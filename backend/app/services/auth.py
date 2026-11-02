from __future__ import annotations

from fastapi import HTTPException, Request, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.auth_policies import (
    AUTH_UNAUTHORIZED_DETAIL,
    CURRENT_PASSWORD_INCORRECT_DETAIL,
    NEW_PASSWORD_SAME_AS_CURRENT_DETAIL,
)
from app.core.authz import is_reserved_super_admin_account
from app.core.cookies import (
    REFRESH_COOKIE,
    clear_auth_cookies,
    set_access_header,
    set_refresh_cookies,
)
from app.core.enums import UserRole
from app.core.security import (
    DUMMY_PASSWORD_HASH,
    create_access_token,
    generate_opaque_token,
    verify_password,
)
from app.crud import auth, user
from app.models.user import User
from app.schemas.auth import (
    CurrentUserResponse,
    LoginRequest,
    LoginResponse,
    PasswordChangeRequest,
    PasswordChangeResponse,
    RegisterRequest,
    RegisterResponse,
)


async def register_user(db: AsyncSession, payload: RegisterRequest) -> RegisterResponse:
    """Create a new USER account or raise if the account already exists.

    Args:
        db: Async SQLAlchemy session.
        payload: Registration body (account, password, name).

    Returns:
        ``RegisterResponse`` with account, name, role, and success message.

    Raises:
        HTTPException: 400 if the account is reserved for config elevation, or
            an account with the same ``account`` already exists.
    """
    if is_reserved_super_admin_account(payload.account):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account name reserved",
        )
    existing_user = await user.get_user_by_account(db, payload.account)
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account already exists",
        )

    try:
        created_user = await user.create_user(
            db,
            account_id=payload.account,
            name=payload.name,
            password=payload.password,
            role=UserRole.USER,
            must_change_password=False,
        )
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account already exists",
        ) from None

    return RegisterResponse(
        account=created_user.account_id,
        name=created_user.name,
        role=UserRole(created_user.role),
        message="Registration successful",
    )


async def login_user(
    db: AsyncSession,
    payload: LoginRequest,
    response: Response,
) -> LoginResponse:
    """Authenticate; set refresh cookies and Bearer access header.

    Args:
        db: Async SQLAlchemy session.
        payload: Login body (account, password).
        response: Used for Set-Cookie and ``Authorization`` header.

    Returns:
        ``LoginResponse`` profile fields (no tokens in JSON).

    Raises:
        HTTPException: 401 if the account is missing or the password is wrong.
    """
    current_user = await user.get_user_by_account(db, payload.account)
    stored_hash = (
        current_user.password.password_hash
        if current_user is not None and current_user.password is not None
        else DUMMY_PASSWORD_HASH
    )
    password_ok = await run_in_threadpool(
        verify_password, payload.password, stored_hash
    )
    if current_user is None or current_user.password is None or not password_ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid account or password",
        )

    role = UserRole(current_user.role)
    access_token = create_access_token(subject=current_user.id, role=role)
    refresh_raw = await auth.create_refresh_token(db, current_user.id)
    csrf = generate_opaque_token()
    set_refresh_cookies(
        response,
        refresh_token=refresh_raw,
        csrf_token=csrf,
    )
    set_access_header(response, access_token)
    return LoginResponse(
        account=current_user.account_id,
        name=current_user.name,
        role=role,
        preferred_language=user.preferred_language_code(current_user),
        must_change_password=current_user.password.must_change_password,
    )


async def logout_user(
    db: AsyncSession,
    request: Request,
    response: Response,
) -> None:
    """Revoke refresh tokens for the cookie session and clear cookies.

    Uses the refresh cookie only (no Bearer required) so expired access can
    still log out. CSRF is enforced by middleware on this path.
    """
    raw = request.cookies.get(REFRESH_COOKIE)
    if raw:
        user_id = await auth.get_user_id_for_refresh(db, raw)
        if user_id is not None:
            await auth.revoke_all_for_user(db, user_id)
    clear_auth_cookies(response)


async def get_current_user_profile(current_user: User) -> CurrentUserResponse:
    """Build the ``/users/me`` response for an authenticated user.

    Args:
        current_user: Authenticated user with password relation loaded.

    Returns:
        ``CurrentUserResponse`` with account, name, role, and preferred language.

    Raises:
        HTTPException: 401 if the user has no password row.
    """
    if current_user.password is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=AUTH_UNAUTHORIZED_DETAIL,
        )
    return CurrentUserResponse(
        account=current_user.account_id,
        name=current_user.name,
        role=UserRole(current_user.role),
        preferred_language=user.preferred_language_code(current_user),
        must_change_password=current_user.password.must_change_password,
    )


async def change_password(
    db: AsyncSession,
    current_user: User,
    payload: PasswordChangeRequest,
) -> PasswordChangeResponse:
    """Verify the old password, set the new hash, and clear must-change.

    Revokes all refresh tokens for the user so prior sessions cannot continue
    after the password (and ``must_change_password`` flag) change.

    Args:
        db: Async SQLAlchemy session.
        current_user: Authenticated user with password relation loaded.
        payload: Old and new password body.

    Returns:
        ``PasswordChangeResponse`` success message.

    Raises:
        HTTPException: 401 if there is no password row; 400 if old password
            is wrong or new password equals the current password.
    """
    if current_user.password is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=AUTH_UNAUTHORIZED_DETAIL,
        )
    old_ok = await run_in_threadpool(
        verify_password,
        payload.old_password,
        current_user.password.password_hash,
    )
    if not old_ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=CURRENT_PASSWORD_INCORRECT_DETAIL,
        )
    if payload.new_password == payload.old_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=NEW_PASSWORD_SAME_AS_CURRENT_DETAIL,
        )
    await user.update_password(
        db,
        current_user,
        new_password=payload.new_password,
        must_change_password=False,
    )
    await auth.revoke_all_for_user(db, current_user.id)
    return PasswordChangeResponse()
