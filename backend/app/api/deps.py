"""FastAPI ``Depends`` entrypoints for auth and shared resources."""

from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.authz import enforce_must_change_password, is_super_admin
from app.core.cookies import (
    REFRESH_COOKIE,
    set_access_header,
    set_refresh_cookies,
)
from app.core.database import get_db
from app.core.enums import UserRole
from app.core.exceptions import AuthRequired
from app.core.http_methods import SAFE_RENEW_METHODS
from app.core.redis import get_redis
from app.core.security import create_access_token, decode_access_token
from app.crud import auth, user
from app.crud.auth import RenewOutcome
from app.models.user import User

__all__ = [
    "ActiveUser",
    "CurrentUser",
    "SuperAdminUser",
    "get_current_active_user",
    "get_current_user",
    "get_db",
    "get_redis",
    "require_super_admin",
]


def _bearer_token(request: Request) -> str | None:
    header = request.headers.get("Authorization")
    if header is None:
        return None
    scheme, _, value = header.partition(" ")
    if scheme.lower() != "bearer" or not value:
        return None
    return value.strip() or None


def _user_id_from_access(access: str) -> UUID | None:
    try:
        payload = decode_access_token(access)
        return UUID(str(payload["sub"]))
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


async def get_current_user(
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Resolve the user from Bearer access; silent-renew on GET/HEAD only.

    Writes never renew from the refresh cookie (expired Bearer → 401).

    Raises:
        AuthRequired: if Bearer is missing/invalid and renew is not allowed.
    """
    access = _bearer_token(request)
    if access:
        user_id = _user_id_from_access(access)
        if user_id is not None:
            current_user = await user.get_user_by_id(db, user_id)
            if current_user is not None:
                return current_user

    if request.method not in SAFE_RENEW_METHODS:
        raise AuthRequired()

    refresh_cookie = request.cookies.get(REFRESH_COOKIE)
    if not refresh_cookie:
        raise AuthRequired()

    renew_cookie = await auth.renew_with_lock(refresh_cookie)
    if renew_cookie.outcome is RenewOutcome.REJECTED or renew_cookie.user_id is None:
        raise AuthRequired(clear_cookies=True)

    current_user = await user.get_user_by_id(db, renew_cookie.user_id)
    if current_user is None:
        raise AuthRequired(clear_cookies=True)

    access_jwt = create_access_token(
        subject=current_user.id, role=UserRole(current_user.role)
    )
    set_access_header(response, access_jwt)
    if (
        renew_cookie.outcome is RenewOutcome.ROTATED
        and renew_cookie.raw_refresh
        and renew_cookie.raw_csrf
    ):
        set_refresh_cookies(
            response,
            refresh_token=renew_cookie.raw_refresh,
            csrf_token=renew_cookie.raw_csrf,
        )

    return current_user


async def get_current_active_user(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Authenticated user under the password-change gate."""
    enforce_must_change_password(current_user, path=request.url.path)
    return current_user


async def require_super_admin(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> User:
    """Require config elevation (``SUPER_ADMIN_ACCOUNTS``), not API ``role``."""
    if not is_super_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user


CurrentUser = Annotated[User, Depends(get_current_user)]
ActiveUser = Annotated[User, Depends(get_current_active_user)]
SuperAdminUser = Annotated[User, Depends(require_super_admin)]
