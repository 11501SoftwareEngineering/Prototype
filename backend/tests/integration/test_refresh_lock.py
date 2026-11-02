"""Concurrency tests for refresh rotation ``SELECT … FOR UPDATE``."""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select, update

from app.core.config import settings
from app.core.database import AsyncSessionLocal, engine
from app.core.enums import UserRole
from app.core.migration import run_migrations
from app.core.security import hash_password, hash_token
from app.crud.auth import (
    RenewOutcome,
    create_refresh_token,
    get_active_user_id_for_refresh,
    renew_with_lock,
    revoke_all_for_user,
)
from app.models.user import RefreshToken, User, UserPassword


async def _prepare_db() -> None:
    # Each asyncio.run() gets a new loop; drop pooled asyncpg connections first.
    await engine.dispose()
    await run_migrations()


async def _seed_user_with_refresh() -> tuple[uuid.UUID, str]:
    user_id = uuid.uuid4()
    async with AsyncSessionLocal() as db:
        user = User(
            id=user_id,
            account_id=f"lock-{user_id.hex[:8]}",
            name="Lock Test",
            role=UserRole.USER.value,
        )
        user.password = UserPassword(
            password_hash=hash_password("password1"),
            must_change_password=False,
        )
        db.add(user)
        await db.commit()
        raw = await create_refresh_token(db, user_id)
    return user_id, raw


async def _assert_active_count(user_id: uuid.UUID, expected: int) -> None:
    async with AsyncSessionLocal() as db:
        active = await db.scalar(
            select(func.count())
            .select_from(RefreshToken)
            .where(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked_at.is_(None),
            )
        )
    assert active == expected


@pytest.mark.integration
def test_refresh_lock_concurrent_and_post_grace_theft() -> None:
    """One event loop: concurrent ACCESS_ONLY, then post-grace revoke-all."""

    async def _run() -> None:
        await _prepare_db()
        user_id, raw = await _seed_user_with_refresh()

        results = await asyncio.gather(
            renew_with_lock(raw),
            renew_with_lock(raw),
        )
        outcomes = {r.outcome for r in results}
        assert RenewOutcome.ROTATED in outcomes
        assert RenewOutcome.REJECTED not in outcomes
        assert outcomes <= {RenewOutcome.ROTATED, RenewOutcome.ACCESS_ONLY}
        await _assert_active_count(user_id, 1)

        user_id2, raw2 = await _seed_user_with_refresh()
        first = await renew_with_lock(raw2)
        assert first.outcome is RenewOutcome.ROTATED

        past = datetime.now(UTC) - timedelta(
            seconds=settings.REFRESH_REUSE_GRACE_SECONDS + 1
        )
        async with AsyncSessionLocal() as db:
            await db.execute(
                update(RefreshToken)
                .where(RefreshToken.token_hash == hash_token(raw2))
                .values(revoked_at=past)
            )
            await db.commit()

        second = await renew_with_lock(raw2)
        assert second.outcome is RenewOutcome.REJECTED
        await _assert_active_count(user_id2, 0)

    asyncio.run(_run())


@pytest.mark.integration
def test_refresh_unknown_expired_and_revoke_helpers() -> None:
    """Cover unknown/expired renew paths plus revoke/lookup helpers."""

    async def _run() -> None:
        await _prepare_db()

        unknown = await renew_with_lock("never-issued-refresh")
        assert unknown.outcome is RenewOutcome.REJECTED

        user_id, raw = await _seed_user_with_refresh()
        async with AsyncSessionLocal() as db:
            assert await get_active_user_id_for_refresh(db, raw) == user_id
            await db.execute(
                update(RefreshToken)
                .where(RefreshToken.token_hash == hash_token(raw))
                .values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
            )
            await db.commit()
            assert await get_active_user_id_for_refresh(db, raw) is None

        expired = await renew_with_lock(raw)
        assert expired.outcome is RenewOutcome.REJECTED

        user_id2, raw2 = await _seed_user_with_refresh()
        async with AsyncSessionLocal() as db:
            await revoke_all_for_user(db, user_id2)
            assert await get_active_user_id_for_refresh(db, raw2) is None

        after_logout = await renew_with_lock(raw2)
        assert after_logout.outcome is RenewOutcome.REJECTED
        await _assert_active_count(user_id2, 0)

    asyncio.run(_run())
