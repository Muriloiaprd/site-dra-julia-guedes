"""006 activity_source: adiciona strava_api

Revision ID: 006_activity_source_strava
Revises: 005_equipment
Create Date: 2026-09-10
"""
from collections.abc import Sequence

from alembic import op

revision: str = "006_activity_source_strava"
down_revision: str | None = "005_equipment"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE activity_source ADD VALUE IF NOT EXISTS 'strava_api'")


def downgrade() -> None:
    # Postgres nao suporta remover valor de enum diretamente; downgrade e no-op.
    pass
