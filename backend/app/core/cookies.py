"""Refresh/CSRF cookie helpers and Bearer access response header."""

from __future__ import annotations

from fastapi import Response

from app.core.config import settings

REFRESH_COOKIE = "refresh_token"
CSRF_COOKIE = "csrf_token"


def _cookie_common() -> dict:
    # SameSite=None requires Secure; fall back to Lax for local HTTP / TestClient.
    secure = settings.cookie_secure
    samesite = settings.COOKIE_SAMESITE if secure else "lax"
    return {
        "secure": secure,
        "samesite": samesite,
        "path": "/",
    }


def set_access_header(response: Response, access_token: str) -> None:
    """Put the access JWT on the response as ``Authorization: Bearer …``."""
    response.headers["Authorization"] = f"Bearer {access_token}"


def set_refresh_cookies(
    response: Response,
    *,
    refresh_token: str,
    csrf_token: str,
) -> None:
    """Set HttpOnly refresh and readable CSRF cookies."""
    common = _cookie_common()
    refresh_max = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    response.set_cookie(
        REFRESH_COOKIE,
        refresh_token,
        httponly=True,
        max_age=refresh_max,
        **common,
    )
    response.set_cookie(
        CSRF_COOKIE,
        csrf_token,
        httponly=False,
        max_age=refresh_max,
        **common,
    )


def clear_auth_cookies(response: Response) -> None:
    """Expire refresh and CSRF cookies."""
    common = _cookie_common()
    for name in (REFRESH_COOKIE, CSRF_COOKIE):
        response.delete_cookie(name, **common)
