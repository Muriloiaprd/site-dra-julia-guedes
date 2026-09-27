"""017 activities.checkin_tags: etiquetas prontas do check-in

Revision ID: 017_checkin_tags
Revises: 016_coach_activity_comment
Create Date: 2026-09-27
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "017_checkin_tags"
down_revision: str | None = "016_coach_activity_comment"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("activities", sa.Column("checkin_tags", postgresql.ARRAY(sa.String(40)), nullable=True))


def downgrade() -> None:
    op.drop_column("activities", "checkin_tags")
