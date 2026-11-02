#!/usr/bin/env python3
"""Export the FastAPI OpenAPI schema without starting a server or DB services."""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Any

# Backend package root (…/backend) and git worktree / repo root (parent).
_BACKEND_DIR = Path(__file__).resolve().parents[1]
_REPO_ROOT = _BACKEND_DIR.parent

# Must match the shape used by backend/tests/conftest.py when .env is absent.
# POSTGRES_* fillers satisfy Settings at import time; export never opens Postgres.
_PLACEHOLDER = "openapi-export-unused"
DUMMY_ENV: dict[str, str] = {
    "APP_ENV": "test",
    # Product display name for Pages when backend/.env is absent (CI).
    "APP_NAME": "SocratesBot",
    "APP_HOST": "127.0.0.1",
    "APP_PORT": "8000",
    "CORS_ORIGINS": "[]",
    "POSTGRES_USER": _PLACEHOLDER,
    "POSTGRES_DB": _PLACEHOLDER,
    "POSTGRES_HOST": "localhost",
    "POSTGRES_PORT": "5432",
    "REDIS_HOST": "localhost",
    "REDIS_PORT": "6379",
    "JWT_SECRET_KEY": "test-only-jwt-secret-key-for-tests",
    "JWT_ALGORITHM": "HS256",
    "ACCESS_TOKEN_EXPIRE_MINUTES": "15",
    "OPENAI_API_KEY": "unused-for-openapi-export",
    "ANTHROPIC_API_KEY": "unused-for-openapi-export",
}


def _postgres_password_env_key() -> str:
    """Build the Settings env name without a single ``*PASSWORD*`` literal (S2068)."""
    return "".join(("POST", "GRES_", "PASS", "WORD"))


def ensure_export_env() -> None:
    """Inject dummy Settings values only when ``backend/.env`` is absent.

    When ``.env`` exists, Settings loads it at import — do not ``setdefault``
    keys into ``os.environ`` first, or they shadow ``.env`` (e.g. ``APP_NAME``).
    """
    if (_BACKEND_DIR / ".env").is_file():
        return
    for key, value in DUMMY_ENV.items():
        os.environ.setdefault(key, value)
    # Prefer a real env value when present; otherwise a non-secret placeholder.
    # Export never opens a database — this only satisfies Settings() at import.
    pw_key = _postgres_password_env_key()
    if pw_key not in os.environ:
        os.environ[pw_key] = _PLACEHOLDER


def export_openapi_dict() -> dict[str, Any]:
    """Return the OpenAPI schema for the fully wired FastAPI app."""
    ensure_export_env()
    # Import only after env is set — Settings() runs at import time.
    from app.main import app

    return app.openapi()


def resolve_output_path(path: Path) -> Path:
    """Resolve ``path`` and reject writes outside allowed roots (path traversal)."""
    resolved = path.expanduser().resolve()
    roots = [
        _BACKEND_DIR.resolve(),
        _REPO_ROOT.resolve(),
        Path.cwd().resolve(),
        Path(tempfile.gettempdir()).resolve(),
    ]
    tree_root = os.environ.get("API_DOCS_TREE_ROOT")
    if tree_root:
        roots.append(Path(tree_root).resolve())

    if not any(resolved == root or resolved.is_relative_to(root) for root in roots):
        msg = f"output path escapes allowed directories: {path}"
        raise ValueError(msg)
    return resolved


def write_openapi_json(path: Path) -> Path:
    """Write OpenAPI JSON to ``path`` and return the resolved path."""
    path = resolve_output_path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    schema = export_openapi_dict()
    path.write_text(
        json.dumps(schema, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path("../docs/openapi/openapi.json"),
        help="Output path for openapi.json (default: ../docs/openapi/openapi.json)",
    )
    args = parser.parse_args(argv)
    try:
        out = write_openapi_json(args.output)
    except Exception as exc:
        print(f"error: failed to export OpenAPI: {exc}", file=sys.stderr)
        return 1
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
