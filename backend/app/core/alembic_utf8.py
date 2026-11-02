"""Force Alembic to read alembic.ini as UTF-8.

Alembic 1.20 uses encoding="locale" for ConfigParser reads. On Windows with
CP950 (or other non-UTF-8 locales), UTF-8 Traditional Chinese comments in
alembic.ini raise UnicodeDecodeError before any migration runs.
"""

from __future__ import annotations

import os
from configparser import ConfigParser

from alembic.util import compat


def _read_config_parser(
    file_config: ConfigParser,
    file_argument: list[str | os.PathLike[str]],
) -> list[str]:
    return file_config.read(file_argument, encoding="utf-8")


compat.read_config_parser = _read_config_parser
