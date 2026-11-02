"""Unit tests for auth service error branches (no database)."""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException, Response
from sqlalchemy.exc import IntegrityError

from app.core.enums import UserRole
from app.schemas.auth import LoginRequest, RegisterRequest
from app.services import auth as auth_service


@dataclass
class _FakePassword:
    password_hash: str
    must_change_password: bool = False


@dataclass
class _FakeUser:
    id: uuid.UUID
    account_id: str
    name: str
    role: str
    password: _FakePassword | None
    languages: list = field(default_factory=list)


def test_register_integrity_error_maps_to_400(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.services.auth.user.get_user_by_account",
        AsyncMock(return_value=None),
    )
    monkeypatch.setattr(
        "app.services.auth.user.create_user",
        AsyncMock(side_effect=IntegrityError("stmt", {}, Exception("dup"))),
    )
    db = AsyncMock()
    db.rollback = AsyncMock()

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            auth_service.register_user(
                db,
                RegisterRequest(account="dup", password="password1", name="Dup"),
            )
        )
    assert exc.value.status_code == 400
    db.rollback.assert_awaited_once()


def test_register_rejects_reserved_super_admin_account(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.services.auth.is_reserved_super_admin_account",
        lambda _account: True,
    )
    get_user = AsyncMock()
    monkeypatch.setattr("app.services.auth.user.get_user_by_account", get_user)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            auth_service.register_user(
                AsyncMock(),
                RegisterRequest(account="boss", password="password1", name="Boss"),
            )
        )
    assert exc.value.status_code == 400
    assert exc.value.detail == "Account name reserved"
    get_user.assert_not_awaited()


def test_login_rejects_user_without_password(monkeypatch: pytest.MonkeyPatch) -> None:
    user = _FakeUser(
        id=uuid.uuid4(),
        account_id="nopw",
        name="No Password",
        role=UserRole.USER.value,
        password=None,
    )
    monkeypatch.setattr(
        "app.services.auth.user.get_user_by_account",
        AsyncMock(return_value=user),
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            auth_service.login_user(
                AsyncMock(),
                LoginRequest(account="nopw", password="password1"),
                Response(),
            )
        )
    assert exc.value.status_code == 401


def test_profile_rejects_user_without_password() -> None:
    user = _FakeUser(
        id=uuid.uuid4(),
        account_id="nopw",
        name="No Password",
        role=UserRole.USER.value,
        password=None,
    )
    with pytest.raises(HTTPException) as exc:
        asyncio.run(auth_service.get_current_user_profile(user))  # type: ignore[arg-type]
    assert exc.value.status_code == 401


def test_logout_without_refresh_cookie_still_clears(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cleared: list[object] = []
    monkeypatch.setattr(
        "app.services.auth.clear_auth_cookies",
        lambda response: cleared.append(response),
    )
    request = SimpleNamespace(cookies={})
    response = Response()
    asyncio.run(auth_service.logout_user(AsyncMock(), request, response))  # type: ignore[arg-type]
    assert cleared == [response]
