"""Parser de arquivos FIT (formato binario padrao Garmin/Wahoo)."""

from datetime import UTC, datetime

from fitparse import FitFile
from fitparse.utils import FitParseError

from ondilow_api.parsers.base import (
    NormalizedActivity,
    NormalizedLap,
    NormalizedPoint,
    ParserError,
)
from ondilow_api.parsers.sports import normalize_sport

_SEMICIRCLE_TO_DEG = 180.0 / 2**31


def parse_fit(content: bytes) -> NormalizedActivity:
    try:
        fit = FitFile(content)
        fit.parse()
    except FitParseError as e:
        raise ParserError(f"FIT invalido: {e}") from e

    records = list(fit.get_messages("record"))
    if not records:
        raise ParserError("FIT sem mensagens 'record'")

    start_time = None
    for r in records:
        ts = r.get_value("timestamp")
        if ts is not None:
            start_time = _to_utc(ts)
            break
    if start_time is None:
        raise ParserError("FIT sem timestamp nos records")

    points: list[NormalizedPoint] = []
    last_time = start_time
    max_power = None
    for r in records:
        ts = r.get_value("timestamp")
        if ts is None:
            continue
        t = _to_utc(ts)
        last_time = t

        power = _int(r.get_value("power"))
        if power is not None:
            max_power = power if max_power is None else max(max_power, power)

        points.append(
            NormalizedPoint(
                elapsed_time_s=int((t - start_time).total_seconds()),
                lat=_semicircle(r.get_value("position_lat")),
                lon=_semicircle(r.get_value("position_long")),
                altitude_m=_float(
                    r.get_value("enhanced_altitude") or r.get_value("altitude")
                ),
                distance_m=_float(r.get_value("distance")),
                hr=_int(r.get_value("heart_rate")),
                cadence=_int(r.get_value("cadence")),
                power_w=power,
                speed_ms=_float(r.get_value("enhanced_speed") or r.get_value("speed")),
                temperature_c=_float(r.get_value("temperature")),
            )
        )

    laps = _parse_laps(fit, start_time)
    session = _first_message(fit, "session")

    sport = _resolve_sport(session, fit)
    duration = int((last_time - start_time).total_seconds())

    activity = NormalizedActivity(
        sport=sport,
        start_time=start_time,
        duration_s=duration,
        source="fit",
        points=points,
        laps=laps,
        max_power_w=max_power,
    )
    if session is not None:
        _fill_from_session(activity, session)
    return activity


def _parse_laps(fit: FitFile, start_time: datetime) -> list[NormalizedLap]:
    laps: list[NormalizedLap] = []
    for idx, lap in enumerate(fit.get_messages("lap")):
        lap_start = lap.get_value("start_time")
        laps.append(
            NormalizedLap(
                lap_index=idx,
                start_elapsed_s=(
                    int((_to_utc(lap_start) - start_time).total_seconds())
                    if lap_start
                    else None
                ),
                duration_s=_int(lap.get_value("total_elapsed_time")),
                distance_m=_float(lap.get_value("total_distance")),
                avg_hr=_int(lap.get_value("avg_heart_rate")),
                max_hr=_int(lap.get_value("max_heart_rate")),
                avg_power_w=_int(lap.get_value("avg_power")),
                avg_cadence=_int(lap.get_value("avg_cadence")),
                elevation_gain_m=_float(lap.get_value("total_ascent")),
            )
        )
    return laps


def _fill_from_session(activity: NormalizedActivity, session) -> None:
    activity.moving_time_s = _int(session.get_value("total_timer_time")) or activity.moving_time_s
    activity.distance_m = _float(session.get_value("total_distance")) or activity.distance_m
    activity.elevation_gain_m = _float(session.get_value("total_ascent"))
    activity.elevation_loss_m = _float(session.get_value("total_descent"))
    activity.avg_hr = _int(session.get_value("avg_heart_rate"))
    activity.max_hr = _int(session.get_value("max_heart_rate"))
    activity.avg_power_w = _int(session.get_value("avg_power"))
    activity.max_power_w = _int(session.get_value("max_power")) or activity.max_power_w
    activity.avg_cadence = _float(session.get_value("avg_cadence"))
    activity.calories = _int(session.get_value("total_calories"))


def _resolve_sport(session, fit: FitFile) -> str:
    if session is not None:
        return normalize_sport(session.get_value("sport"), session.get_value("sub_sport"))
    sport_msg = _first_message(fit, "sport")
    if sport_msg is not None:
        return normalize_sport(sport_msg.get_value("sport"), sport_msg.get_value("sub_sport"))
    return "other"


def _first_message(fit: FitFile, name: str):
    for msg in fit.get_messages(name):
        return msg
    return None


def _to_utc(ts: datetime) -> datetime:
    return ts.replace(tzinfo=UTC) if ts.tzinfo is None else ts.astimezone(UTC)


def _semicircle(v) -> float | None:
    return v * _SEMICIRCLE_TO_DEG if v is not None else None


def _float(v) -> float | None:
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def _int(v) -> int | None:
    f = _float(v)
    return int(f) if f is not None else None
