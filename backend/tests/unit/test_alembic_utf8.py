"""alembic.ini must load as UTF-8 even when the process locale is not UTF-8."""

from __future__ import annotations

from configparser import ConfigParser

import pytest
from alembic.config import Config
from alembic.util import compat

from app.core import alembic_utf8
from app.core.config import BACKEND_DIR


def test_cp950_cannot_decode_alembic_ini_utf8_comments() -> None:
    """Prove the Windows-locale failure mode against our UTF-8 alembic.ini."""
    parser = ConfigParser()
    with pytest.raises(UnicodeDecodeError):
        parser.read(BACKEND_DIR / "alembic.ini", encoding="cp950")


def test_alembic_config_needs_utf8_patch_under_cp950(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Fail under Alembic's locale-style CP950 read; succeed after our UTF-8 patch."""

    def read_as_cp950(
        file_config: ConfigParser,
        file_argument: list[str],
    ) -> list[str]:
        return file_config.read(file_argument, encoding="cp950")

    monkeypatch.setattr(compat, "read_config_parser", read_as_cp950)
    broken = Config(BACKEND_DIR / "alembic.ini")
    with pytest.raises(UnicodeDecodeError):
        _ = broken.file_config

    monkeypatch.setattr(compat, "read_config_parser", alembic_utf8._read_config_parser)
    config = Config(BACKEND_DIR / "alembic.ini")
    assert config.get_main_option("script_location")
    assert compat.read_config_parser is alembic_utf8._read_config_parser
