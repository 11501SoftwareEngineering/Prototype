import asyncio
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.core.database import Base
from app.core.enums import SessionStatus, UserRole
from app.crud import session as session_crud
from app.crud.user import delete_teacher
from app.models.course import Course, CourseMembership
from app.models.session import Session
from app.models.topic import Topic
from app.models.user import User
from app.services.session import (
    CourseAccessDeniedError,
    TopicNotFoundError,
    create_or_enter_session,
)

pytestmark = pytest.mark.integration


@asynccontextmanager
async def session_test_db() -> AsyncIterator[AsyncSession]:
    database_url = os.environ.get("SESSION_TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("Set SESSION_TEST_DATABASE_URL to run Session CRUD tests")

    test_engine = create_async_engine(database_url)

    try:
        async with test_engine.connect() as connection:
            transaction = await connection.begin()
            try:
                await connection.run_sync(Base.metadata.create_all)

                async with AsyncSession(
                    bind=connection,
                    expire_on_commit=False,
                    join_transaction_mode="create_savepoint",
                ) as db:
                    yield db
            finally:
                await transaction.rollback()
    finally:
        await test_engine.dispose()


def test_missing_topic_returns_none() -> None:
    async def run() -> None:
        async with session_test_db() as db:
            course_id = await session_crud.get_topic_course_id(db, uuid4())

            assert course_id is None

    asyncio.run(run())


async def create_course_and_topic(db: AsyncSession) -> tuple[Course, Topic]:
    teacher = User(
        account_id=f"teacher-{uuid4().hex}",
        name="Test Teacher",
        role=UserRole.TEACHER.value,
    )
    db.add(teacher)
    await db.flush()

    course = Course(
        name="Test Course",
        created_by=teacher.id,
        invitation_code=uuid4().hex,
    )
    db.add(course)
    await db.flush()

    topic = Topic(
        course_id=course.id,
        created_by=teacher.id,
        title="Test Topic",
    )
    db.add(topic)
    await db.flush()

    return course, topic


def test_topic_lookup_returns_correct_course() -> None:
    async def run() -> None:
        async with session_test_db() as db:
            course_a, topic_a = await create_course_and_topic(db)
            course_b, topic_b = await create_course_and_topic(db)

            assert await session_crud.get_topic_course_id(db, topic_b.id) == course_b.id
            assert await session_crud.get_topic_course_id(db, topic_a.id) == course_a.id
            assert await session_crud.get_topic_course_id(db, uuid4()) is None

    asyncio.run(run())


async def create_student(db: AsyncSession) -> User:
    student = User(
        account_id=f"student-{uuid4().hex}",
        name="Test Student",
        role=UserRole.USER.value,
    )
    db.add(student)
    await db.flush()
    return student


@pytest.mark.parametrize("membership_role", ["STUDENT", "TA"])
def test_course_membership_checks_user_and_course(membership_role: str) -> None:
    async def run() -> None:
        async with session_test_db() as db:
            course_a, _ = await create_course_and_topic(db)
            course_b, _ = await create_course_and_topic(db)
            member = await create_student(db)
            outsider = await create_student(db)

            db.add(
                CourseMembership(
                    course_id=course_a.id,
                    user_id=member.id,
                    role=membership_role,
                )
            )
            await db.flush()

            is_member = await session_crud.is_course_member(
                db, user_id=member.id, course_id=course_a.id
            )
            wrong_course = await session_crud.is_course_member(
                db, user_id=member.id, course_id=course_b.id
            )
            wrong_user = await session_crud.is_course_member(
                db, user_id=outsider.id, course_id=course_a.id
            )

            assert is_member is True
            assert wrong_course is False
            assert wrong_user is False

    asyncio.run(run())


@pytest.mark.parametrize("is_anonymous", [True, False])
def test_create_session_stores_initial_values(is_anonymous: bool) -> None:
    async def run() -> None:
        async with session_test_db() as db:
            _, topic = await create_course_and_topic(db)
            student = await create_student(db)

            existing_id = await session_crud.get_session_id(
                db,
                user_id=student.id,
                topic_id=topic.id,
            )
            assert existing_id is None

            session_id = await session_crud.get_or_create_session_id(
                db,
                user_id=student.id,
                topic_id=topic.id,
                is_anonymous=is_anonymous,
            )

            created = await db.get(Session, session_id)

            assert created is not None
            assert created.user_id == student.id
            assert created.topic_id == topic.id
            assert created.status == SessionStatus.IN_PROGRESS.value
            assert created.is_anonymous == is_anonymous
            assert created.started_at is not None
            assert created.completed_at is None

            found_id = await session_crud.get_session_id(
                db,
                user_id=student.id,
                topic_id=topic.id,
            )
            assert found_id == session_id

    asyncio.run(run())


@pytest.mark.parametrize(
    "session_status",
    [SessionStatus.IN_PROGRESS, SessionStatus.COMPLETED],
)
@pytest.mark.parametrize("is_anonymous", [True, False])
def test_repeated_creation_preserves_existing_session(
    session_status: SessionStatus,
    is_anonymous: bool,
) -> None:
    async def run() -> None:
        async with session_test_db() as db:
            _, topic = await create_course_and_topic(db)
            student = await create_student(db)

            original_id = await session_crud.get_or_create_session_id(
                db,
                user_id=student.id,
                topic_id=topic.id,
                is_anonymous=is_anonymous,
            )
            original = await db.get(Session, original_id)
            assert original is not None

            completed_at = (
                datetime(2026, 1, 1, tzinfo=UTC)
                if session_status == SessionStatus.COMPLETED
                else None
            )
            original.status = session_status.value
            original.completed_at = completed_at
            await db.flush()

            repeated_id = await session_crud.get_or_create_session_id(
                db,
                user_id=student.id,
                topic_id=topic.id,
                is_anonymous=not is_anonymous,
            )

            await db.refresh(original)

            assert repeated_id == original_id
            assert original.status == session_status.value
            assert original.is_anonymous == is_anonymous
            assert original.completed_at == completed_at

            session_count = await db.scalar(
                select(func.count())
                .select_from(Session)
                .where(
                    Session.user_id == student.id,
                    Session.topic_id == topic.id,
                )
            )
            assert session_count == 1

    asyncio.run(run())


def test_sessions_are_separate_for_each_user_and_topic() -> None:
    async def run() -> None:
        async with session_test_db() as db:
            _, topic_a = await create_course_and_topic(db)
            _, topic_b = await create_course_and_topic(db)
            student_a = await create_student(db)
            student_b = await create_student(db)

            session_aa = await session_crud.get_or_create_session_id(
                db,
                user_id=student_a.id,
                topic_id=topic_a.id,
                is_anonymous=True,
            )
            session_ba = await session_crud.get_or_create_session_id(
                db,
                user_id=student_b.id,
                topic_id=topic_a.id,
                is_anonymous=True,
            )
            session_ab = await session_crud.get_or_create_session_id(
                db,
                user_id=student_a.id,
                topic_id=topic_b.id,
                is_anonymous=True,
            )

            assert len({session_aa, session_ba, session_ab}) == 3

            found_aa = await session_crud.get_session_id(
                db, user_id=student_a.id, topic_id=topic_a.id
            )
            found_ba = await session_crud.get_session_id(
                db, user_id=student_b.id, topic_id=topic_a.id
            )
            found_ab = await session_crud.get_session_id(
                db, user_id=student_a.id, topic_id=topic_b.id
            )
            found_bb = await session_crud.get_session_id(
                db, user_id=student_b.id, topic_id=topic_b.id
            )

            assert found_aa == session_aa
            assert found_ba == session_ba
            assert found_ab == session_ab
            assert found_bb is None

    asyncio.run(run())


@pytest.mark.parametrize("is_anonymous", [True, False])
def test_service_creates_and_reuses_session_with_database(
    is_anonymous: bool,
) -> None:
    async def run() -> None:
        async with session_test_db() as db:
            course, topic = await create_course_and_topic(db)
            student = await create_student(db)

            db.add(
                CourseMembership(
                    course_id=course.id,
                    user_id=student.id,
                    role="STUDENT",
                )
            )
            await db.flush()

            store = session_crud.SQLAlchemySessionStore(
                db,
                initial_is_anonymous=is_anonymous,
            )

            first = await create_or_enter_session(
                user_id=student.id,
                topic_id=topic.id,
                store=store,
            )
            second = await create_or_enter_session(
                user_id=student.id,
                topic_id=topic.id,
                store=store,
            )

            assert first.topic_id == topic.id
            assert second.topic_id == topic.id
            assert second.session_id == first.session_id

            created = await db.get(Session, first.session_id)
            assert created is not None
            assert created.user_id == student.id
            assert created.topic_id == topic.id
            assert created.status == SessionStatus.IN_PROGRESS.value
            assert created.is_anonymous == is_anonymous

            session_count = await db.scalar(
                select(func.count())
                .select_from(Session)
                .where(
                    Session.user_id == student.id,
                    Session.topic_id == topic.id,
                )
            )
            assert session_count == 1

    asyncio.run(run())


def test_service_rejects_non_member_without_creating_session() -> None:
    async def run() -> None:
        async with session_test_db() as db:
            _, topic = await create_course_and_topic(db)
            student = await create_student(db)

            store = session_crud.SQLAlchemySessionStore(
                db,
                initial_is_anonymous=False,
            )

            with pytest.raises(CourseAccessDeniedError):
                await create_or_enter_session(
                    user_id=student.id,
                    topic_id=topic.id,
                    store=store,
                )

            session_count = await db.scalar(select(func.count()).select_from(Session))
            assert session_count == 0

    asyncio.run(run())


def test_service_rejects_missing_topic_without_creating_session() -> None:
    async def run() -> None:
        async with session_test_db() as db:
            student = await create_student(db)

            store = session_crud.SQLAlchemySessionStore(
                db,
                initial_is_anonymous=False,
            )

            with pytest.raises(TopicNotFoundError):
                await create_or_enter_session(
                    user_id=student.id,
                    topic_id=uuid4(),
                    store=store,
                )

            session_count = await db.scalar(select(func.count()).select_from(Session))
            assert session_count == 0

    asyncio.run(run())


def test_delete_teacher_cascades_course_data() -> None:
    async def run() -> None:
        async with session_test_db() as db:
            course, topic = await create_course_and_topic(db)
            other_course, other_topic = await create_course_and_topic(db)
            student = await create_student(db)

            teacher = await db.get(User, course.created_by)
            assert teacher is not None

            session = Session(
                user_id=student.id,
                topic_id=topic.id,
                is_anonymous=False,
            )
            db.add_all(
                [
                    CourseMembership(
                        course_id=course.id,
                        user_id=student.id,
                        role="STUDENT",
                    ),
                    session,
                ]
            )
            await db.flush()

            course_id = course.id
            deleted_records = (
                (User, teacher.id),
                (Course, course.id),
                (Topic, topic.id),
                (Session, session.id),
            )
            preserved_records = (
                (User, student.id),
                (User, other_course.created_by),
                (Course, other_course.id),
                (Topic, other_topic.id),
            )

            await delete_teacher(db, teacher)
            await db.execute(
                text("SET CONSTRAINTS fk_topics_created_by_users IMMEDIATE")
            )

            for model, record_id in deleted_records:
                assert (
                    await db.scalar(select(model.id).where(model.id == record_id))
                    is None
                )

            assert (
                await db.scalar(
                    select(CourseMembership.user_id).where(
                        CourseMembership.course_id == course_id
                    )
                )
                is None
            )

            for model, record_id in preserved_records:
                assert (
                    await db.scalar(select(model.id).where(model.id == record_id))
                    == record_id
                )

    asyncio.run(run())


def test_topic_rejects_missing_creator() -> None:
    async def run() -> None:
        async with session_test_db() as db:
            course, _ = await create_course_and_topic(db)

            db.add(
                Topic(
                    course_id=course.id,
                    created_by=uuid4(),
                    title="Missing creator",
                )
            )
            await db.flush()

            with pytest.raises(
                IntegrityError,
                match="fk_topics_created_by_users",
            ):
                await db.execute(
                    text("SET CONSTRAINTS fk_topics_created_by_users IMMEDIATE")
                )

            await db.rollback()

    asyncio.run(run())
