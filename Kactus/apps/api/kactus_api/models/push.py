import datetime as dt
import uuid

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from kactus_api.db import Base


class PushSubscription(Base):
    """Um aparelho que aceitou notificações (Web Push). No iPhone só existe com o
    app na Tela de Início (iOS 16.4+)."""

    __tablename__ = "push_subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    endpoint: Mapped[str] = mapped_column(Text(), nullable=False, unique=True)
    p256dh: Mapped[str] = mapped_column(Text(), nullable=False)
    auth: Mapped[str] = mapped_column(Text(), nullable=False)
    device: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_sent_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failures: Mapped[int] = mapped_column(Integer(), nullable=False, default=0)


class PushLog(Base):
    """O que já foi avisado: (tipo, chave) único por usuário, para não repetir."""

    __tablename__ = "push_log"
    __table_args__ = (UniqueConstraint("user_id", "kind", "key", name="uq_push_log_user_kind_key"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    kind: Mapped[str] = mapped_column(String(30), nullable=False)
    key: Mapped[str] = mapped_column(String(120), nullable=False)
    sent_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
