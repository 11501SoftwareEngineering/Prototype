from typing import Protocol
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.session_privacy import SQLAlchemySessionPrivacyStore
from app.schemas.session_privacy import (
    SessionPrivacyData,
    UpdateSessionPrivacyResponse,
)


class SessionPrivacyStore(Protocol):
    async def get_session(
        self,
        session_id: UUID,
    ) -> SessionPrivacyData | None: ...

    async def set_is_anonymous(
        self,
        session_id: UUID,
        is_anonymous: bool,
    ) -> SessionPrivacyData | None: ...


async def update_session_privacy(
    *,
    store: SessionPrivacyStore,
    session_id: UUID,
    current_user_id: UUID,
    is_anonymous: bool,
) -> UpdateSessionPrivacyResponse:
    session = await store.get_session(session_id)

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    if session.user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not the session owner",
        )

    updated_session = await store.set_is_anonymous(session_id, is_anonymous)

    if updated_session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    return UpdateSessionPrivacyResponse(
        session_id=updated_session.id,
        is_anonymous=updated_session.is_anonymous,
        message="匿名分享設定已更新",
    )


async def update_student_session_privacy(
    db: AsyncSession,
    current_user_id: UUID,
    session_id: UUID,
    is_anonymous: bool,
) -> UpdateSessionPrivacyResponse:
    """Update session privacy and manage the database transaction."""
    store = SQLAlchemySessionPrivacyStore(db)

    try:
        result = await update_session_privacy(
            store=store,
            session_id=session_id,
            current_user_id=current_user_id,
            is_anonymous=is_anonymous,
        )
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return result
