"""013 activities: check-in pos-treino (PSE, dor, sensacao, notas)

Revision ID: 013_activity_checkin
Revises: 012_activity_derived_metrics
Create Date: 2026-09-21
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "013_activity_checkin"
down_revision: str | None = "012_activity_derived_metrics"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("activities", sa.Column("rpe", sa.SmallInteger(), nullable=True))
    op.add_column("activities", sa.Column("pain_level", sa.SmallInteger(), nullable=True))
    op.add_column("activities", sa.Column("pain_location", sa.String(100), nullable=True))
    op.add_column("activities", sa.Column("feeling", sa.String(30), nullable=True))
    op.add_column("activities", sa.Column("checkin_notes", sa.Text(), nullable=True))
    op.add_column("activities", sa.Column("checkin_at", sa.DateTime(timezone=True), nullable=True))
    op.create_check_constraint("ck_activities_rpe_range", "activities", "rpe IS NULL OR rpe BETWEEN 0 AND 10")
    op.create_check_constraint(
        "ck_activities_pain_level_range", "activities", "pain_level IS NULL OR pain_level BETWEEN 0 AND 10"
    )


def downgrade() -> None:
    op.drop_constraint("ck_activities_pain_level_range", "activities", type_="check")
    op.drop_constraint("ck_activities_rpe_range", "activities", type_="check")
    for col in ("checkin_at", "checkin_notes", "feeling", "pain_location", "pain_level", "rpe"):
        op.drop_column("activities", col)
