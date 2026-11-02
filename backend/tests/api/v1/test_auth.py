"""Auth API tests with an in-memory fake user store (no PostgreSQL required)."""

from __future__ import annotations

import asyncio
import uuid
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.api import deps as deps_mod
from app.core.auth_policies import (
    CURRENT_PASSWORD_INCORRECT_DETAIL,
    NEW_PASSWORD_SAME_AS_CURRENT_DETAIL,
    PASSWORD_CHANGE_EXEMPT_PATHS,
)
from app.core.cookies import CSRF_COOKIE, REFRESH_COOKIE
from app.core.enums import UserRole
from app.core.exceptions import AuthRequired
from app.core.security import create_access_token, hash_password, verify_password
from app.crud.auth import RenewResult
from tests.api.v1.conftest import (
    FakePassword,
    FakeStore,
    FakeUser,
    bearer_from,
    seed_user,
)


def test_register_login_and_me(auth_client: TestClient) -> None:
    register = auth_client.post(
        "/api/v1/auth/register",
        json={"account": "alice", "password": "password1", "name": "Alice"},
    )
    assert register.status_code == 200
    body = register.json()
    assert body["account"] == "alice"
    assert body["role"] == "USER"
    assert "message" in body
    assert "access_token" not in body

    login = auth_client.post(
        "/api/v1/auth/login",
        json={"account": "alice", "password": "password1"},
    )
    assert login.status_code == 200
    token_body = login.json()
    assert "access_token" not in token_body
    assert token_body["must_change_password"] is False
    assert token_body["preferred_language"] == "zh-TW"
    assert token_body["role"] == "USER"
    assert "access_token" not in auth_client.cookies
    assert REFRESH_COOKIE in auth_client.cookies
    assert CSRF_COOKIE in auth_client.cookies
    bearer = bearer_from(login)

    me = auth_client.get(
        "/api/v1/users/me",
        headers={"Authorization": bearer},
    )
    assert me.status_code == 200
    assert me.json() == {
        "account": "alice",
        "name": "Alice",
        "role": "USER",
        "preferred_language": "zh-TW",
        "must_change_password": False,
    }


def test_me_silent_renew_on_get_without_bearer(auth_client: TestClient) -> None:
    auth_client.post(
        "/api/v1/auth/register",
        json={"account": "renew", "password": "password1", "name": "Renew"},
    )
    auth_client.post(
        "/api/v1/auth/login",
        json={"account": "renew", "password": "password1"},
    )
    me = auth_client.get("/api/v1/users/me")
    assert me.status_code == 200
    assert me.json()["account"] == "renew"
    bearer_from(me)


def test_register_duplicate_account(auth_client: TestClient) -> None:
    payload = {"account": "bob", "password": "password1", "name": "Bob"}
    assert auth_client.post("/api/v1/auth/register", json=payload).status_code == 200
    again = auth_client.post("/api/v1/auth/register", json=payload)
    assert again.status_code == 400


def test_login_wrong_password(auth_client: TestClient) -> None:
    auth_client.post(
        "/api/v1/auth/register",
        json={"account": "carol", "password": "password1", "name": "Carol"},
    )
    response = auth_client.post(
        "/api/v1/auth/login",
        json={"account": "carol", "password": "wrong-pass"},
    )
    assert response.status_code == 401


def test_me_requires_auth(auth_client: TestClient) -> None:
    assert auth_client.get("/api/v1/users/me").status_code == 401


def test_logout_clears_session(auth_client: TestClient) -> None:
    auth_client.post(
        "/api/v1/auth/register",
        json={"account": "dave", "password": "password1", "name": "Dave"},
    )
    auth_client.post(
        "/api/v1/auth/login",
        json={"account": "dave", "password": "password1"},
    )
    csrf = auth_client.cookies.get(CSRF_COOKIE)
    assert csrf
    out = auth_client.post(
        "/api/v1/auth/logout",
        headers={"X-CSRF-Token": csrf},
    )
    assert out.status_code == 200
    assert auth_client.get("/api/v1/users/me").status_code == 401


