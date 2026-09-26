"""004 daily metrics

Revision ID: 004
Revises: 003
Create Date: 2026-09-09
"""

from alembic import op
import sqlalchemy as sa

revision = "004_daily_metrics"
down_revision = "003_records"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "daily_metrics",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("sport", sa.String(50), nullable=True),
        sa.Column("daily_load", sa.Numeric(8, 2), nullable=True),
        sa.Column("ctl", sa.Numeric(8, 2), nullable=True),
        sa.Column("atl", sa.Numeric(8, 2), nullable=True),
        sa.Column("tsb", sa.Numeric(8, 2), nullable=True),
        sa.Column("acwr", sa.Numeric(5, 3), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "date", "sport", name="uq_daily_metrics_user_date_sport"),
    )
    op.create_index("ix_daily_metrics_user_date", "daily_metrics", ["user_id", sa.text("date DESC")])

    op.execute("""
        CREATE TRIGGER trg_daily_metrics_updated_at
        BEFORE UPDATE ON daily_metrics
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    """)


def downgrade() -> None:
    op.drop_table("daily_metrics")
