"""Planejado × feito: volume e ritmo contra o alvo, sem IA."""

import uuid
from datetime import UTC, date, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from test_import_normalized_router import _payload

from kactus_api.ai.adherence import pace_range
from kactus_api.models import PlannedWorkout


def test_pace_range_reads_the_target_text() -> None:
    assert pace_range("6:10–6:40/km") == (370.0, 400.0)
    assert pace_range("5:58/km") == (348.0, 368.0)
    assert pace_range("6:55/km ou mais lento") == (415.0, None)
    assert pace_range("blocos a 5:20/km") == (310.0, 330.0)
    assert pace_range(None) is None and pace_range("leve, conversando") is None


def _planned(db: Session, user_id, day: date, title: str, km: float, ritmo: str | None = None) -> PlannedWorkout:
    w = PlannedWorkout(
        user_id=user_id, date=day, sport="run", title=title, target_distance_m=km * 1000,
        target_intensity="leve", status="planned", plan_batch_id=uuid.uuid4(),
        targets={"ritmo": ritmo} if ritmo else None,
    )
    db.add(w)
    db.commit()
    return w


def test_adherence_compares_planned_and_done(auth_client: tuple[TestClient, dict], db_session: Session) -> None:
    client, user = auth_client
    yesterday = date.today() - timedelta(days=1)
    two_days = date.today() - timedelta(days=2)
    # 5 km em 25 min = 5:00/km; o alvo era 8 km a 6:10–6:40
    start = datetime.combine(yesterday, datetime.min.time(), tzinfo=UTC).replace(hour=10)
    resp = client.post("/activities/import-normalized", json=_payload(source_activity_id="adh-1", start_time=start.isoformat()))
    activity_id = resp.json()["activity_id"]
    _planned(db_session, user["id"], yesterday, "Rodagem leve", 8.0, "6:10–6:40/km")
    _planned(db_session, user["id"], two_days, "Longão", 14.0)

    items = client.get("/coach/plan/adherence?days=7").json()

    assert [i["title"] for i in items] == ["Rodagem leve", "Longão"]
    done, skipped = items
    assert done["status"] == "done" and done["actual"]["activity_id"] == activity_id
    assert done["volume"] == "a_menos" and done["ratio"] == 0.62
    assert done["ritmo"] == "mais_rapido"
    assert done["comment"] is None
    assert skipped["status"] == "skipped" and skipped["actual"] is None and skipped["volume"] is None


def test_adherence_ignores_future_and_other_users(auth_client: tuple[TestClient, dict], db_session: Session) -> None:
    client, user = auth_client
    _planned(db_session, user["id"], date.today() + timedelta(days=1), "Amanhã", 6.0)
    assert client.get("/coach/plan/adherence").json() == []
