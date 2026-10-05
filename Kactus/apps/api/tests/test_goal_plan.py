"""Plano do objetivo: esqueleto (codigo), paces e o endpoint com a Duni falsa."""

from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from kactus_api.ai import coach_service, goal_plan
from kactus_api.ai.coach_service import GoalPlanLLM, GoalPlanPhaseLLM, GoalPlanSlotLLM

TODAY = date(2026, 10, 5)
RACE = date(2027, 5, 30)


# ── esqueleto ───────────────────────────────────────────────────────────────


@pytest.fixture
def marathon() -> list[goal_plan.Week]:
    return goal_plan.build_skeleton(TODAY, RACE, 42.2, 3, base_km=18.0, base_long_km=10.0)


def test_skeleton_covers_every_week_until_the_race(marathon) -> None:
    assert marathon[0].start == TODAY
    assert marathon[-1].start <= RACE <= marathon[-1].end
    for a, b in zip(marathon, marathon[1:], strict=False):
        assert b.start == a.start + timedelta(days=7)
    *_, race = marathon[-1].slots
    assert (race.date, race.role, race.km) == (RACE, "prova", 42.2)
    assert all(s.date <= RACE for w in marathon for s in w.slots)


def test_three_runs_per_week_on_fixed_days(marathon) -> None:
    for w in marathon[:-1]:
        assert [(s.date.weekday(), s.role) for s in w.slots] == [(1, "qualidade"), (3, "leve"), (6, "longao")]


def test_volume_grows_at_most_10_percent_and_has_cutbacks(marathon) -> None:
    training = [w for w in marathon if w.phase != "polimento"]
    full = [w for w in training if not w.cutback]
    for a, b in zip(full, full[1:], strict=False):
        assert b.km <= a.km * 1.10 + 1.0  # +1 km de folga do arredondamento dos treinos
    assert all(w.cutback == (w.index % 4 == 0) for w in training)
    assert max(w.km for w in marathon if w.phase != "polimento") <= 56


def test_long_run_tops_at_32_km_a_few_times_and_taper_drops(marathon) -> None:
    longs = [w.long_km for w in marathon]
    assert max(longs) == 32.0
    assert 2 <= longs.count(32.0) <= 4  # nao repete 32 km toda semana
    taper = [w for w in marathon if w.phase == "polimento"]
    assert len(taper) == 3
    assert taper[0].long_km > taper[1].long_km
    assert all(w.phase == "base" for w in marathon[:10])


def test_race_distance_from_memory_text() -> None:
    assert goal_plan.race_distance_km("Maratona do Rio") == 42.2
    assert goal_plan.race_distance_km("Meia Maratona do Rio") == 21.1
    assert goal_plan.race_distance_km("Corrida de 10 km da Ponte") == 10.0
    assert goal_plan.race_distance_km("Prova da firma") is None


def test_paces_are_ordered_from_fast_to_slow() -> None:
    p = goal_plan.paces(40.0, 42.2)
    assert p["intervalo"] < p["limiar"] < p["prova"] < p["leve_rapido"] < p["leve_lento"]
    assert 4 * 3600 > goal_plan.race_time_s(40.0, 42.2) > 3 * 3600  # VDOT 40 ≈ 3h30 na maratona


def test_targets_use_hr_bpm_and_no_effort_scale() -> None:
    zones = {"z1": [0, 120], "z2": [120, 140], "z3": [140, 155], "z4": [155, 170], "z5": [170, 190]}
    t = goal_plan.workout_targets("rodagem leve", 8.0, goal_plan.paces(40.0, 42.2), zones)
    assert t["zona_fc"] == "Z2 (120–140 bpm)" and t["intensidade"] == "leve" and "/km" in t["ritmo"]


# ── endpoint ────────────────────────────────────────────────────────────────


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


def _with_history(client: TestClient) -> None:
    now = datetime.now(UTC).replace(hour=7, minute=0, second=0, microsecond=0)
    for i, days_ago in enumerate((21, 14, 10, 7, 3)):
        resp = client.post(
            "/activities/import-normalized",
            json={"sport": "running", "start_time": (now - timedelta(days=days_ago)).isoformat(),
                  "duration_s": 2400, "moving_time_s": 2400, "source": "garmin_api",
                  "source_activity_id": f"goal-{i}", "distance_m": 6500.0},
        )
        assert resp.status_code in (200, 201), resp.text


def _race(client: TestClient, days_ahead: int = 120, content: str = "Maratona do Rio") -> None:
    race_day = (date.today() + timedelta(days=days_ahead)).isoformat()
    resp = client.post("/coach/memories", json={"kind": "prova", "content": content, "event_date": race_day})
    assert resp.status_code == 201, resp.text


