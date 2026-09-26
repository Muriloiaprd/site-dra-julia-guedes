"""015 weekly_plans: plano da semana da Duni (status, avaliacao, criterios) e
treinos estruturados (objetivo, motivo, passos, alvos)

Revision ID: 015_weekly_plans
Revises: 014_athlete_memories
Create Date: 2026-09-21
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "015_weekly_plans"
down_revision: str | None = "014_athlete_memories"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "weekly_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("week_end", sa.Date(), nullable=False),
        sa.Column("status", sa.String(10), nullable=False),
        sa.Column("status_reason", sa.Text(), nullable=False),
        # resumo, carga da semana anterior, avaliacao, proxima semana, criterios, 4 semanas
        sa.Column("report", postgresql.JSONB(), nullable=False),
        sa.Column("model_used", sa.String(50), nullable=True),
        sa.Column("prompt_version", sa.String(10), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("status IN ('verde', 'amarelo', 'laranja', 'vermelho')", name="ck_weekly_plans_status"),
    )
    op.create_index("ix_weekly_plans_user_created", "weekly_plans", ["user_id", "created_at"])

    op.add_column(
        "planned_workouts",
        sa.Column("weekly_plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("weekly_plans.id", ondelete="SET NULL"), nullable=True),
    )
    op.add_column("planned_workouts", sa.Column("objective", sa.Text(), nullable=True))
    op.add_column("planned_workouts", sa.Column("reason", sa.Text(), nullable=True))
    op.add_column("planned_workouts", sa.Column("steps", postgresql.JSONB(), nullable=True))
    op.add_column("planned_workouts", sa.Column("targets", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    for col in ("targets", "steps", "reason", "objective", "weekly_plan_id"):
        op.drop_column("planned_workouts", col)
    op.drop_index("ix_weekly_plans_user_created", table_name="weekly_plans")
    op.drop_table("weekly_plans")
