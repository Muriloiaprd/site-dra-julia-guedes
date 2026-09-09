"""Persiste uma NormalizedActivity: dedup, downsample, campos derivados basicos.

Metricas avancadas (TSS, zonas, VO2max, recordes) sao calculadas nos sprints
seguintes; aqui ficam apenas os derivados diretos do proprio arquivo.
"""

import hashlib
import uuid
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ondilow_api.config import settings
from ondilow_api.metrics.load import update_daily_metrics
from ondilow_api.metrics.records import update_records
from ondilow_api.models import Activity, ActivityLap, ActivityPoint
from ondilow_api.parsers.base import NormalizedActivity


@dataclass(slots=True)
class ImportResult:
    activity_id: uuid.UUID
    duplicate: bool
    sport: str
    distance_m: float | None
    points_stored: int


def file_sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def import_activity(
    db: Session,
    user_id: uuid.UUID,
    norm: NormalizedActivity,
    *,
    file_hash: str | None = None,
    file_path: str | None = None,
) -> ImportResult:
    existing = _find_duplicate(db, user_id, norm, file_hash)
    if existing is not None:
        return ImportResult(existing.id, True, existing.sport, _as_float(existing.distance_m), 0)

    _derive_summary(norm)

    activity = Activity(
        user_id=user_id,
        sport=norm.sport,
        start_time=norm.start_time,
        duration_s=norm.duration_s,
        moving_time_s=norm.moving_time_s,
        distance_m=norm.distance_m,
        elevation_gain_m=norm.elevation_gain_m,
        elevation_loss_m=norm.elevation_loss_m,
        avg_hr=norm.avg_hr,
        max_hr=norm.max_hr,
        avg_power_w=norm.avg_power_w,
        max_power_w=norm.max_power_w,
        avg_cadence=norm.avg_cadence,
        avg_temperature_c=norm.avg_temperature_c,
        calories=norm.calories,
        avg_pace_s_per_km=_avg_pace(norm),
        avg_speed_kmh=_avg_speed(norm),
        source=norm.source,
        source_activity_id=norm.source_activity_id,
        file_hash=file_hash,
        file_path=file_path,
        title=norm.title,
        location_start_lat=_first_coord(norm, "lat"),
        location_start_lon=_first_coord(norm, "lon"),
        location_end_lat=_last_coord(norm, "lat"),
        location_end_lon=_last_coord(norm, "lon"),
    )

    kept = _downsample(norm.points, settings.gps_downsample_seconds)
    activity.points = [
        ActivityPoint(
            elapsed_time_s=p.elapsed_time_s,
            lat=p.lat,
            lon=p.lon,
            altitude_m=p.altitude_m,
            distance_m=p.distance_m,
            hr=p.hr,
            cadence=p.cadence,
            power_w=p.power_w,
            speed_ms=p.speed_ms,
            temperature_c=p.temperature_c,
        )
        for p in kept
    ]
    activity.laps = [
        ActivityLap(
            lap_index=lap.lap_index,
            lap_type="auto",
            start_elapsed_s=lap.start_elapsed_s,
            duration_s=lap.duration_s,
            distance_m=lap.distance_m,
            avg_hr=lap.avg_hr,
            max_hr=lap.max_hr,
            avg_power_w=lap.avg_power_w,
            avg_cadence=lap.avg_cadence,
            elevation_gain_m=lap.elevation_gain_m,
        )
        for lap in norm.laps
    ]

    db.add(activity)
    db.commit()
    db.refresh(activity)

    update_records(db, activity)
    update_daily_metrics(db, user_id, from_date=activity.start_time.date())

    return ImportResult(activity.id, False, activity.sport, _as_float(activity.distance_m), len(kept))


def _find_duplicate(
    db: Session, user_id: uuid.UUID, norm: NormalizedActivity, file_hash: str | None
) -> Activity | None:
    if file_hash:
        hit = db.execute(
            select(Activity).where(
                Activity.user_id == user_id, Activity.file_hash == file_hash
            )
        ).scalar_one_or_none()
        if hit:
            return hit

    if norm.source_activity_id:
        hit = db.execute(
            select(Activity).where(
                Activity.user_id == user_id,
                Activity.source == norm.source,
                Activity.source_activity_id == norm.source_activity_id,
            )
        ).scalar_one_or_none()
        if hit:
            return hit

    # dedup por proximidade: mesmo inicio (+-60s) e distancia parecida (+-1%)
    window = timedelta(seconds=60)
    candidates = db.execute(
        select(Activity).where(
            Activity.user_id == user_id,
            Activity.start_time >= norm.start_time - window,
            Activity.start_time <= norm.start_time + window,
        )
    ).scalars()
    for c in candidates:
        if _similar_distance(_as_float(c.distance_m), norm.distance_m):
            return c
    return None


def _similar_distance(a: float | None, b: float | None) -> bool:
    if a is None or b is None:
        return a == b
    if a == 0 and b == 0:
        return True
    ref = max(a, b, 1.0)
    return abs(a - b) / ref <= 0.01


def _derive_summary(norm: NormalizedActivity) -> None:
    if norm.distance_m is None:
        for p in reversed(norm.points):
            if p.distance_m is not None:
                norm.distance_m = p.distance_m
                break

    if norm.avg_hr is None:
        hrs = [p.hr for p in norm.points if p.hr]
        if hrs:
            norm.avg_hr = round(sum(hrs) / len(hrs))
    if norm.max_hr is None:
        hrs = [p.hr for p in norm.points if p.hr]
        if hrs:
            norm.max_hr = max(hrs)

    if norm.elevation_gain_m is None and any(p.altitude_m is not None for p in norm.points):
        norm.elevation_gain_m, norm.elevation_loss_m = _elevation_from_points(norm.points)


def _elevation_from_points(points) -> tuple[float, float]:
    gain = loss = 0.0
    prev = None
    for p in points:
        if p.altitude_m is None:
            continue
        if prev is not None:
            delta = p.altitude_m - prev
            if delta > 0:
                gain += delta
            else:
                loss -= delta
        prev = p.altitude_m
    return round(gain, 2), round(loss, 2)


def _downsample(points, seconds: int):
    if seconds <= 1 or not points:
        return points
    kept = []
    last_bucket = None
    for p in points:
        bucket = p.elapsed_time_s // seconds
        if bucket != last_bucket:
            kept.append(p)
            last_bucket = bucket
    if kept and kept[-1] is not points[-1]:
        kept.append(points[-1])
    return kept


def _avg_speed(norm: NormalizedActivity) -> float | None:
    base = norm.moving_time_s or norm.duration_s
    if not norm.distance_m or not base:
        return None
    return round((norm.distance_m / base) * 3.6, 2)


def _avg_pace(norm: NormalizedActivity) -> float | None:
    if norm.sport in ("bike", "mtb", "gravel", "indoor_bike"):
        return None
    base = norm.moving_time_s or norm.duration_s
    if not norm.distance_m or norm.distance_m < 1 or not base:
        return None
    return round(base / (norm.distance_m / 1000), 2)


def _first_coord(norm: NormalizedActivity, attr: str) -> float | None:
    for p in norm.points:
        v = getattr(p, attr)
        if v is not None:
            return v
    return None


def _last_coord(norm: NormalizedActivity, attr: str) -> float | None:
    for p in reversed(norm.points):
        v = getattr(p, attr)
        if v is not None:
            return v
    return None


def _as_float(v) -> float | None:
    return float(v) if v is not None else None
