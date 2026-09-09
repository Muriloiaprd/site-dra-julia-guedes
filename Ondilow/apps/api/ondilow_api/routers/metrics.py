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
    days: Annotated[int, Query(ge=7, le=365)] = 90,
) -> list[HeatmapDay]:
    """Retorna carga diaria por modalidade para o heatmap semanal."""
    since = date.today() - timedelta(days=days)
    rows = db.execute(
        select(DailyMetric)
        .where(
            DailyMetric.user_id == current_user.id,
            DailyMetric.sport.is_not(None),
            DailyMetric.date >= since,
            DailyMetric.daily_load > 0,
        )
        .order_by(DailyMetric.date.asc())
    ).scalars().all()
    return [
        HeatmapDay(date=r.date, sport=r.sport, daily_load=float(r.daily_load or 0))
        for r in rows
    ]
