"""GET /coach/plan com start/end: o calendario de treinos le meses passados e futuros."""

import uuid
from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from kactus_api.models import PlannedWorkout


def _planned(db: Session, user_id, day: date, title: str) -> None:
    db.add(PlannedWorkout(
        user_id=user_id, date=day, sport="run", title=title, target_distance_m=8000,
        target_intensity="leve", status="planned", plan_batch_id=uuid.uuid4(),
    ))
    db.commit()


def test_range_includes_past_and_future(auth_client: tuple[TestClient, dict], db_session: Session) -> None:
    client, user = auth_client
    today = date.today()
    _planned(db_session, user["id"], today - timedelta(days=40), "Mês passado")
    _planned(db_session, user["id"], today + timedelta(days=3), "Esta semana")
    _planned(db_session, user["id"], today + timedelta(days=120), "Longe demais")

    start, end = today - timedelta(days=45), today + timedelta(days=30)
    items = client.get(f"/coach/plan?start={start}&end={end}").json()

    assert [i["title"] for i in items] == ["Mês passado", "Esta semana"]
    # o treino que passou sem atividade casada vira pulado (reconcile), mas continua no calendario
    assert items[0]["status"] == "skipped"


def test_without_range_keeps_today_onwards(auth_client: tuple[TestClient, dict], db_session: Session) -> None:
    client, user = auth_client
    today = date.today()
    _planned(db_session, user["id"], today - timedelta(days=2), "Anteontem")
    _planned(db_session, user["id"], today + timedelta(days=2), "Depois de amanhã")

    assert [i["title"] for i in client.get("/coach/plan?days_ahead=14").json()] == ["Depois de amanhã"]


def test_range_validation(auth_client: tuple[TestClient, dict]) -> None:
    client, _ = auth_client
    today = date.today()
    assert client.get(f"/coach/plan?start={today}").status_code == 400
    assert client.get(f"/coach/plan?start={today}&end={today - timedelta(days=1)}").status_code == 400
    assert client.get(f"/coach/plan?start={today}&end={today + timedelta(days=401)}").status_code == 400
    assert client.get(f"/coach/plan?start={today}&end={today}").status_code == 200
