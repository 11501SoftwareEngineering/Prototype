import asyncio
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.core.enums import SessionStatus
from app.crud.session import get_or_create_session_id
from app.crud.session_privacy import SQLAlchemySessionPrivacyStore
from app.models.session import Session
from app.services.session_privacy import update_session_privacy
from tests.integration.test_session_crud import (
    create_course_and_topic,
    create_student,
    session_test_db,
)

pytestmark = pytest.mark.integration


def test_missing_session_returns_none() -> None:
    async def run() -> None:
        async with session_test_db() as db:
            store = SQLAlchemySessionPrivacyStore(db)

            result = await store.get_session(uuid4())

            assert result is None

    asyncio.run(run())


@pytest.mark.parametrize("is_anonymous", [True, False])
def test_get_session_returns_stored_values(is_anonymous: bool) -> None:
    async def run() -> None:
        async with session_test_db() as db:
            _, topic = await create_course_and_topic(db)
            student = await create_student(db)

            session_id = await get_or_create_session_id(
                db,
                user_id=student.id,
                topic_id=topic.id,
                is_anonymous=is_anonymous,
            )

            store = SQLAlchemySessionPrivacyStore(db)
            result = await store.get_session(session_id)

            assert result is not None
            assert result.id == session_id
            assert result.user_id == student.id
            assert result.is_anonymous is is_anonymous

    asyncio.run(run())


@pytest.mark.parametrize("is_anonymous", [True, False])
def test_set_is_anonymous_updates_database(is_anonymous: bool) -> None:
    async def run() -> None:
        async with session_test_db() as db:
            _, topic = await create_course_and_topic(db)
            student = await create_student(db)

            session_id = await get_or_create_session_id(
                db,
                user_id=student.id,
                topic_id=topic.id,
                is_anonymous=not is_anonymous,
            )

            store = SQLAlchemySessionPrivacyStore(db)
            result = await store.set_is_anonymous(
                session_id=session_id,
                is_anonymous=is_anonymous,
            )

            assert result is not None
            assert result.id == session_id
            assert result.user_id == student.id
            assert result.is_anonymous is is_anonymous

            saved = await db.get(Session, session_id, populate_existing=True)

            assert saved is not None
            assert saved.is_anonymous is is_anonymous
            assert saved.user_id == student.id
            assert saved.topic_id == topic.id

    asyncio.run(run())


def test_update_missing_session_returns_none() -> None:
    async def run() -> None:
        async with session_test_db() as db:
            session_id = uuid4()
            store = SQLAlchemySessionPrivacyStore(db)

            result = await store.set_is_anonymous(
                session_id=session_id,
                is_anonymous=True,
            )

            assert result is None
            assert await store.get_session(session_id) is None

    asyncio.run(run())


def test_privacy_update_preserves_completed_session() -> None:
    async def run() -> None:
        async with session_test_db() as db:
            _, topic = await create_course_and_topic(db)
            student = await create_student(db)

            started_at = datetime(2026, 1, 1, 10, tzinfo=UTC)
            completed_at = datetime(2026, 1, 1, 11, tzinfo=UTC)
            session = Session(
                user_id=student.id,
                topic_id=topic.id,
                status=SessionStatus.COMPLETED.value,
                is_anonymous=False,
                started_at=started_at,
                completed_at=completed_at,
            )
            db.add(session)
            await db.flush()
            session_id = session.id

            store = SQLAlchemySessionPrivacyStore(db)
            await store.set_is_anonymous(
                session_id=session_id,
                is_anonymous=True,
            )

            saved = await db.get(Session, session_id, populate_existing=True)

            assert saved is not None
            assert saved.is_anonymous is True
            assert saved.status == SessionStatus.COMPLETED.value
            assert saved.started_at == started_at
            assert saved.completed_at == completed_at

    asyncio.run(run())


def test_non_owner_cannot_update_privacy_in_database() -> None:
    async def run() -> None:
        async with session_test_db() as db:
            _, topic = await create_course_and_topic(db)
            owner = await create_student(db)
            outsider = await create_student(db)

            session_id = await get_or_create_session_id(
                db,
                user_id=owner.id,
                topic_id=topic.id,
                is_anonymous=False,
            )
            store = SQLAlchemySessionPrivacyStore(db)

            with pytest.raises(HTTPException) as exc_info:
                await update_session_privacy(
                    store=store,
                    session_id=session_id,
                    current_user_id=outsider.id,
                    is_anonymous=True,
                )

            assert exc_info.value.status_code == 403

            saved = await db.get(Session, session_id, populate_existing=True)

            assert saved is not None
            assert saved.is_anonymous is False
            assert saved.user_id == owner.id

    asyncio.run(run())
