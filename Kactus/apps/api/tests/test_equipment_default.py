"""Tenis padrao por esporte: entra sozinho no treino importado e pode ser aplicado aos antigos."""

from datetime import timedelta

from fastapi.testclient import TestClient
from test_import_normalized_router import _START, _payload


def _import(client: TestClient, source_id: str, sport: str = "running", days: int = 0) -> str:
    resp = client.post(
        "/activities/import-normalized",
        json=_payload(source_activity_id=source_id, sport=sport, start_time=(_START + timedelta(days=days)).isoformat()),
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["activity_id"]


def _shoe(client: TestClient, name: str, sports: list[str]) -> dict:
    resp = client.post("/equipment", json={"name": name, "type": "shoe", "default_sports": sports})
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_imported_run_gets_the_default_shoe(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    shoe = _shoe(client, "Pegasus", ["run", "treadmill"])
    assert shoe["default_sports"] == ["run", "treadmill"]

    run = _import(client, "1")
    walk = _import(client, "2", sport="walking", days=1)

    assert client.get(f"/activities/{run}").json()["equipment_id"] == shoe["id"]
    assert client.get(f"/activities/{walk}").json()["equipment_id"] is None


def test_one_default_per_sport_and_retired_loses_it(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    old = _shoe(client, "Velho", ["run", "trail_run"])
    new = _shoe(client, "Novo", ["run"])

    shoes = {e["name"]: e for e in client.get("/equipment").json()}
    assert shoes["Velho"]["default_sports"] == ["trail_run"] and shoes["Novo"]["default_sports"] == ["run"]

    retired = client.patch(f"/equipment/{new['id']}", json={"retired_at": "2026-10-01"}).json()
    assert retired["default_sports"] == []
    assert client.get(f"/activities/{_import(client, '3')}").json()["equipment_id"] is None
    assert old["id"]  # o velho continua padrao so do trail


def test_apply_default_to_old_runs_without_equipment(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    first = _import(client, "1")
    second = _import(client, "2", days=1)
    other = _shoe(client, "Outro", [])
    client.patch(f"/activities/{second}", json={"equipment_id": other["id"]})
    shoe = _shoe(client, "Pegasus", ["run"])

    resp = client.post(f"/equipment/{shoe['id']}/apply-default")

    assert resp.json() == {"updated": 1}
    assert client.get(f"/activities/{first}").json()["equipment_id"] == shoe["id"]
    assert client.get(f"/activities/{second}").json()["equipment_id"] == other["id"]  # nao troca o que ja tinha


def test_invalid_sport_is_refused(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    resp = client.post("/equipment", json={"name": "X", "type": "shoe", "default_sports": ["corrida"]})
    assert resp.status_code == 422
