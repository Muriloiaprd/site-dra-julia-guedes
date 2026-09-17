"""010 athlete_profile: adiciona logo_data_url

Revision ID: 010_athlete_profile_logo
Revises: 009_activity_equipment
Create Date: 2026-09-15
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "010_athlete_profile_logo"
down_revision: str | None = "009_activity_equipment"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("athlete_profile", sa.Column("logo_data_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("athlete_profile", "logo_data_url")
