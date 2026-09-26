"""Memorias da Duni (/coach/memories) e sugestoes de memoria no chat."""

import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from kactus_api.ai import coach_service
from kactus_api.ai.coach_service import ChatMemorySuggestion, ChatReply, CoachPlanParseError
from kactus_api.models import User
from kactus_api.models.coach import CoachInteraction
from kactus_api.security import create_access_token, hash_password


def _create(client: TestClient, **body) -> dict:
    payload = {"kind": "prova", "content": "Meia maratona do Rio", **body}
    resp = client.post("/coach/memories", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_create_list_update_archive_delete(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    race = _create(client, event_date="2026-11-30")
    injury = _create(client, kind="lesao", content="  Canelite na perna esquerda  ")

    assert race["source"] == "manual" and race["active"] is True
    assert injury["content"] == "Canelite na perna esquerda"  # sem espacos nas pontas
    assert {m["id"] for m in client.get("/coach/memories").json()} == {race["id"], injury["id"]}

    edited = client.patch(f"/coach/memories/{race['id']}", json={"content": "Meia do Rio (21 km)", "event_date": None}).json()
    assert edited["content"] == "Meia do Rio (21 km)" and edited["event_date"] is None

    client.patch(f"/coach/memories/{injury['id']}", json={"active": False})
    active = client.get("/coach/memories").json()
    assert [m["id"] for m in active] == [race["id"]]
    assert len(client.get("/coach/memories?include_archived=true").json()) == 2

    assert client.delete(f"/coach/memories/{race['id']}").status_code == 204
    assert client.get("/coach/memories").json() == []


def test_patch_null_does_not_erase_required_fields(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    m = _create(client)
    body = client.patch(f"/coach/memories/{m['id']}", json={"content": None, "kind": None}).json()
    assert body["content"] == "Meia maratona do Rio" and body["kind"] == "prova"


def test_validation(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    assert client.post("/coach/memories", json={"kind": "sonho", "content": "x"}).status_code == 422
    assert client.post("/coach/memories", json={"kind": "outro", "content": ""}).status_code == 422
    assert client.post("/coach/memories", json={"kind": "outro", "content": "x" * 501}).status_code == 422
    assert client.post("/coach/memories", json={"kind": "outro", "content": "x", "source": "gemini"}).status_code == 422


def test_other_users_memory_is_404(auth_client: tuple[TestClient, dict], db_session: Session) -> None:
    client, _owner = auth_client
    m = _create(client)
    other = User(email=f"pytest-{uuid.uuid4().hex[:12]}@kactus.test", password_hash=hash_password("outra-senha-123"))
    db_session.add(other)
    db_session.commit()
    headers = {"Authorization": f"Bearer {create_access_token(str(other.id))}"}

    assert client.patch(f"/coach/memories/{m['id']}", json={"active": False}, headers=headers).status_code == 404
    assert client.delete(f"/coach/memories/{m['id']}", headers=headers).status_code == 404
    assert client.get("/coach/memories", headers=headers).json() == []


def test_memories_context_counts_days(auth_client: tuple[TestClient, dict], db_session: Session) -> None:
    client, user = auth_client
    today = date(2026, 9, 21)
    _create(client, event_date=(today + timedelta(days=70)).isoformat())
    _create(client, kind="lesao", content="Dor no joelho em descidas")
    archived = _create(client, kind="objetivo", content="Sub 1h40 na meia")
    client.patch(f"/coach/memories/{archived['id']}", json={"active": False})

    ctx = coach_service.memories_context(db_session, user["id"], today=today)

    assert ctx[0] == {"tipo": "prova", "conteudo": "Meia maratona do Rio", "data": "2026-11-30", "quando": "faltam 70 dias"}
    assert ctx[1] == {"tipo": "lesao", "conteudo": "Dor no joelho em descidas"}
    assert len(ctx) == 2  # arquivada nao entra


# ── chat ───────────────────────────────────────────────────────────────────


@pytest.fixture
def fake_llm(monkeypatch):
    """Substitui a chamada ao Gemini; guarda o que foi enviado."""
    sent = {}

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


def test_chat_returns_clean_suggestions_without_saving_them(auth_client: tuple[TestClient, dict], fake_llm) -> None:
    client, _user = auth_client
    _create(client, kind="lesao", content="Canelite na perna esquerda")
    sent = fake_llm(ChatReply(
        reply="Anotado! Vamos preparar a meia.",
        memory_suggestions=[
            ChatMemorySuggestion(kind="prova", content="Meia maratona em 30/11", event_date="2026-11-30"),
            ChatMemorySuggestion(kind="lesao", content="canelite na perna esquerda"),   # ja salva
            ChatMemorySuggestion(kind="disponibilidade", content="Sem treino às quartas", event_date="quarta"),
            ChatMemorySuggestion(kind="outro", content="   "),
        ],
    ))

    resp = client.post("/coach/chat", json={"message": "Vou correr a meia em 30/11 e nao treino as quartas"})

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["reply"] == "Anotado! Vamos preparar a meia."
    assert body["memory_suggestions"] == [
        {"kind": "prova", "content": "Meia maratona em 30/11", "event_date": "2026-11-30"},
        {"kind": "disponibilidade", "content": "Sem treino às quartas", "event_date": None},
    ]
    # a Duni recebeu o que ja sabe, para nao repetir
    assert "Canelite na perna esquerda" in sent["user_content"]
    assert sent["response_model"] is ChatReply
    # sugestao nao vira memoria sozinha
    assert len(client.get("/coach/memories").json()) == 1
    history = client.get("/coach/chat/history").json()
    assert [h["role"] for h in history] == ["user", "assistant"]


def test_chat_history_puts_question_first_on_timestamp_tie(auth_client: tuple[TestClient, dict], db_session: Session) -> None:
    """Mensagens antigas tem pergunta e resposta com o mesmo created_at."""
    client, user = auth_client
    same = datetime(2026, 9, 21, 18, 23, 8, tzinfo=UTC)
    for role in ("assistant", "user"):  # a resposta gravada primeiro, de proposito
        db_session.add(CoachInteraction(user_id=user["id"], kind="chat", role=role, content=role, created_at=same))
    db_session.commit()

    assert [h["role"] for h in client.get("/coach/chat/history").json()] == ["user", "assistant"]


def test_chat_invalid_structured_response_is_502(auth_client: tuple[TestClient, dict], fake_llm) -> None:
    client, _user = auth_client
    fake_llm(CoachPlanParseError("Gemini retornou JSON invalido"))
    resp = client.post("/coach/chat", json={"message": "oi"})
    assert resp.status_code == 502
    assert resp.json()["detail"]["error"] == "invalid_response"
    assert client.get("/coach/chat/history").json() == []
