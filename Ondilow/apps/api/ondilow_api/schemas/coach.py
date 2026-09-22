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


class GeneratePlanRequest(BaseModel):
    days: int = 7


class PlannedWorkoutOut(BaseModel):
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

    class Config:
        from_attributes = True


class UpdateWorkoutStatusRequest(BaseModel):
    status: str | None = None
    activity_id: uuid.UUID | None = None


class ChatHistoryItem(BaseModel):
    role: str | None
    content: str
    created_at: datetime

    class Config:
        from_attributes = True
