from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.authz import is_reserved_super_admin_account, is_super_admin
from app.core.enums import UserRole
from app.core.security import generate_initial_password
from app.crud import user
from app.schemas.admin import (
    TeacherCreateRequest,
    TeacherCreateResponse,
    TeacherListItem,
)


async def list_teachers(db: AsyncSession) -> list[TeacherListItem]:
    """Return all TEACHER accounts for the admin roster."""
    teachers = await user.list_users_by_role(db, UserRole.TEACHER)
    return [
        TeacherListItem(
            id=teacher.id,
            account=teacher.account_id,
            name=teacher.name,
            created_at=teacher.created_at,
        )
        for teacher in teachers
    ]


async def create_teacher(
    db: AsyncSession, payload: TeacherCreateRequest
) -> TeacherCreateResponse:
    """Create a TEACHER with a generated initial password.

    Sets ``must_change_password=true``. The plaintext password is returned
    once in the response so the admin can hand it to the teacher.

    Raises:
        HTTPException: 400 if the account is reserved or already exists.
    """
    if is_reserved_super_admin_account(payload.account):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account name reserved",
        )
    existing = await user.get_user_by_account(db, payload.account)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account already exists",
        )
    initial_password = generate_initial_password()
    try:
        created = await user.create_user(
            db,
            account_id=payload.account,
            name=payload.name,
            password=initial_password,
            role=UserRole.TEACHER,
            must_change_password=True,
        )
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account already exists",
        ) from None
    return TeacherCreateResponse(
        account=created.account_id,
        name=created.name,
        role=UserRole(created.role),
        password=initial_password,
        message="Teacher created",
    )


async def delete_teacher(db: AsyncSession, teacher_id: UUID) -> None:
    """Delete a TEACHER by id (not general ``USER`` accounts).

    Child rows (``user_passwords``, ``user_languages``, ``refresh_tokens``)
    are removed by Postgres ``ON DELETE CASCADE`` (ORM ``passive_deletes``).

    Raises:
        HTTPException: 404 if missing or not a TEACHER; 403 if the teacher is
            config-elevated via ``SUPER_ADMIN_ACCOUNTS``.
    """
    target = await user.get_user_by_id(db, teacher_id)
    if target is None or target.role != UserRole.TEACHER.value:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher not found",
        )
    if is_super_admin(target):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete elevated admin account",
        )
    await user.delete_teacher(db, target)
