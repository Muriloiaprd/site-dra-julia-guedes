"""Contrato comum de saida de todos os parsers.

Cada parser (fit, gpx, tcx, csv) converte seu formato para NormalizedActivity,
sempre em unidades SI: metros, segundos, m/s. O resto do sistema (dedup,
persistencia, metricas) consome apenas este contrato — nunca o formato bruto.
"""

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
