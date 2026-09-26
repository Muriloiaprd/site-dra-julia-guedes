"""016 coach_interactions.activity_id: comentario da Duni sobre uma atividade

Revision ID: 016_coach_activity_comment
Revises: 015_weekly_plans
Create Date: 2026-09-22
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "016_coach_activity_comment"
down_revision: str | None = "015_weekly_plans"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "coach_interactions",
        sa.Column(
            "activity_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("activities.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    op.create_index("ix_coach_interactions_activity", "coach_interactions", ["activity_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_coach_interactions_activity", table_name="coach_interactions")
    op.drop_column("coach_interactions", "activity_id")
