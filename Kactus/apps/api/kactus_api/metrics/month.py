"""Resumo do mês: volume, esportes, maior treino, recordes e a comparação com o mês anterior.

O dia de cada treino é o dia local (fuso da atividade), igual ao resto das telas.
"""

import uuid
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from kactus_api.ai.athlete_analysis import effective_kind
from kactus_api.models import Activity, PersonalRecord

KINDS = ("run", "walk", "bike", "swim", "strength", "pilates", "other")


def _f(v) -> float | None:
    return float(v) if v is not None else None


def _month_bounds(month: date) -> tuple[date, date]:
    first = month.replace(day=1)
    nxt = (first + timedelta(days=32)).replace(day=1)
    return first, nxt - timedelta(days=1)


def _local_day(ts: datetime, tz: str | None) -> date:
    return ts.astimezone(ZoneInfo(tz or "America/Sao_Paulo")).date()


def _activities(db: Session, user_id: uuid.UUID, first: date, last: date) -> list[Activity]:
    rows = db.execute(
        select(Activity).where(
            Activity.user_id == user_id,
            Activity.deleted_at.is_(None),
            Activity.start_time >= datetime.combine(first - timedelta(days=1), time.min, tzinfo=UTC),
            Activity.start_time <= datetime.combine(last + timedelta(days=1), time.max, tzinfo=UTC),
        ).order_by(Activity.start_time)
    ).scalars().all()
    return [a for a in rows if first <= _local_day(a.start_time, a.timezone) <= last]


def _totals(acts: list[Activity]) -> dict:
    return {
        "treinos": len(acts),
        "km": round(sum(_f(a.distance_m) or 0 for a in acts) / 1000, 1),
        "horas": round(sum((a.moving_time_s or a.duration_s) for a in acts) / 3600, 1),
        "dias": len({_local_day(a.start_time, a.timezone) for a in acts}),
    }


def _pct(cur: float, prev: float) -> float | None:
    return round((cur - prev) / prev * 100) if prev else None


def month_summary(db: Session, user_id: uuid.UUID, month: date) -> dict:
    first, last = _month_bounds(month)
    acts = _activities(db, user_id, first, last)
    prev_first, prev_last = _month_bounds(first - timedelta(days=1))
    prev = _activities(db, user_id, prev_first, prev_last)

    by_kind: dict[str, list[Activity]] = {}
    for a in acts:
        by_kind.setdefault(effective_kind(a.sport, _f(a.avg_pace_s_per_km)), []).append(a)
    esportes = [{"tipo": k, **_totals(v)} for k, v in sorted(by_kind.items(), key=lambda kv: -len(kv[1]))]

    runs = by_kind.get("run", [])
    run_km = sum(_f(a.distance_m) or 0 for a in runs) / 1000
    run_s = sum((a.moving_time_s or a.duration_s) for a in runs)
    biggest = max(acts, key=lambda a: _f(a.distance_m) or 0, default=None)

    records = db.execute(
        select(PersonalRecord).where(
            PersonalRecord.user_id == user_id,
            func.date(PersonalRecord.achieved_at) >= first,
            func.date(PersonalRecord.achieved_at) <= last,
        ).order_by(PersonalRecord.achieved_at)
    ).scalars().all()

    totals, prev_totals = _totals(acts), _totals(prev)
    # meses com treino nos ultimos 2 anos (para o seletor)
    meses = sorted({
        _local_day(t, tz).strftime("%Y-%m")
        for t, tz in db.execute(
            select(Activity.start_time, Activity.timezone).where(
                Activity.user_id == user_id,
                Activity.deleted_at.is_(None),
                Activity.start_time >= datetime.now(UTC) - timedelta(days=730),
            )
        ).all()
    })

    return {
        "mes": first.strftime("%Y-%m"),
        "inicio": first,
        "fim": last,
        "total": totals,
        "anterior": prev_totals,
        "variacao": {
            "km_pct": _pct(totals["km"], prev_totals["km"]),
            "horas_pct": _pct(totals["horas"], prev_totals["horas"]),
            "treinos": totals["treinos"] - prev_totals["treinos"],
        },
        "esportes": esportes,
        "corrida": {
            "km": round(run_km, 1),
            "treinos": len(runs),
            "pace_medio_s_km": round(run_s / run_km) if run_km >= 1 else None,
        } if runs else None,
        "maior_treino": {
            "id": biggest.id,
            "titulo": biggest.title,
            "sport": biggest.sport,
            "km": round((_f(biggest.distance_m) or 0) / 1000, 1),
            "data": _local_day(biggest.start_time, biggest.timezone),
        } if biggest and biggest.distance_m else None,
        "recordes": [
            {"tipo": r.record_type, "sport": r.sport, "valor": _f(r.value), "unidade": r.unit,
             "data": r.achieved_at.date(), "activity_id": r.activity_id}
            for r in records
        ],
        "meses_disponiveis": meses,
    }
