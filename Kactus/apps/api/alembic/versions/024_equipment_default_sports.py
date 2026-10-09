"""024 equipment.default_sports: esportes em que o equipamento entra sozinho
nos treinos importados (tenis padrao da corrida, da esteira...)

Revision ID: 024_equipment_default_sports
Revises: 023_weekly_plan_kind
Create Date: 2026-10-09
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "024_equipment_default_sports"
down_revision: str | None = "023_weekly_plan_kind"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "equipment",
        sa.Column("default_sports", postgresql.ARRAY(sa.String(30)), nullable=False, server_default="{}"),
    )


def downgrade() -> None:
    op.drop_column("equipment", "default_sports")
