from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from kactus_api.models import Activity

VALID_ZONES = {
    "z1": [0, 114],
    "z2": [114, 133],
    "z3": [133, 152],
    "z4": [152, 171],
    "z5": [171, 200],
}


def test_hr_zones_valid_payload_accepted(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    resp = client.put("/profile", json={"hr_zones": VALID_ZONES})
    assert resp.status_code == 200, resp.text
    assert resp.json()["hr_zones"] == VALID_ZONES


def test_hr_zones_missing_key_rejected(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    bad = {k: v for k, v in VALID_ZONES.items() if k != "z5"}
    resp = client.put("/profile", json={"hr_zones": bad})
    assert resp.status_code == 422


def test_hr_zones_gap_between_zones_rejected(auth_client: tuple[TestClient, dict]) -> None:
    """z2 deveria comecar em 114 (onde z1 termina); um buraco tem que ser rejeitado --
    e exatamente o payload que antes passava pelo PUT e so quebrava depois, em
    hr_zone_distribution() no GET /activities/{id}/zones."""
    client, _user = auth_client
    bad = {**VALID_ZONES, "z2": [120, 133]}
    resp = client.put("/profile", json={"hr_zones": bad})
    assert resp.status_code == 422


def test_hr_zones_non_list_value_rejected(auth_client: tuple[TestClient, dict]) -> None:
    """Sem essa validacao, `sorted(zones.items(), key=lambda kv: kv[1][0])` em
    hr_zone_distribution() quebra com TypeError (int nao e subscriptable) --
    500 em vez do PUT rejeitar na hora."""
    client, _user = auth_client
    bad = {**VALID_ZONES, "z3": 140}
    resp = client.put("/profile", json={"hr_zones": bad})
    assert resp.status_code == 422


def test_hr_zones_null_clears_zones(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    client.put("/profile", json={"hr_zones": VALID_ZONES})
    resp = client.put("/profile", json={"hr_zones": None})
    assert resp.status_code == 200
    assert resp.json()["hr_zones"] is None


def test_export_includes_profile_and_activities(
    auth_client: tuple[TestClient, dict], db_session: Session
) -> None:
    client, user = auth_client
    client.put("/profile", json={"full_name": "Corredor de Teste", "max_hr": 190})

    db_session.add(
        Activity(
            user_id=user["id"],
            sport="run",
            start_time=datetime.now(UTC),
            duration_s=1800,
            distance_m=5000,
            source="manual",
            title="Corrida de teste",
        )
    )
    db_session.commit()

    resp = client.get("/profile/export")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/json")
    assert "attachment" in resp.headers["content-disposition"]

    body = resp.json()
    assert body["user"]["email"] == user["email"]
    assert body["profile"]["full_name"] == "Corredor de Teste"
    assert len(body["activities"]) == 1
    assert body["activities"][0]["title"] == "Corrida de teste"
    assert body["activities"][0]["distance_m"] == 5000.0


def test_export_empty_account_has_no_activities(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    resp = client.get("/profile/export")
    assert resp.status_code == 200
    body = resp.json()
    assert body["activities"] == []
    assert body["equipment"] == []
    assert body["records"] == []
