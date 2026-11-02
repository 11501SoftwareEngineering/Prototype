import subprocess

import pytest
from fastapi.testclient import TestClient


@pytest.mark.integration
def test_lifespan_migrates_database_and_closes_services(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.core.config import BACKEND_DIR, settings
    from app.main import app

    monkeypatch.setattr(settings, "APP_ENV", "development")

    with TestClient(app) as client:
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        assert response.json() == {
            "status": "ok",
            "database": "ok",
            "redis": "ok",
        }

        current_revision = subprocess.run(
            [
                "uv",
                "run",
                "--locked",
                "python",
                "scripts/run_alembic.py",
                "current",
                "--verbose",
            ],
            cwd=BACKEND_DIR,
            check=True,
            capture_output=True,
            text=True,
        )
        assert "(head)" in current_revision.stdout
