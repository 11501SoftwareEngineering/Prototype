"""Unit tests for admin teacher service error branches (no database)."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.schemas.admin import TeacherCreateRequest
from app.services import admin_teachers as admin_teachers_service


def test_create_teacher_integrity_error_maps_to_400(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.services.admin_teachers.is_reserved_super_admin_account",
        lambda _account: False,
    )
    monkeypatch.setattr(
        "app.services.admin_teachers.user.get_user_by_account",
        AsyncMock(return_value=None),
    )
    monkeypatch.setattr(
        "app.services.admin_teachers.generate_initial_password",
        lambda: "generated-password",
    )
    monkeypatch.setattr(
        "app.services.admin_teachers.user.create_user",
        AsyncMock(side_effect=IntegrityError("stmt", {}, Exception("dup"))),
    )
    db = AsyncMock()
    db.rollback = AsyncMock()

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            admin_teachers_service.create_teacher(
                db,
                TeacherCreateRequest(account="race", name="Race"),
            )
        )
    assert exc.value.status_code == 400
    assert exc.value.detail == "Account already exists"
    db.rollback.assert_awaited_once()
