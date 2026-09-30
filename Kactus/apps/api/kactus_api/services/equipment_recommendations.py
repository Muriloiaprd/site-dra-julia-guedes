"""Recomendacoes de equipamento personalizadas pelo uso: so os esportes que o
atleta pratica (pelo volume dos ultimos 90 dias), destaques pelo que ele faz e
alerta de troca de tenis."""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from kactus_api.equipment_catalog import CATALOG_UPDATED_AT, SPORTS, catalog_for
from kactus_api.models import Activity, Equipment

# Tenis perde amortecimento entre ~500 e ~800 km
SHOE_WARN_KM = 500
SHOE_REPLACE_KM = 600
_RUN = {"run", "trail_run", "treadmill"}
_BIKE = {"bike", "mtb", "gravel", "indoor_bike"}
_SWIM = {"swim", "open_water_swim"}
# Ritmo medio de corrida abaixo disso (s/km) = treina rapido o bastante para
# aproveitar um tenis de prova
_FAST_PACE_S_PER_KM = 330


def _group(sport: str) -> str | None:
    if sport in _RUN:
        return "run"
    if sport in _BIKE:
        return "bike"
    if sport in _SWIM:
        return "swim"
    return None


def _shoe_alerts(db: Session, user_id: uuid.UUID) -> list[dict]:
    rows = db.execute(
        select(Equipment, func.coalesce(func.sum(Activity.distance_m), 0))
        .outerjoin(Activity, (Activity.equipment_id == Equipment.id) & Activity.deleted_at.is_(None))
        .where(Equipment.user_id == user_id, Equipment.type == "shoe", Equipment.retired_at.is_(None))
        .group_by(Equipment.id)
    ).all()
    alerts = []
    for eq, linked in rows:
        km = round((float(eq.initial_distance_m or 0) + float(linked)) / 1000)
        if km >= SHOE_REPLACE_KM:
            alerts.append({"nivel": "trocar", "equipamento": eq.name, "equipamento_id": str(eq.id), "km": km,
                           "texto": f"{eq.name} já tem {km} km: o amortecimento costuma cansar entre 500 e 800 km. Hora de pensar no próximo."})
        elif km >= SHOE_WARN_KM:
            alerts.append({"nivel": "atencao", "equipamento": eq.name, "equipamento_id": str(eq.id), "km": km,
                           "texto": f"{eq.name} está com {km} km: fique de olho em dor nova ou no tênis \"batendo\" duro."})
    return alerts


def recommendations(db: Session, user_id: uuid.UUID, now: datetime | None = None) -> dict:
    now = now or datetime.now(UTC)
    rows = db.execute(
        select(Activity.sport, Activity.source, Activity.distance_m, Activity.moving_time_s, Activity.duration_s)
        .where(Activity.user_id == user_id, Activity.deleted_at.is_(None), Activity.start_time >= now - timedelta(days=90))
    ).all()

    minutes: dict[str, float] = {}
    run_km = run_s = 0.0
    has_trail = has_fit = False
    for sport, source, dist, moving, dur in rows:
        g = _group(sport)
        has_fit = has_fit or source == "fit"
        if g is None:
            continue
        seconds = moving or dur
        minutes[g] = minutes.get(g, 0) + seconds / 60
        if g == "run" and dist:
            run_km += float(dist) / 1000
            run_s += seconds
            has_trail = has_trail or sport == "trail_run"
    has_watch = db.execute(
        select(func.count()).select_from(Equipment).where(
            Equipment.user_id == user_id, Equipment.type == "watch", Equipment.retired_at.is_(None)
        )
    ).scalar_one() > 0

    practiced = sorted(minutes, key=minutes.get, reverse=True)
    week_km = round(run_km / (90 / 7), 1)
    pace = run_s / run_km if run_km else None

    sports = []
    for sport in [*practiced, *(s for s in SPORTS if s not in practiced)]:
        categories = catalog_for(sport)
        highlights: dict[str, str] = {}
        if sport == "run":
            highlights["tenis_dia_a_dia"] = f"Você corre ~{week_km} km por semana: é o tênis que mais vai gastar." if week_km else "O tênis que mais vai gastar."
            if pace and pace < _FAST_PACE_S_PER_KM:
                highlights["tenis_prova"] = "Seu ritmo médio é rápido o bastante para tirar proveito da placa de carbono."
            if has_trail:
                highlights["tenis_trilha"] = "Você fez corrida de trilha nos últimos 90 dias."
            if has_fit or has_watch:
                highlights["relogio"] = "Você já usa relógio com GPS: troque só se sentir falta de algum recurso."
        for c in categories:
            c["destaque"] = highlights.get(c["id"])
        sports.append({
            "sport": sport,
            "label": SPORTS[sport],
            "praticado": sport in practiced,
            "horas_90d": round(minutes.get(sport, 0) / 60, 1),
            "categorias": categories,
        })
    # destaques primeiro dentro de cada esporte
    for s in sports:
        s["categorias"].sort(key=lambda c: c["destaque"] is None)

    return {"atualizado_em": CATALOG_UPDATED_AT, "alertas": _shoe_alerts(db, user_id), "esportes": sports}
