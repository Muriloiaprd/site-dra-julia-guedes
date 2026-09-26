"""Contexto da Duni (Fase 6): analise da Fase 4, memorias, aderencia e atividades recentes."""

import uuid
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from kactus_api.ai import coach_service
from kactus_api.config import settings
from kactus_api.models import PlannedWorkout
from kactus_api.models.coach import CoachInteraction

_BATCH = uuid.uuid4()


def _workout(user_id, day: date, status: str, title: str = "Rodagem leve") -> PlannedWorkout:
    return PlannedWorkout(user_id=user_id, date=day, sport="run", title=title, status=status, plan_batch_id=_BATCH)


def test_adherence_counts_only_the_last_4_weeks(auth_client: tuple[TestClient, dict], db_session: Session) -> None:
    _client, user = auth_client
    today = date(2026, 9, 21)
    db_session.add_all([
        _workout(user["id"], today - timedelta(days=2), "done"),
        _workout(user["id"], today - timedelta(days=4), "done"),
        _workout(user["id"], today - timedelta(days=6), "skipped", "Intervalado 6x800"),
        _workout(user["id"], today - timedelta(days=40), "skipped"),  # fora da janela
        _workout(user["id"], today, "planned"),                        # hoje ainda nao conta
        _workout(user["id"], today + timedelta(days=2), "planned"),    # futuro
    ])
    db_session.commit()

    adh = coach_service.adherence_context(db_session, user["id"], today=today)

    assert adh == {
        "planejados": 3,
        "feitos": 2,
        "pulados": 1,
        "percentual_feito": 67,
        "pulados_detalhe": [{"data": "2026-09-15", "treino": "Intervalado 6x800"}],
    }


def test_adherence_without_plan(auth_client: tuple[TestClient, dict], db_session: Session) -> None:
    _client, user = auth_client
    adh = coach_service.adherence_context(db_session, user["id"], today=date(2026, 9, 21))
    assert adh["planejados"] == 0 and "nota" in adh


def test_build_context_shape(auth_client: tuple[TestClient, dict], db_session: Session) -> None:
    client, user = auth_client
    start = datetime.now(UTC).replace(second=0, microsecond=0) - timedelta(hours=1)
    resp = client.post(
        "/activities/import-normalized",
        json={
            "sport": "running",
            "start_time": start.isoformat(),
            "duration_s": 2400,
            "moving_time_s": 2400,
            "source": "garmin_api",
            "source_activity_id": "contexto-1",
            "distance_m": 8000.0,
            "avg_hr": 148,
        },
    )
    activity_id = resp.json()["activity_id"]
    client.put(f"/activities/{activity_id}/checkin", json={"rpe": 4, "feeling": "bem"})
    client.post("/coach/memories", json={"kind": "objetivo", "content": "Meia abaixo de 1h45"})

    ctx = coach_service.build_context(db_session, user["id"])

    # a analise da Fase 4 vai inteira, e o formato de triathlon saiu
    assert ctx["analise"]["janelas"]["7d"]["corrida"]["km"] == 8.0
    assert "profile" not in ctx and "daily_metrics_last_30" not in ctx
    assert set(ctx["perfil"]) == {"tratamento", "peso_kg", "fc_repouso", "fc_max"}
    assert ctx["perfil"]["tratamento"] == "neutro"  # sexo nao informado
    assert ctx["objetivo_cadastrado"] is True
    assert ctx["aderencia_4_semanas"]["planejados"] == 0

    [act] = ctx["atividades_ultimos_14_dias"]
    local_day = start.astimezone(ZoneInfo("America/Sao_Paulo")).date().isoformat()
    assert act["data"] == local_day  # data no fuso da atividade, nao UTC
    assert act["tipo"] == "run" and act["km"] == 8.0 and act["ritmo"] == "5:00/km"
    assert act["fc_media"] == 148 and act["pse"] == 4 and act["sensacao"] == "bem"
    assert "dor" not in act  # campo vazio nao vai


def test_fmt_duration() -> None:
    assert coach_service._fmt_duration(233) == "3:53"
    assert coach_service._fmt_duration(6645) == "1:50:45"


def test_prompt_is_the_duni_v3() -> None:
    assert settings.coach_prompt_version == "v3"
    assert "Você é a Duni" in coach_service.SYSTEM_PROMPT
    assert "triathlon" not in coach_service.SYSTEM_PROMPT.lower()
    # o exemplo entre aspas fazia o modelo abrir todo texto com essa frase
    assert "sou sua treinadora" not in coach_service.SYSTEM_PROMPT.lower()


def test_has_goal_accepts_upcoming_race() -> None:
    race = {"tipo": "prova", "conteudo": "Meia do Rio", "data": "2026-11-15", "quando": "faltam 53 dias"}
    past = {**race, "quando": "foi há 3 dias"}
    undated = {"tipo": "prova", "conteudo": "Uma maratona no ano que vem"}
    assert coach_service.has_goal([race]) is True
    assert coach_service.has_goal([undated]) is True
    assert coach_service.has_goal([past]) is False
    assert coach_service.has_goal([{"tipo": "lesao", "conteudo": "Canelite"}]) is False


def test_get_last_report_without_calling_the_ai(auth_client: tuple[TestClient, dict], db_session: Session) -> None:
    client, user = auth_client
    assert client.get("/coach/analyze").json() is None

    old = datetime(2026, 9, 20, 12, tzinfo=UTC)
    db_session.add_all([
        CoachInteraction(user_id=user["id"], kind="analysis", content="antigo", model_used="m", created_at=old),
        CoachInteraction(user_id=user["id"], kind="analysis", content="novo", model_used="m", created_at=old + timedelta(days=1)),
        CoachInteraction(user_id=user["id"], kind="chat", role="user", content="nao e resumo", created_at=old + timedelta(days=2)),
    ])
    db_session.commit()

    body = client.get("/coach/analyze").json()
    assert body["report"] == "novo" and body["model_used"] == "m"


def test_address_follows_profile_sex(auth_client: tuple[TestClient, dict], db_session: Session) -> None:
    client, user = auth_client
    assert client.put("/profile", json={"sex": "F"}).status_code == 200
    assert coach_service.build_context(db_session, user["id"])["perfil"]["tratamento"] == "feminino"
