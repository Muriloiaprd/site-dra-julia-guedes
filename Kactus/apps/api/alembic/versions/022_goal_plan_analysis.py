"""022 goal_plans.analysis: o que a Duni levou em conta (6 meses de historico)

Revision ID: 022_goal_plan_analysis
Revises: 021_goal_plans
Create Date: 2026-10-05
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "022_goal_plan_analysis"
down_revision: str | None = "021_goal_plans"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # [{tema, texto}]: volume recente, historico, pausas, dor, nivel, dias, preferencias
    op.add_column("goal_plans", sa.Column("analysis", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("goal_plans", "analysis")
