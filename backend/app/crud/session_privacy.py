from uuid import UUID

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.session import Session
from app.schemas.session_privacy import SessionPrivacyData


async def get_session(
    db: AsyncSession,
    session_id: UUID,
) -> SessionPrivacyData | None:
    session = await db.get(Session, session_id)

    if session is None:
        return None

    return SessionPrivacyData(
        id=session.id,
        user_id=session.user_id,
        is_anonymous=session.is_anonymous,
    )


async def set_is_anonymous(
    db: AsyncSession,
    *,
    session_id: UUID,
    is_anonymous: bool,
) -> SessionPrivacyData | None:
    statement = (
        update(Session)
        .where(Session.id == session_id)
        .values(is_anonymous=is_anonymous)
        .returning(
            Session.id,
            Session.user_id,
            Session.is_anonymous,
        )
    )

    result = await db.execute(statement)
    row = result.mappings().one_or_none()

    if row is None:
        return None

    return SessionPrivacyData(
        id=row["id"],
        user_id=row["user_id"],
        is_anonymous=row["is_anonymous"],
    )


class SQLAlchemySessionPrivacyStore:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_session(
        self,
        session_id: UUID,
    ) -> SessionPrivacyData | None:
        return await get_session(self._db, session_id)

    async def set_is_anonymous(
        self,
        session_id: UUID,
        is_anonymous: bool,
    ) -> SessionPrivacyData | None:
        return await set_is_anonymous(
            self._db,
            session_id=session_id,
            is_anonymous=is_anonymous,
        )
