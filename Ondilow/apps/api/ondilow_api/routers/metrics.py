from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import func, select

from ondilow_api.deps import CurrentUser, DbSession
from ondilow_api.metrics.load import update_daily_metrics
from ondilow_api.models.activity import Activity
from ondilow_api.models.daily_metric import DailyMetric
from ondilow_api.schemas.metrics import DailyMetricOut

router = APIRouter(prefix="/metrics", tags=["metrics"])


class HeatmapDay(BaseModel):
    date: date
    sport: str | None
    daily_load: float


@router.get("/load", response_model=list[DailyMetricOut])
def get_load_metrics(
    current_user: CurrentUser,
    db: DbSession,
    days: Annotated[int, Query(ge=7, le=365)] = 90,
) -> list[DailyMetric]:
    since = date.today() - timedelta(days=days)
    rows = db.execute(
        select(DailyMetric)
        .where(
            DailyMetric.user_id == current_user.id,
            DailyMetric.sport.is_(None),
            DailyMetric.date >= since,
        )
        .order_by(DailyMetric.date.asc())
    ).scalars().all()

    # se nao ha dados, recalcula agora
    if not rows:
        update_daily_metrics(db, current_user.id)
        rows = db.execute(
            select(DailyMetric)
            .where(
                DailyMetric.user_id == current_user.id,
                DailyMetric.sport.is_(None),
                DailyMetric.date >= since,
            )
            .order_by(DailyMetric.date.asc())
        ).scalars().all()

    return list(rows)


@router.get("/heatmap", response_model=list[HeatmapDay])
def get_heatmap(
    current_user: CurrentUser,
    db: DbSession,
    days: Annotated[int, Query(ge=7, le=365)] = 112,
) -> list[HeatmapDay]:
    """Retorna carga diaria por modalidade para o heatmap, calculada das atividades."""
    from datetime import datetime, timezone
    from ondilow_api.metrics.load import compute_tss
    from ondilow_api.models.user import AthleteProfile

    since = date.today() - timedelta(days=days)
    since_dt = datetime(since.year, since.month, since.day, tzinfo=timezone.utc)

    profile = db.execute(
        select(AthleteProfile).where(AthleteProfile.user_id == current_user.id)
    ).scalar_one_or_none()

    activities = db.execute(
        select(Activity)
        .where(
            Activity.user_id == current_user.id,
            Activity.deleted_at.is_(None),
            Activity.start_time >= since_dt,
        )
        .order_by(Activity.start_time.asc())
    ).scalars().all()

    # agrupa TSS por (date, sport)
    by_date_sport: dict[tuple[date, str], float] = {}
    for act in activities:
        key = (act.start_time.date(), act.sport)
        by_date_sport[key] = by_date_sport.get(key, 0.0) + compute_tss(act, profile)

    return [
        HeatmapDay(date=d, sport=sport, daily_load=round(load, 2))
        for (d, sport), load in sorted(by_date_sport.items())
    ]
