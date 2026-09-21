"""Metricas de carga de treino: TSS, CTL, ATL, TSB, ACWR.

TSS por modalidade (MVP simplificado — usa HR quando disponivel):
  - Bike com potencia + FTP: TSS classico de Coggan
  - Qualquer modalidade com HR: TSS_hr = h × (hr/hrmax)² × 100
  - Fallback (sem HR nem potencia): estima 50 TSS/h
"""

import math
from datetime import date, datetime, timedelta
from typing import Protocol

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from sqlalchemy import cast
from sqlalchemy.types import DateTime as SADateTime

from ondilow_api.models import Activity
from ondilow_api.models.daily_metric import DailyMetric
from ondilow_api.models.user import AthleteProfile


class TssInput(Protocol):
    """O que compute_tss realmente le — serve tanto para um Activity da ORM
    quanto para a Row enxuta que update_daily_metrics busca."""

    start_time: datetime
    sport: str
    duration_s: int
    avg_hr: int | None
    avg_power_w: int | None

_CTL_TC = 42  # dias (constante de tempo forma cronica)
_ATL_TC = 7   # dias (constante de tempo forma aguda)
_K_CTL = 1 - math.exp(-1 / _CTL_TC)
_K_ATL = 1 - math.exp(-1 / _ATL_TC)

_BIKE_SPORTS = {"bike", "mtb", "gravel", "indoor_bike"}


def compute_tss(activity: TssInput, profile: "AthleteProfile | None" = None) -> float:
    """Retorna o TSS estimado da atividade (nunca None — fallback garantido)."""
    duration_h = activity.duration_s / 3600

    # Ciclismo com potencia media e FTP configurado
    if (
        activity.sport in _BIKE_SPORTS
        and activity.avg_power_w
        and profile
        and profile.ftp_watts
        and profile.ftp_watts > 0
    ):
        avg_p = float(activity.avg_power_w)
        ftp = float(profile.ftp_watts)
        intensity_factor = avg_p / ftp
        return round((duration_h * avg_p * intensity_factor) / ftp * 100, 2)

    # Qualquer modalidade com HR e max_hr
    if activity.avg_hr and profile and profile.max_hr and profile.max_hr > 0:
        hr_ratio = float(activity.avg_hr) / float(profile.max_hr)
        return round(duration_h * (hr_ratio ** 2) * 100, 2)

    # Fallback: estimativa conservadora de 50 TSS/h
    return round(duration_h * 50, 2)


def update_daily_metrics(db: Session, user_id, from_date: date | None = None) -> None:
    """Recalcula CTL/ATL/TSB/ACWR a partir de from_date ate hoje (idempotente)."""
    today = date.today()

    # busca perfil do atleta (necessario para compute_tss)
    profile = db.execute(
        select(AthleteProfile).where(AthleteProfile.user_id == user_id)
    ).scalar_one_or_none()

    # busca a atividade mais antiga para definir o ponto de partida
    earliest = db.execute(
        select(Activity.start_time)
        .where(Activity.user_id == user_id, Activity.deleted_at.is_(None))
        .order_by(Activity.start_time.asc())
        .limit(1)
    ).scalar_one_or_none()

    if earliest is None:
        return

    start = from_date or earliest.date()
    # precisa de pelo menos 42 dias de historico para CTL estavel; vai atras se possivel
    lookback = start - timedelta(days=_CTL_TC * 2)

    # busca todos os TSS diarios agregados a partir do lookback. So as colunas
    # que compute_tss le: num backfill isso varre o historico inteiro, e trazer
    # o objeto completo da ORM (com todos os campos e identity map) nao paga.
    from datetime import timezone
    lookback_dt = datetime(lookback.year, lookback.month, lookback.day, tzinfo=timezone.utc)
    activities = db.execute(
        select(
            Activity.start_time,
            Activity.sport,
            Activity.duration_s,
            Activity.avg_hr,
            Activity.avg_power_w,
        )
        .where(
            Activity.user_id == user_id,
            Activity.deleted_at.is_(None),
            Activity.start_time >= cast(lookback_dt, SADateTime(timezone=True)),
        )
        .order_by(Activity.start_time.asc())
    ).all()

    # agrupa TSS por data
    tss_by_date: dict[date, float] = {}
    for act in activities:
        d = act.start_time.date()
        tss_by_date[d] = tss_by_date.get(d, 0.0) + compute_tss(act, profile)

    # calcula CTL/ATL de trás para frente a partir do lookback
    ctl = 0.0
    atl = 0.0
    current = lookback
    while current < start:
        tss = tss_by_date.get(current, 0.0)
        ctl = ctl + _K_CTL * (tss - ctl)
        atl = atl + _K_ATL * (tss - atl)
        current += timedelta(days=1)

    # apaga linhas do periodo que vai ser reescrito
    db.execute(
        delete(DailyMetric).where(
            DailyMetric.user_id == user_id,
            DailyMetric.date >= start,
            DailyMetric.sport.is_(None),
        )
    )

    # insere uma linha por dia de start ate hoje
    rows: list[DailyMetric] = []
    current = start
    while current <= today:
        tss_today = tss_by_date.get(current, 0.0)
        tsb = ctl - atl  # forma antes do treino de hoje
        ctl = ctl + _K_CTL * (tss_today - ctl)
        atl = atl + _K_ATL * (tss_today - atl)
        acwr = _compute_acwr(tss_by_date, current)
        rows.append(
            DailyMetric(
                user_id=user_id,
                date=current,
                sport=None,  # agregado geral
                daily_load=round(tss_today, 2) if tss_today else None,
                ctl=round(ctl, 2),
                atl=round(atl, 2),
                tsb=round(tsb, 2),
                acwr=round(acwr, 3) if acwr else None,
            )
        )
        current += timedelta(days=1)

    db.add_all(rows)
    db.commit()


def _compute_acwr(tss_by_date: dict[date, float], today: date) -> float | None:
    """ACWR = media 7d / media 28d (se 28d disponivel)."""
    seven = sum(tss_by_date.get(today - timedelta(days=i), 0.0) for i in range(7))
    twenty_eight = sum(tss_by_date.get(today - timedelta(days=i), 0.0) for i in range(28))
    if twenty_eight == 0:
        return None
    return (seven / 7) / (twenty_eight / 28)
