"""021 goal_plans: plano do objetivo da Duni (todas as semanas ate a prova) e o
vinculo dos treinos planejados com ele (planned_workouts.goal_plan_id)

Revision ID: 021_goal_plans
Revises: 020_drop_equipment_kits
Create Date: 2026-10-05
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "021_goal_plans"
down_revision: str | None = "020_drop_equipment_kits"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "goal_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "memory_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("athlete_memories.id", ondelete="SET NULL"), nullable=True,
        ),
        sa.Column("race_name", sa.Text(), nullable=False),
        sa.Column("race_date", sa.Date(), nullable=False),
        sa.Column("race_distance_km", sa.Numeric(5, 1), nullable=False),
        sa.Column("days_per_week", sa.Integer(), nullable=False),
        sa.Column("vdot", sa.Numeric(4, 1), nullable=True),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("phases", postgresql.JSONB(), nullable=False),
        sa.Column("weeks", postgresql.JSONB(), nullable=False),
        sa.Column("paces", postgresql.JSONB(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("model_used", sa.String(50), nullable=True),
        sa.Column("prompt_version", sa.String(10), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_goal_plans_user_active", "goal_plans", ["user_id", "active"])

    op.add_column(
        "planned_workouts",
        sa.Column("goal_plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("goal_plans.id", ondelete="SET NULL"), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("planned_workouts", "goal_plan_id")
    op.drop_index("ix_goal_plans_user_active", table_name="goal_plans")
    op.drop_table("goal_plans")
