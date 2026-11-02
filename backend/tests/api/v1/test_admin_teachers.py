"""Admin teacher API tests (fake store; no PostgreSQL)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.enums import UserRole
from app.core.yaml_config import yaml_config
from tests.api.v1.conftest import FakeStore, bearer_from, seed_user


@pytest.fixture
def elevated_client(
    auth_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> TestClient:
    monkeypatch.setattr(yaml_config, "SUPER_ADMIN_ACCOUNTS", ["admin"])
    return auth_client


def _login(client: TestClient, account: str, password: str = "password1") -> str:
    login = client.post(
        "/api/v1/auth/login",
        json={"account": account, "password": password},
    )
    assert login.status_code == 200
    return bearer_from(login)


def _seed_admin_and_login(
    client: TestClient,
    store: FakeStore,
    account: str = "admin",
    password: str = "password1",
) -> str:
    """Bootstrap an elevated admin without public register (reserved names)."""
    seed_user(store, account_id=account, password=password, name="Admin")
    return _login(client, account, password)


def _register_and_login(
    client: TestClient, account: str, password: str = "password1", name: str = "User"
) -> str:
    client.post(
        "/api/v1/auth/register",
        json={"account": account, "password": password, "name": name},
    )
    return _login(client, account, password)


def test_elevated_user_lists_teachers(
    elevated_client: TestClient, store: FakeStore
) -> None:
    bearer = _seed_admin_and_login(elevated_client, store)

    listed = elevated_client.get(
        "/api/v1/admin/teachers",
        headers={"Authorization": bearer},
    )
    assert listed.status_code == 200
    assert listed.json() == []


def test_non_elevated_forbidden(elevated_client: TestClient) -> None:
    bearer = _register_and_login(elevated_client, "peon")
    response = elevated_client.post(
        "/api/v1/admin/teachers",
        headers={"Authorization": bearer},
        json={"account": "t1", "name": "Teacher"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Admin privileges required"


def test_admin_unauthenticated(elevated_client: TestClient) -> None:
    assert elevated_client.get("/api/v1/admin/teachers").status_code == 401


def test_register_reserved_super_admin_account(
    elevated_client: TestClient,
) -> None:
    response = elevated_client.post(
        "/api/v1/auth/register",
        json={"account": "admin", "password": "password1", "name": "Squat"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Account name reserved"


def test_create_teacher_reserved_account_name(
    elevated_client: TestClient, store: FakeStore
) -> None:
    admin_bearer = _seed_admin_and_login(elevated_client, store)
    response = elevated_client.post(
        "/api/v1/admin/teachers",
        headers={"Authorization": admin_bearer},
        json={"account": "admin", "name": "Should Fail"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Account name reserved"


def test_create_list_delete_teacher(
    elevated_client: TestClient, store: FakeStore
) -> None:
    admin_bearer = _seed_admin_and_login(elevated_client, store)

    created = elevated_client.post(
        "/api/v1/admin/teachers",
        headers={"Authorization": admin_bearer},
        json={"account": "teach1", "name": "Teach One"},
    )
    assert created.status_code == 200
    body = created.json()
    assert body["account"] == "teach1"
    assert body["role"] == "TEACHER"
    assert "message" in body
    initial_password = body["password"]
    assert isinstance(initial_password, str) and len(initial_password) >= 8

    listed = elevated_client.get(
        "/api/v1/admin/teachers",
        headers={"Authorization": admin_bearer},
    )
    assert listed.status_code == 200
    teachers = listed.json()
    assert len(teachers) == 1
    assert teachers[0]["account"] == "teach1"
    teacher_id = teachers[0]["id"]

    teacher_login = elevated_client.post(
        "/api/v1/auth/login",
        json={"account": "teach1", "password": initial_password},
    )
    assert teacher_login.status_code == 200
    assert teacher_login.json()["role"] == "TEACHER"
    assert teacher_login.json()["must_change_password"] is True

    deleted = elevated_client.delete(
        f"/api/v1/admin/teachers/{teacher_id}",
        headers={"Authorization": admin_bearer},
    )
    assert deleted.status_code == 204
    assert deleted.content == b""
    assert (
        elevated_client.get(
            "/api/v1/admin/teachers",
            headers={"Authorization": admin_bearer},
        ).json()
        == []
    )
    assert (
        elevated_client.post(
            "/api/v1/auth/login",
            json={"account": "teach1", "password": initial_password},
        ).status_code
        == 401
    )


def test_create_teacher_duplicate(
    elevated_client: TestClient, store: FakeStore
) -> None:
    admin_bearer = _seed_admin_and_login(elevated_client, store)
    payload = {"account": "dup", "name": "Dup"}
    assert (
        elevated_client.post(
            "/api/v1/admin/teachers",
            headers={"Authorization": admin_bearer},
            json=payload,
        ).status_code
        == 200
    )
    again = elevated_client.post(
        "/api/v1/admin/teachers",
        headers={"Authorization": admin_bearer},
        json=payload,
    )
    assert again.status_code == 400


def test_delete_unknown_or_non_teacher(
    elevated_client: TestClient, store: FakeStore
) -> None:
    admin_bearer = _seed_admin_and_login(elevated_client, store)
    missing = elevated_client.delete(
        "/api/v1/admin/teachers/00000000-0000-0000-0000-000000000001",
        headers={"Authorization": admin_bearer},
    )
    assert missing.status_code == 404

    user_id = next(iter(store.users_by_id))
    not_teacher = elevated_client.delete(
        f"/api/v1/admin/teachers/{user_id}",
        headers={"Authorization": admin_bearer},
    )
    assert not_teacher.status_code == 404


def test_delete_elevated_teacher_forbidden(
    elevated_client: TestClient,
    store: FakeStore,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    admin_bearer = _seed_admin_and_login(elevated_client, store)
    elevated_teacher = seed_user(
        store,
        account_id="elevated-teacher",
        name="Elevated Teacher",
        role=UserRole.TEACHER,
    )
    monkeypatch.setattr(
        yaml_config,
        "SUPER_ADMIN_ACCOUNTS",
        ["admin", "elevated-teacher"],
    )

    response = elevated_client.delete(
        f"/api/v1/admin/teachers/{elevated_teacher.id}",
        headers={"Authorization": admin_bearer},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Cannot delete elevated admin account"
    assert "elevated-teacher" in store.users_by_account


def test_teacher_must_change_password_gate(
    elevated_client: TestClient,
    store: FakeStore,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    admin_bearer = _seed_admin_and_login(elevated_client, store)
    created = elevated_client.post(
        "/api/v1/admin/teachers",
        headers={"Authorization": admin_bearer},
        json={"account": "gated", "name": "Gated"},
    )
    assert created.status_code == 200
    initial_password = created.json()["password"]

    teacher_login = elevated_client.post(
        "/api/v1/auth/login",
        json={"account": "gated", "password": initial_password},
    )
    teacher_bearer = bearer_from(teacher_login)
    assert teacher_login.json()["must_change_password"] is True

    blocked = elevated_client.get(
        "/api/v1/admin/teachers",
        headers={"Authorization": teacher_bearer},
    )
    assert blocked.status_code == 403
    assert blocked.json()["detail"] == "Password change required"

    me = elevated_client.get(
        "/api/v1/users/me",
        headers={"Authorization": teacher_bearer},
    )
    assert me.status_code == 200
    assert me.json()["must_change_password"] is True

    changed = elevated_client.put(
        "/api/v1/auth/password",
        headers={"Authorization": teacher_bearer},
        json={"old_password": initial_password, "new_password": "password2"},
    )
    assert changed.status_code == 200

    monkeypatch.setattr(yaml_config, "SUPER_ADMIN_ACCOUNTS", ["admin", "gated"])
    allowed = elevated_client.get(
        "/api/v1/admin/teachers",
        headers={"Authorization": teacher_bearer},
    )
    assert allowed.status_code == 200

    relogin = elevated_client.post(
        "/api/v1/auth/login",
        json={"account": "gated", "password": "password2"},
    )
    assert relogin.json()["must_change_password"] is False
