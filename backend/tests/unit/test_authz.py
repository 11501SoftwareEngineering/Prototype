"""Unit tests for config-based super-admin elevation."""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.deps import require_super_admin
from app.core.authz import is_reserved_super_admin_account, is_super_admin
from app.core.yaml_config import yaml_config


def test_is_super_admin_uses_yaml_config(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(yaml_config, "SUPER_ADMIN_ACCOUNTS", ["boss"])
    assert is_super_admin(SimpleNamespace(account_id="boss")) is True
    assert is_super_admin(SimpleNamespace(account_id="peon")) is False


def test_is_reserved_super_admin_account(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(yaml_config, "SUPER_ADMIN_ACCOUNTS", ["boss"])
    assert is_reserved_super_admin_account("boss") is True
    assert is_reserved_super_admin_account("peon") is False


def test_require_super_admin(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(yaml_config, "SUPER_ADMIN_ACCOUNTS", ["boss"])
    ok = SimpleNamespace(account_id="boss")
    assert asyncio.run(require_super_admin(ok)) is ok  # type: ignore[arg-type]

    with pytest.raises(HTTPException) as exc:
        asyncio.run(require_super_admin(SimpleNamespace(account_id="peon")))  # type: ignore[arg-type]
    assert exc.value.status_code == 403
