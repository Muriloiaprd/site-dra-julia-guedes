"""initial: users, athlete_profile, user_integrations

Revision ID: 001_initial
Revises:
Create Date: 2026-09-09
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_UPDATED_AT_FN = """
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""


def _updated_at_trigger(table: str) -> str:
    return (
        f"CREATE TRIGGER trg_{table}_updated_at BEFORE UPDATE ON {table} "
        f"FOR EACH ROW EXECUTE FUNCTION set_updated_at();"
    )


def upgrade() -> None:
    op.execute(_UPDATED_AT_FN)

    op.create_table(
        "users",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("email_verified_at", sa.DateTime(timezone=True)),
        sa.Column("last_login_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.execute(_updated_at_trigger("users"))

    op.create_table(
        "athlete_profile",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("full_name", sa.String(255)),
        sa.Column("dob", sa.Date()),
        sa.Column("sex", sa.String(1)),
        sa.Column("weight_kg", sa.Numeric(5, 2)),
        sa.Column("height_cm", sa.Numeric(5, 2)),
        sa.Column("resting_hr", sa.SmallInteger()),
        sa.Column("max_hr", sa.SmallInteger()),
        sa.Column("hr_zones", postgresql.JSONB()),
        sa.Column("run_pace_zones", postgresql.JSONB()),
        sa.Column("bike_power_zones", postgresql.JSONB()),
        sa.Column("swim_pace_zones", postgresql.JSONB()),
        sa.Column("ftp_watts", sa.SmallInteger()),
        sa.Column("css_pace_s_per_100m", sa.Numeric(5, 2)),
        sa.Column("vo2max_estimated", sa.Numeric(4, 2)),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("sex IS NULL OR sex IN ('M', 'F', 'O')", name="ck_athlete_profile_sex"),
    )
    op.execute(_updated_at_trigger("athlete_profile"))

    op.create_table(
        "user_integrations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("provider", sa.String(30), nullable=False),
        sa.Column("credentials_encrypted", sa.LargeBinary(), nullable=False),
        sa.Column("tokens_encrypted", sa.LargeBinary()),
        sa.Column("last_sync_at", sa.DateTime(timezone=True)),
        sa.Column("last_sync_status", sa.String(20)),
        sa.Column("last_sync_error", sa.Text()),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("user_id", "provider", name="uq_user_integration_provider"),
    )
    op.create_index("ix_user_integrations_user_provider", "user_integrations", ["user_id", "provider"])
    op.execute(_updated_at_trigger("user_integrations"))


def downgrade() -> None:
    op.drop_table("user_integrations")
    op.drop_table("athlete_profile")
    op.drop_table("users")
    op.execute("DROP FUNCTION IF EXISTS set_updated_at();")
