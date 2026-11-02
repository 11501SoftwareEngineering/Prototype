"""Unit tests for OpenAPI export without a running server or DB."""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest
from pydantic import ValidationError

from scripts.export_openapi import (
    DUMMY_ENV,
    _postgres_password_env_key,
    ensure_export_env,
    export_openapi_dict,
    resolve_output_path,
    write_openapi_json,
)


def test_export_openapi_dict_includes_v1_paths() -> None:
    schema = export_openapi_dict()
    assert schema["openapi"].startswith("3.")
    paths = schema["paths"]
    assert any(p.startswith("/api/v1/") for p in paths)
    assert any("health" in p for p in paths)


def test_write_openapi_json_roundtrip(tmp_path: Path) -> None:
    out = tmp_path / "openapi.json"
    write_openapi_json(out)
    data = json.loads(out.read_text(encoding="utf-8"))
    assert "paths" in data
    assert data["openapi"].startswith("3.")


def test_exported_json_does_not_embed_dummy_jwt_secret(tmp_path: Path) -> None:
    out = tmp_path / "openapi.json"
    write_openapi_json(out)
    body = out.read_text(encoding="utf-8")
    assert DUMMY_ENV["JWT_SECRET_KEY"] not in body


def test_resolve_output_path_rejects_escape(tmp_path: Path) -> None:
    # Outside repo, cwd, and the process temp dir (pytest tmp lives under temp).
    outside = Path("/") / f"openapi-export-escape-{tmp_path.name}.json"
    with pytest.raises(ValueError, match="escapes allowed"):
        resolve_output_path(outside)


def test_resolve_output_path_allows_repo_relative(tmp_path: Path) -> None:
    # Default Make path is under the repo root (parent of backend/).
    from scripts import export_openapi as mod

    target = mod._REPO_ROOT / "docs" / "openapi" / "openapi.json"
    assert resolve_output_path(target) == target.resolve()


def test_resolve_output_path_allows_api_docs_tree_root(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    tree = tmp_path / "api-docs-tree"
    out = tree / "backend" / "openapi.json"
    out.parent.mkdir(parents=True)
    monkeypatch.setenv("API_DOCS_TREE_ROOT", str(tree))
    assert resolve_output_path(out) == out.resolve()


def test_ensure_export_env_skips_dummies_when_dotenv_present(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from scripts import export_openapi as mod

    (tmp_path / ".env").write_text("APP_NAME=FromDotEnv\n", encoding="utf-8")
    monkeypatch.setattr(mod, "_BACKEND_DIR", tmp_path)
    monkeypatch.delenv("APP_NAME", raising=False)
    ensure_export_env()
    assert "APP_NAME" not in os.environ


def test_ensure_export_env_sets_product_name_without_dotenv(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from scripts import export_openapi as mod

    monkeypatch.setattr(mod, "_BACKEND_DIR", tmp_path)
    monkeypatch.delenv("APP_NAME", raising=False)
    ensure_export_env()
    assert os.environ.get("APP_NAME") == "SocratesBot"


def test_settings_rejects_missing_jwt_when_env_cleared(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Missing required Settings fields fail clearly (export relies on ensure_export_env)."""
    from app.core.config import Settings, get_settings

    get_settings.cache_clear()
    for key in (*DUMMY_ENV, _postgres_password_env_key()):
        monkeypatch.delenv(key, raising=False)
    get_settings.cache_clear()
    with pytest.raises(ValidationError):
        # Ignore backend/.env so cleared process env is what Settings sees.
        Settings(_env_file=None)  # type: ignore[call-arg]
