"""Service tests with fake storage; no real database or HTTP calls."""

from dataclasses import dataclass
from uuid import UUID, uuid4

import pytest

from app.services.session import (
    CourseAccessDeniedError,
    TopicNotFoundError,
    create_or_enter_session,
)

pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@dataclass
class FakeSession:
    id: UUID
    status: str = "IN_PROGRESS"


class FakeSessionStore:
    """Test-only in-memory storage, never used by production routes."""

    def __init__(self) -> None:
        self.user_id = uuid4()
        self.topic_id = uuid4()
        self.course_id = uuid4()
        self.topics = {self.topic_id: self.course_id}
        self.members = {(self.user_id, self.course_id)}
        self.sessions: dict[tuple[UUID, UUID], FakeSession] = {}
        self.create_calls = 0

    async def get_topic_course_id(self, topic_id: UUID) -> UUID | None:
        return self.topics.get(topic_id)

    async def is_course_member(self, user_id: UUID, course_id: UUID) -> bool:
        return (user_id, course_id) in self.members

    async def get_session_id(self, user_id: UUID, topic_id: UUID) -> UUID | None:
        session = self.sessions.get((user_id, topic_id))
        return session.id if session is not None else None

    async def get_or_create_session_id(self, user_id: UUID, topic_id: UUID) -> UUID:
        self.create_calls += 1
        key = (user_id, topic_id)
        if key not in self.sessions:
            self.sessions[key] = FakeSession(id=uuid4())
        return self.sessions[key].id


@pytest.fixture
def store() -> FakeSessionStore:
    return FakeSessionStore()


async def test_first_entry_creates_session(store: FakeSessionStore) -> None:
    result = await create_or_enter_session(
        user_id=store.user_id, topic_id=store.topic_id, store=store
    )

    saved = store.sessions[(store.user_id, store.topic_id)]
    assert result.session_id == saved.id
    assert result.topic_id == store.topic_id
    assert saved.status == "IN_PROGRESS"
    assert len(store.sessions) == 1
    assert store.create_calls == 1


@pytest.mark.parametrize("session_status", ["IN_PROGRESS", "COMPLETED"])
async def test_reentry_keeps_existing_session(
    store: FakeSessionStore, session_status: str
) -> None:
    first = await create_or_enter_session(
        user_id=store.user_id, topic_id=store.topic_id, store=store
    )
    saved = store.sessions[(store.user_id, store.topic_id)]
    saved.status = session_status

    second = await create_or_enter_session(
        user_id=store.user_id, topic_id=store.topic_id, store=store
    )

    assert second.session_id == first.session_id
    assert saved.status == session_status
    assert len(store.sessions) == 1
    assert store.create_calls == 1


async def test_different_users_get_separate_sessions(store: FakeSessionStore) -> None:
    other_user_id = uuid4()
    store.members.add((other_user_id, store.course_id))

    first = await create_or_enter_session(
        user_id=store.user_id, topic_id=store.topic_id, store=store
    )
    second = await create_or_enter_session(
        user_id=other_user_id, topic_id=store.topic_id, store=store
    )

    assert first.session_id != second.session_id
    assert len(store.sessions) == 2


async def test_different_topics_get_separate_sessions(store: FakeSessionStore) -> None:
    other_topic_id = uuid4()
    store.topics[other_topic_id] = store.course_id

    first = await create_or_enter_session(
        user_id=store.user_id, topic_id=store.topic_id, store=store
    )
    second = await create_or_enter_session(
        user_id=store.user_id, topic_id=other_topic_id, store=store
    )

    assert first.session_id != second.session_id
    assert second.topic_id == other_topic_id
    assert len(store.sessions) == 2


async def test_missing_topic_is_rejected(store: FakeSessionStore) -> None:
    with pytest.raises(TopicNotFoundError):
        await create_or_enter_session(
            user_id=store.user_id, topic_id=uuid4(), store=store
        )

    assert store.sessions == {}
    assert store.create_calls == 0


@pytest.mark.parametrize("has_session", [False, True])
async def test_non_member_is_rejected(
    store: FakeSessionStore, has_session: bool
) -> None:
    if has_session:
        store.sessions[(store.user_id, store.topic_id)] = FakeSession(id=uuid4())
    store.members.clear()

    with pytest.raises(CourseAccessDeniedError):
        await create_or_enter_session(
            user_id=store.user_id, topic_id=store.topic_id, store=store
        )

    assert len(store.sessions) == int(has_session)
    assert store.create_calls == 0
