"""Business rules for entering a student's single session per topic."""

from typing import Protocol
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.session import SQLAlchemySessionStore
from app.schemas.session import CreateSessionResponse


class TopicNotFoundError(Exception):
    """The requested topic does not exist."""


class CourseAccessDeniedError(Exception):
    """The user is not a member of the topic's course."""


class SessionStore(Protocol):
    """Storage operations to be implemented by the CRUD layer."""

    async def get_topic_course_id(self, topic_id: UUID) -> UUID | None:
        """Return the course ID, or None when the topic does not exist."""
        ...

    async def is_course_member(self, user_id: UUID, course_id: UUID) -> bool:
        """Return whether the user currently belongs to the course."""
        ...

    async def get_session_id(self, user_id: UUID, topic_id: UUID) -> UUID | None:
        """Find an existing session regardless of completion status."""
        ...

    async def get_or_create_session_id(self, user_id: UUID, topic_id: UUID) -> UUID:
        """Atomically create IN_PROGRESS or reuse an existing session unchanged."""
        ...


async def create_or_enter_session(
    *,
    user_id: UUID,
    topic_id: UUID,
    store: SessionStore,
) -> CreateSessionResponse:
    """Enter a session using the authenticated user's ID supplied by the route."""
    course_id = await store.get_topic_course_id(topic_id)
    if course_id is None:
        raise TopicNotFoundError("Topic not found")

    # Check permission even when an old session already exists.
    if not await store.is_course_member(user_id, course_id):
        raise CourseAccessDeniedError("Course membership required")

    session_id = await store.get_session_id(user_id, topic_id)
    if session_id is None:
        session_id = await store.get_or_create_session_id(user_id, topic_id)

    return CreateSessionResponse(session_id=session_id, topic_id=topic_id)


async def create_or_enter_student_session(
    db: AsyncSession,
    user_id: UUID,
    topic_id: UUID,
) -> CreateSessionResponse:
    """Enter a student session and handle transactions and HTTP errors."""
    store = SQLAlchemySessionStore(
        db,
        initial_is_anonymous=False,
    )

    try:
        result = await create_or_enter_session(
            user_id=user_id,
            topic_id=topic_id,
            store=store,
        )
        await db.commit()
    except TopicNotFoundError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topic not found",
        ) from exc
    except CourseAccessDeniedError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Course membership required",
        ) from exc
    except Exception:
        await db.rollback()
        raise

    return result
