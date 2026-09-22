import datetime as dt
import uuid

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ondilow_api.db import Base

WEEKLY_STATUSES = ("verde", "amarelo", "laranja", "vermelho")


class WeeklyPlan(Base):
    """Plano da semana da Duni: status (verde/amarelo/laranja/vermelho) com a
    justificativa e o relatorio estruturado. Os treinos ficam em planned_workouts."""

    __tablename__ = "weekly_plans"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    week_start: Mapped[dt.date] = mapped_column(Date(), nullable=False)
    week_end: Mapped[dt.date] = mapped_column(Date(), nullable=False)
    status: Mapped[str] = mapped_column(String(10), nullable=False)
    status_reason: Mapped[str] = mapped_column(Text(), nullable=False)
    report: Mapped[dict] = mapped_column(JSONB(), nullable=False)
    model_used: Mapped[str | None] = mapped_column(String(50), nullable=True)
    prompt_version: Mapped[str | None] = mapped_column(String(10), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=lambda: dt.datetime.now(dt.UTC))


class PlannedWorkout(Base):
    __tablename__ = "planned_workouts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date: Mapped[dt.date] = mapped_column(Date(), nullable=False)
    sport: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    target_duration_s: Mapped[int | None] = mapped_column(nullable=True)
    target_distance_m: Mapped[float | None] = mapped_column(Numeric(9, 2), nullable=True)
    target_tss: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    target_intensity: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="planned")
    activity_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("activities.id", ondelete="SET NULL"), nullable=True
    )
    plan_batch_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    weekly_plan_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("weekly_plans.id", ondelete="SET NULL"), nullable=True
    )
    objective: Mapped[str | None] = mapped_column(Text(), nullable=True)  # finalidade fisiologica
    reason: Mapped[str | None] = mapped_column(Text(), nullable=True)  # por que esta semana (dados)
    steps: Mapped[list | None] = mapped_column(JSONB(), nullable=True)  # aquecimento/principal/desaquecimento
    targets: Mapped[dict | None] = mapped_column(JSONB(), nullable=True)  # ritmo, GAP, FC, PSE, cadencia...
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)


MEMORY_KINDS = ("objetivo", "prova", "lesao", "disponibilidade", "preferencia", "outro")


class AthleteMemory(Base):
    """O que a Duni sabe do atleta alem dos dados do relogio: objetivo, provas,
    lesoes, dias disponiveis, preferencias. Sugeridas pela Duni no chat so viram
    memoria com a confirmacao do atleta (source='duni')."""

    __tablename__ = "athlete_memories"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text(), nullable=False)
    event_date: Mapped[dt.date | None] = mapped_column(Date(), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    source: Mapped[str] = mapped_column(String(10), nullable=False, default="manual")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=lambda: dt.datetime.now(dt.UTC))
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=lambda: dt.datetime.now(dt.UTC))


class CoachInteraction(Base):
    __tablename__ = "coach_interactions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    content: Mapped[str] = mapped_column(Text(), nullable=False)
    model_used: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # kind='activity': comentario da Duni sobre esta atividade (Fase 8)
    activity_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("activities.id", ondelete="CASCADE"), nullable=True
    )
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=dt.datetime.utcnow)
