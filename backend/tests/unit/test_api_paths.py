"""Unit tests for API path helpers and auth path policy sets."""

from __future__ import annotations

from app.core.api_paths import API_V1_PREFIX, api_v1, normalize_path, path_is_exempt
from app.core.auth_policies import CSRF_PROTECTED_PATHS, PASSWORD_CHANGE_EXEMPT_PATHS


def test_api_v1_builds_absolute_paths() -> None:
    assert api_v1("auth", "login") == f"{API_V1_PREFIX}/auth/login"
    assert api_v1() == API_V1_PREFIX


def test_csrf_protected_includes_logout() -> None:
    assert normalize_path(api_v1("auth", "logout")) in CSRF_PROTECTED_PATHS


def test_password_change_exempt_paths() -> None:
    assert path_is_exempt("/api/v1/users/me", PASSWORD_CHANGE_EXEMPT_PATHS)
    assert path_is_exempt("/api/v1/users/me/", PASSWORD_CHANGE_EXEMPT_PATHS)
    assert not path_is_exempt("/api/v1/admin/teachers", PASSWORD_CHANGE_EXEMPT_PATHS)
