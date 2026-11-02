from fastapi.testclient import TestClient

from app.core.database import get_db
from app.core.redis import get_redis


class FakeDatabase:
    def __init__(self, should_fail: bool = False) -> None:
        self.should_fail = should_fail

    async def execute(self, _query: object) -> None:
        if self.should_fail:
            raise RuntimeError("database unavailable")


class FakeRedis:
    def __init__(self, should_fail: bool = False) -> None:
        self.should_fail = should_fail

    async def ping(self) -> bool:
        if self.should_fail:
            raise RuntimeError("redis unavailable")
        return True


def override_dependencies(
    client: TestClient,
    *,
    database_fails: bool = False,
    redis_fails: bool = False,
) -> None:
    database = FakeDatabase(should_fail=database_fails)
    redis = FakeRedis(should_fail=redis_fails)

    async def provide_database() -> FakeDatabase:
        return database

    async def provide_redis() -> FakeRedis:
        return redis

    client.app.dependency_overrides[get_db] = provide_database
    client.app.dependency_overrides[get_redis] = provide_redis


def test_health_returns_ok_when_dependencies_are_healthy(client: TestClient) -> None:
    override_dependencies(client)

    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "database": "ok",
        "redis": "ok",
    }


def test_health_returns_503_when_database_is_unavailable(client: TestClient) -> None:
    override_dependencies(client, database_fails=True)

    response = client.get("/api/v1/health")

    assert response.status_code == 503
    assert response.json() == {
        "status": "error",
        "database": "error",
        "redis": "ok",
    }


def test_health_returns_503_when_redis_is_unavailable(client: TestClient) -> None:
    override_dependencies(client, redis_fails=True)

    response = client.get("/api/v1/health")

    assert response.status_code == 503
    assert response.json() == {
        "status": "error",
        "database": "ok",
        "redis": "error",
    }
