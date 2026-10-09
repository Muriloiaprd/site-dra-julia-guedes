"""027 goal_plans.target_time_s: tempo-alvo escolhido pelo atleta para a prova

Revision ID: 027_goal_target_time
Revises: 026_push_notifications
Create Date: 2026-10-09
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "027_goal_target_time"
down_revision: str | None = "026_push_notifications"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("goal_plans", sa.Column("target_time_s", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("goal_plans", "target_time_s")
