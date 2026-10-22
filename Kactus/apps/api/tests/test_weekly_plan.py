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

# Os endpoints rodam numa quarta fixa (a quarta desta semana, ou da anterior): a geracao
# vale de hoje a domingo, e o teste precisa saber quantos dias sobram.
_REAL_TODAY = date.today()
WEDNESDAY = _REAL_TODAY - timedelta(days=(_REAL_TODAY.weekday() - 2) % 7)


class _FixedDate(date):
    today_value = WEDNESDAY

    @classmethod
    def today(cls):
        return cls.today_value


@pytest.fixture(autouse=True)
def fixed_today(monkeypatch):
    """date.today() do coach_service vira a quarta; mude com fixed_today(dia)."""
    monkeypatch.setattr(coach_service, "date", _FixedDate)

    def set_day(day: date) -> None:
        monkeypatch.setattr(_FixedDate, "today_value", day)

    set_day(WEDNESDAY)
    return set_day


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
        "zona_fc": "Zona 2 (128-142 bpm)",
        "cadencia": "~170 ppm (a sua habitual)",
        "terreno": "plano",
        "metrica_prioritaria": "FC",
        "observacoes": None,
        "passos": [
            PlanStep(fase="principal", descricao="Rodar leve", duracao_min=36, distancia_km=6, repeticoes=None,
                     ritmo="6:00/km", zona_fc="Zona 2 (128-142 bpm)", recuperacao=None),
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
    assert set(plan["report"]) == {"semana_gerada", "resumo", "carga_semana_anterior", "avaliacao", "proxima_semana",
                                   "criterios_ajuste", "proximas_4_semanas"}
    assert plan["report"]["carga_semana_anterior"]["corridas"] == 0  # o historico e de 3 semanas atras
    [first, *_] = body["workouts"]
    assert first["objective"] == "Base aerobica" and first["reason"].startswith("Semana de retomada")
    assert first["target_distance_m"] == 6000 and first["target_duration_s"] == 2160
    assert first["targets"]["metrica_prioritaria"] == "FC" and first["steps"][0]["fase"] == "principal"
    assert "pse" not in first["targets"] and "pse" not in first["steps"][0]  # o atleta nao le PSE
    assert first["weekly_plan_id"] == plan["id"]

    week = client.get("/coach/plan/week").json()
    assert week["plan"]["id"] == plan["id"] and len(week["workouts"]) == 3
    # quarta a domingo; a semana gerada fica guardada (a segunda) e trava ate a proxima segunda
    assert plan["week_start"] == WEDNESDAY.isoformat()
    assert plan["week_end"] == (WEDNESDAY + timedelta(days=4)).isoformat()
    assert plan["report"]["semana_gerada"] == (WEDNESDAY - timedelta(days=2)).isoformat()
    assert week["generation"]["locked"] is True
    assert week["generation"]["unlocks_on"] == (WEDNESDAY + timedelta(days=5)).isoformat()


def test_week_is_generated_only_until_sunday(auth_client: tuple[TestClient, dict], fake_llm) -> None:
    client, _user = auth_client
    _with_history(client)
    gen = client.get("/coach/plan/week").json()["generation"]
    assert gen["locked"] is False and gen["trained_today"] is False
    assert (gen["first_day"], gen["last_day"]) == (WEDNESDAY.isoformat(), (WEDNESDAY + timedelta(days=4)).isoformat())

    sent = fake_llm(_plan([_workout(WEDNESDAY + timedelta(days=i), titulo=f"Treino {i}") for i in (0, 2, 4, 5, 6)]))
    body = client.post("/coach/plan/generate").json()

    # segunda e terca da semana seguinte ficam de fora: so ate domingo
    assert [w["date"] for w in body["workouts"]] == [(WEDNESDAY + timedelta(days=i)).isoformat() for i in (0, 2, 4)]
    assert "quarta" in sent["user_content"] and "domingo" in sent["user_content"]
    assert "segunda" not in sent["user_content"].split("Contexto do atleta")[0].split("Os dias do plano")[1]


def test_generate_is_locked_until_monday(auth_client: tuple[TestClient, dict], fake_llm, fixed_today) -> None:
    client, _user = auth_client
    _with_history(client)
    _generate(client, fake_llm, (0, 2))

    again = client.post("/coach/plan/generate")
    assert again.status_code == 409 and again.json()["detail"]["error"] == "week_already_generated"

    fixed_today(WEDNESDAY + timedelta(days=4))  # domingo: ainda travado
    assert client.post("/coach/plan/generate").status_code == 409

    monday = WEDNESDAY + timedelta(days=5)
    fixed_today(monday)  # segunda: libera, e vale a semana nova inteira
    gen = client.get("/coach/plan/week").json()["generation"]
    assert gen["locked"] is False and gen["first_day"] == monday.isoformat()
    fake_llm(_plan([_workout(monday + timedelta(days=i)) for i in (0, 2, 4)]))
    assert client.post("/coach/plan/generate").status_code == 200
    assert client.get("/coach/plan/week").json()["generation"]["locked"] is True


def test_short_end_of_week_can_be_all_rest_or_all_training() -> None:
    sunday = START + timedelta(days=6)
    assert validate_weekly_plan(_plan([]), sunday, sunday) == []
    friday = START + timedelta(days=4)
    assert len(validate_weekly_plan(_plan([_workout(friday + timedelta(days=i)) for i in range(3)]), friday, sunday)) == 3


def test_invalid_plan_is_502_and_nothing_is_saved(auth_client: tuple[TestClient, dict], fake_llm) -> None:
    client, _user = auth_client
    _with_history(client)
    start, _end = week_range()
    fake_llm(_plan([_workout(start + timedelta(days=i)) for i in range(7)]))  # sem descanso

    resp = client.post("/coach/plan/generate")

    assert resp.status_code == 502 and resp.json()["detail"]["error"] == "invalid_plan_response"
    week = client.get("/coach/plan/week").json()
    assert week["plan"] is None and week["workouts"] == []
    assert week["generation"]["locked"] is False  # falhou: nao gasta a semana


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
    yesterday = (WEDNESDAY - timedelta(days=1)).isoformat()

    resp = client.post(f"/coach/plan/{a['id']}/move", json={"date": yesterday})

    assert resp.status_code == 400 and resp.json()["detail"]["error"] == "past_date"


def test_week_starts_today() -> None:
    assert week_range(date(2026, 10, 5)) == (date(2026, 10, 5), date(2026, 10, 11))


def test_trained_today_starts_tomorrow(auth_client: tuple[TestClient, dict], fake_llm, db_session) -> None:
    """Ja treinou hoje: o plano comeca amanha, e o feito de hoje aparece no quadro."""
    from kactus_api.models.coach import PlannedWorkout

    client, user = auth_client
    _with_history(client)
    import uuid as _uuid
    db_session.add(PlannedWorkout(user_id=user["id"], date=WEDNESDAY, sport="run", title="Feito hoje",
                                  status="done", plan_batch_id=_uuid.uuid4()))
    db_session.flush()
    gen = client.get("/coach/plan/week").json()["generation"]
    assert gen["trained_today"] is True and gen["first_day"] == (WEDNESDAY + timedelta(days=1)).isoformat()

    sent = fake_llm(_plan([_workout(WEDNESDAY + timedelta(days=i)) for i in (0, 1, 3)]))
    body = client.post("/coach/plan/generate").json()

    assert [w["date"] for w in body["workouts"]] == [(WEDNESDAY + timedelta(days=i)).isoformat() for i in (1, 3)]
    assert "ja treinou" in sent["user_content"]
    week = client.get("/coach/plan/week").json()["workouts"]
    assert (WEDNESDAY.isoformat(), "done") in [(w["date"], w["status"]) for w in week]


def test_plan_schema_speaks_hr_not_pse() -> None:
    """A Duni guia por FC, distancia, ritmo e tempo: o esquema pedido a IA nao tem PSE."""
    assert "pse" not in PlanWorkout.model_fields and "pse" not in PlanStep.model_fields
    assert "PSE" not in coach_service._WEEK_PLAN_INSTRUCTION
