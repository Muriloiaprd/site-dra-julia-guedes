"""023 weekly_plans.kind: 'principal' (o plano que vale, ligado ao objetivo) ou
'livre' (o plano da semana pelo estado de agora, so para comparar com o objetivo)

Revision ID: 023_weekly_plan_kind
Revises: 022_goal_plan_analysis
Create Date: 2026-10-05
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "023_weekly_plan_kind"
down_revision: str | None = "022_goal_plan_analysis"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("weekly_plans", sa.Column("kind", sa.String(10), nullable=False, server_default="principal"))


def downgrade() -> None:
    op.drop_column("weekly_plans", "kind")
