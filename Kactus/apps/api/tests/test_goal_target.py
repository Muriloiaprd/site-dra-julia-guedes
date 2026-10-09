"""Tempo-alvo do atleta no plano do objetivo: ritmo de prova e treinos que usam ele."""

import uuid
from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from kactus_api.ai import goal_plan
from kactus_api.models import GoalPlan, PlannedWorkout


def _plan(db: Session, user_id: uuid.UUID) -> GoalPlan:
    vdot = 35.8
    paces = {k: round(v) for k, v in goal_plan.paces(vdot, 42.2).items()}
    plan = GoalPlan(
        user_id=user_id, race_name="Maratona do Rio", race_date=date.today() + timedelta(days=200),
        race_distance_km=42.2, days_per_week=3, vdot=vdot, summary="plano", phases=[], weeks=[], paces=paces,
    )
    db.add(plan)
    db.flush()
    batch = uuid.uuid4()
    for i, (kind, km) in enumerate((("ritmo de prova", 10), ("rodagem leve", 8))):
        t = goal_plan.workout_targets(kind, km, paces, None)
        db.add(PlannedWorkout(
            user_id=user_id, plan_batch_id=batch, goal_plan_id=plan.id, date=date.today() + timedelta(days=i + 1),
            sport="run", title=kind, target_distance_m=km * 1000, target_duration_s=t["duracao_s"],
            targets={"tipo": kind, "ritmo": t["ritmo"], "zona_fc": t["zona_fc"]},
        ))
    db.flush()
    return plan


def test_target_sets_race_pace_and_workouts(auth_client: tuple[TestClient, dict], db_session: Session) -> None:
    client, user = auth_client
    plan = _plan(db_session, user["id"])
    leve_antes = plan.paces["leve_rapido"]

    r = client.put("/coach/goal-plan/target", json={"target_time_s": 3 * 3600 + 59 * 60})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["plan"]["target_time_s"] == 14340
    assert body["plan"]["paces"]["prova"] == round(14340 / 42.2)  # 340 s/km = 5:40
    assert body["plan"]["paces"]["leve_rapido"] == leve_antes  # treino segue o condicionamento de hoje
    por_tipo = {w["title"]: w for w in body["workouts"]}
    assert por_tipo["ritmo de prova"]["targets"]["ritmo"] == "5:40/km"
    assert por_tipo["rodagem leve"]["targets"]["ritmo"].startswith(goal_plan.fmt_pace(leve_antes))

    # nulo volta ao ritmo calculado pelo VDOT
    back = client.put("/coach/goal-plan/target", json={"target_time_s": None}).json()
    assert back["plan"]["target_time_s"] is None
    assert back["plan"]["paces"]["prova"] == round(goal_plan.race_time_s(35.8, 42.2) / 42.2)


def test_target_without_plan(auth_client: tuple[TestClient, dict]) -> None:
    client, _ = auth_client
    assert client.put("/coach/goal-plan/target", json={"target_time_s": 14340}).status_code == 404
    assert client.put("/coach/goal-plan/target", json={"target_time_s": 30}).status_code == 422
