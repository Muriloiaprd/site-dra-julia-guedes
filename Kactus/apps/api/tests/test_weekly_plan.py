"""Plano da semana da Duni (Fase 7): saida estruturada, validacao no codigo,
regerar um dia e mover treino."""

from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from kactus_api.ai import coach_service
from kactus_api.ai.coach_service import (
    CoachPlanParseError,
    PlanAdjustCriteria,
    PlanEvaluation,
    PlanNextWeek,
    PlanStep,
    PlanWorkout,
    RegeneratedDay,
    WeeklyPlanLLM,
    previous_week_load,
    validate_weekly_plan,
    week_range,
)

START = date(2026, 9, 22)
END = START + timedelta(days=6)


def _workout(day: date, **over) -> PlanWorkout:
    base = {
        "data": day.isoformat(),
        "esporte": "run",
        "tipo": "rodagem leve",
        "titulo": "Rodagem leve",
        "objetivo": "Base aerobica",
        "motivo": "Semana de retomada, carga baixa nas ultimas 4 semanas",
        "intensidade": "leve",
        "distancia_km": 6.0,
        "duracao_min": 36.0,
        "ritmo": "6:00/km",
        "gap": None,
        "zona_fc": "Z2",
        "pse": "3/10 - leve, da para conversar",
        "cadencia": "~170 ppm (a sua habitual)",
        "terreno": "plano",
        "metrica_prioritaria": "PSE",
        "observacoes": None,
        "passos": [
            PlanStep(fase="principal", descricao="Rodar leve", duracao_min=36, distancia_km=6, repeticoes=None,
                     ritmo="6:00/km", zona_fc="Z2", pse="3", recuperacao=None),
        ],
    }
    return PlanWorkout(**{**base, **over})


def _plan(workouts: list[PlanWorkout], status: str = "verde") -> WeeklyPlanLLM:
    return WeeklyPlanLLM(
        status=status,
        status_justificativa="TSB positivo e nenhum sinal de fadiga",
        resumo="Semana de retomada.",
        avaliacao=PlanEvaluation(positivos=["Voltou a correr"], fadiga=[], riscos=[], evolucao=[]),
        proxima_semana=PlanNextWeek(km_previsto=18, sessoes=3, estimulo_principal="aerobico", objetivo="base"),
        treinos=workouts,
        criterios_ajuste=PlanAdjustCriteria(manter=["PSE ate 4"], reduzir=["FC alta em ritmo facil"],
                                            acelerar=[], interromper=["dor que aumenta"]),
        proximas_4_semanas=[],
    )


# ── validacao pura ──────────────────────────────────────────────────────────


def test_validate_keeps_only_valid_dates_in_order():
    plan = _plan([
        _workout(START + timedelta(days=4)),
        _workout(START),
        _workout(START, titulo="repetido no mesmo dia"),
        _workout(START - timedelta(days=1)),  # antes da semana
        _workout(END + timedelta(days=1)),    # depois da semana
        _workout(START, data="amanha"),       # data invalida
    ])
    valid = validate_weekly_plan(plan, START, END)
    assert [w.data for w in valid] == [START.isoformat(), (START + timedelta(days=4)).isoformat()]
    assert valid[0].titulo == "Rodagem leve"  # o primeiro do dia fica


def test_validate_requires_a_rest_day():
    plan = _plan([_workout(START + timedelta(days=i)) for i in range(7)])
    with pytest.raises(CoachPlanParseError, match="descanso"):
        validate_weekly_plan(plan, START, END)
    assert len(validate_weekly_plan(_plan([_workout(START + timedelta(days=i)) for i in range(6)]), START, END)) == 6


def test_validate_no_hard_workout_when_red():
    plan = _plan([_workout(START, intensidade="forte")], status="vermelho")
    with pytest.raises(CoachPlanParseError, match="vermelho"):
        validate_weekly_plan(plan, START, END)
    # moderado no vermelho passa; forte no laranja tambem
    validate_weekly_plan(_plan([_workout(START, intensidade="moderado")], status="vermelho"), START, END)
    validate_weekly_plan(_plan([_workout(START, intensidade="forte")], status="laranja"), START, END)


