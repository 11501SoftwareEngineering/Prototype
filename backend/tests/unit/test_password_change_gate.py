"""Unit tests for must_change_password path gating."""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.deps import get_current_active_user


def test_get_current_active_user_password_gate() -> None:
    current_user = SimpleNamespace(
        password=SimpleNamespace(must_change_password=True),
    )
    blocked = SimpleNamespace(url=SimpleNamespace(path="/api/v1/admin/teachers"))
    with pytest.raises(HTTPException) as exc:
        asyncio.run(get_current_active_user(blocked, current_user))  # type: ignore[arg-type]
    assert exc.value.status_code == 403

    for path in ("/api/v1/users/me", "/api/v1/auth/password", "/api/v1/auth/logout"):
        allowed = SimpleNamespace(url=SimpleNamespace(path=path))
        assert (
            asyncio.run(get_current_active_user(allowed, current_user))  # type: ignore[arg-type]
            is current_user
        )
