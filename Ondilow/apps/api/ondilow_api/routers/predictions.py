from datetime import date, timedelta

from fastapi import APIRouter
from sqlalchemy import select

from ondilow_api.deps import CurrentUser, DbSession
from ondilow_api.metrics.predictions import (
    assess_injury_risk,
    predict_race_times,
    simulate_tsb,
    training_recommendation,
)
from ondilow_api.models.daily_metric import DailyMetric
from ondilow_api.models.record import PersonalRecord
from ondilow_api.schemas.predictions import (
    PredictionsOverview,
    SimulateRequest,
    SimulatedDay,
)

router = APIRouter(prefix="/predictions", tags=["predictions"])

_RUN_SPORTS = {"run", "trail_run", "treadmill"}


@router.get("/overview", response_model=PredictionsOverview)
def get_predictions_overview(current_user: CurrentUser, db: DbSession) -> dict:
    run_records = db.execute(
        select(PersonalRecord)
        .where(
            PersonalRecord.user_id == current_user.id,
            PersonalRecord.sport.in_(list(_RUN_SPORTS)),
        )
        .order_by(PersonalRecord.achieved_at.desc())
    ).scalars().all()

    # Pega o melhor (mais recente) por record_type
    best: dict[str, PersonalRecord] = {}
    for r in run_records:
        if r.record_type not in best:
            best[r.record_type] = r

    since = date.today() - timedelta(days=30)
    metrics = db.execute(
        select(DailyMetric)
        .where(
            DailyMetric.user_id == current_user.id,
            DailyMetric.sport.is_(None),
            DailyMetric.date >= since,
        )
        .order_by(DailyMetric.date.asc())
    ).scalars().all()

    latest_metric = metrics[-1] if metrics else None

    return {
        "race_predictions": predict_race_times(list(best.values())),
        "risk": assess_injury_risk(list(metrics)),
        "recommendation": training_recommendation(latest_metric),
    }


@router.post("/simulate", response_model=list[SimulatedDay])
def simulate_future_tsb(body: SimulateRequest, current_user: CurrentUser, db: DbSession) -> list[dict]:
    if body.current_ctl is None or body.current_atl is None:
        latest = db.execute(
            select(DailyMetric)
            .where(
                DailyMetric.user_id == current_user.id,
                DailyMetric.sport.is_(None),
            )
            .order_by(DailyMetric.date.desc())
            .limit(1)
        ).scalar_one_or_none()
        ctl = float(latest.ctl) if latest and latest.ctl else 0.0
        atl = float(latest.atl) if latest and latest.atl else 0.0
    else:
        ctl = body.current_ctl
        atl = body.current_atl

    return simulate_tsb(ctl, atl, body.planned_tss[:90])
