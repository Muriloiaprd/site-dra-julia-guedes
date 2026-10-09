"""Ritmo × calor: como a temperatura do relógio pesa no ritmo e na FC das corridas.

Usa as corridas ao ar livre (sem esteira) de 3 km ou mais do último ano com
temperatura gravada. O sensor fica no pulso, então a leitura sai alguns graus acima
do ar: as faixas são da temperatura do relógio.
"""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from kactus_api.models import Activity

OUTDOOR_RUNS = ("run", "trail_run")
MIN_KM = 3.0
MIN_RUNS_BAND = 3  # faixa com menos corridas não entra na comparação
BANDS: list[tuple[str, float | None, float | None]] = [
    ("até 15 °C", None, 15.0),
    ("15–20 °C", 15.0, 20.0),
    ("20–25 °C", 20.0, 25.0),
    ("25–30 °C", 25.0, 30.0),
    ("30 °C ou mais", 30.0, None),
]


def _band(t: float) -> int:
    for i, (_, lo, hi) in enumerate(BANDS):
        if (lo is None or t >= lo) and (hi is None or t < hi):
            return i
    return len(BANDS) - 1


def heat_analysis(db: Session, user_id: uuid.UUID, days: int = 365) -> dict:
    rows = db.execute(
        select(Activity).where(
            Activity.user_id == user_id,
            Activity.deleted_at.is_(None),
            Activity.sport.in_(OUTDOOR_RUNS),
            Activity.avg_temperature_c.is_not(None),
            Activity.avg_pace_s_per_km.is_not(None),
            Activity.distance_m >= MIN_KM * 1000,
            Activity.start_time >= datetime.now(UTC) - timedelta(days=days),
        ).order_by(Activity.start_time)
    ).scalars().all()

    pontos = [
        {
            "id": a.id,
            "data": a.start_time.date(),
            "temp_c": round(float(a.avg_temperature_c), 1),
            "pace_s_km": round(float(a.avg_pace_s_per_km)),
            "fc": a.avg_hr,
            "km": round(float(a.distance_m) / 1000, 1),
        }
        for a in rows
    ]

    acc = [{"km": 0.0, "pace_km": 0.0, "fc_w": 0.0, "fc_km": 0.0, "n": 0} for _ in BANDS]
    for p in pontos:
        b = acc[_band(p["temp_c"])]
        b["n"] += 1
        b["km"] += p["km"]
        b["pace_km"] += p["pace_s_km"] * p["km"]
        if p["fc"]:
            b["fc_w"] += p["fc"] * p["km"]
            b["fc_km"] += p["km"]
    faixas = [
        {
            "faixa": label,
            "corridas": b["n"],
            "pace_s_km": round(b["pace_km"] / b["km"]) if b["km"] else None,
            "fc": round(b["fc_w"] / b["fc_km"]) if b["fc_km"] else None,
        }
        for (label, _, _), b in zip(BANDS, acc, strict=True)
    ]

    validas = [f for f in faixas if f["corridas"] >= MIN_RUNS_BAND and f["pace_s_km"]]
    comparacao = None
    if len(validas) >= 2:
        fria, quente = validas[0], validas[-1]
        comparacao = {
            "fria": fria["faixa"],
            "quente": quente["faixa"],
            "pace_diff_s_km": quente["pace_s_km"] - fria["pace_s_km"],
            "fc_diff": quente["fc"] - fria["fc"] if quente["fc"] and fria["fc"] else None,
        }
    return {"corridas": len(pontos), "pontos": pontos, "faixas": faixas, "comparacao": comparacao}
