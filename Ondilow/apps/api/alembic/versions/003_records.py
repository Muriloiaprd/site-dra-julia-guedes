"""personal_records: enum record_type + tabela

Revision ID: 003_records
Revises: 002_activities
Create Date: 2026-09-09
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003_records"
down_revision: str | None = "002_activities"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

RECORD_TYPES = (
    "fastest_1k", "fastest_5k", "fastest_10k", "fastest_21k", "fastest_42k",
    "longest_run", "longest_ride", "longest_swim",
    "most_elevation_gain", "fastest_100m_swim", "fastest_400m_swim",
    "max_hr_recorded", "max_power_1s", "best_power_5min", "best_power_20min",
    "best_power_60min", "ftp_estimated", "css_estimated", "vo2max_estimated",
)


def upgrade() -> None:
    rt = postgresql.ENUM(*RECORD_TYPES, name="record_type")
    rt.create(op.get_bind())

    op.create_table(
        "personal_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sport", postgresql.ENUM(name="sport", create_type=False), nullable=False),
        sa.Column("record_type", postgresql.ENUM(*RECORD_TYPES, name="record_type", create_type=False), nullable=False),
        sa.Column("value", sa.Numeric(10, 2), nullable=False),
        sa.Column("unit", sa.String(20), nullable=False),
        sa.Column("activity_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("activities.id", ondelete="SET NULL")),
        sa.Column("achieved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("previous_value", sa.Numeric(10, 2)),
        sa.Column("previous_activity_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("activities.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index(
        "ix_records_user_sport_type_time",
        "personal_records",
        ["user_id", "sport", "record_type", "achieved_at"],
    )


def downgrade() -> None:
    op.drop_table("personal_records")
    op.execute("DROP TYPE IF EXISTS record_type;")
