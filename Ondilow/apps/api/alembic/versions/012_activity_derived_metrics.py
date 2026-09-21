"""012 activities/laps: GAP, deriva cardiaca e versao dos derivados

So cria as colunas. O preenchimento das atividades ja existentes (e a correcao
da cadencia gravada por perna) e feito por scripts/backfill_derived.py, que le
os pontos de cada atividade e e seguro de rodar de novo.

Revision ID: 012_activity_derived_metrics
Revises: 011_sport_walk_strength_pilates
Create Date: 2026-09-21
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "012_activity_derived_metrics"
down_revision: str | None = "011_sport_walk_strength_pilates"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("activities", sa.Column("gap_pace_s_per_km", sa.Numeric(6, 2), nullable=True))
    op.add_column("activities", sa.Column("hr_decoupling_pct", sa.Numeric(5, 2), nullable=True))
    op.add_column("activities", sa.Column("derived_version", sa.SmallInteger(), nullable=True))
    op.add_column("activity_laps", sa.Column("gap_pace_s_per_km", sa.Numeric(6, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("activity_laps", "gap_pace_s_per_km")
    op.drop_column("activities", "derived_version")
    op.drop_column("activities", "hr_decoupling_pct")
    op.drop_column("activities", "gap_pace_s_per_km")