def test_validate_requires_objective_and_reason():
    with pytest.raises(CoachPlanParseError, match="motivo"):
        validate_weekly_plan(_plan([_workout(START, motivo="  ")]), START, END)


def test_validate_rejects_empty_week():
    with pytest.raises(CoachPlanParseError):
        validate_weekly_plan(_plan([_workout(END + timedelta(days=3))]), START, END)


def test_previous_week_load_comes_from_the_analysis():
    analysis = {
        "janelas": {"7d": {
            "corrida": {"sessoes": 3, "km": 21.4, "minutos": 130, "ritmo_medio": "6:04/km", "longao_km": 10.2},
            "caminhada": {"km": 3.0}, "complementar": {"bike": {"sessoes": 1, "minutos": 60}},
            "sessoes_total": 5, "carga_interna_srpe": 610, "pse_media": 4.2,
        }},
        "distribuicao_intensidade_28d": {"disponivel": False},
    }
    load = previous_week_load(analysis)
    assert load["corrida_km"] == 21.4 and load["corridas"] == 3 and load["treinos_total"] == 5
    assert load["longao_km"] == 10.2 and load["complementar"] == {"bike": {"sessoes": 1, "minutos": 60}}
    assert load["intensidade_28d_pct"] is None


# ── endpoints ───────────────────────────────────────────────────────────────


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


def _with_history(client: TestClient) -> None:
    """3 semanas de historico: o plano exige pelo menos 2."""
    start = datetime.now(UTC).replace(hour=12, minute=0, second=0, microsecond=0) - timedelta(days=21)
    resp = client.post(
        "/activities/import-normalized",
        json={"sport": "running", "start_time": start.isoformat(), "duration_s": 2400, "moving_time_s": 2400,
              "source": "garmin_api", "source_activity_id": "hist-1", "distance_m": 7000.0},
    )
    assert resp.status_code in (200, 201), resp.text


def _generate(client: TestClient, fake_llm, workouts_offsets=(0, 2, 4), status="verde") -> dict:
    start, _end = week_range()
    fake_llm(_plan([_workout(start + timedelta(days=i), titulo=f"Treino {i}") for i in workouts_offsets], status))
    resp = client.post("/coach/plan/generate")
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_generate_saves_plan_and_structured_workouts(auth_client: tuple[TestClient, dict], fake_llm) -> None:
    client, _user = auth_client
    _with_history(client)

    body = _generate(client, fake_llm)

    plan = body["plan"]
    assert plan["status"] == "verde" and plan["status_reason"].startswith("TSB")
    assert set(plan["report"]) == {"resumo", "carga_semana_anterior", "avaliacao", "proxima_semana",
                                   "criterios_ajuste", "proximas_4_semanas"}
    assert plan["report"]["carga_semana_anterior"]["corridas"] == 0  # o historico e de 3 semanas atras
    [first, *_] = body["workouts"]
    assert first["objective"] == "Base aerobica" and first["reason"].startswith("Semana de retomada")
    assert first["target_distance_m"] == 6000 and first["target_duration_s"] == 2160
    assert first["targets"]["metrica_prioritaria"] == "PSE" and first["steps"][0]["fase"] == "principal"
    assert first["weekly_plan_id"] == plan["id"]

    week = client.get("/coach/plan/week").json()
    assert week["plan"]["id"] == plan["id"] and len(week["workouts"]) == 3


def test_regenerating_the_week_replaces_planned_workouts(auth_client: tuple[TestClient, dict], fake_llm) -> None:
    client, _user = auth_client
    _with_history(client)
    _generate(client, fake_llm, (0, 1, 2, 3))
    second = _generate(client, fake_llm, (5,))

    assert client.get("/coach/plan/week").json()["plan"]["id"] == second["plan"]["id"]
    assert len(client.get("/coach/plan?days_ahead=14").json()) == 1


