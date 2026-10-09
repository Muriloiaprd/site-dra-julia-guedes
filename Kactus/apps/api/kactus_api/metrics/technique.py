"""Evolução da técnica de corrida mês a mês: cadência, contato com o solo,
oscilação vertical, razão vertical e passada.

Só o relógio com dinâmica de corrida (FIT do Garmin) grava esses números. Entram as
corridas de 3 km ou mais com cadência de corrida (corrida com muita caminhada puxa
tudo para baixo e confunde a evolução). A média do mês é ponderada pelos km, e o
ritmo médio vai junto: a técnica muda com a velocidade.
"""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from kactus_api.metrics.derived import RUN_SPORTS
from kactus_api.models import Activity

MIN_KM = 3.0
MIN_CADENCE = 140  # abaixo disso a corrida teve caminhada demais
COMPARE_MONTHS = 3  # últimos 3 meses × os 3 primeiros da janela

# Faixas do Garmin Connect (cores da dinâmica de corrida): do melhor para o pior.
# (limite, rótulo); o valor cai na primeira faixa cujo limite ele não passa.
METRICS: dict[str, dict] = {
    "cadencia": {"col": "avg_cadence", "maior_melhor": True, "faixas": [(183, "excelente"), (174, "boa"), (164, "média"), (153, "abaixo"), (0, "baixa")]},
    "contato_ms": {"col": "avg_stance_time_ms", "maior_melhor": False, "faixas": [(208, "excelente"), (240, "boa"), (272, "média"), (305, "abaixo"), (None, "baixa")]},
    "oscilacao_mm": {"col": "avg_vertical_oscillation_mm", "maior_melhor": False, "faixas": [(64, "excelente"), (81, "boa"), (97, "média"), (115, "abaixo"), (None, "baixa")]},
    "razao_vertical_pct": {"col": "avg_vertical_ratio_pct", "maior_melhor": False, "faixas": [(6.1, "excelente"), (7.4, "boa"), (8.6, "média"), (10.1, "abaixo"), (None, "baixa")]},
    "passada_m": {"col": "avg_step_length_m", "maior_melhor": True, "faixas": None},
}
_DECIMALS = {"cadencia": 0, "contato_ms": 0, "oscilacao_mm": 0, "razao_vertical_pct": 1, "passada_m": 2}


def level(metric: str, value: float | None) -> str | None:
    """Faixa do Garmin para o valor (None se a métrica não tem faixa)."""
    cfg = METRICS[metric]
    if value is None or not cfg["faixas"]:
        return None
    for limit, label in cfg["faixas"]:
        if limit is None or (value > limit if cfg["maior_melhor"] else value < limit):
            return label
    return cfg["faixas"][-1][1]


def _avg(rows: list[dict], key: str) -> float | None:
    pairs = [(r[key], r["km"]) for r in rows if r[key] is not None]
    km = sum(k for _, k in pairs)
    return sum(v * k for v, k in pairs) / km if km else None


def _summary(rows: list[dict]) -> dict:
    out = {m: (round(v, _DECIMALS[m]) if (v := _avg(rows, m)) is not None else None) for m in METRICS}
    pace = _avg(rows, "pace_s_km")
    out["pace_s_km"] = round(pace) if pace else None
    out["corridas"] = len(rows)
    out["km"] = round(sum(r["km"] for r in rows), 1)
    return out


def technique_evolution(db: Session, user_id: uuid.UUID, months: int = 12) -> dict:
    since = datetime.now(UTC) - timedelta(days=31 * months)
    acts = db.execute(
        select(Activity).where(
            Activity.user_id == user_id,
            Activity.deleted_at.is_(None),
            Activity.sport.in_(RUN_SPORTS),
            Activity.distance_m >= MIN_KM * 1000,
            Activity.avg_cadence >= MIN_CADENCE,
            Activity.avg_stance_time_ms.is_not(None),
            Activity.start_time >= since,
        ).order_by(Activity.start_time)
    ).scalars().all()

    rows = [
        {
            "mes": a.start_time.strftime("%Y-%m"),
            "km": float(a.distance_m) / 1000,
            "pace_s_km": float(a.avg_pace_s_per_km) if a.avg_pace_s_per_km else None,
            **{m: (float(v) if (v := getattr(a, cfg["col"])) is not None else None) for m, cfg in METRICS.items()},
        }
        for a in acts
    ]

    by_month: dict[str, list[dict]] = {}
    for r in rows:
        by_month.setdefault(r["mes"], []).append(r)
    meses = [{"mes": mes, **_summary(rs)} for mes, rs in by_month.items()]

    atual = comparacao = None
    if meses:
        recentes = [r for m in meses[-COMPARE_MONTHS:] for r in by_month[m["mes"]]]
        atual = _summary(recentes)
        atual["faixas"] = {m: level(m, atual[m]) for m in METRICS}
        if len(meses) >= 2 * COMPARE_MONTHS:
            antes = _summary([r for m in meses[:COMPARE_MONTHS] for r in by_month[m["mes"]]])
            comparacao = {
                "de": meses[0]["mes"],
                "ate": meses[-1]["mes"],
                **{m: (round(atual[m] - antes[m], _DECIMALS[m]) if atual[m] is not None and antes[m] is not None else None) for m in METRICS},
                "pace_s_km": atual["pace_s_km"] - antes["pace_s_km"] if atual["pace_s_km"] and antes["pace_s_km"] else None,
            }
    return {"meses": meses, "atual": atual, "comparacao": comparacao, "corridas": len(rows)}
