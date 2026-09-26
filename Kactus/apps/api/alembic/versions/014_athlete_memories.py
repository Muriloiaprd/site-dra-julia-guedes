"""014 athlete_memories: o que a Duni sabe do atleta (objetivo, provas, lesoes...)

Revision ID: 014_athlete_memories
Revises: 013_activity_checkin
Create Date: 2026-09-21
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "014_athlete_memories"
down_revision: str | None = "013_activity_checkin"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "athlete_memories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("event_date", sa.Date(), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("source", sa.String(10), nullable=False, server_default="manual"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "kind IN ('objetivo', 'prova', 'lesao', 'disponibilidade', 'preferencia', 'outro')",
            name="ck_athlete_memories_kind",
        ),
        sa.CheckConstraint("source IN ('manual', 'duni')", name="ck_athlete_memories_source"),
    )
    op.create_index("ix_athlete_memories_user_active", "athlete_memories", ["user_id", "active"])


def downgrade() -> None:
    op.drop_index("ix_athlete_memories_user_active", table_name="athlete_memories")
    op.drop_table("athlete_memories")
