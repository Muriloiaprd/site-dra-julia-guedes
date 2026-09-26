"""007 athlete_profile: adiciona avatar_data_url

Revision ID: 007_athlete_profile_avatar
Revises: 006_activity_source_strava
Create Date: 2026-09-11
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "007_athlete_profile_avatar"
down_revision: str | None = "006_activity_source_strava"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("athlete_profile", sa.Column("avatar_data_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("athlete_profile", "avatar_data_url")
