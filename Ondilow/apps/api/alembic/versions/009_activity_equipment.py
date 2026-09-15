"""009 activity_equipment: vincula atividade a um equipamento

Revision ID: 009_activity_equipment
Revises: 008_coach
Create Date: 2026-09-15
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "009_activity_equipment"
down_revision: str | None = "008_coach"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "activities",
        sa.Column(
            "equipment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("equipment.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_activities_equipment", "activities", ["equipment_id"])


def downgrade() -> None:
    op.drop_index("ix_activities_equipment", table_name="activities")
    op.drop_column("activities", "equipment_id")
