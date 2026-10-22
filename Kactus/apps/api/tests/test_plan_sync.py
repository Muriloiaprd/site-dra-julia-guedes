"""Mudar o treino de um dia e ver a mudanca em todas as telas: a Duni trocando pelo
chat (antes ela dizia "feito" e nada mudava) e o atleta editando a mao no calendario.
Todas as telas leem a mesma tabela (planned_workouts), entao basta conferir as rotas."""

import uuid
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from kactus_api.ai import coach_service
from kactus_api.ai.coach_service import ChatReply, ChatWorkoutChange, PlanStep, PlanWorkout
from kactus_api.models.coach import PlannedWorkout

TODAY = date.today()


@pytest.fixture
def fake_llm(monkeypatch):
    sent: dict = {}

    def install(result):
        def _call(system_prompt, user_content, *, response_model=None):
            sent["user_content"] = user_content
            return result, "modelo-fake"

        monkeypatch.setattr(coach_service, "call_llm", _call)
        return sent

    return install


def _planned(db: Session, user_id, day: date, **over) -> PlannedWorkout:
    row = PlannedWorkout(
        user_id=user_id, date=day, sport="run", title="Rodagem leve", target_distance_m=4000,
        target_duration_s=1560, target_intensity="leve", plan_batch_id=uuid.uuid4(),
        targets={"tipo": "rodagem leve", "ritmo": "6:30/km"},
        steps=[{"fase": "principal", "descricao": "Rodar", "duracao_min": 26, "distancia_km": 4, "repeticoes": None,
                "ritmo": "6:30/km", "zona_fc": "Zona 2", "recuperacao": None}],
        **over,
    )
    db.add(row)
    db.flush()
    return row


def _z2(day: date) -> PlanWorkout:
    return PlanWorkout(
        data=day.isoformat(), esporte="run", tipo="rodagem leve", titulo="40 min em Z2",
        objetivo="Base aerobica sem cansar", motivo="Pedido do atleta", intensidade="leve",
        distancia_km=6.5, duracao_min=40, ritmo="6:10/km", gap=None, zona_fc="Zona 2 (128-150 bpm)",
        cadencia=None, terreno=None, metrica_prioritaria="FC", observacoes=None,
        passos=[PlanStep(fase="principal", descricao="Rodar em Z2", duracao_min=40, distancia_km=6.5,
                         repeticoes=None, ritmo="6:10/km", zona_fc="Zona 2", recuperacao=None)],
    )


def _everywhere(client: TestClient, day: date) -> list[dict]:
    """O treino do dia em cada rota que as telas usam: calendario, dashboard e quadro da semana."""
    iso = day.isoformat()
    cal = [w for w in client.get(f"/coach/plan?start={iso}&end={iso}").json()]
    dash = [w for w in client.get("/coach/plan?days_ahead=35").json() if w["date"] == iso]
    return [cal, dash]


def test_chat_change_is_saved_and_shows_on_every_screen(
    auth_client: tuple[TestClient, dict], db_session: Session, fake_llm
) -> None:
    client, user = auth_client
    row = _planned(db_session, user["id"], TODAY)
    sent = fake_llm(ChatReply(
        reply="Feito, mudei para 40 minutos em zona 2 hoje.",
        alteracao_treino=ChatWorkoutChange(data=TODAY.isoformat(), descanso=False, treino=_z2(TODAY)),
    ))

    resp = client.post("/coach/chat", json={"message": "Quero que troque meu treino de hoje para 40 min correndo em z2"})

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["reply"] == "Feito, mudei para 40 minutos em zona 2 hoje."
    change = body["workout_change"]
    assert change["applied"] is True and change["action"] == "changed" and change["workout"]["id"] == str(row.id)
    for screen in _everywhere(client, TODAY):
        assert [(w["id"], w["title"], w["target_duration_s"]) for w in screen] == [(str(row.id), "40 min em Z2", 2400)]
    # a Duni recebeu a agenda para saber o que trocar
    assert "treinos_planejados" in sent["user_content"] and "Rodagem leve" in sent["user_content"]


def test_chat_change_on_a_free_day_creates_the_workout(
    auth_client: tuple[TestClient, dict], fake_llm
) -> None:
    client, _user = auth_client
    day = TODAY + timedelta(days=2)
    fake_llm(ChatReply(reply="Coloquei.", alteracao_treino=ChatWorkoutChange(data=day.isoformat(), descanso=False, treino=_z2(day))))

    change = client.post("/coach/chat", json={"message": "poe um treino depois de amanha"}).json()["workout_change"]

    assert change["action"] == "created"
    assert [w["title"] for w in _everywhere(client, day)[0]] == ["40 min em Z2"]


