"""025 athlete_profile.weekly_km_goal: meta de km de corrida por semana

Revision ID: 025_weekly_km_goal
Revises: 024_equipment_default_sports
Create Date: 2026-10-09
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "025_weekly_km_goal"
down_revision: str | None = "024_equipment_default_sports"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("athlete_profile", sa.Column("weekly_km_goal", sa.Numeric(5, 1), nullable=True))


def downgrade() -> None:
    op.drop_column("athlete_profile", "weekly_km_goal")
