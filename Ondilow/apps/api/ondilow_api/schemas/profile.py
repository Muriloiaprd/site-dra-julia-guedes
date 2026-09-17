import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, field_validator

_LOGO_PREFIX = "data:image/png;base64,"
_LOGO_MAX_BYTES = 700 * 1024


def _validate_logo_data_url(value: str | None) -> str | None:
    if value is None:
        return value
    if not value.startswith(_LOGO_PREFIX):
        raise ValueError("logo_data_url deve ser um PNG em base64 (data:image/png;base64,...)")
    if len(value) > _LOGO_MAX_BYTES:
        raise ValueError(f"logo_data_url deve ter no maximo {_LOGO_MAX_BYTES // 1024}KB")
    return value


class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    full_name: str | None = None
    avatar_data_url: str | None = None
    logo_data_url: str | None = None
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
    logo_data_url: str | None = None
    dob: date | None = None
    sex: str | None = None
    weight_kg: float | None = None
    height_cm: float | None = None
    resting_hr: int | None = None
    max_hr: int | None = None
    hr_zones: dict | None = None
    ftp_watts: int | None = None
    css_pace_s_per_100m: float | None = None

    _validate_logo = field_validator("logo_data_url")(_validate_logo_data_url)


class RecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sport: str
    record_type: str
    value: float
    unit: str
    achieved_at: datetime
    activity_id: uuid.UUID | None = None
