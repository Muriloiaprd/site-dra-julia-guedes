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
    assert set(ctx["perfil"]) == {"tratamento", "peso_kg", "fc_repouso", "fc_max", "zonas_fc_bpm"}
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


def test_prompt_is_the_duni_v4() -> None:
    assert settings.coach_prompt_version == "v4"
    assert "Você é a Duni" in coach_service.SYSTEM_PROMPT and "Kactus" in coach_service.SYSTEM_PROMPT
    assert "ondilow" not in coach_service.SYSTEM_PROMPT.lower()
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


def test_analysis_is_structured_and_short(auth_client: tuple[TestClient, dict], monkeypatch) -> None:
    """Resumo v4: saida estruturada, no maximo 3 pontos e 3 acoes, salvo como JSON."""
    client, _user = auth_client
    sent: dict = {}
    parsed = coach_service.AnalysisLLM(
        status="amarelo",
        status_frase="Atenção: 14 dias sem treinar.",
        semana="0 km nos últimos 7 dias; normal era 20 km.",
        pontos=[coach_service.AnalysisPoint(tipo="bom", texto=f"ponto {i}") for i in range(5)],
        acoes=[f"acao {i}" for i in range(4)],
        pergunta="Qual é o seu objetivo?",
    )

    def _call(system_prompt, user_content, *, response_model=None):
        sent["response_model"] = response_model
        return parsed, "modelo-fake"

    monkeypatch.setattr(coach_service, "call_llm", _call)
    monkeypatch.setattr(coach_service, "_require_sufficient_data", lambda _ctx: None)

    body = client.post("/coach/analyze").json()

    assert sent["response_model"] is coach_service.AnalysisLLM
    assert body["report"] is None
    summary = body["summary"]
    assert summary["status"] == "amarelo" and summary["pergunta"] == "Qual é o seu objetivo?"
    assert len(summary["pontos"]) == 3 and len(summary["acoes"]) == 3
    # o GET devolve o mesmo resumo, sem chamar a IA
    again = client.get("/coach/analyze").json()
    assert again["summary"] == summary and again["model_used"] == "modelo-fake"


def test_old_markdown_report_still_comes_back(auth_client: tuple[TestClient, dict], db_session: Session) -> None:
    client, user = auth_client
    db_session.add(CoachInteraction(user_id=user["id"], kind="analysis", content="**Status**: 🟢", model_used="m"))
    db_session.commit()
    body = client.get("/coach/analyze").json()
    assert body["summary"] is None and body["report"] == "**Status**: 🟢"


def test_prompt_v4_asks_for_short_text_without_acronyms() -> None:
    prompt = coach_service.SYSTEM_PROMPT
    assert "ESCRITA" in prompt and "~100 palavras" in prompt
    assert '"disposição" (não TSB)' in prompt
    schema = coach_service.WeeklyPlanLLM.model_json_schema()
    assert "1 a 2 frases" in schema["properties"]["resumo"]["description"]
    assert "No maximo 2 itens" in schema["$defs"]["PlanEvaluation"]["properties"]["positivos"]["description"]
    assert "~120" in coach_service._ACTIVITY_INSTRUCTION
