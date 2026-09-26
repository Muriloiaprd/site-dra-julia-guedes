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


_HR_ZONE_KEYS = [f"z{i}" for i in range(1, 6)]


def _validate_hr_zones(value: dict | None) -> dict | None:
    """5 zonas contiguas (z1..z5), cada uma [lo, hi] em bpm inteiros, comecando
    em 0. Sem isso, um JSON malformado passa direto pelo PUT /profile (que faz
    setattr cego) e so explode depois, em hr_zone_distribution() — a leitura de
    `GET /activities/{id}/zones` vira 500 em vez do PUT rejeitar na hora."""
    if value is None:
        return value
    if not isinstance(value, dict) or set(value.keys()) != set(_HR_ZONE_KEYS):
        raise ValueError("hr_zones deve ter exatamente as chaves z1..z5")

    prev_hi = 0
    for key in _HR_ZONE_KEYS:
        bounds = value[key]
        if (
            not isinstance(bounds, list)
            or len(bounds) != 2
            or not all(isinstance(v, int) and not isinstance(v, bool) for v in bounds)
        ):
            raise ValueError(f"{key} deve ser uma lista [lo, hi] de bpm inteiros")
        lo, hi = bounds
        if lo != prev_hi:
            raise ValueError(
                f"{key}: limite inferior ({lo}) deve ser igual ao limite superior da zona anterior ({prev_hi})"
            )
        if not (0 <= lo < hi <= 300):
            raise ValueError(f"{key}: faixa invalida ({lo}-{hi} bpm)")
        prev_hi = hi
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
    _validate_zones = field_validator("hr_zones")(_validate_hr_zones)


class RecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sport: str
    record_type: str
    value: float
    unit: str
    achieved_at: datetime
    activity_id: uuid.UUID | None = None
