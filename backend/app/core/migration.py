import asyncio
import logging

from alembic.config import Config

import app.core.alembic_utf8  # noqa: F401
from alembic import command
from app.core.config import BACKEND_DIR

logger = logging.getLogger(__name__)


def _upgrade_to_head() -> None:
    config = Config(BACKEND_DIR / "alembic.ini")
    config.attributes["configure_logger"] = False
    command.upgrade(config, "head")


async def run_migrations() -> None:
    """run db migrations by alembic."""
    logger.info("Running database migrations")
    await asyncio.to_thread(_upgrade_to_head)
