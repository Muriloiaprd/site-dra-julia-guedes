import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ActivitySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sport: str
    start_time: datetime
    duration_s: int
    distance_m: float | None = None
    elevation_gain_m: float | None = None
    avg_hr: int | None = None
    avg_pace_s_per_km: float | None = None
    avg_speed_kmh: float | None = None
    title: str | None = None
    source: str


class ActivityPointOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    elapsed_time_s: int
    lat: float | None = None
    lon: float | None = None
    altitude_m: float | None = None
    distance_m: float | None = None
    hr: int | None = None
    cadence: int | None = None
    power_w: int | None = None
    speed_ms: float | None = None


class ActivityLapOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    lap_index: int
    duration_s: int | None = None
    distance_m: float | None = None
    avg_pace_s_per_km: float | None = None
    avg_hr: int | None = None
    avg_power_w: int | None = None


class ActivityDetail(ActivitySummary):
    moving_time_s: int | None = None
    elevation_loss_m: float | None = None
    max_hr: int | None = None
    avg_power_w: int | None = None
    max_power_w: int | None = None
    avg_cadence: float | None = None
    calories: int | None = None
    location_start_lat: float | None = None
    location_start_lon: float | None = None
    laps: list[ActivityLapOut] = []
    points: list[ActivityPointOut] = []


class SplitOut(BaseModel):
    index: int
    distance_m: float
    duration_s: int
    pace_s_per_km: float | None = None
    avg_hr: int | None = None
    elevation_gain_m: float | None = None


class ZoneBucketOut(BaseModel):
    zone: int
    seconds: int
    percent: float


class UploadItemResult(BaseModel):
    activity_id: uuid.UUID
    duplicate: bool
    sport: str
    distance_m: float | None = None
    points_stored: int


class UploadResponse(BaseModel):
    filename: str
    imported: list[UploadItemResult]


class NormalizedPointIn(BaseModel):
    elapsed_time_s: int
    lat: float | None = None
    lon: float | None = None
    altitude_m: float | None = None
    distance_m: float | None = None
    hr: int | None = None
    cadence: int | None = None
    power_w: int | None = None
    speed_ms: float | None = None
    temperature_c: float | None = None


class NormalizedLapIn(BaseModel):
    lap_index: int
    start_elapsed_s: int | None = None
    duration_s: int | None = None
    distance_m: float | None = None
    avg_hr: int | None = None
    max_hr: int | None = None
    avg_power_w: int | None = None
    avg_cadence: int | None = None
    elevation_gain_m: float | None = None


class NormalizedActivityIn(BaseModel):
    """Payload de import direto (sem arquivo bruto) — usado para trazer
    atividades buscadas via MCP (Garmin/Strava) quando so ha dados
    estruturados (JSON), nao um .fit/.gpx pronto para reupload.
    """

    sport: str
    start_time: datetime
    duration_s: int
    source: str = Field(pattern="^(garmin_api|strava_api|manual)$")
    source_activity_id: str | None = None
    points: list[NormalizedPointIn] = []
    laps: list[NormalizedLapIn] = []

    moving_time_s: int | None = None
    distance_m: float | None = None
    elevation_gain_m: float | None = None
    elevation_loss_m: float | None = None
    avg_hr: int | None = None
    max_hr: int | None = None
    avg_power_w: int | None = None
    max_power_w: int | None = None
    avg_cadence: float | None = None
    calories: int | None = None
    avg_temperature_c: float | None = None
    title: str | None = None
