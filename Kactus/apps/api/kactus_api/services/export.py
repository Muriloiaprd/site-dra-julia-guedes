"""Exportação de todos os dados do usuário: o botão "Exportar meus dados" e o backup
semanal do Kactus Controle usam o mesmo conteúdo.

Monta tudo em memória (de propósito, sem streaming: a sessão do banco fecha antes
de um generator rodar). Para o volume de um uso pessoal é rápido o bastante.
"""

import datetime as dt
import uuid
from decimal import Decimal

from sqlalchemy import inspect, select
from sqlalchemy.orm import Session, selectinload

from kactus_api.models import Activity, Equipment, PersonalRecord, User
from kactus_api.models.coach import (
    AthleteMemory,
    CoachInteraction,
    GoalPlan,
    PlannedWorkout,
    WeeklyPlan,
)
from kactus_api.models.daily_metric import DailyMetric
from kactus_api.schemas.activity import ActivityDetail
from kactus_api.schemas.profile import ProfileOut, RecordOut

EXPORT_VERSION = 2


def _plain(v):
    if isinstance(v, uuid.UUID):
        return str(v)
    if isinstance(v, dt.datetime | dt.date):
        return v.isoformat()
    if isinstance(v, Decimal):
        return float(v)
    return v


def _row(obj, skip: tuple[str, ...] = ("user_id",)) -> dict:
    """Todas as colunas da linha, em tipos que o JSON aceita."""
    return {c.key: _plain(getattr(obj, c.key)) for c in inspect(obj).mapper.column_attrs if c.key not in skip}


def _all(db: Session, model, user_id: uuid.UUID, order) -> list[dict]:
    rows = db.execute(select(model).where(model.user_id == user_id).order_by(order)).scalars().all()
    return [_row(r) for r in rows]


def build_export(db: Session, user: User) -> dict:
    activities = db.execute(
        select(Activity)
        .where(Activity.user_id == user.id, Activity.deleted_at.is_(None))
        .options(selectinload(Activity.points), selectinload(Activity.laps))
        .order_by(Activity.start_time)
    ).scalars().all()
    records = db.execute(select(PersonalRecord).where(PersonalRecord.user_id == user.id)).scalars().all()
    equipment = db.execute(select(Equipment).where(Equipment.user_id == user.id)).scalars().all()

    return {
        "exported_at": dt.datetime.now(dt.UTC).isoformat(),
        "export_version": EXPORT_VERSION,
        "user": {"id": str(user.id), "email": user.email, "created_at": user.created_at.isoformat()},
        "profile": ProfileOut.model_validate(user.profile).model_dump(mode="json") if user.profile else None,
        "equipment": [
            {
                "id": str(e.id),
                "name": e.name,
                "type": e.type,
                "brand": e.brand,
                "model": e.model,
                "purchase_date": e.purchase_date.isoformat() if e.purchase_date else None,
                "retired_at": e.retired_at.isoformat() if e.retired_at else None,
                "initial_distance_m": float(e.initial_distance_m),
                "notes": e.notes,
                "default_sports": list(e.default_sports or []),
            }
            for e in equipment
        ],
        "records": [RecordOut.model_validate(r).model_dump(mode="json") for r in records],
        "activities": [ActivityDetail.model_validate(a).model_dump(mode="json") for a in activities],
        # o que a Duni sabe e o que ela planejou/conversou
        "duni": {
            "memories": _all(db, AthleteMemory, user.id, AthleteMemory.created_at),
            "goal_plans": _all(db, GoalPlan, user.id, GoalPlan.created_at),
            "weekly_plans": _all(db, WeeklyPlan, user.id, WeeklyPlan.created_at),
            "planned_workouts": _all(db, PlannedWorkout, user.id, PlannedWorkout.date),
            "interactions": _all(db, CoachInteraction, user.id, CoachInteraction.created_at),
        },
        "daily_metrics": _all(db, DailyMetric, user.id, DailyMetric.date),
    }
