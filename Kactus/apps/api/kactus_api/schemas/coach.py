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


class CoachSummaryPoint(BaseModel):
    tipo: str
    texto: str


class CoachSummary(BaseModel):
    status: str
    status_frase: str
    semana: str
    pontos: list[CoachSummaryPoint] = []
    acoes: list[str] = []
    pergunta: str | None = None


class AnalyzeResponse(BaseModel):
    """Resumo novo em `summary`; resumo antigo (markdown) em `report`."""

    summary: CoachSummary | None = None
    report: str | None = None
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
    goal_plan_id: uuid.UUID | None = None
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


class GoalPlanRequest(BaseModel):
    days_per_week: int = Field(default=3, ge=3, le=5)


class GoalPlanOut(BaseModel):
    """Plano do objetivo: fases [{fase, inicio, fim, foco}], semanas [{semana, inicio,
    fim, fase, km, longao_km, alivio}] e paces em s/km (leve_rapido, leve_lento,
    limiar, intervalo, prova)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    race_name: str
    race_date: date
    race_distance_km: float
    days_per_week: int
    vdot: float | None
    summary: str
    phases: list[dict]
    weeks: list[dict]
    paces: dict
    analysis: list[dict] | None = None  # o que a Duni levou em conta: [{tema, texto}]
    model_used: str | None
    created_at: datetime


class GoalPlanResponse(BaseModel):
    plan: GoalPlanOut | None
    workouts: list[PlannedWorkoutOut]


class RegenerateWorkoutRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=300)


class WorkoutReviewRequest(BaseModel):
    question: str | None = Field(default=None, max_length=300)


class WorkoutReviewResponse(BaseModel):
    """Analise do treino do dia. suggestion (formato da IA) volta no apply-review;
    preview e o mesmo treino nos campos de planned_workouts, para mostrar."""

    verdict: Literal["manter", "ajustar", "descanso"]
    explanation: str
    points: list[str]
    suggestion: dict | None
    preview: dict | None
    model_used: str


class ApplyReviewRequest(BaseModel):
    verdict: Literal["ajustar", "descanso"]
    suggestion: dict | None = None
    explanation: str = Field(default="", max_length=600)


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
