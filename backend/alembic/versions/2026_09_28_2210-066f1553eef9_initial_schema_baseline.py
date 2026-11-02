"""Establish the initial Alembic revision before domain models exist.

Revision ID: 066f1553eef9
Revises:
Create Date: 2026-09-28 22:10:34.156602+08:00

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "066f1553eef9"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