def _llm(first_date: str, bad_date: str) -> GoalPlanLLM:
    return GoalPlanLLM(
        resumo="Base longa, construção e pico até a maratona.",
        fases=[GoalPlanPhaseLLM(fase="base", foco="Volume leve com constância.")],
        treinos=[
            GoalPlanSlotLLM(data=first_date, tipo="fartlek", titulo="Fartlek de retomada", objetivo="Soltar a passada."),
            GoalPlanSlotLLM(data=bad_date, tipo="tiro de 400 m", titulo="Inventado", objetivo="Fora das opções."),
        ],
    )


def test_goal_plan_needs_a_race_with_date(auth_client: tuple[TestClient, dict], fake_llm) -> None:
    client, _user = auth_client
    _with_history(client)
    fake_llm(_llm("2026-01-01", "2026-01-02"))

    resp = client.post("/coach/goal-plan/generate", json={})

    assert resp.status_code == 422 and resp.json()["detail"]["error"] == "no_goal_race"
    assert client.get("/coach/goal-plan").json() == {"plan": None, "workouts": []}


def test_goal_plan_generates_every_workout_until_the_race(auth_client: tuple[TestClient, dict], fake_llm) -> None:
    client, _user = auth_client
    _with_history(client)
    _race(client, days_ahead=120)
    weeks = goal_plan.build_skeleton(date.today(), date.today() + timedelta(days=120), 42.2, 3, 0, 0)
    first_q = next(s for w in weeks for s in w.slots if s.role == "qualidade")
    first_l = next(s for w in weeks for s in w.slots if s.role == "longao")
    sent = fake_llm(_llm(first_q.date.isoformat(), first_l.date.isoformat()))

    body = client.post("/coach/goal-plan/generate", json={"days_per_week": 3}).json()

    plan, workouts = body["plan"], body["workouts"]
    assert sent["response_model"] is GoalPlanLLM and "PSE" not in sent["user_content"]
    assert plan["race_name"] == "Maratona do Rio" and plan["race_distance_km"] == 42.2 and plan["days_per_week"] == 3
    assert [p["fase"] for p in plan["phases"]] == ["base", "construcao", "pico", "polimento"]
    assert len(plan["weeks"]) == 18 and plan["paces"]["prova"] > 0
    assert workouts[-1]["date"] == (date.today() + timedelta(days=120)).isoformat()
    assert workouts[-1]["targets"]["tipo"] == "prova" and workouts[-1]["target_distance_m"] == 42200
    by_date = {w["date"]: w for w in workouts}
    picked = by_date[first_q.date.isoformat()]
    assert (picked["targets"]["tipo"], picked["title"]) == ("fartlek", "Fartlek de retomada")
    fallback = by_date[first_l.date.isoformat()]
    assert fallback["targets"]["tipo"] == "longão" and fallback["title"] == "Longão"  # tipo inventado nao vale
    assert all("bpm" in w["targets"]["zona_fc"] or w["targets"]["zona_fc"].startswith("Z") for w in workouts)
    assert all(w["goal_plan_id"] == plan["id"] and w["steps"] is None for w in workouts)

    got = client.get("/coach/goal-plan").json()
    assert got["plan"]["id"] == plan["id"] and len(got["workouts"]) == len(workouts)


def test_regenerating_is_stable_and_keeps_done_workouts(auth_client: tuple[TestClient, dict], fake_llm) -> None:
    client, _user = auth_client
    _with_history(client)
    _race(client, days_ahead=60)
    fake_llm(_llm("2026-01-01", "2026-01-02"))
    first = client.post("/coach/goal-plan/generate", json={}).json()
    done = first["workouts"][0]
    assert client.patch(f"/coach/plan/{done['id']}", json={"status": "done"}).status_code == 200

    second = client.post("/coach/goal-plan/generate", json={}).json()

    key = [(w["date"], w["target_distance_m"], w["targets"]["tipo"]) for w in second["workouts"]]
    assert key == [(w["date"], w["target_distance_m"], w["targets"]["tipo"]) for w in first["workouts"][1:]]
    assert client.get("/coach/goal-plan").json()["plan"]["id"] == second["plan"]["id"]  # o antigo saiu
    week = client.get("/coach/plan?days_ahead=14").json()
    assert sum(w["date"] == done["date"] for w in week) == 1  # o feito ficou e o dia nao ganhou outro


# ── a semana segue o plano do objetivo (Fase 4) ─────────────────────────────


