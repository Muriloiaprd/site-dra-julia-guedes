"""A aba Carga em linguagem simples: o que fazer hoje, quanto da para correr
nos proximos 7 dias sem salto de carga, volume por semana e intensidade.

Reaproveita a analise da Duni (ai/athlete_analysis.build_analysis) para a
intensidade de 28 dias e a recomendacao de hoje (metrics/predictions)."""

import uuid
from collections import Counter
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from kactus_api.ai.athlete_analysis import build_analysis, effective_kind
from kactus_api.metrics.garmin import benefit_label
from kactus_api.metrics.load import ACWR_MIN_CHRONIC_DAILY_LOAD, compute_tss
from kactus_api.metrics.predictions import training_recommendation
from kactus_api.models import Activity
from kactus_api.models.daily_metric import DailyMetric
from kactus_api.models.user import AthleteProfile

WEEKS = 16
# Faixa segura: carga dos proximos 7 dias entre 0,8x e 1,3x a media das ultimas 4
# semanas (a zona "ideal" do salto de carga, a mesma da tela avancada).
_SAFE_MIN, _SAFE_MAX = 0.8, 1.3


def _local_day(ts: datetime, tz: str | None) -> date:
    return ts.astimezone(ZoneInfo(tz or "America/Sao_Paulo")).date()


def _f(v) -> float | None:
    return float(v) if v is not None else None


def load_summary(db: Session, user_id: uuid.UUID, today: date | None = None) -> dict:
    today = today or date.today()
    analysis = build_analysis(db, user_id, today)  # tambem atualiza a carga diaria ate hoje
    profile = db.execute(select(AthleteProfile).where(AthleteProfile.user_id == user_id)).scalar_one_or_none()
    latest = db.execute(
        select(DailyMetric)
        .where(DailyMetric.user_id == user_id, DailyMetric.sport.is_(None), DailyMetric.date <= today)
        .order_by(DailyMetric.date.desc())
        .limit(1)
    ).scalar_one_or_none()

    monday = today - timedelta(days=today.weekday())
    first_week = monday - timedelta(weeks=WEEKS - 1)
    rows = db.execute(
        select(Activity).where(
            Activity.user_id == user_id,
            Activity.deleted_at.is_(None),
            Activity.start_time >= datetime.combine(first_week - timedelta(days=1), time.min, tzinfo=UTC),
        )
    ).scalars().all()

    acts = []
    for r in rows:
        day = _local_day(r.start_time, r.timezone)
        if day < first_week or day > today:
            continue
        acts.append({
            "day": day,
            "kind": effective_kind(r.sport, _f(r.avg_pace_s_per_km)),
            "km": (_f(r.distance_m) or 0) / 1000,
            "min": (r.moving_time_s or r.duration_s) / 60,
            "tss": compute_tss(r, profile),
            "effect": _f(r.training_effect_aerobic),
            "benefit": benefit_label(r.primary_benefit),
        })

    return {
        "hoje": training_recommendation(latest),
        "semana": _period(acts, today, 7),
        "media_4_semanas": _avg_week(acts, today),
        "faixa_segura": _safe_range(acts, today),
        "intensidade_28d": analysis.get("distribuicao_intensidade_28d"),
        "efeito_treino_7d": _training_effect(acts, today),
        "semanas": _weeks(acts, first_week, today),
    }


def _in_last(acts: list[dict], today: date, days: int) -> list[dict]:
    start = today - timedelta(days=days - 1)
    return [a for a in acts if start <= a["day"] <= today]


def _period(acts: list[dict], today: date, days: int) -> dict:
    sel = _in_last(acts, today, days)
    return {
        "corrida_km": round(sum(a["km"] for a in sel if a["kind"] == "run"), 1),
        "horas": round(sum(a["min"] for a in sel) / 60, 1),
        "treinos": len(sel),
    }


def _avg_week(acts: list[dict], today: date) -> dict:
    """Media semanal dos 28 dias antes dos ultimos 7 (para comparar com a semana)."""
    prev = [a for a in acts if today - timedelta(days=34) <= a["day"] <= today - timedelta(days=7)]
    return {
        "corrida_km": round(sum(a["km"] for a in prev if a["kind"] == "run") / 4, 1),
        "horas": round(sum(a["min"] for a in prev) / 60 / 4, 1),
        "treinos": round(len(prev) / 4, 1),
    }


def _safe_range(acts: list[dict], today: date) -> dict:
    """Km de corrida nos proximos 7 dias que mantem a carga entre 0,8x e 1,3x a media
    das ultimas 4 semanas, descontando a carga media dos outros esportes."""
    last28 = _in_last(acts, today, 28)
    chronic = sum(a["tss"] for a in last28) / 28
    done7 = round(sum(a["km"] for a in _in_last(acts, today, 7) if a["kind"] == "run"), 1)
    if chronic < ACWR_MIN_CHRONIC_DAILY_LOAD:
        return {"disponivel": False, "motivo": "base_baixa", "feito_7d_km": done7}
    runs = [a for a in last28 if a["kind"] == "run" and a["km"] > 0]
    run_km = sum(a["km"] for a in runs)
    if run_km <= 0:
        return {"disponivel": False, "motivo": "sem_corrida", "feito_7d_km": done7}
    tss_per_km = sum(a["tss"] for a in runs) / run_km
    other_week = sum(a["tss"] for a in last28 if a["kind"] != "run") / 4
    lo = max(0.0, (_SAFE_MIN * 7 * chronic - other_week) / tss_per_km)
    hi = max(0.0, (_SAFE_MAX * 7 * chronic - other_week) / tss_per_km)
    return {"disponivel": True, "min_km": round(lo), "max_km": round(hi), "feito_7d_km": done7}


def _training_effect(acts: list[dict], today: date) -> dict | None:
    sel = [a for a in _in_last(acts, today, 7) if a["effect"] is not None]
    if not sel:
        return None
    benefits = Counter(a["benefit"] for a in sel if a["benefit"])
    return {
        "media_aerobico": round(sum(a["effect"] for a in sel) / len(sel), 1),
        "treinos": len(sel),
        "beneficios": dict(benefits.most_common()),
    }


def _weeks(acts: list[dict], first_week: date, today: date) -> list[dict]:
    out = []
    for i in range(WEEKS):
        start = first_week + timedelta(weeks=i)
        end = start + timedelta(days=6)
        sel = [a for a in acts if start <= a["day"] <= end]
        out.append({
            "semana": start.isoformat(),
            "em_andamento": end >= today,
            "corrida_km": round(sum(a["km"] for a in sel if a["kind"] == "run"), 1),
            "bike_km": round(sum(a["km"] for a in sel if a["kind"] == "bike"), 1),
            "caminhada_km": round(sum(a["km"] for a in sel if a["kind"] == "walk"), 1),
            "horas": round(sum(a["min"] for a in sel) / 60, 1),
            "treinos": len(sel),
        })
    return out
