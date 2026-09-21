"""Aplica as metricas derivadas (metrics/derived.py) numa Activity da ORM.

Usado no import e no backfill (scripts/backfill_derived.py): os dois caminhos
passam por aqui para o valor salvo nao depender de como a atividade entrou.
"""

from ondilow_api.metrics.derived import (
    RUN_SPORTS,
    STEP_SPORTS,
    gap_pace,
    hr_decoupling_pct,
    step_cadence_factor,
)
from ondilow_api.models import Activity

# Sobe quando o calculo mudar, para o backfill saber o que refazer.
# 2: deriva so em corrida continua (moving >= 90% do total).
DERIVED_VERSION = 2
# Volta curta demais (ex.: 2m em 40s ao apertar o botao) da ritmo sem sentido.
_MIN_LAP_M = 50.0
# 60 min/km.
_SLOWEST_PACE_S = 3600.0
# Fracao minima do tempo total em movimento para calcular a deriva.
_MIN_CONTINUITY = 0.9


def normalize_step_cadence(activity: Activity, *, update_points: bool = True) -> int:
    """Dobra a cadencia gravada por perna (resumo, voltas e pontos) em esportes
    de passada e devolve o fator aplicado (1 = nada mudou).

    So pode rodar UMA vez por atividade: quem chama garante isso (import: sempre
    dado cru; backfill: so com derived_version nulo). Com update_points=False os
    pontos ficam para o chamador (o backfill faz um UPDATE em SQL por atividade
    em vez de um por ponto)."""
    factor = step_cadence_factor(
        activity.sport,
        float(activity.avg_cadence) if activity.avg_cadence is not None else None,
        [p.cadence for p in activity.points],
    )
    if factor == 1:
        return 1
    if activity.avg_cadence is not None:
        activity.avg_cadence = round(float(activity.avg_cadence) * factor, 2)
    for lap in activity.laps:
        if lap.avg_cadence is not None:
            lap.avg_cadence = lap.avg_cadence * factor
    if update_points:
        for p in activity.points:
            if p.cadence is not None:
                p.cadence = p.cadence * factor
    return factor


def apply_derived_metrics(activity: Activity) -> None:
    """GAP e deriva da atividade, ritmo e GAP de cada volta. Idempotente."""
    points = sorted(activity.points, key=lambda p: p.elapsed_time_s)
    step = activity.sport in STEP_SPORTS

    activity.gap_pace_s_per_km = _bounded(gap_pace(activity.avg_pace_s_per_km, points)) if step else None
    activity.hr_decoupling_pct = hr_decoupling_pct(points) if _is_continuous_run(activity) else None

    for lap in activity.laps:
        if not step or not lap.distance_m or not lap.duration_s or float(lap.distance_m) < _MIN_LAP_M:
            lap.gap_pace_s_per_km = None
            continue
        if lap.avg_pace_s_per_km is None:
            lap.avg_pace_s_per_km = _bounded(round(lap.duration_s / (float(lap.distance_m) / 1000), 2))
        lap.gap_pace_s_per_km = _bounded(gap_pace(lap.avg_pace_s_per_km, _lap_points(points, lap)))

    activity.derived_version = DERIVED_VERSION


def _is_continuous_run(activity: Activity) -> bool:
    """Deriva so faz sentido em corrida sem paradas longas: com muita pausa, a FC
    cai e sobe de novo e o numero sai absurdo (no backfill de 2026-09-21, -134%
    numa corrida com 27 de 45 minutos em movimento)."""
    if activity.sport not in RUN_SPORTS:
        return False
    moving, total = activity.moving_time_s, activity.duration_s
    if not moving or not total:
        return True
    return moving / total >= _MIN_CONTINUITY


def _bounded(pace: float | None) -> float | None:
    """Ritmo mais lento que isso e parado, nao passada (e nao cabe na coluna)."""
    return pace if pace is not None and pace < _SLOWEST_PACE_S else None


def _lap_points(points: list, lap) -> list:
    if lap.start_elapsed_s is None:
        return []
    start = lap.start_elapsed_s
    end = start + lap.duration_s
    return [p for p in points if start <= p.elapsed_time_s <= end]
