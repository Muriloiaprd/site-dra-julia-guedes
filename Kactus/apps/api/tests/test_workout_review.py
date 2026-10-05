"""Analisar o treino do dia: a Duni opina (manter/ajustar/descanso) sem mudar nada;
so o apply-review troca o treino ou vira descanso."""

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from test_goal_plan import _llm, _race, _with_history
from test_weekly_plan import _workout

from kactus_api.ai import coach_service
from kactus_api.ai.coach_service import WorkoutReviewLLM


@pytest.fixture
def fake_llm(monkeypatch):
    sent: dict = {}

    def install(result):
        def _call(system_prompt, user_content, *, response_model=None):
            sent["user_content"] = user_content
            sent["response_model"] = response_model
            return result, "modelo-fake"

        monkeypatch.setattr(coach_service, "call_llm", _call)
        return sent

    return install


def _goal_workout(client: TestClient, fake_llm) -> dict:
    _with_history(client)
    _race(client, days_ahead=60)
    fake_llm(_llm("2026-01-01", "2026-01-02"))
    goal = client.post("/coach/goal-plan/generate", json={}).json()
    return goal["workouts"][0]


def test_review_keeps_and_changes_nothing(auth_client: tuple[TestClient, dict], fake_llm) -> None:
    client, _user = auth_client
    w = _goal_workout(client, fake_llm)
    sent = fake_llm(WorkoutReviewLLM(veredito="manter", explicacao="Carga baixa e sem dor nova: siga.", pontos=["Volume leve", " "], sugestao=None))

    body = client.post(f"/coach/plan/{w['id']}/analyze", json={"question": "Acho pouco, posso fazer mais?"}).json()

    assert body["verdict"] == "manter" and body["points"] == ["Volume leve"] and body["suggestion"] is None
    assert sent["response_model"] is WorkoutReviewLLM
    assert "Acho pouco, posso fazer mais?" in sent["user_content"] and "Plano do objetivo" in sent["user_content"]


def test_review_suggests_and_apply_swaps_on_the_same_day(auth_client: tuple[TestClient, dict], fake_llm) -> None:
    client, _user = auth_client
    w = _goal_workout(client, fake_llm)
    other_day = date.fromisoformat(w["date"]) + timedelta(days=2)
    fake_llm(WorkoutReviewLLM(
        veredito="ajustar",
        explicacao="Lombar doeu no sábado: troque o progressivo por rodagem leve.",
        pontos=["Dor lombar 3/10"],
        sugestao=_workout(other_day, titulo="Rodagem leve sem dor", distancia_km=4.0),
    ))

    review = client.post(f"/coach/plan/{w['id']}/analyze", json={}).json()

    assert review["verdict"] == "ajustar"
    assert review["preview"]["title"] == "Rodagem leve sem dor" and review["preview"]["date"] == w["date"]
    unchanged = {x["id"]: x for x in client.get("/coach/goal-plan").json()["workouts"]}[w["id"]]
    assert unchanged["title"] == w["title"]  # analisar nao muda nada

    applied = client.post(f"/coach/plan/{w['id']}/apply-review", json={
        "verdict": "ajustar", "suggestion": review["suggestion"], "explanation": review["explanation"],
    }).json()["workout"]
    assert applied["id"] == w["id"] and applied["date"] == w["date"]  # mesmo treino, mesmo dia
    assert applied["title"] == "Rodagem leve sem dor" and applied["target_distance_m"] == 4000
    assert applied["goal_plan_id"] == w["goal_plan_id"]
    assert applied["targets"]["ajuste_analise"].startswith("Lombar doeu")


def test_apply_rest_removes_the_workout(auth_client: tuple[TestClient, dict], fake_llm) -> None:
    client, _user = auth_client
    w = _goal_workout(client, fake_llm)

    resp = client.post(f"/coach/plan/{w['id']}/apply-review", json={"verdict": "descanso", "explanation": "Descanse."})

    assert resp.status_code == 200 and resp.json()["workout"] is None
    assert w["id"] not in {x["id"] for x in client.get("/coach/goal-plan").json()["workouts"]}


def test_review_refuses_done_workouts_and_bad_suggestions(auth_client: tuple[TestClient, dict], fake_llm) -> None:
    client, _user = auth_client
    w = _goal_workout(client, fake_llm)
    bad = client.post(f"/coach/plan/{w['id']}/apply-review", json={"verdict": "ajustar", "suggestion": {"titulo": "x"}})
    assert bad.status_code == 422 and bad.json()["detail"]["error"] == "invalid_suggestion"

    client.patch(f"/coach/plan/{w['id']}", json={"status": "done"})
    done = client.post(f"/coach/plan/{w['id']}/analyze", json={})
    assert done.status_code == 400 and done.json()["detail"]["error"] == "not_editable"