def test_week_plan_details_goal_workouts_without_changing_them(auth_client: tuple[TestClient, dict], fake_llm) -> None:
    from test_weekly_plan import _plan, _workout

    client, _user = auth_client
    _with_history(client)
    _race(client, days_ahead=60)
    fake_llm(_llm("2026-01-01", "2026-01-02"))
    goal = client.post("/coach/goal-plan/generate", json={}).json()
    start = date.today()
    in_week = [w for w in goal["workouts"] if w["date"] <= (start + timedelta(days=6)).isoformat()]
    assert in_week, "o plano do objetivo tem treino nesta semana"
    target = in_week[0]
    free_day = next(
        d for d in (start + timedelta(days=i) for i in range(7)) if d.isoformat() not in {w["date"] for w in in_week}
    )
    # a IA "desobedece": muda distancia e tipo e inventa um treino num dia livre
    sent = fake_llm(_plan([
        _workout(date.fromisoformat(target["date"]), tipo="intervalado", distancia_km=20.0, titulo="Detalhado"),
        _workout(free_day, titulo="Inventado"),
    ]))

    body = client.post("/coach/plan/generate").json()

    assert sent["user_content"].startswith("PLANO DO OBJETIVO")
    rows = {w["date"]: w for w in body["workouts"]}
    assert set(rows) == {w["date"] for w in in_week}  # nenhum treino a mais
    got = rows[target["date"]]
    assert got["id"] == target["id"] and got["title"] == "Detalhado" and got["steps"]
    assert got["target_distance_m"] == target["target_distance_m"]  # distancia do objetivo
    assert got["targets"]["tipo"] == target["targets"]["tipo"]  # tipo do objetivo
    assert got["weekly_plan_id"] == body["plan"]["id"] and got["goal_plan_id"] == goal["plan"]["id"]
    week = client.get("/coach/plan/week").json()
    assert {w["id"] for w in week["workouts"]} == {w["id"] for w in in_week}


def test_goal_plan_reads_six_months_and_follows_available_days(auth_client: tuple[TestClient, dict], fake_llm) -> None:
    client, _user = auth_client
    _with_history(client)
    _race(client, days_ahead=90)
    assert client.post("/coach/memories", json={"kind": "disponibilidade", "content": "Treina nas terças, quintas e sábados"}).status_code == 201
    sent = fake_llm(_llm("2026-01-01", "2026-01-02"))

    body = client.post("/coach/goal-plan/generate", json={}).json()

    temas = [f["tema"] for f in body["plan"]["analysis"]]
    assert temas[0] == "Último mês" and "Dias" in temas and "Nível" in temas
    assert "Semanas dos ultimos 6 meses" in sent["user_content"] and "Último mês" in sent["user_content"]
    weekdays = {date.fromisoformat(w["date"]).weekday() for w in body["workouts"][:-1]}
    assert weekdays <= {1, 3, 5}  # terca, quinta e sabado (a prova pode cair em outro dia)
    longs = [w for w in body["workouts"] if w["targets"]["tipo"].startswith("longão")]
    assert longs and all(date.fromisoformat(w["date"]).weekday() == 5 for w in longs)


# ── cards da semana nao esvaziam (PLANEJAMENTO_2026-10-05_2) ──────────────


def test_regenerating_goal_keeps_the_week_cards_filled(auth_client: tuple[TestClient, dict], fake_llm) -> None:
    from test_weekly_plan import _plan, _workout

    client, _user = auth_client
    _with_history(client)
    _race(client, days_ahead=60)
    fake_llm(_llm("2026-01-01", "2026-01-02"))
    goal = client.post("/coach/goal-plan/generate", json={}).json()
    end = (date.today() + timedelta(days=6)).isoformat()
    in_week = [w for w in goal["workouts"] if w["date"] <= end]
    fake_llm(_plan([_workout(date.fromisoformat(w["date"])) for w in in_week]))
    main = client.post("/coach/plan/generate").json()

    # o que aconteceu de verdade: refazer o objetivo depois de detalhar a semana
    fake_llm(_llm("2026-01-01", "2026-01-02"))
    client.post("/coach/goal-plan/generate", json={})
    week = client.get("/coach/plan/week").json()

    assert week["plan"]["id"] == main["plan"]["id"]
    assert sorted(w["date"] for w in week["workouts"]) == sorted(w["date"] for w in in_week)
    assert all(w["weekly_plan_id"] == main["plan"]["id"] for w in week["workouts"])


def test_week_without_weekly_plan_shows_the_goal_workouts(auth_client: tuple[TestClient, dict], fake_llm) -> None:
    client, _user = auth_client
    _with_history(client)
    _race(client, days_ahead=60)
    fake_llm(_llm("2026-01-01", "2026-01-02"))
    goal = client.post("/coach/goal-plan/generate", json={}).json()
    end = (date.today() + timedelta(days=6)).isoformat()

    week = client.get("/coach/plan/week").json()

    assert week["plan"] is None
    assert [w["id"] for w in week["workouts"]] == [w["id"] for w in goal["workouts"] if w["date"] <= end]


def test_week_is_empty_without_any_plan(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    assert client.get("/coach/plan/week").json() == {"plan": None, "workouts": []}
