"""PUT /activities/{id}/checkin: PSE, dor, sensacao e notas pos-treino."""

import uuid
from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from ondilow_api.models import User
from ondilow_api.security import create_access_token, hash_password

_START = datetime(2026, 4, 2, 7, 0, tzinfo=UTC)


def _create_activity(client: TestClient, source_id: str = "checkin-1", moving_s: int = 2400) -> str:
    resp = client.post(
        "/activities/import-normalized",
        json={
            "sport": "running",
            "start_time": _START.isoformat(),
            "duration_s": 2700,
            "moving_time_s": moving_s,
            "source": "garmin_api",
            "source_activity_id": source_id,
            "distance_m": 8000.0,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["activity_id"]


def test_checkin_saves_and_computes_srpe(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    activity_id = _create_activity(client)

    resp = client.put(
        f"/activities/{activity_id}/checkin",
        json={"rpe": 6, "pain_level": 3, "pain_location": " panturrilha ", "feeling": "pernas_pesadas", "notes": "calor"},
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["rpe"] == 6
    assert body["srpe"] == 240.0  # 6 x 40 min em movimento
    assert body["pain_level"] == 3
    assert body["pain_location"] == "panturrilha"
    assert body["feeling"] == "pernas_pesadas"
    assert body["checkin_notes"] == "calor"
    assert body["checkin_at"] is not None

    # a leitura normal da atividade devolve o check-in
    again = client.get(f"/activities/{activity_id}").json()
    assert again["rpe"] == 6 and again["srpe"] == 240.0


def test_checkin_drops_location_without_pain(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    activity_id = _create_activity(client)
    body = client.put(
        f"/activities/{activity_id}/checkin", json={"rpe": 3, "pain_level": 0, "pain_location": "joelho"}
    ).json()
    assert body["pain_level"] == 0
    assert body["pain_location"] is None


def test_checkin_all_null_clears_it(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    activity_id = _create_activity(client)
    client.put(f"/activities/{activity_id}/checkin", json={"rpe": 7, "feeling": "cansado"})

    body = client.put(f"/activities/{activity_id}/checkin", json={}).json()

    assert body["rpe"] is None and body["srpe"] is None
    assert body["feeling"] is None
    assert body["checkin_at"] is None


def test_checkin_validates_ranges_and_feeling(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    activity_id = _create_activity(client)
    assert client.put(f"/activities/{activity_id}/checkin", json={"rpe": 11}).status_code == 422
    assert client.put(f"/activities/{activity_id}/checkin", json={"rpe": -1}).status_code == 422
    assert client.put(f"/activities/{activity_id}/checkin", json={"pain_level": 12}).status_code == 422
    assert client.put(f"/activities/{activity_id}/checkin", json={"feeling": "feliz"}).status_code == 422


def test_checkin_uses_duration_when_moving_time_missing(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    resp = client.post(
        "/activities/import-normalized",
        json={
            "sport": "strength_training",
            "start_time": _START.isoformat(),
            "duration_s": 3600,
            "source": "garmin_api",
            "source_activity_id": "forca-1",
        },
    )
    activity_id = resp.json()["activity_id"]
    body = client.put(f"/activities/{activity_id}/checkin", json={"rpe": 5}).json()
    assert body["srpe"] == 300.0  # 5 x 60 min


def test_checkin_other_users_activity_is_404(
    auth_client: tuple[TestClient, dict], db_session: Session
) -> None:
    client, _owner = auth_client
    activity_id = _create_activity(client)

    other = User(email=f"pytest-{uuid.uuid4().hex[:12]}@ondilow.test", password_hash=hash_password("outra-senha-123"))
    db_session.add(other)
    db_session.commit()
    other_token = create_access_token(str(other.id))

    resp = client.put(
        f"/activities/{activity_id}/checkin",
        json={"rpe": 5},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert resp.status_code == 404
    no_auth = client.put(f"/activities/{activity_id}/checkin", json={"rpe": 5}, headers={"Authorization": ""})
    assert no_auth.status_code == 401
