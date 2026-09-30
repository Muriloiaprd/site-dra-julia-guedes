"""020 remove a tabela do "Meu kit" (o boneco foi retirado do site a pedido do usuario)

A foto do equipamento (equipment.photo_data_url, da 019) continua.

Revision ID: 020_drop_equipment_kits
Revises: 019_equipment_photo_kits
Create Date: 2026-09-29
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "020_drop_equipment_kits"
down_revision: str | None = "019_equipment_photo_kits"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_table("equipment_kits")


def downgrade() -> None:
    op.create_table(
        "equipment_kits",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("preset", sa.String(20), nullable=False),
        sa.Column("slots", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "preset", name="uq_equipment_kits_user_preset"),
    )
