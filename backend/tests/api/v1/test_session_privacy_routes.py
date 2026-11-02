from dataclasses import replace
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
from app.crud import session_privacy as privacy_crud
from app.services.session_privacy import SessionPrivacyData
from tests.api.v1.conftest import FakeStore, bearer_from, seed_user


def test_update_privacy_requires_login(auth_client: TestClient) -> None:
    response = auth_client.patch(
        f"/api/v1/student/sessions/{uuid4()}/privacy",
        json={"is_anonymous": True},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": AUTH_UNAUTHORIZED_DETAIL}
    assert response.headers["www-authenticate"] == "Bearer"


@pytest.fixture
def privacy_route_db(auth_client: TestClient) -> AsyncMock:
    db = AsyncMock(spec=AsyncSession)

    async def provide_db() -> AsyncMock:
        return db

    auth_client.app.dependency_overrides[get_db] = provide_db
    return db


@pytest.mark.parametrize("is_anonymous", [True, False])
def test_owner_updates_privacy_and_commits(
    is_anonymous: bool,
    auth_client: TestClient,
    store: FakeStore,
    privacy_route_db: AsyncMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    student = seed_user(store, account_id="privacy-owner")
    login = auth_client.post(
        "/api/v1/auth/login",
        json={"account": student.account_id, "password": "password1"},
    )
    assert login.status_code == 200
    privacy_route_db.reset_mock()

    session = SessionPrivacyData(
        id=uuid4(),
        user_id=student.id,
        is_anonymous=not is_anonymous,
    )
    monkeypatch.setattr(
        privacy_crud,
        "get_session",
        AsyncMock(return_value=session),
    )
    update_mock = AsyncMock(
        return_value=replace(session, is_anonymous=is_anonymous),
    )
    monkeypatch.setattr(privacy_crud, "set_is_anonymous", update_mock)

    response = auth_client.patch(
        f"/api/v1/student/sessions/{session.id}/privacy",
        headers={"Authorization": bearer_from(login)},
        json={"is_anonymous": is_anonymous},
    )

    assert response.status_code == 200
    assert response.json() == {
        "session_id": str(session.id),
        "is_anonymous": is_anonymous,
        "message": "匿名分享設定已更新",
    }
    update_mock.assert_awaited_once_with(
        privacy_route_db,
        session_id=session.id,
        is_anonymous=is_anonymous,
    )
    privacy_route_db.commit.assert_awaited_once()
    privacy_route_db.rollback.assert_not_awaited()


@pytest.mark.parametrize(
    ("session_exists", "expected_status", "expected_detail"),
    [
        (False, 404, "Session not found"),
        (True, 403, "Not the session owner"),
    ],
)
def test_privacy_errors_do_not_update_and_roll_back(
    session_exists: bool,
    expected_status: int,
    expected_detail: str,
    auth_client: TestClient,
    store: FakeStore,
    privacy_route_db: AsyncMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    student = seed_user(store, account_id="privacy-denied")
    login = auth_client.post(
        "/api/v1/auth/login",
        json={"account": student.account_id, "password": "password1"},
    )
    assert login.status_code == 200
    privacy_route_db.reset_mock()

    session_id = uuid4()
    session = (
        SessionPrivacyData(
            id=session_id,
            user_id=uuid4(),
            is_anonymous=False,
        )
        if session_exists
        else None
    )
    monkeypatch.setattr(
        privacy_crud,
        "get_session",
        AsyncMock(return_value=session),
    )
    update_mock = AsyncMock()
    monkeypatch.setattr(privacy_crud, "set_is_anonymous", update_mock)

    response = auth_client.patch(
        f"/api/v1/student/sessions/{session_id}/privacy",
        headers={"Authorization": bearer_from(login)},
        json={"is_anonymous": True},
    )

    assert response.status_code == expected_status
    assert response.json() == {"detail": expected_detail}
    update_mock.assert_not_awaited()
    privacy_route_db.commit.assert_not_awaited()
    privacy_route_db.rollback.assert_awaited_once()


@pytest.mark.parametrize(
    "payload",
    [
        {"is_anonymous": "true"},
        {"is_anonymous": 1},
        {"is_anonymous": None},
        {},
    ],
)
def test_invalid_privacy_setting_returns_422(
    payload: dict[str, object],
    auth_client: TestClient,
    store: FakeStore,
    privacy_route_db: AsyncMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    student = seed_user(store, account_id="privacy-invalid")
    login = auth_client.post(
        "/api/v1/auth/login",
        json={"account": student.account_id, "password": "password1"},
    )
    assert login.status_code == 200
    privacy_route_db.reset_mock()

    lookup_mock = AsyncMock()
    update_mock = AsyncMock()
    monkeypatch.setattr(privacy_crud, "get_session", lookup_mock)
    monkeypatch.setattr(privacy_crud, "set_is_anonymous", update_mock)

    response = auth_client.patch(
        f"/api/v1/student/sessions/{uuid4()}/privacy",
        headers={"Authorization": bearer_from(login)},
        json=payload,
    )

    assert response.status_code == 422
    lookup_mock.assert_not_awaited()
    update_mock.assert_not_awaited()
    privacy_route_db.commit.assert_not_awaited()


def test_expired_token_cannot_update_privacy(
    auth_client: TestClient,
    store: FakeStore,
    privacy_route_db: AsyncMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    student = seed_user(store, account_id="privacy-expired")
    expired_token = create_access_token(
        subject=student.id,
        role=UserRole.USER,
        expires_delta=timedelta(minutes=-1),
    )

    lookup_mock = AsyncMock()
    update_mock = AsyncMock()
    monkeypatch.setattr(privacy_crud, "get_session", lookup_mock)
    monkeypatch.setattr(privacy_crud, "set_is_anonymous", update_mock)

    response = auth_client.patch(
        f"/api/v1/student/sessions/{uuid4()}/privacy",
        headers={"Authorization": f"Bearer {expired_token}"},
        json={"is_anonymous": True},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": AUTH_UNAUTHORIZED_DETAIL}
    assert response.headers["www-authenticate"] == "Bearer"
    lookup_mock.assert_not_awaited()
    update_mock.assert_not_awaited()
    privacy_route_db.commit.assert_not_awaited()
