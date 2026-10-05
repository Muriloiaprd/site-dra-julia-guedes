"""Contrato comum de saida de todos os parsers.

Cada parser (fit, gpx, tcx, csv) converte seu formato para NormalizedActivity,
sempre em unidades SI: metros, segundos, m/s. O resto do sistema (dedup,
persistencia, metricas) consome apenas este contrato — nunca o formato bruto.
"""

import math
from dataclasses import dataclass, field
from datetime import datetime


class ParserError(Exception):
    """Falha ao interpretar o conteudo de um arquivo de atividade."""


@dataclass(slots=True)
class NormalizedPoint:
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
    # dinamica de corrida (relogio com sensor de pulso ou cinta): so FIT
    vertical_oscillation_mm: float | None = None
    stance_time_ms: float | None = None
    vertical_ratio_pct: float | None = None
    step_length_mm: float | None = None


@dataclass(slots=True)
class NormalizedLap:
    lap_index: int
    start_elapsed_s: int | None = None
    duration_s: int | None = None
    distance_m: float | None = None
    avg_hr: int | None = None
    max_hr: int | None = None
    avg_power_w: int | None = None
    avg_cadence: int | None = None
    elevation_gain_m: float | None = None


@dataclass(slots=True)
class NormalizedActivity:
    sport: str
    start_time: datetime
    duration_s: int
    source: str
    points: list[NormalizedPoint] = field(default_factory=list)
    laps: list[NormalizedLap] = field(default_factory=list)

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
    source_activity_id: str | None = None

    # o que so o FIT (Garmin) traz; tudo opcional
    max_speed_ms: float | None = None
    normalized_power_w: int | None = None
    min_temperature_c: float | None = None
    max_temperature_c: float | None = None
    elevation_min_m: float | None = None
    elevation_max_m: float | None = None
    training_effect_aerobic: float | None = None  # 0-5
    training_effect_anaerobic: float | None = None  # 0-5
    primary_benefit: int | None = None  # codigo do Garmin, ver PRIMARY_BENEFIT
    hr_recovery: int | None = None  # bpm que a FC caiu depois de parar
    sweat_loss_ml: int | None = None
    resting_calories: int | None = None
    avg_vertical_oscillation_mm: float | None = None
    avg_stance_time_ms: float | None = None
    avg_vertical_ratio_pct: float | None = None
    avg_step_length_mm: float | None = None
    total_strides: int | None = None
    # autoavaliacao feita no relogio, 0-100 (sensacao: 0 = muito fraco, 100 = muito forte)
    watch_feel: int | None = None
    watch_rpe: int | None = None


# ---------- tempo em movimento ----------

# Intervalo sem ponto maior que isso e um "buraco": pausa (auto-pause) se o
# atleta nao saiu do lugar, ou gravacao esparsa (modo economia do relogio) se
# ele andou. Decide a velocidade media do proprio buraco.
_PAUSE_GAP_S = 30
# A velocidade de cada trecho e medida pelo deslocamento em ~10 s, nao ponto a
# ponto: parado, o GPS "tremula" alguns metros pra la e pra ca, e a soma desses
# tremores viraria movimento.
_SPEED_WINDOW_S = 10
# Abaixo disso o atleta esta parado. Natacao, forca e "outro" ficam de fora:
# sem deslocamento confiavel, vale o tempo do relogio.
_MIN_MOVING_SPEED_MS = {
    "run": 0.5,
    "trail_run": 0.5,
    "treadmill": 0.5,
    "walk": 0.4,
    "bike": 1.0,
    "mtb": 1.0,
    "gravel": 1.0,
    "indoor_bike": 1.0,
}


def compute_moving_time_s(points: list[NormalizedPoint], sport: str) -> int | None:
    """Tempo em movimento, em segundos, a partir dos pontos em resolucao total.

    Soma os intervalos entre pontos consecutivos em que o atleta estava se
    movendo: descarta pausas (buraco de tempo > 30 s sem deslocamento) e
    trechos parados (velocidade abaixo do limiar do esporte). A velocidade vem do proprio
    relogio (`speed_ms`) quando o arquivo tem, senao do deslocamento real
    (lat/lon) ou da distancia acumulada numa janela de ~10 s.

    Devolve None quando nao da pra saber: esporte sem limiar (natacao, forca...)
    ou arquivo sem velocidade, distancia nem GPS (ex.: esteira sem sensor).
    """
    clock = moving_clock(points, sport)
    return clock[-1] if clock else None


def moving_clock(points: list[NormalizedPoint], sport: str) -> list[int] | None:
    """Tempo em movimento acumulado ate cada ponto (mesma regra de
    `compute_moving_time_s`): o "cronometro" que para nas pausas e paradas.
    Serve pra medir parciais e contadores pelo tempo corrido, nao pelo do relogio."""
    threshold = _MIN_MOVING_SPEED_MS.get(sport)
    if threshold is None or len(points) < 2:
        return None
    if not any(p.speed_ms is not None or p.distance_m is not None or p.lat is not None for p in points):
        return None

    moving = 0
    clock = [0]
    start = 0  # inicio da janela de velocidade
    for i in range(1, len(points)):
        dt = points[i].elapsed_time_s - points[i - 1].elapsed_time_s
        if dt <= 0:
            clock.append(moving)
            continue
        if dt > _PAUSE_GAP_S:
            gap_speed = _window_speed(points[i - 1], points[i], use_device_speed=False)
            if gap_speed is not None and gap_speed >= threshold:
                moving += dt
            start = i
            clock.append(moving)
            continue
        t = points[i].elapsed_time_s
        while start < i - 1 and t - points[start + 1].elapsed_time_s >= _SPEED_WINDOW_S:
            start += 1
        speed = _window_speed(points[start], points[i])
        if speed is None or speed >= threshold:
            moving += dt
        clock.append(moving)
    return clock


def _window_speed(a: NormalizedPoint, b: NormalizedPoint, *, use_device_speed: bool = True) -> float | None:
    if use_device_speed and b.speed_ms is not None:
        return b.speed_ms
    span = b.elapsed_time_s - a.elapsed_time_s
    if span <= 0:
        return None
    if None not in (a.lat, a.lon, b.lat, b.lon):
        return _haversine_m(a.lat, a.lon, b.lat, b.lon) / span
    if a.distance_m is not None and b.distance_m is not None:
        return (b.distance_m - a.distance_m) / span
    return None


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))
