"""008 coach: planned_workouts + coach_interactions

Revision ID: 008_coach
Revises: 007_athlete_profile_avatar
Create Date: 2026-09-11
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "008_coach"
down_revision: str | None = "007_athlete_profile_avatar"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "planned_workouts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("sport", sa.String(50), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("target_duration_s", sa.Integer(), nullable=True),
        sa.Column("target_distance_m", sa.Numeric(9, 2), nullable=True),
        sa.Column("target_tss", sa.Numeric(6, 2), nullable=True),
        sa.Column("target_intensity", sa.String(20), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="planned"),
        sa.Column("activity_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("activities.id", ondelete="SET NULL"), nullable=True),
        sa.Column("plan_batch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_planned_workouts_user_date", "planned_workouts", ["user_id", "date"])

    op.create_table(
        "coach_interactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("role", sa.String(20), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("model_used", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_coach_interactions_user_created", "coach_interactions", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_coach_interactions_user_created", table_name="coach_interactions")
    op.drop_table("coach_interactions")
    op.drop_index("ix_planned_workouts_user_date", table_name="planned_workouts")
    op.drop_table("planned_workouts")