def test_chat_rest_removes_the_workout(auth_client: tuple[TestClient, dict], db_session: Session, fake_llm) -> None:
    client, user = auth_client
    day = TODAY + timedelta(days=1)
    _planned(db_session, user["id"], day)
    fake_llm(ChatReply(reply="Amanha e descanso.", alteracao_treino=ChatWorkoutChange(data=day.isoformat(), descanso=True, treino=None)))

    change = client.post("/coach/chat", json={"message": "tira o treino de amanha"}).json()["workout_change"]

    assert change["action"] == "rest" and change["applied"] is True
    assert _everywhere(client, day) == [[], []]


def test_chat_cannot_claim_a_change_that_did_not_happen(
    auth_client: tuple[TestClient, dict], db_session: Session, fake_llm
) -> None:
    client, user = auth_client
    _planned(db_session, user["id"], TODAY, status="done")
    fake_llm(ChatReply(reply="Feito, troquei.", alteracao_treino=ChatWorkoutChange(data=TODAY.isoformat(), descanso=False, treino=_z2(TODAY))))

    body = client.post("/coach/chat", json={"message": "troca o de hoje"}).json()

    assert body["workout_change"]["applied"] is False
    assert "Não consegui mudar o treino" in body["reply"]
    assert client.get("/coach/chat/history").json()[-1]["content"] == body["reply"]  # o historico tambem avisa
    assert _everywhere(client, TODAY)[0][0]["title"] == "Rodagem leve"


def test_plain_chat_changes_nothing(auth_client: tuple[TestClient, dict], db_session: Session, fake_llm) -> None:
    client, user = auth_client
    _planned(db_session, user["id"], TODAY)
    fake_llm(ChatReply(reply="Hoje e leve."))

    body = client.post("/coach/chat", json={"message": "como esta meu treino de hoje?"}).json()

    assert body["workout_change"] is None
    assert _everywhere(client, TODAY)[0][0]["title"] == "Rodagem leve"


# ── edicao a mao (clicar no dia do calendario) ─────────────────────────────


def test_edit_workout_by_hand(auth_client: tuple[TestClient, dict], db_session: Session) -> None:
    client, user = auth_client
    row = _planned(db_session, user["id"], TODAY + timedelta(days=1))

    resp = client.patch(f"/coach/plan/{row.id}", json={
        "title": "Intervalado curto", "tipo": "intervalado", "target_distance_m": 6000, "target_duration_s": 2100,
        "target_intensity": "forte", "ritmo": "4:50/km", "objective": "Ritmo de 5 km",
    })

    assert resp.status_code == 200, resp.text
    w = resp.json()
    assert (w["title"], w["target_distance_m"], w["target_duration_s"], w["target_intensity"]) == ("Intervalado curto", 6000, 2100, "forte")
    assert w["targets"]["tipo"] == "intervalado" and w["targets"]["ritmo"] == "4:50/km" and w["targets"]["editado_pelo_atleta"]
    assert w["objective"] == "Ritmo de 5 km" and w["description"] == "Ritmo de 5 km"
    # o passo a passo antigo (4 km) nao bate mais: vira um passo so com o novo volume
    assert w["steps"] == [{"fase": "principal", "descricao": "Intervalado curto", "duracao_min": 35.0, "distancia_km": 6.0,
                           "repeticoes": None, "ritmo": "4:50/km", "zona_fc": None, "recuperacao": None}]
    for screen in _everywhere(client, TODAY + timedelta(days=1)):
        assert screen[0]["title"] == "Intervalado curto"


def test_edit_only_text_keeps_steps(auth_client: tuple[TestClient, dict], db_session: Session) -> None:
    client, user = auth_client
    row = _planned(db_session, user["id"], TODAY)

    w = client.patch(f"/coach/plan/{row.id}", json={"observacoes": "Levar agua", "title": None}).json()

    assert w["title"] == "Rodagem leve" and w["targets"]["observacoes"] == "Levar agua"
    assert w["steps"][0]["distancia_km"] == 4


def test_edit_refuses_done_or_past_workout(auth_client: tuple[TestClient, dict], db_session: Session) -> None:
    client, user = auth_client
    done = _planned(db_session, user["id"], TODAY, status="done")
    past = _planned(db_session, user["id"], TODAY - timedelta(days=2))

    for row in (done, past):
        resp = client.patch(f"/coach/plan/{row.id}", json={"title": "Outro"})
        assert resp.status_code == 400 and resp.json()["detail"]["error"] == "not_editable"
    # so a situacao continua podendo mudar
    assert client.patch(f"/coach/plan/{past.id}", json={"status": "skipped"}).json()["status"] == "skipped"


def test_edit_validates_fields(auth_client: tuple[TestClient, dict], db_session: Session) -> None:
    client, user = auth_client
    row = _planned(db_session, user["id"], TODAY)
    assert client.patch(f"/coach/plan/{row.id}", json={"target_intensity": "maxima"}).status_code == 422
    assert client.patch(f"/coach/plan/{row.id}", json={"target_distance_m": -1}).status_code == 422
