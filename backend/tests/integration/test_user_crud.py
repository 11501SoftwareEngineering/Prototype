"""Integration tests for real user CRUD against PostgreSQL."""

from __future__ import annotations

import asyncio
import uuid

import pytest

from app.core.config import settings
from app.core.database import AsyncSessionLocal, engine
from app.core.enums import UserRole
from app.core.migration import run_migrations
from app.core.security import verify_password
from app.crud import user as user_crud
from app.models.user import User


@pytest.mark.integration
def test_user_crud_create_get_and_preferred_language() -> None:
    async def _run() -> None:
        await engine.dispose()
        await run_migrations()
        account = f"crud-{uuid.uuid4().hex[:10]}"

        async with AsyncSessionLocal() as db:
            created = await user_crud.create_user(
                db,
                account_id=account,
                name="CRUD User",
                password="password1",
                role=UserRole.USER,
            )
            assert created.account_id == account
            assert created.password is not None
            assert verify_password("password1", created.password.password_hash)
            assert user_crud.preferred_language_code(created) == (
                settings.DEFAULT_LANGUAGE_CODE
            )

            by_account = await user_crud.get_user_by_account(db, account)
            assert by_account is not None
            assert by_account.id == created.id

            by_id = await user_crud.get_user_by_id(db, created.id)
            assert by_id is not None
            assert by_id.account_id == account

            missing = await user_crud.get_user_by_account(db, "missing-account")
            assert missing is None

            bare = User(
                id=uuid.uuid4(),
                account_id=f"bare-{uuid.uuid4().hex[:8]}",
                name="Bare",
                role=UserRole.USER.value,
            )
            assert (
                user_crud.preferred_language_code(bare)
                == settings.DEFAULT_LANGUAGE_CODE
            )

            language = await user_crud.ensure_default_language(db)
            again = await user_crud.ensure_default_language(db)
            assert again.id == language.id
            assert again.code == settings.DEFAULT_LANGUAGE_CODE

    asyncio.run(_run())
