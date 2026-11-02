from datetime import timedelta
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.auth_policies import AUTH_UNAUTHORIZED_DETAIL
from app.core.enums import UserRole
from app.core.security import create_access_token
from app.crud import session as session_crud
from tests.api.v1.conftest import FakeStore, bearer_from, seed_user


def test_create_session_requires_login(auth_client: TestClient) -> None:
    response = auth_client.post(f"/api/v1/student/topics/{uuid4()}/sessions")

    assert response.status_code == 401
    assert response.json() == {"detail": AUTH_UNAUTHORIZED_DETAIL}
    assert response.headers["www-authenticate"] == "Bearer"


@pytest.fixture
def session_route_db(auth_client: TestClient) -> AsyncMock:
    db = AsyncMock(spec=AsyncSession)

    async def provide_db() -> AsyncMock:
        return db

    auth_client.app.dependency_overrides[get_db] = provide_db
    return db


def test_create_session_returns_ids_and_commits(
    auth_client: TestClient,
    store: FakeStore,
    session_route_db: AsyncMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    student = seed_user(store, account_id="session-student")
    login = auth_client.post(
        "/api/v1/auth/login",
        json={"account": student.account_id, "password": "password1"},
    )
    assert login.status_code == 200

    topic_id = uuid4()
    session_id = uuid4()

    monkeypatch.setattr(
        session_crud, "get_topic_course_id", AsyncMock(return_value=uuid4())
    )
    monkeypatch.setattr(session_crud, "is_course_member", AsyncMock(return_value=True))
    monkeypatch.setattr(session_crud, "get_session_id", AsyncMock(return_value=None))
    create_mock = AsyncMock(return_value=session_id)
    monkeypatch.setattr(session_crud, "get_or_create_session_id", create_mock)

    response = auth_client.post(
        f"/api/v1/student/topics/{topic_id}/sessions",
        headers={"Authorization": bearer_from(login)},
    )

    assert response.status_code == 200
    assert response.json() == {
        "session_id": str(session_id),
        "topic_id": str(topic_id),
    }
    create_mock.assert_awaited_once_with(
        session_route_db,
        user_id=student.id,
        topic_id=topic_id,
        is_anonymous=False,
    )
    session_route_db.commit.assert_awaited_once()
    session_route_db.rollback.assert_not_awaited()


@pytest.mark.parametrize(
    ("topic_exists", "expected_status", "expected_detail"),
    [
        (False, 404, "Topic not found"),
        (True, 403, "Course membership required"),
    ],
)
def test_session_errors_return_http_status_and_roll_back(
    topic_exists: bool,
    expected_status: int,
    expected_detail: str,
    auth_client: TestClient,
    store: FakeStore,
    session_route_db: AsyncMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    student = seed_user(store, account_id="session-denied")
    login = auth_client.post(
        "/api/v1/auth/login",
        json={"account": student.account_id, "password": "password1"},
    )
    assert login.status_code == 200

    topic_id = uuid4()

    monkeypatch.setattr(
        session_crud,
        "get_topic_course_id",
        AsyncMock(return_value=uuid4() if topic_exists else None),
    )
    monkeypatch.setattr(session_crud, "is_course_member", AsyncMock(return_value=False))

    lookup_mock = AsyncMock(return_value=None)
    create_mock = AsyncMock(return_value=uuid4())
    monkeypatch.setattr(session_crud, "get_session_id", lookup_mock)
    monkeypatch.setattr(session_crud, "get_or_create_session_id", create_mock)

    response = auth_client.post(
        f"/api/v1/student/topics/{topic_id}/sessions",
        headers={"Authorization": bearer_from(login)},
    )

    assert response.status_code == expected_status
    assert response.json() == {"detail": expected_detail}
    lookup_mock.assert_not_awaited()
    create_mock.assert_not_awaited()
    session_route_db.commit.assert_not_awaited()
    session_route_db.rollback.assert_awaited_once()


def test_enter_existing_session_returns_original_id(
    auth_client: TestClient,
    store: FakeStore,
    session_route_db: AsyncMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    student = seed_user(store, account_id="session-returning")
    login = auth_client.post(
        "/api/v1/auth/login",
        json={"account": student.account_id, "password": "password1"},
    )
    assert login.status_code == 200

    topic_id = uuid4()
    existing_session_id = uuid4()

    monkeypatch.setattr(
        session_crud, "get_topic_course_id", AsyncMock(return_value=uuid4())
    )
    monkeypatch.setattr(session_crud, "is_course_member", AsyncMock(return_value=True))

    lookup_mock = AsyncMock(return_value=existing_session_id)
    create_mock = AsyncMock(return_value=uuid4())
    monkeypatch.setattr(session_crud, "get_session_id", lookup_mock)
    monkeypatch.setattr(session_crud, "get_or_create_session_id", create_mock)

    response = auth_client.post(
        f"/api/v1/student/topics/{topic_id}/sessions",
        headers={"Authorization": bearer_from(login)},
    )

    assert response.status_code == 200
    assert response.json() == {
        "session_id": str(existing_session_id),
        "topic_id": str(topic_id),
    }
    lookup_mock.assert_awaited_once_with(
        session_route_db,
        user_id=student.id,
        topic_id=topic_id,
    )
    create_mock.assert_not_awaited()


def test_expired_token_cannot_create_session(
    auth_client: TestClient,
    store: FakeStore,
    session_route_db: AsyncMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    student = seed_user(store, account_id="session-expired")

    expired_token = create_access_token(
        subject=student.id,
        role=UserRole.USER,
        expires_delta=timedelta(minutes=-1),
    )

    service_mock = AsyncMock()
    monkeypatch.setattr(
        "app.services.session.create_or_enter_session",
        service_mock,
    )

    response = auth_client.post(
        f"/api/v1/student/topics/{uuid4()}/sessions",
        headers={"Authorization": f"Bearer {expired_token}"},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": AUTH_UNAUTHORIZED_DETAIL}
    assert response.headers["www-authenticate"] == "Bearer"
    service_mock.assert_not_awaited()
    session_route_db.commit.assert_not_awaited()
