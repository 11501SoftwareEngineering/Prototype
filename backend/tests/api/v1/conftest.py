"""Shared fake-store fixtures for auth and admin API tests."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.enums import UserRole
from app.core.redis import get_redis
from app.core.security import hash_password
from app.crud.auth import RenewOutcome, RenewResult
from app.main import app


@dataclass
class FakePassword:
    password_hash: str
    must_change_password: bool = False


@dataclass
class FakeLanguage:
    code: str


@dataclass
class FakeUserLanguage:
    language: FakeLanguage


@dataclass
class FakeUser:
    id: uuid.UUID
    account_id: str
    name: str
    role: str
    password: FakePassword
    languages: list[FakeUserLanguage] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))


class FakeStore:
    def __init__(self) -> None:
        self.users_by_account: dict[str, FakeUser] = {}
        self.users_by_id: dict[uuid.UUID, FakeUser] = {}
        self.refresh_by_raw: dict[str, uuid.UUID] = {}


@pytest.fixture
def store() -> FakeStore:
    return FakeStore()


@pytest.fixture
def auth_client(client: TestClient, store: FakeStore, monkeypatch: pytest.MonkeyPatch):
    async def fake_get_user_by_account(_db, account_id: str):
        return store.users_by_account.get(account_id)

    async def fake_get_user_by_id(_db, user_id: uuid.UUID):
        return store.users_by_id.get(user_id)

    async def fake_create_user(
        _db,
        *,
        account_id: str,
        name: str,
        password: str,
        role: UserRole = UserRole.USER,
        must_change_password: bool = False,
    ):
        user = FakeUser(
            id=uuid.uuid4(),
            account_id=account_id,
            name=name,
            role=role.value,
            password=FakePassword(
                password_hash=hash_password(password),
                must_change_password=must_change_password,
            ),
            languages=[FakeUserLanguage(language=FakeLanguage(code="zh-TW"))],
        )
        store.users_by_account[account_id] = user
        store.users_by_id[user.id] = user
        return user

    def fake_preferred_language_code(user: FakeUser) -> str:
        if user.languages:
            return user.languages[0].language.code
        return "zh-TW"

    async def fake_create_refresh(_db, user_id: uuid.UUID) -> str:
        raw = f"refresh-{user_id}"
        store.refresh_by_raw[raw] = user_id
        return raw

    async def fake_get_user_id(_db, raw_refresh: str):
        return store.refresh_by_raw.get(raw_refresh)

    async def fake_get_active_user_id(_db, raw_refresh: str):
        return store.refresh_by_raw.get(raw_refresh)

    async def fake_revoke_all(_db, user_id: uuid.UUID) -> None:
        store.refresh_by_raw = {
            k: v for k, v in store.refresh_by_raw.items() if v != user_id
        }

    async def fake_renew(raw_refresh: str) -> RenewResult:
        user_id = store.refresh_by_raw.get(raw_refresh)
        if user_id is None:
            return RenewResult(outcome=RenewOutcome.REJECTED)
        new_raw = f"refresh-{user_id}-rotated"
        store.refresh_by_raw.pop(raw_refresh, None)
        store.refresh_by_raw[new_raw] = user_id
        return RenewResult(
            outcome=RenewOutcome.ROTATED,
            user_id=user_id,
            raw_refresh=new_raw,
            raw_csrf="csrf-rotated",
        )

    async def fake_update_password(
        _db,
        current_user: FakeUser,
        *,
        new_password: str,
        must_change_password: bool = False,
    ):
        current_user.password.password_hash = hash_password(new_password)
        current_user.password.must_change_password = must_change_password
        return current_user

    async def fake_list_users_by_role(_db, role: UserRole):
        return [u for u in store.users_by_id.values() if u.role == role.value]

    async def fake_delete_teacher(_db, current_user: FakeUser) -> None:
        if current_user.role != UserRole.TEACHER.value:
            raise ValueError("only TEACHER accounts may be deleted")
        store.users_by_account.pop(current_user.account_id, None)
        store.users_by_id.pop(current_user.id, None)
        store.refresh_by_raw = {
            k: v for k, v in store.refresh_by_raw.items() if v != current_user.id
        }

    monkeypatch.setattr("app.crud.user.get_user_by_account", fake_get_user_by_account)
    monkeypatch.setattr("app.crud.user.get_user_by_id", fake_get_user_by_id)
    monkeypatch.setattr("app.crud.user.create_user", fake_create_user)
    monkeypatch.setattr("app.crud.user.update_password", fake_update_password)
    monkeypatch.setattr("app.crud.user.list_users_by_role", fake_list_users_by_role)
    monkeypatch.setattr("app.crud.user.delete_teacher", fake_delete_teacher)
    monkeypatch.setattr(
        "app.crud.user.preferred_language_code", fake_preferred_language_code
    )
    monkeypatch.setattr("app.crud.auth.create_refresh_token", fake_create_refresh)
    monkeypatch.setattr("app.crud.auth.get_user_id_for_refresh", fake_get_user_id)
    monkeypatch.setattr(
        "app.crud.auth.get_active_user_id_for_refresh", fake_get_active_user_id
    )
    monkeypatch.setattr("app.crud.auth.revoke_all_for_user", fake_revoke_all)
    monkeypatch.setattr("app.crud.auth.renew_with_lock", fake_renew)

    class _Db:
        pass

    class _Redis:
        async def ping(self) -> bool:
            return True

    async def provide_db():
        return _Db()

    async def provide_redis():
        return _Redis()

    app.dependency_overrides[get_db] = provide_db
    app.dependency_overrides[get_redis] = provide_redis
    yield client
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_redis, None)


def seed_user(
    store: FakeStore,
    *,
    account_id: str,
    password: str = "password1",
    name: str = "User",
    role: UserRole = UserRole.USER,
    must_change_password: bool = False,
) -> FakeUser:
    """Insert a user into the fake store (bypasses public register)."""
    user = FakeUser(
        id=uuid.uuid4(),
        account_id=account_id,
        name=name,
        role=role.value,
        password=FakePassword(
            password_hash=hash_password(password),
            must_change_password=must_change_password,
        ),
        languages=[FakeUserLanguage(language=FakeLanguage(code="zh-TW"))],
    )
    store.users_by_account[account_id] = user
    store.users_by_id[user.id] = user
    return user


def bearer_from(response) -> str:
    value = response.headers.get("authorization")
    assert value is not None
    assert value.lower().startswith("bearer ")
    return value
