"""Notificacoes Web Push: inscricao, preferencias, teste e os avisos (sem rede: _deliver falso)."""

import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from kactus_api.models import Activity, PlannedWorkout, PushSubscription
from kactus_api.services import push

SUB = {"endpoint": "https://web.push.apple.com/QAbc123", "keys": {"p256dh": "B" * 87, "auth": "a" * 22}, "device": "iPhone"}


class Entregas(list):
    """O que teria saído para o aparelho; `resultado` é a resposta do serviço de push."""

    resultado = "ok"


@pytest.fixture
def entregas(monkeypatch: pytest.MonkeyPatch) -> Entregas:
    """Troca o envio de verdade (rede) por uma lista."""
    enviados = Entregas()

    def fake(sub: PushSubscription, payload: str) -> str:
        enviados.append(payload)
        return enviados.resultado

    monkeypatch.setattr(push, "_deliver", fake)
    return enviados


def test_config_subscribe_prefs(auth_client: tuple[TestClient, dict]) -> None:
    client, _ = auth_client
    c = client.get("/push/config").json()
    assert len(c["public_key"]) == 87 and c["devices"] == 0
    assert c["prefs"] == {"treino_hoje": True, "recorde": True, "sem_treino": True}

    assert client.post("/push/subscribe", json=SUB).json()["devices"] == 1
    assert client.post("/push/subscribe", json=SUB).json()["devices"] == 1  # mesmo aparelho de novo
    assert client.put("/push/prefs", json={"sem_treino": False}).json()["prefs"]["sem_treino"] is False
    assert client.post("/push/unsubscribe", json={"endpoint": SUB["endpoint"]}).json()["devices"] == 0


def test_send_test(auth_client: tuple[TestClient, dict], entregas: Entregas) -> None:
    client, _ = auth_client
    assert client.post("/push/test").status_code == 409
    client.post("/push/subscribe", json=SUB)
    assert client.post("/push/test").json() == {"delivered": 1}
    assert "Notificações ligadas" in entregas[0]
    # inscrição morta (410) sai da lista
    entregas.resultado = "gone"
    assert client.post("/push/test").json() == {"delivered": 0}
    assert client.get("/push/config").json()["devices"] == 0


def test_daily_treino_hoje_once(auth_client: tuple[TestClient, dict], db_session: Session, entregas: Entregas) -> None:
    client, user = auth_client
    uid = user["id"]
    client.post("/push/subscribe", json=SUB)
    hoje = date.today()
    db_session.add(PlannedWorkout(user_id=uid, date=hoje, sport="run", title="Rodagem leve", target_distance_m=8000, plan_batch_id=uuid.uuid4()))
    db_session.flush()

    cedo = datetime.combine(hoje, datetime.min.time()).replace(hour=6)
    assert push.daily_check(db_session, cedo) == []
    manha = cedo.replace(hour=8)
    assert push.daily_check(db_session, manha) == [(uid, "treino_hoje")]
    assert "Rodagem leve · 8 km" in entregas[0]
    assert push.daily_check(db_session, manha) == []  # uma vez só por dia


def test_daily_sem_treino(auth_client: tuple[TestClient, dict], db_session: Session, entregas: Entregas) -> None:
    client, user = auth_client
    uid = user["id"]
    client.post("/push/subscribe", json=SUB)
    start = datetime.now(UTC) - timedelta(days=4)
    client.post("/activities/import-normalized", json={
        "sport": "running", "start_time": start.isoformat(), "duration_s": 1800, "distance_m": 5000,
        "source": "garmin_api", "source_activity_id": "push-1",
    })
    noite = datetime.now().replace(hour=19, minute=0)
    assert push.daily_check(db_session, noite) == [(uid, "sem_treino")]
    assert "dias sem treinar" in entregas[0]
    assert push.daily_check(db_session, noite) == []  # uma vez por sequência


def test_prefs_off_blocks(auth_client: tuple[TestClient, dict], db_session: Session, entregas: Entregas) -> None:
    client, user = auth_client
    client.post("/push/subscribe", json=SUB)
    client.put("/push/prefs", json={"treino_hoje": False})
    db_session.add(PlannedWorkout(user_id=user["id"], date=date.today(), sport="run", title="Tiros", plan_batch_id=uuid.uuid4()))
    db_session.flush()
    assert push.daily_check(db_session, datetime.now().replace(hour=9)) == []
    assert entregas == []


def test_records_only_recent(auth_client: tuple[TestClient, dict], db_session: Session, entregas: Entregas) -> None:
    client, _ = auth_client
    client.post("/push/subscribe", json=SUB)
    for sid, dias in (("rec-novo", 0), ("rec-velho", 30)):
        client.post("/activities/import-normalized", json={
            "sport": "running", "start_time": (datetime.now(UTC) - timedelta(days=dias, hours=1)).isoformat(),
            "duration_s": 1500, "distance_m": 5000, "title": "Prova", "source": "garmin_api", "source_activity_id": sid,
        })
    novo = db_session.execute(select(Activity).where(Activity.source_activity_id == "rec-novo")).scalar_one()
    velho = db_session.execute(select(Activity).where(Activity.source_activity_id == "rec-velho")).scalar_one()
    assert push.notify_records(db_session, velho, ["fastest_5k"]) is False
    assert push.notify_records(db_session, novo, ["fastest_5k", "longest_run"]) is True
    assert "5 km e corrida mais longa — Prova" in entregas[-1]
    assert push.notify_records(db_session, novo, ["fastest_5k"]) is False  # já avisado
