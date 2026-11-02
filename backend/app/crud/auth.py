"""Refresh token persistence with Postgres row-level lock for rotation."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.security import generate_opaque_token, hash_token
from app.models.user import RefreshToken


class RenewOutcome(StrEnum):
    """Result kind from ``renew_with_lock``."""

    ROTATED = "rotated"
    ACCESS_ONLY = "access_only"
    REJECTED = "rejected"


@dataclass(frozen=True)
class RenewResult:
    """Outcome of a locked refresh renew attempt."""

    outcome: RenewOutcome
    user_id: uuid.UUID | None = None
    raw_refresh: str | None = None
    raw_csrf: str | None = None


async def create_refresh_token(db: AsyncSession, user_id: uuid.UUID) -> str:
    """Insert a new refresh row and return the plaintext cookie value.

    Args:
        db: Async SQLAlchemy session.
        user_id: Owner of the refresh token.

    Returns:
        Opaque plaintext refresh token for the HttpOnly cookie.
    """
    raw = generate_opaque_token()
    row = RefreshToken(
        user_id=user_id,
        token_hash=hash_token(raw),
        expires_at=datetime.now(UTC)
        + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(row)
    await db.commit()
    return raw


async def get_user_id_for_refresh(
    db: AsyncSession, raw_refresh: str
) -> uuid.UUID | None:
    """Return the user id for a refresh token hash, even if revoked or expired.

    Used by logout so a just-rotated cookie still maps to the user and can
    revoke-all (including the successor refresh).
    """
    row = await db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == hash_token(raw_refresh),
        )
    )
    return row.user_id if row is not None else None


async def get_active_user_id_for_refresh(
    db: AsyncSession, raw_refresh: str
) -> uuid.UUID | None:
    """Return the user id for an active, unexpired refresh token, if any."""
    now = datetime.now(UTC)
    row = await db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == hash_token(raw_refresh),
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now,
        )
    )
    return row.user_id if row is not None else None


async def revoke_all_for_user(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Revoke every active refresh token for the user.

    Args:
        db: Async SQLAlchemy session.
        user_id: User whose refresh tokens are revoked.
    """
    now = datetime.now(UTC)
    await db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=now)
    )
    await db.commit()


async def renew_with_lock(raw_refresh: str) -> RenewResult:
    """Renew session using ``SELECT … FOR UPDATE`` on the refresh hash.

    Uses a **dedicated** session/transaction (not the request-scoped ``get_db``)
    so concurrent workers serialize on the same ``token_hash`` row lock even
    when each request has its own SQLAlchemy session.

    Spec algorithm:
    - Active row → rotate (revoke + insert); return new refresh + csrf.
    - Revoked within ``REFRESH_REUSE_GRACE_SECONDS`` with an active peer →
      access-only (concurrent waiter after peer rotate).
    - Revoked outside that grace with an active peer → revoke all (theft) +
      rejected.
    - Otherwise → rejected.

    Args:
        raw_refresh: Plaintext refresh cookie value.

    Returns:
        ``RenewResult`` describing rotation, access-only, or rejection.
    """
    # DB stores only the hash; cookie carries the opaque plaintext.
    token_h = hash_token(raw_refresh)
    now = datetime.now(UTC)
    grace = timedelta(seconds=settings.REFRESH_REUSE_GRACE_SECONDS)

    # begin() commits on success / rolls back on error; FOR UPDATE holds until then.
    async with AsyncSessionLocal() as db, db.begin():
        result = await db.execute(
            select(RefreshToken)
            .where(RefreshToken.token_hash == token_h)
            .with_for_update()
        )
        row = result.scalar_one_or_none()

        # Unknown token (never issued, or purged).
        if row is None:
            return RenewResult(outcome=RenewOutcome.REJECTED)

        # Expired but not yet marked revoked: mark and refuse (no rotation).
        if row.expires_at <= now and row.revoked_at is None:
            row.revoked_at = now
            return RenewResult(outcome=RenewOutcome.REJECTED)

        # --- Happy path: first requester to present a live refresh wins ---
        # Revoke this row, insert a successor, return new cookies to the caller.
        # A concurrent twin blocked on FOR UPDATE will see revoked_at set below.
        if row.revoked_at is None:
            row.revoked_at = now
            new_raw = generate_opaque_token()
            csrf = generate_opaque_token()
            db.add(
                RefreshToken(
                    user_id=row.user_id,
                    token_hash=hash_token(new_raw),
                    expires_at=now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
                )
            )
            return RenewResult(
                outcome=RenewOutcome.ROTATED,
                user_id=row.user_id,
                raw_refresh=new_raw,
                raw_csrf=csrf,
            )

        # --- Row already revoked: either a race loser or a stolen cookie ---
        # Still have another live refresh for this user? (winner's successor, or
        # a second device / re-login). That distinguishes "tab race" from logout.
        active = await db.execute(
            select(RefreshToken.id)
            .where(
                RefreshToken.user_id == row.user_id,
                RefreshToken.revoked_at.is_(None),
                RefreshToken.expires_at > now,
            )
            .limit(1)
        )
        has_active = active.scalars().first() is not None

        # Within grace: treat as concurrent renew of the *same* cookie. Mint a
        # fresh access JWT only; the peer already holds the new refresh cookie.
        # Do not revoke the family — that would false-positive on multi-tab.
        if has_active and (now - row.revoked_at) <= grace:
            return RenewResult(
                outcome=RenewOutcome.ACCESS_ONLY,
                user_id=row.user_id,
            )

        # Past grace + still has active refresh: reuse detection / theft.
        # Kill every active refresh so both attacker and victim must re-login.
        if has_active:
            await db.execute(
                update(RefreshToken)
                .where(
                    RefreshToken.user_id == row.user_id,
                    RefreshToken.revoked_at.is_(None),
                )
                .values(revoked_at=now)
            )

        # No active peer (e.g. after logout) or theft path above → reject.
        return RenewResult(outcome=RenewOutcome.REJECTED)
