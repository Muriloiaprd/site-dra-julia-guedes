"""Plano da semana pelo estado de agora (livre) × plano do objetivo: gerar nao mexe
na agenda; "usar" leva dias escolhidos (ou a semana toda) para a agenda."""

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from test_goal_plan import _llm, _race, _with_history
from test_weekly_plan import _plan, _workout

from kactus_api.ai import coach_service
from kactus_api.ai.coach_service import FreeWeekLLM, WeekComparison, WeekComparisonDay


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


def _setup(client: TestClient, fake_llm) -> tuple[list[dict], dict]:
    """Plano do objetivo + semana principal detalhada; devolve os treinos da semana."""
    _with_history(client)
    _race(client, days_ahead=60)
    fake_llm(_llm("2026-01-01", "2026-01-02"))
    goal = client.post("/coach/goal-plan/generate", json={}).json()
    end = (date.today() + timedelta(days=6)).isoformat()
    week = [w for w in goal["workouts"] if w["date"] <= end]
    fake_llm(_plan([_workout(date.fromisoformat(w["date"]), titulo=f"Objetivo {w['date']}") for w in week]))
    main = client.post("/coach/plan/generate").json()
    return week, main


def _free(week: list[dict]) -> tuple[FreeWeekLLM, date, date]:
    """Livre: troca o 1o treino do objetivo e poe um treino num dia que o objetivo deixou livre."""
    first = date.fromisoformat(week[0]["date"])
    taken = {w["date"] for w in week}
    free_day = next(d for d in (date.today() + timedelta(days=i) for i in range(7)) if d.isoformat() not in taken)
    base = _plan([_workout(first, titulo="Livre leve", distancia_km=4.0), _workout(free_day, titulo="Livre extra")])
    llm = FreeWeekLLM(
        **base.model_dump(),
        comparacao=WeekComparison(
            recomenda="misturar",
            explicacao="A lombar pede uma semana mais leve no começo.",
            dias=[WeekComparisonDay(data=first.isoformat(), escolha="semana", motivo="Dor lombar")],
        ),
    )
    return llm, first, free_day


def test_free_week_is_a_proposal_and_does_not_touch_the_calendar(auth_client: tuple[TestClient, dict], fake_llm) -> None:
    client, _user = auth_client
    week, main = _setup(client, fake_llm)
    llm, first, free_day = _free(week)
    sent = fake_llm(llm)

    body = client.post("/coach/plan/free/generate").json()

    assert sent["response_model"] is FreeWeekLLM and sent["user_content"].startswith("PLANO DA SEMANA PELO ESTADO DE AGORA")
    assert sorted(w["id"] for w in body["workouts"]) == sorted([f"livre-{first.isoformat()}", f"livre-{free_day.isoformat()}"])
    assert body["comparison"]["recomenda"] == "misturar" and body["plan"]["id"] != main["plan"]["id"]
    after = client.get("/coach/plan/week").json()
    assert after["plan"]["id"] == main["plan"]["id"]  # a principal continua valendo
    assert {w["title"] for w in after["workouts"]} == {w["title"] for w in main["workouts"]}
    assert client.get("/coach/plan/free").json()["plan"]["id"] == body["plan"]["id"]


def test_use_one_day_swaps_only_that_day(auth_client: tuple[TestClient, dict], fake_llm) -> None:
    client, _user = auth_client
    week, main = _setup(client, fake_llm)
    llm, first, _free_day = _free(week)
    fake_llm(llm)
    client.post("/coach/plan/free/generate")

    body = client.post("/coach/plan/free/use", json={"dates": [first.isoformat()]}).json()

    by_date = {w["date"]: w for w in body["workouts"]}
    swapped = by_date[first.isoformat()]
    assert swapped["id"] == week[0]["id"] and swapped["title"] == "Livre leve" and swapped["target_distance_m"] == 4000
    assert swapped["goal_plan_id"] == week[0]["goal_plan_id"] and swapped["targets"]["origem"] == "plano da semana"
    others = [w for w in body["workouts"] if w["date"] != first.isoformat()]
    assert all(w["title"].startswith("Objetivo") for w in others)


def test_use_whole_week_creates_and_removes(auth_client: tuple[TestClient, dict], fake_llm) -> None:
    client, _user = auth_client
    week, main = _setup(client, fake_llm)
    llm, first, free_day = _free(week)
    fake_llm(llm)
    client.post("/coach/plan/free/generate")

    body = client.post("/coach/plan/free/use", json={}).json()

    assert sorted(w["date"] for w in body["workouts"]) == sorted([first.isoformat(), free_day.isoformat()])
    extra = next(w for w in body["workouts"] if w["date"] == free_day.isoformat())
    assert extra["title"] == "Livre extra" and extra["weekly_plan_id"] == main["plan"]["id"]
    assert extra["goal_plan_id"] == week[0]["goal_plan_id"]


def test_use_without_free_week_is_404(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    resp = client.post("/coach/plan/free/use", json={})
    assert resp.status_code == 404 and resp.json()["detail"]["error"] == "no_free_week"
