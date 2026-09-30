import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator

# Foto vem redimensionada do navegador (~30 KB); o teto so barra upload cru por engano.
PHOTO_MAX_CHARS = 400_000  # ~300 KB de imagem em base64
_PHOTO_PREFIXES = ("data:image/jpeg;base64,", "data:image/png;base64,")


def _check_photo(v: str | None) -> str | None:
    if v is None or v == "":
        return None
    if not v.startswith(_PHOTO_PREFIXES):
        raise ValueError("a foto precisa ser JPEG ou PNG em data URL")
    if len(v) > PHOTO_MAX_CHARS:
        raise ValueError("foto grande demais (máximo ~300 KB)")
    return v


class EquipmentCreate(BaseModel):
    name: str = Field(..., max_length=100)
    type: str = Field(..., max_length=30)
    brand: str | None = Field(None, max_length=100)
    model: str | None = Field(None, max_length=100)
    purchase_date: date | None = None
    initial_distance_m: float = 0.0
    notes: str | None = None
    photo_data_url: str | None = None

    _photo = field_validator("photo_data_url")(_check_photo)


class EquipmentUpdate(BaseModel):
    name: str | None = Field(None, max_length=100)
    type: str | None = Field(None, max_length=30)
    brand: str | None = Field(None, max_length=100)
    model: str | None = Field(None, max_length=100)
    purchase_date: date | None = None
    retired_at: date | None = None
    initial_distance_m: float | None = None
    notes: str | None = None
    photo_data_url: str | None = None

    _photo = field_validator("photo_data_url")(_check_photo)


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
    photo_data_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
