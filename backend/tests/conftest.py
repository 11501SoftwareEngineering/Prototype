import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

if not (Path(__file__).resolve().parents[1] / ".env").is_file():
    for key, value in {
        "APP_ENV": "test",
        "APP_NAME": "test",
        "APP_HOST": "127.0.0.1",
        "APP_PORT": "8000",
        "CORS_ORIGINS": "[]",
        "POSTGRES_USER": "postgres",
        "POSTGRES_PASSWORD": "postgres",
        "POSTGRES_DB": "postgres",
        "POSTGRES_HOST": "localhost",
        "POSTGRES_PORT": "5432",
        "DATABASE_URL": "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres",
        "REDIS_HOST": "localhost",
        "REDIS_PORT": "6379",
        "REDIS_URL": "redis://localhost:6379/0",
        "JWT_SECRET_KEY": "test-only-jwt-secret-key-for-tests",
        "JWT_ALGORITHM": "HS256",
        "ACCESS_TOKEN_EXPIRE_MINUTES": "15",
        "OPENAI_API_KEY": "",
        "ANTHROPIC_API_KEY": "",
    }.items():
        os.environ.setdefault(key, value)


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    from app.core.config import settings
    from app.main import app

    monkeypatch.setattr(settings, "APP_ENV", "test")
    previous_overrides = app.dependency_overrides.copy()

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)
