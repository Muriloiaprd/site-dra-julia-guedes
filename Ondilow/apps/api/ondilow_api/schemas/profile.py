import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    full_name: str | None = None
    avatar_data_url: str | None = None
    dob: date | None = None
    sex: str | None = None
    weight_kg: float | None = None
    height_cm: float | None = None
    resting_hr: int | None = None
    max_hr: int | None = None
    hr_zones: dict | None = None
    ftp_watts: int | None = None
    css_pace_s_per_100m: float | None = None
    vo2max_estimated: float | None = None


class ProfileUpdate(BaseModel):
    full_name: str | None = None
    avatar_data_url: str | None = None
    dob: date | None = None
    sex: str | None = None
    weight_kg: float | None = None
    height_cm: float | None = None
    resting_hr: int | None = None
    max_hr: int | None = None
    hr_zones: dict | None = None
    ftp_watts: int | None = None
    css_pace_s_per_100m: float | None = None


class RecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sport: str
    record_type: str
    value: float
    unit: str
    achieved_at: datetime
    activity_id: uuid.UUID | None = None
