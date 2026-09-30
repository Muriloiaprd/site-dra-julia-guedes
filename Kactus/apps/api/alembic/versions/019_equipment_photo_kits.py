"""019 foto do equipamento e kits do boneco ("Meu kit")

- equipment.photo_data_url: foto real da peca, redimensionada no navegador (data URL).
- equipment_kits: um boneco montado por preset (corrida, prova, calor, frio), com
  as pecas de cada encaixe em JSONB.

Revision ID: 019_equipment_photo_kits
Revises: 018_garmin_fields
Create Date: 2026-09-29
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "019_equipment_photo_kits"
down_revision: str | None = "018_garmin_fields"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("equipment", sa.Column("photo_data_url", sa.Text(), nullable=True))

    op.create_table(
        "equipment_kits",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("preset", sa.String(20), nullable=False),
        sa.Column("slots", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "preset", name="uq_equipment_kits_user_preset"),
    )


def downgrade() -> None:
    op.drop_table("equipment_kits")
    op.drop_column("equipment", "photo_data_url")
