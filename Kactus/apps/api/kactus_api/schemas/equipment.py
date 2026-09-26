import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class EquipmentCreate(BaseModel):
    name: str = Field(..., max_length=100)
    type: str = Field(..., max_length=30)
    brand: str | None = Field(None, max_length=100)
    model: str | None = Field(None, max_length=100)
    purchase_date: date | None = None
    initial_distance_m: float = 0.0
    notes: str | None = None


class EquipmentUpdate(BaseModel):
    name: str | None = Field(None, max_length=100)
    type: str | None = Field(None, max_length=30)
    brand: str | None = Field(None, max_length=100)
    model: str | None = Field(None, max_length=100)
    purchase_date: date | None = None
    retired_at: date | None = None
    initial_distance_m: float | None = None
    notes: str | None = None


class EquipmentOut(BaseModel):
    id: uuid.UUID
    name: str
    type: str
    brand: str | None
    model: str | None
    purchase_date: date | None
    retired_at: date | None
    initial_distance_m: float
    total_distance_m: float
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
