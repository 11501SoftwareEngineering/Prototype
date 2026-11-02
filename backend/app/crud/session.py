from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import SessionStatus
from app.models.course import CourseMembership
from app.models.session import Session
from app.models.topic import Topic


async def get_topic_course_id(
    db: AsyncSession,
    topic_id: UUID,
) -> UUID | None:
    statement = select(Topic.course_id).where(Topic.id == topic_id)
    return await db.scalar(statement)


async def is_course_member(
    db: AsyncSession,
    *,
    user_id: UUID,
    course_id: UUID,
) -> bool:
    statement = select(CourseMembership.user_id).where(
        CourseMembership.user_id == user_id,
        CourseMembership.course_id == course_id,
    )
    return await db.scalar(statement) is not None


async def get_session_id(
    db: AsyncSession,
    *,
    user_id: UUID,
    topic_id: UUID,
) -> UUID | None:
    statement = select(Session.id).where(
        Session.user_id == user_id,
        Session.topic_id == topic_id,
    )
    return await db.scalar(statement)


async def get_or_create_session_id(
    db: AsyncSession,
    *,
    user_id: UUID,
    topic_id: UUID,
    is_anonymous: bool,
) -> UUID:
    statement = (
        insert(Session)
        .values(
            user_id=user_id,
            topic_id=topic_id,
            status=SessionStatus.IN_PROGRESS.value,
            is_anonymous=is_anonymous,
        )
        .on_conflict_do_nothing(
            constraint="uq_sessions_user_id_topic_id",
        )
        .returning(Session.id)
    )

    session_id = await db.scalar(statement)
    if session_id is not None:
        return session_id

    existing_session_id = await get_session_id(
        db,
        user_id=user_id,
        topic_id=topic_id,
    )
    if existing_session_id is None:
        raise RuntimeError("Session was not found after an insert conflict")

    return existing_session_id


class SQLAlchemySessionStore:
    def __init__(
        self,
        db: AsyncSession,
        *,
        initial_is_anonymous: bool,
    ) -> None:
        self._db = db
        self._initial_is_anonymous = initial_is_anonymous

    async def get_topic_course_id(self, topic_id: UUID) -> UUID | None:
        return await get_topic_course_id(self._db, topic_id)

    async def is_course_member(
        self,
        user_id: UUID,
        course_id: UUID,
    ) -> bool:
        return await is_course_member(
            self._db,
            user_id=user_id,
            course_id=course_id,
        )

    async def get_session_id(
        self,
        user_id: UUID,
        topic_id: UUID,
    ) -> UUID | None:
        return await get_session_id(
            self._db,
            user_id=user_id,
            topic_id=topic_id,
        )

    async def get_or_create_session_id(
        self,
        user_id: UUID,
        topic_id: UUID,
    ) -> UUID:
        return await get_or_create_session_id(
            self._db,
            user_id=user_id,
            topic_id=topic_id,
            is_anonymous=self._initial_is_anonymous,
        )
