import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

MemoryKind = Literal["objetivo", "prova", "lesao", "disponibilidade", "preferencia", "outro"]


class ChatRequest(BaseModel):
    message: str


class MemorySuggestion(BaseModel):
    """Algo que a Duni percebeu na conversa e acha que vale lembrar. So vira
    memoria se o atleta confirmar na tela."""

    kind: MemoryKind
    content: str = Field(max_length=500)
    event_date: date | None = None


class ChatResponse(BaseModel):
    reply: str
    model_used: str
    memory_suggestions: list[MemorySuggestion] = []


class MemoryIn(BaseModel):
    kind: MemoryKind
    content: str = Field(min_length=1, max_length=500)
    event_date: date | None = None
    source: Literal["manual", "duni"] = "manual"


class MemoryUpdate(BaseModel):
    kind: MemoryKind | None = None
    content: str | None = Field(default=None, min_length=1, max_length=500)
    event_date: date | None = None
    active: bool | None = None


class MemoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: str
    content: str
    event_date: date | None
    active: bool
    source: str
    created_at: datetime


class AnalyzeResponse(BaseModel):
    report: str
    model_used: str
    generated_at: datetime


class PlannedWorkoutOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    date: date
    sport: str
    title: str
    description: str | None
    target_duration_s: int | None
    target_distance_m: float | None
    target_tss: float | None
    target_intensity: str | None
    status: str
    activity_id: uuid.UUID | None
    weekly_plan_id: uuid.UUID | None = None
    objective: str | None = None
    reason: str | None = None
    steps: list[dict] | None = None
    targets: dict | None = None


class WeeklyPlanOut(BaseModel):
    """Status e relatorio da semana. `report` tem resumo, carga_semana_anterior,
    avaliacao, proxima_semana, criterios_ajuste e proximas_4_semanas."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    week_start: date
    week_end: date
    status: str
    status_reason: str
    report: dict
    model_used: str | None
    created_at: datetime


class WeeklyPlanResponse(BaseModel):
    plan: WeeklyPlanOut | None
    workouts: list[PlannedWorkoutOut]


class RegenerateWorkoutRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=300)


class RegenerateWorkoutResponse(BaseModel):
    workout: PlannedWorkoutOut | None  # None = a Duni trocou por descanso
    explanation: str
    model_used: str


class ActivityCommentResponse(BaseModel):
    """Comentario da Duni sobre uma atividade; comment=None se ainda nao pediu."""

    comment: str | None
    model_used: str | None = None
    generated_at: datetime | None = None


class MoveWorkoutRequest(BaseModel):
    date: date
    on_conflict: Literal["error", "swap", "keep_both"] = "error"


class UpdateWorkoutStatusRequest(BaseModel):
    status: str | None = None
    activity_id: uuid.UUID | None = None


class ChatHistoryItem(BaseModel):
    role: str | None
    content: str
    created_at: datetime

    class Config:
        from_attributes = True
