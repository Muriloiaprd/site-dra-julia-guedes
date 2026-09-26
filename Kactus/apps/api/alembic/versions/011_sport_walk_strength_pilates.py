"""011 sport: adiciona walk, strength e pilates

Revision ID: 011_sport_walk_strength_pilates
Revises: 010_athlete_profile_logo
Create Date: 2026-09-21
"""
from collections.abc import Sequence

from alembic import op

revision: str = "011_sport_walk_strength_pilates"
down_revision: str | None = "010_athlete_profile_logo"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        for value in ("walk", "strength", "pilates"):
            op.execute(f"ALTER TYPE sport ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    # Postgres nao suporta remover valor de enum diretamente; downgrade e no-op.
    pass
