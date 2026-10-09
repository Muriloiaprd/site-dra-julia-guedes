"""Lixeira das atividades: excluir manda para a lixeira, restaurar devolve,
limpar apaga de vez (com pontos e voltas)."""

from datetime import timedelta

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from test_import_normalized_router import _START, _payload

from kactus_api.models import Activity, ActivityLap, ActivityPoint


def _activity(client: TestClient, source_id: str, title: str) -> str:
    # dia diferente por atividade: mesmo horario de inicio o importador trata como o mesmo treino
    start = (_START + timedelta(days=int(source_id))).isoformat()
    resp = client.post(
        "/activities/import-normalized", json=_payload(source_activity_id=source_id, title=title, start_time=start),
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["activity_id"]


def _ids(client: TestClient) -> set[str]:
    return {a["id"] for a in client.get("/activities?limit=50").json()}


def test_delete_goes_to_trash_and_restore_brings_back(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    keep = _activity(client, "1", "Fica")
    gone = _activity(client, "2", "Vai e volta")
    assert client.get("/activities/trash").json() == []

    assert client.delete(f"/activities/{gone}").status_code == 204

    assert _ids(client) == {keep}
    [item] = client.get("/activities/trash").json()
    assert item["id"] == gone and item["title"] == "Vai e volta" and item["deleted_at"]

    restored = client.post(f"/activities/{gone}/restore")
    assert restored.status_code == 200 and restored.json()["id"] == gone
    assert _ids(client) == {keep, gone} and client.get("/activities/trash").json() == []
    assert client.get(f"/activities/{gone}").status_code == 200
    assert client.post(f"/activities/{gone}/restore").status_code == 404  # nao esta mais na lixeira


def test_empty_trash_deletes_for_good_with_points_and_laps(auth_client: tuple[TestClient, dict], db_session: Session) -> None:
    client, _user = auth_client
    keep = _activity(client, "1", "Fica")
    gone = _activity(client, "2", "Vai embora")
    client.delete(f"/activities/{gone}")

    resp = client.delete("/activities/trash")

    assert resp.json() == {"deleted": 1}
    assert client.get("/activities/trash").json() == [] and _ids(client) == {keep}
    for model in (Activity, ActivityPoint, ActivityLap):
        col = model.id if model is Activity else model.activity_id
        assert db_session.execute(select(func.count()).select_from(model).where(col == gone)).scalar() == 0
    assert db_session.execute(select(func.count()).select_from(ActivityPoint).where(ActivityPoint.activity_id == keep)).scalar() > 0
    assert client.delete("/activities/trash").json() == {"deleted": 0}


def test_trash_is_per_user(auth_client: tuple[TestClient, dict], db_session: Session) -> None:
    import uuid

    from kactus_api.models import User
    from kactus_api.security import create_access_token, hash_password

    client, _user = auth_client
    gone = _activity(client, "1", "Minha")
    client.delete(f"/activities/{gone}")
    other = User(email=f"pytest-{uuid.uuid4().hex[:12]}@kactus.test", password_hash=hash_password("outra-senha-123"))
    db_session.add(other)
    db_session.commit()
    headers = {"Authorization": f"Bearer {create_access_token(str(other.id))}"}

    assert client.get("/activities/trash", headers=headers).json() == []
    assert client.post(f"/activities/{gone}/restore", headers=headers).status_code == 404
    assert client.delete("/activities/trash", headers=headers).json() == {"deleted": 0}
    assert len(client.get("/activities/trash").json()) == 1  # a do dono continua la


def test_reimport_of_trashed_activity_brings_it_back(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    gone = _activity(client, "1", "Excluida sem querer")
    client.delete(f"/activities/{gone}")

    again = _activity(client, "1", "Excluida sem querer")

    assert again == gone
    assert _ids(client) == {gone} and client.get("/activities/trash").json() == []
