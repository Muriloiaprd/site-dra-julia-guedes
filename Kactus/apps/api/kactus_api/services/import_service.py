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

from kactus_api.config import settings
from kactus_api.metrics.derived import RUN_SPORTS
from kactus_api.metrics.garmin import compute_walk_time_s
from kactus_api.metrics.load import update_daily_metrics
from kactus_api.metrics.records import update_records
from kactus_api.models import Activity, ActivityLap, ActivityPoint, Equipment
from kactus_api.parsers.base import NormalizedActivity, compute_moving_time_s
from kactus_api.services.derived_metrics import apply_derived_metrics, normalize_step_cadence


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
    recompute_metrics: bool = True,
) -> ImportResult:
    existing = _find_duplicate(db, user_id, norm, file_hash)
    if existing is not None and existing.deleted_at is not None:
        # importar de novo um treino que esta na lixeira tira ele de la
        # (file_hash e unico: nao da para criar outro)
        existing.deleted_at = None
        db.commit()
        update_records(db, existing)
        if recompute_metrics:
            update_daily_metrics(db, user_id, from_date=existing.start_time.date())
        return ImportResult(existing.id, False, existing.sport, _as_float(existing.distance_m), 0)
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
        **garmin_fields(norm),
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

    activity.equipment_id = _default_equipment(db, user_id, norm.sport)

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
            **point_dynamics(p),
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

    # dado cru do arquivo: a cadencia ainda nao foi corrigida
    normalize_step_cadence(activity)
    apply_derived_metrics(activity)

    db.add(activity)
    db.commit()
    db.refresh(activity)

    update_records(db, activity)
    if recompute_metrics:
        # custa uma varredura de todo o historico ate hoje -- em import em lote,
        # o chamador deve pular isso aqui e chamar update_daily_metrics() uma
        # unica vez ao final, com a menor data afetada do lote inteiro.
        update_daily_metrics(db, user_id, from_date=activity.start_time.date())

    return ImportResult(activity.id, False, activity.sport, _as_float(activity.distance_m), len(kept))


def _default_equipment(db: Session, user_id: uuid.UUID, sport: str) -> uuid.UUID | None:
    """Equipamento padrao do esporte (ativo): o tenis da corrida entra sozinho no treino."""
    return db.execute(
        select(Equipment.id).where(
            Equipment.user_id == user_id,
            Equipment.retired_at.is_(None),
            Equipment.default_sports.any(sport),
        ).limit(1)
    ).scalar_one_or_none()


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
    resolve_moving_time(norm)

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

    derive_extremes(norm)


def derive_extremes(norm: NormalizedActivity) -> None:
    """Elevacao minima/maxima e temperatura pelos pontos. A media de temperatura
    dos pontos vale mais que a do resumo do FIT, que e inteira (29 x 28,6)."""
    alts = [p.altitude_m for p in norm.points if p.altitude_m is not None]
    if alts:
        norm.elevation_min_m = round(min(alts), 1)
        norm.elevation_max_m = round(max(alts), 1)
    temps = [p.temperature_c for p in norm.points if p.temperature_c is not None]
    if temps:
        norm.avg_temperature_c = round(sum(temps) / len(temps), 1)
        norm.min_temperature_c = min(temps) if norm.min_temperature_c is None else norm.min_temperature_c
        norm.max_temperature_c = max(temps) if norm.max_temperature_c is None else norm.max_temperature_c


def garmin_fields(norm: NormalizedActivity) -> dict:
    """Colunas da Activity que so o FIT preenche (as outras fontes deixam nulo)."""
    walk = compute_walk_time_s(norm.points, norm.sport, norm.avg_cadence) if norm.sport in RUN_SPORTS else None
    return {
        "max_speed_kmh": round(norm.max_speed_ms * 3.6, 2) if norm.max_speed_ms else None,
        "normalized_power_w": norm.normalized_power_w,
        "elevation_min_m": norm.elevation_min_m,
        "elevation_max_m": norm.elevation_max_m,
        "min_temperature_c": norm.min_temperature_c,
        "max_temperature_c": norm.max_temperature_c,
        "training_effect_aerobic": norm.training_effect_aerobic,
        "training_effect_anaerobic": norm.training_effect_anaerobic,
        "primary_benefit": norm.primary_benefit,
        "hr_recovery": norm.hr_recovery,
        "sweat_loss_ml": norm.sweat_loss_ml,
        "resting_calories": norm.resting_calories,
        "avg_vertical_oscillation_mm": norm.avg_vertical_oscillation_mm,
        "avg_stance_time_ms": norm.avg_stance_time_ms,
        "avg_vertical_ratio_pct": norm.avg_vertical_ratio_pct,
        "avg_step_length_m": round(norm.avg_step_length_mm / 1000, 2) if norm.avg_step_length_mm else None,
        "total_strides": norm.total_strides,
        "walk_time_s": walk,
        "watch_feel": norm.watch_feel,
        "watch_rpe": norm.watch_rpe,
    }


def point_dynamics(p) -> dict:
    return {
        "vertical_oscillation_mm": p.vertical_oscillation_mm,
        "stance_time_ms": round(p.stance_time_ms) if p.stance_time_ms else None,
        "vertical_ratio_pct": p.vertical_ratio_pct,
        "step_length_mm": round(p.step_length_mm) if p.step_length_mm else None,
    }


def resolve_moving_time(norm: NormalizedActivity) -> None:
    """Tempo em movimento a partir dos pontos em resolucao total (antes do
    downsample). O `total_timer_time` do FIT so desconta as pausas do relogio;
    parada sem auto-pause continua contando, entao vale o menor dos dois."""
    computed = compute_moving_time_s(norm.points, norm.sport)
    if computed is None:
        return
    norm.moving_time_s = min(norm.moving_time_s, computed) if norm.moving_time_s else computed


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
    return avg_speed_kmh(norm.distance_m, norm.moving_time_s or norm.duration_s)


def _avg_pace(norm: NormalizedActivity) -> float | None:
    return avg_pace_s_per_km(norm.sport, norm.distance_m, norm.moving_time_s or norm.duration_s)


def avg_speed_kmh(distance_m: float | None, seconds: int | None) -> float | None:
    if not distance_m or not seconds:
        return None
    return round((float(distance_m) / seconds) * 3.6, 2)


def avg_pace_s_per_km(sport: str, distance_m: float | None, seconds: int | None) -> float | None:
    if sport in ("bike", "mtb", "gravel", "indoor_bike"):
        return None
    if not distance_m or float(distance_m) < 1 or not seconds:
        return None
    return round(seconds / (float(distance_m) / 1000), 2)


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