def test_logout_csrf_mismatch_forbidden(auth_client: TestClient) -> None:
    auth_client.post(
        "/api/v1/auth/register",
        json={"account": "erin", "password": "password1", "name": "Erin"},
    )
    auth_client.post(
        "/api/v1/auth/login",
        json={"account": "erin", "password": "password1"},
    )
    out = auth_client.post(
        "/api/v1/auth/logout",
        headers={"X-CSRF-Token": "not-the-cookie"},
    )
    assert out.status_code == 403


def test_logout_missing_csrf_cookie_forbidden(auth_client: TestClient) -> None:
    auth_client.post(
        "/api/v1/auth/register",
        json={"account": "frank", "password": "password1", "name": "Frank"},
    )
    auth_client.post(
        "/api/v1/auth/login",
        json={"account": "frank", "password": "password1"},
    )
    auth_client.cookies.pop(CSRF_COOKIE, None)
    out = auth_client.post("/api/v1/auth/logout")
    assert out.status_code == 403


def test_me_rejected_refresh_clears_cookies(auth_client: TestClient) -> None:
    auth_client.post(
        "/api/v1/auth/register",
        json={"account": "gina", "password": "password1", "name": "Gina"},
    )
    auth_client.post(
        "/api/v1/auth/login",
        json={"account": "gina", "password": "password1"},
    )
    auth_client.cookies.set(REFRESH_COOKIE, "not-a-real-refresh")
    response = auth_client.get("/api/v1/users/me")
    assert response.status_code == 401
    set_cookie = ";".join(response.headers.get_list("set-cookie")).lower()
    assert REFRESH_COOKIE in set_cookie
    assert "max-age=0" in set_cookie


