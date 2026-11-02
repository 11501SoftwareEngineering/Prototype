"""Alembic CLI entry that reads alembic.ini as UTF-8 (Windows locale-safe)."""

from __future__ import annotations

import sys
from pathlib import Path

# backend/ on sys.path so `app` imports work when invoked as a script
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from alembic.config import main

import app.core.alembic_utf8  # noqa: F401

if __name__ == "__main__":
    main()
