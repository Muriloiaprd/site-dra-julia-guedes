"""Parser de arquivos FIT (formato binario padrao Garmin/Wahoo)."""

from datetime import UTC, datetime

from fitparse import FitFile
from fitparse.utils import FitParseError

from kactus_api.parsers.base import (
    NormalizedActivity,
    NormalizedLap,
    NormalizedPoint,
    ParserError,
)
from kactus_api.parsers.sports import normalize_sport

_SEMICIRCLE_TO_DEG = 180.0 / 2**31

# Campos da mensagem session que o fitparse nao conhece (aparecem como
# unknown_N): lidos pelo numero. Conferidos contra o Garmin Connect numa corrida
# de 2026-09-26 (5,01 km): repouso 40 kcal, suor 466 ml, FC de recuperacao 37,
# temperatura minima 27, beneficio 5 = VO2 max, sensacao 0 = "muito fraco" e
# esforco 100 = 10/10.
_SESSION_MIN_TEMPERATURE = 150
_SESSION_SWEAT_LOSS_ML = 178
_SESSION_PRIMARY_BENEFIT = 188
_SESSION_WORKOUT_FEEL = 192
_SESSION_WORKOUT_RPE = 193
_SESSION_RESTING_CALORIES = 196
_SESSION_HR_RECOVERY = 202


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
                vertical_oscillation_mm=_float(r.get_value("vertical_oscillation")),
                stance_time_ms=_float(r.get_value("stance_time")),
                vertical_ratio_pct=_float(r.get_value("vertical_ratio")),
                step_length_mm=_float(r.get_value("step_length")),
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
    activity.avg_cadence = _cadence(session.get_value("avg_cadence"), session.get_value("avg_fractional_cadence"))
    activity.calories = _int(session.get_value("total_calories"))

    activity.max_speed_ms = _float(session.get_value("enhanced_max_speed") or session.get_value("max_speed"))
    activity.normalized_power_w = _int(session.get_value("normalized_power"))
    activity.avg_temperature_c = _float(session.get_value("avg_temperature"))
    activity.max_temperature_c = _float(session.get_value("max_temperature"))
    activity.min_temperature_c = _float(session.get_value(_SESSION_MIN_TEMPERATURE))
    activity.training_effect_aerobic = _float(session.get_value("total_training_effect"))
    activity.training_effect_anaerobic = _float(session.get_value("total_anaerobic_training_effect"))
    activity.primary_benefit = _int(session.get_value(_SESSION_PRIMARY_BENEFIT))
    activity.hr_recovery = _positive(session.get_value(_SESSION_HR_RECOVERY))
    activity.sweat_loss_ml = _positive(session.get_value(_SESSION_SWEAT_LOSS_ML))
    activity.resting_calories = _positive(session.get_value(_SESSION_RESTING_CALORIES))
    activity.avg_vertical_oscillation_mm = _positive_float(session.get_value("avg_vertical_oscillation"))
    activity.avg_stance_time_ms = _positive_float(session.get_value("avg_stance_time"))
    activity.avg_vertical_ratio_pct = _positive_float(session.get_value("avg_vertical_ratio"))
    activity.avg_step_length_mm = _positive_float(session.get_value("avg_step_length"))
    activity.total_strides = _positive(session.get_value("total_strides"))
    activity.watch_feel = _percent(session.get_value(_SESSION_WORKOUT_FEEL))
    activity.watch_rpe = _percent(session.get_value(_SESSION_WORKOUT_RPE))


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


def _positive(v) -> int | None:
    """Inteiro > 0; o relogio grava 0 quando nao mediu."""
    i = _int(v)
    return i if i else None


def _positive_float(v) -> float | None:
    f = _float(v)
    return f if f else None


def _percent(v) -> int | None:
    i = _int(v)
    return i if i is not None and 0 <= i <= 100 else None


def _cadence(whole, fraction) -> float | None:
    """Cadencia do resumo com a fracao (85 + 0,625 = 85,625 por perna). Ainda
    por perna: quem dobra e o normalize_step_cadence, no import."""
    w = _float(whole)
    if w is None:
        return None
    return round(w + (_float(fraction) or 0.0), 3)
