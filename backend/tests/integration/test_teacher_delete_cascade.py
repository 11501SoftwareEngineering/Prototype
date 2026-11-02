"""Integration: teacher delete cascades; general USER delete is refused."""

from __future__ import annotations

import asyncio
import uuid

import pytest
from sqlalchemy import func, select

from app.core.database import AsyncSessionLocal, engine
from app.core.enums import UserRole
from app.core.migration import run_migrations
from app.crud import auth as auth_crud
from app.crud import user as user_crud
from app.models.user import RefreshToken, UserLanguage, UserPassword


@pytest.mark.integration
def test_delete_teacher_cascades_password_language_and_refresh() -> None:
    async def _run() -> None:
        await engine.dispose()
        await run_migrations()
        account = f"teacher-cascade-{uuid.uuid4().hex[:10]}"

        async with AsyncSessionLocal() as db:
            teacher = await user_crud.create_user(
                db,
                account_id=account,
                name="Cascade Teacher",
                password="password1",
                role=UserRole.TEACHER,
                must_change_password=True,
            )
            teacher_id = teacher.id
            await auth_crud.create_refresh_token(db, teacher_id)

            assert (
                await db.scalar(
                    select(func.count())
                    .select_from(UserPassword)
                    .where(UserPassword.user_id == teacher_id)
                )
                == 1
            )
            assert (
                await db.scalar(
                    select(func.count())
                    .select_from(UserLanguage)
                    .where(UserLanguage.user_id == teacher_id)
                )
                == 1
            )
            assert (
                await db.scalar(
                    select(func.count())
                    .select_from(RefreshToken)
                    .where(RefreshToken.user_id == teacher_id)
                )
                == 1
            )

            await user_crud.delete_teacher(db, teacher)

            assert await user_crud.get_user_by_id(db, teacher_id) is None
            assert (
                await db.scalar(
                    select(func.count())
                    .select_from(UserPassword)
                    .where(UserPassword.user_id == teacher_id)
                )
                == 0
            )
            assert (
                await db.scalar(
                    select(func.count())
                    .select_from(UserLanguage)
                    .where(UserLanguage.user_id == teacher_id)
                )
                == 0
            )
            assert (
                await db.scalar(
                    select(func.count())
                    .select_from(RefreshToken)
                    .where(RefreshToken.user_id == teacher_id)
                )
                == 0
            )

    asyncio.run(_run())


@pytest.mark.integration
def test_delete_teacher_refuses_general_user() -> None:
    async def _run() -> None:
        await engine.dispose()
        await run_migrations()
        account = f"user-no-delete-{uuid.uuid4().hex[:10]}"

        async with AsyncSessionLocal() as db:
            general_user = await user_crud.create_user(
                db,
                account_id=account,
                name="General User",
                password="password1",
                role=UserRole.USER,
            )
            user_id = general_user.id
            await auth_crud.create_refresh_token(db, user_id)

            with pytest.raises(ValueError, match="only TEACHER"):
                await user_crud.delete_teacher(db, general_user)

            assert await user_crud.get_user_by_id(db, user_id) is not None
            assert (
                await db.scalar(
                    select(func.count())
                    .select_from(UserPassword)
                    .where(UserPassword.user_id == user_id)
                )
                == 1
            )
            assert (
                await db.scalar(
                    select(func.count())
                    .select_from(UserLanguage)
                    .where(UserLanguage.user_id == user_id)
                )
                == 1
            )
            assert (
                await db.scalar(
                    select(func.count())
                    .select_from(RefreshToken)
                    .where(RefreshToken.user_id == user_id)
                )
                == 1
            )

    asyncio.run(_run())
