import uuid
from datetime import date, datetime

from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str
    model_used: str


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
