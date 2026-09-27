"""018 dados do Garmin que o FIT traz: efeito de treino, dinamica de corrida,
temperatura, suor, autoavaliacao do relogio

Revision ID: 018_garmin_fields
Revises: 017_checkin_tags
Create Date: 2026-09-27
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "018_garmin_fields"
down_revision: str | None = "017_checkin_tags"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_ACTIVITY_COLUMNS = [
    ("training_effect_aerobic", sa.Numeric(3, 1)),
    ("training_effect_anaerobic", sa.Numeric(3, 1)),
    ("primary_benefit", sa.SmallInteger()),
    ("hr_recovery", sa.SmallInteger()),
    ("sweat_loss_ml", sa.Integer()),
    ("resting_calories", sa.Integer()),
    ("min_temperature_c", sa.Numeric(4, 1)),
    ("max_temperature_c", sa.Numeric(4, 1)),
    ("avg_vertical_oscillation_mm", sa.Numeric(5, 1)),
    ("avg_stance_time_ms", sa.Numeric(5, 1)),
    ("avg_vertical_ratio_pct", sa.Numeric(4, 2)),
    ("avg_step_length_m", sa.Numeric(4, 2)),
    ("total_strides", sa.Integer()),
    ("walk_time_s", sa.Integer()),
    ("watch_feel", sa.SmallInteger()),
    ("watch_rpe", sa.SmallInteger()),
]

_POINT_COLUMNS = [
    ("vertical_oscillation_mm", sa.Numeric(5, 1)),
    ("stance_time_ms", sa.SmallInteger()),
    ("vertical_ratio_pct", sa.Numeric(4, 2)),
    ("step_length_mm", sa.SmallInteger()),
]


def upgrade() -> None:
    for name, type_ in _ACTIVITY_COLUMNS:
        op.add_column("activities", sa.Column(name, type_, nullable=True))
    for name, type_ in _POINT_COLUMNS:
        op.add_column("activity_points", sa.Column(name, type_, nullable=True))


def downgrade() -> None:
    for name, _ in _POINT_COLUMNS:
        op.drop_column("activity_points", name)
    for name, _ in _ACTIVITY_COLUMNS:
        op.drop_column("activities", name)
