"""Comentario da Duni sobre uma atividade (Fase 8): contexto do treino,
planejado x feito, e so sob demanda."""

import json
import uuid
from datetime import date, datetime, time
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from kactus_api.ai import coach_service
from kactus_api.ai.coach_service import CoachUnavailableError
from kactus_api.models import PlannedWorkout, User
from kactus_api.security import create_access_token, hash_password

_TODAY_NOON = datetime.combine(date.today(), time(12, 0), tzinfo=ZoneInfo("America/Sao_Paulo"))


@pytest.fixture
def fake_llm(monkeypatch):
    sent: dict = {}

    def install(result):
        def _call(system_prompt, user_content, *, response_model=None):
            sent["user_content"] = user_content
            sent["response_model"] = response_model
            if isinstance(result, Exception):
                raise result
            return result, "modelo-fake"

        monkeypatch.setattr(coach_service, "call_llm", _call)
        return sent

    return install


def _import_run(client: TestClient) -> str:
    resp = client.post(
        "/activities/import-normalized",
        json={
            "sport": "running",
            "start_time": _TODAY_NOON.isoformat(),
            "duration_s": 1800,
            "moving_time_s": 1800,
            "source": "garmin_api",
            "source_activity_id": f"comentario-{uuid.uuid4().hex[:8]}",
            "distance_m": 5000.0,
            "avg_hr": 150,
            "laps": [
                {"lap_index": 0, "duration_s": 360, "distance_m": 1000.0, "avg_hr": 145},
                {"lap_index": 1, "duration_s": 350, "distance_m": 1000.0, "avg_hr": 152},
            ],
        },
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["activity_id"]


def test_comment_is_saved_and_uses_the_workout_context(
    auth_client: tuple[TestClient, dict], db_session: Session, fake_llm
) -> None:
    client, user = auth_client
    activity_id = _import_run(client)
    client.put(f"/activities/{activity_id}/checkin", json={"rpe": 6, "feeling": "pernas_pesadas"})
    db_session.add(PlannedWorkout(
        user_id=user["id"], date=_TODAY_NOON.date(), sport="run", title="Rodagem leve 6 km",
        target_intensity="leve", objective="Base aerobica", status="planned", plan_batch_id=uuid.uuid4(),
    ))
    db_session.commit()
    assert client.get(f"/coach/activities/{activity_id}/analyze").json()["comment"] is None

    sent = fake_llm("**O que foi feito**: 5 km.")
    resp = client.post(f"/coach/activities/{activity_id}/analyze")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["comment"] == "**O que foi feito**: 5 km." and body["model_used"] == "modelo-fake"
    assert sent["response_model"] is None  # texto livre, sem schema

    ctx = json.loads(sent["user_content"].split("Dados do treino (JSON):\n", 1)[1])
    assert ctx["atividade"]["km"] == 5.0 and ctx["atividade"]["pse"] == 6
    assert ctx["atividade"]["sensacao"] == "pernas_pesadas"
    assert [v["volta"] for v in ctx["voltas"]] == [1, 2] and ctx["voltas"][1]["fc_media"] == 152
    [planned] = ctx["planejado_para_o_dia"]
    assert planned["titulo"] == "Rodagem leve 6 km" and planned["intensidade"] == "leve"
    assert ctx["semana_ate_o_dia"]["7d"]["corrida"]["sessoes"] == 1

    again = client.get(f"/coach/activities/{activity_id}/analyze").json()
    assert again["comment"] == body["comment"] and again["generated_at"]
    # comentario de treino nao aparece no historico do chat
    assert client.get("/coach/chat/history").json() == []


def test_unavailable_llm_saves_nothing(auth_client: tuple[TestClient, dict], fake_llm) -> None:
    client, _user = auth_client
    activity_id = _import_run(client)
    fake_llm(CoachUnavailableError("quota_exceeded"))

    resp = client.post(f"/coach/activities/{activity_id}/analyze")

    assert resp.status_code == 503 and resp.json()["detail"]["error"] == "quota_exceeded"
    assert client.get(f"/coach/activities/{activity_id}/analyze").json()["comment"] is None


def test_other_users_or_missing_activity_is_404(
    auth_client: tuple[TestClient, dict], db_session: Session, fake_llm
) -> None:
    client, _owner = auth_client
    activity_id = _import_run(client)
    fake_llm("nao deveria ser chamado")
    other = User(email=f"pytest-{uuid.uuid4().hex[:12]}@kactus.test", password_hash=hash_password("outra-senha-123"))
    db_session.add(other)
    db_session.commit()
    headers = {"Authorization": f"Bearer {create_access_token(str(other.id))}"}

    assert client.post(f"/coach/activities/{activity_id}/analyze", headers=headers).status_code == 404
    assert client.get(f"/coach/activities/{activity_id}/analyze", headers=headers).status_code == 404
    assert client.post(f"/coach/activities/{uuid.uuid4()}/analyze").status_code == 404