def test_invalid_plan_is_502_and_nothing_is_saved(auth_client: tuple[TestClient, dict], fake_llm) -> None:
    client, _user = auth_client
    _with_history(client)
    start, _end = week_range()
    fake_llm(_plan([_workout(start + timedelta(days=i)) for i in range(7)]))  # sem descanso

    resp = client.post("/coach/plan/generate")

    assert resp.status_code == 502 and resp.json()["detail"]["error"] == "invalid_plan_response"
    assert client.get("/coach/plan/week").json() == {"plan": None, "workouts": []}


def test_regenerate_day_keeps_the_date_and_records_the_reason(auth_client: tuple[TestClient, dict], fake_llm) -> None:
    client, _user = auth_client
    _with_history(client)
    target = _generate(client, fake_llm)["workouts"][0]

    other_day = (date.fromisoformat(target["date"]) + timedelta(days=1)).isoformat()
    sent = fake_llm(RegeneratedDay(
        descanso=False, explicacao="Troquei por algo mais leve.",
        treino=_workout(date.fromisoformat(other_day), titulo="Trote regenerativo", distancia_km=4.0),
    ))
    resp = client.post(f"/coach/plan/{target['id']}/regenerate", json={"reason": "panturrilha dura"})

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["explanation"] == "Troquei por algo mais leve."
    assert body["workout"]["title"] == "Trote regenerativo" and body["workout"]["date"] == target["date"]
    assert body["workout"]["targets"]["ajuste_pedido"] == "panturrilha dura"
    assert "panturrilha dura" in sent["user_content"] and sent["response_model"] is RegeneratedDay


def test_regenerate_day_can_become_rest(auth_client: tuple[TestClient, dict], fake_llm) -> None:
    client, _user = auth_client
    _with_history(client)
    target = _generate(client, fake_llm)["workouts"][0]
    fake_llm(RegeneratedDay(descanso=True, explicacao="Com dor, hoje e descanso.", treino=None))

    body = client.post(f"/coach/plan/{target['id']}/regenerate", json={"reason": "dor no joelho"}).json()

    assert body["workout"] is None
    assert len(client.get("/coach/plan/week").json()["workouts"]) == 2


def test_regenerate_refuses_done_workout(auth_client: tuple[TestClient, dict], fake_llm) -> None:
    client, _user = auth_client
    _with_history(client)
    target = _generate(client, fake_llm)["workouts"][0]
    client.patch(f"/coach/plan/{target['id']}", json={"status": "done"})

    resp = client.post(f"/coach/plan/{target['id']}/regenerate", json={"reason": "quero outro"})

    assert resp.status_code == 400 and resp.json()["detail"]["error"] == "not_editable"


def test_move_warns_on_conflict_then_swaps_or_keeps_both(auth_client: tuple[TestClient, dict], fake_llm) -> None:
    client, _user = auth_client
    _with_history(client)
    a, b, _c = _generate(client, fake_llm)["workouts"]

    resp = client.post(f"/coach/plan/{a['id']}/move", json={"date": b["date"]})
    assert resp.status_code == 409
    assert resp.json()["detail"]["conflict"]["title"] == b["title"]

    moved = client.post(f"/coach/plan/{a['id']}/move", json={"date": b["date"], "on_conflict": "swap"}).json()
    assert moved["date"] == b["date"]
    by_id = {w["id"]: w for w in client.get("/coach/plan/week").json()["workouts"]}
    assert by_id[b["id"]]["date"] == a["date"]  # trocaram de dia

    free_day = (date.fromisoformat(a["date"]) + timedelta(days=1)).isoformat()
    assert client.post(f"/coach/plan/{b['id']}/move", json={"date": free_day}).status_code == 200

    both = client.post(f"/coach/plan/{b['id']}/move", json={"date": moved["date"], "on_conflict": "keep_both"})
    assert both.status_code == 200


def test_move_refuses_past_date(auth_client: tuple[TestClient, dict], fake_llm) -> None:
    client, _user = auth_client
    _with_history(client)
    a = _generate(client, fake_llm)["workouts"][0]
    yesterday = (date.today() - timedelta(days=1)).isoformat()

    resp = client.post(f"/coach/plan/{a['id']}/move", json={"date": yesterday})

    assert resp.status_code == 400 and resp.json()["detail"]["error"] == "past_date"