def test_write_method_does_not_silent_renew(
    store: FakeStore, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = FakeUser(
        id=uuid.uuid4(),
        account_id="post-user",
        name="Post",
        role=UserRole.USER.value,
        password=FakePassword(password_hash=hash_password("password1")),
    )
    store.users_by_id[user.id] = user
    raw = f"refresh-{user.id}"
    store.refresh_by_raw[raw] = user.id

    async def fake_get_user_by_id(_db, user_id: uuid.UUID):
        return store.users_by_id.get(user_id)

    async def fake_renew(raw_refresh: str) -> RenewResult:
        raise AssertionError("renew must not run on POST")

    monkeypatch.setattr("app.crud.user.get_user_by_id", fake_get_user_by_id)
    monkeypatch.setattr("app.crud.auth.renew_with_lock", fake_renew)

    request = SimpleNamespace(
        method="POST",
        headers={},
        cookies={REFRESH_COOKIE: raw},
    )
    response = SimpleNamespace(headers={})
    with pytest.raises(AuthRequired):
        asyncio.run(
            deps_mod.get_current_user(request, response, db=object())  # type: ignore[arg-type]
        )


def test_password_hash_roundtrip() -> None:
    hashed = hash_password("password1")
    assert verify_password("password1", hashed)
    assert not verify_password("nope", hashed)
    token = create_access_token(subject=uuid.uuid4(), role=UserRole.USER)
    assert isinstance(token, str) and token


def test_change_password_success(auth_client: TestClient, store: FakeStore) -> None:
    auth_client.post(
        "/api/v1/auth/register",
        json={"account": "pwduser", "password": "password1", "name": "Pwd"},
    )
    login = auth_client.post(
        "/api/v1/auth/login",
        json={"account": "pwduser", "password": "password1"},
    )
    bearer = bearer_from(login)
    assert store.refresh_by_raw  # session established

    changed = auth_client.put(
        "/api/v1/auth/password",
        headers={"Authorization": bearer},
        json={"old_password": "password1", "new_password": "password2"},
    )
    assert changed.status_code == 200
    assert changed.json()["message"]
    assert store.refresh_by_raw == {}  # prior refresh sessions revoked

    # Cookie silent-renew must fail after revoke (no Authorization header).
    assert auth_client.get("/api/v1/users/me").status_code == 401

    assert (
        auth_client.post(
            "/api/v1/auth/login",
            json={"account": "pwduser", "password": "password1"},
        ).status_code
        == 401
    )
    assert (
        auth_client.post(
            "/api/v1/auth/login",
            json={"account": "pwduser", "password": "password2"},
        ).status_code
        == 200
    )


def test_must_change_password_gate_cleared_after_change(
    auth_client: TestClient,
    store: FakeStore,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Forced-change user is gated, then cleared after PUT /auth/password."""
    seed_user(
        store,
        account_id="forced",
        password="password1",
        name="Forced",
        must_change_password=True,
    )
    # Leave /auth/password exempt; make /users/me gated for this assertion.
    monkeypatch.setattr(
        "app.core.authz.PASSWORD_CHANGE_EXEMPT_PATHS",
        frozenset(
            path
            for path in PASSWORD_CHANGE_EXEMPT_PATHS
            if not path.endswith("/users/me")
        ),
    )

    login = auth_client.post(
        "/api/v1/auth/login",
        json={"account": "forced", "password": "password1"},
    )
    assert login.status_code == 200
    assert login.json()["must_change_password"] is True
    bearer = bearer_from(login)

    blocked = auth_client.get(
        "/api/v1/users/me",
        headers={"Authorization": bearer},
    )
    assert blocked.status_code == 403
    assert blocked.json()["detail"] == "Password change required"

    changed = auth_client.put(
        "/api/v1/auth/password",
        headers={"Authorization": bearer},
        json={"old_password": "password1", "new_password": "password2"},
    )
    assert changed.status_code == 200

    # Re-login after revoke; flag must be clear and /me unblocked.
    relogin = auth_client.post(
        "/api/v1/auth/login",
        json={"account": "forced", "password": "password2"},
    )
    assert relogin.status_code == 200
    assert relogin.json()["must_change_password"] is False
    new_bearer = bearer_from(relogin)

    me = auth_client.get(
        "/api/v1/users/me",
        headers={"Authorization": new_bearer},
    )
    assert me.status_code == 200
    assert me.json()["must_change_password"] is False


def test_change_password_wrong_old(auth_client: TestClient) -> None:
    auth_client.post(
        "/api/v1/auth/register",
        json={"account": "pwdbad", "password": "password1", "name": "Pwd"},
    )
    login = auth_client.post(
        "/api/v1/auth/login",
        json={"account": "pwdbad", "password": "password1"},
    )
    bearer = bearer_from(login)
    response = auth_client.put(
        "/api/v1/auth/password",
        headers={"Authorization": bearer},
        json={"old_password": "wrong-pass", "new_password": "password2"},
    )
    assert response.status_code == 400
    assert response.json() == {"detail": CURRENT_PASSWORD_INCORRECT_DETAIL}


def test_change_password_rejects_same_as_current(auth_client: TestClient) -> None:
    auth_client.post(
        "/api/v1/auth/register",
        json={"account": "pwdsame", "password": "password1", "name": "Pwd"},
    )
    login = auth_client.post(
        "/api/v1/auth/login",
        json={"account": "pwdsame", "password": "password1"},
    )
    bearer = bearer_from(login)
    response = auth_client.put(
        "/api/v1/auth/password",
        headers={"Authorization": bearer},
        json={"old_password": "password1", "new_password": "password1"},
    )
    assert response.status_code == 400
    assert response.json() == {"detail": NEW_PASSWORD_SAME_AS_CURRENT_DETAIL}


def test_change_password_validation(auth_client: TestClient) -> None:
    auth_client.post(
        "/api/v1/auth/register",
        json={"account": "pwdval", "password": "password1", "name": "Pwd"},
    )
    login = auth_client.post(
        "/api/v1/auth/login",
        json={"account": "pwdval", "password": "password1"},
    )
    bearer = bearer_from(login)
    response = auth_client.put(
        "/api/v1/auth/password",
        headers={"Authorization": bearer},
        json={"old_password": "password1", "new_password": "short"},
    )
    assert response.status_code == 422
    err = response.json()["detail"][0]
    assert err["loc"] == ["body", "new_password"]
    assert "input" not in err


def test_register_422_redacts_password_on_sibling_field_error(
    auth_client: TestClient,
) -> None:
    response = auth_client.post(
        "/api/v1/auth/register",
        json={"account": "nopath", "password": "password1"},
    )
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert any(err.get("loc") == ["body", "name"] for err in detail)
    for err in detail:
        inp = err.get("input")
        if isinstance(inp, dict):
            assert "password" not in inp
