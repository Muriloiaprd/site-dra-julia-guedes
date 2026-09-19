"""Exercita POST /activities/import-normalized -- a porta de entrada para
atividades vindas de integracao (Garmin/Strava via MCP), que sempre existiu no
codigo mas nunca tinha sido chamada por nenhum teste.

Os payloads imitam o formato que um MCP entrega: resumo + streams em JSON,
com a nomenclatura de esporte da fonte (nao a do banco).
"""

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from ondilow_api.models import Activity, ActivityLap, ActivityPoint, PersonalRecord

_START = datetime(2026, 3, 10, 6, 30, tzinfo=UTC)


def _payload(**overrides) -> dict:
    """Corrida de 5km em 25min, 1 ponto/seg, com FC, altitude e 5 voltas."""
    seconds = 1500
    points = [
        {
            "elapsed_time_s": t,
            "lat": -23.55 + t * 0.00001,
            "lon": -46.63 + t * 0.00001,
            "altitude_m": 760.0 + (t // 100),
            "distance_m": t * (5000 / seconds),
            "hr": 140 + (t // 300),
            "cadence": 168,
            "speed_ms": 5000 / seconds,
        }
        for t in range(0, seconds + 1)
    ]
    # Pico de FC em t=1, que o downsample de 3s descarta: serve para provar que
    # o resumo e derivado da serie completa, antes de reduzir os pontos.
    points[1]["hr"] = 199
    laps = [
        {
            "lap_index": i,
            "start_elapsed_s": i * 300,
            "duration_s": 300,
            "distance_m": 1000.0,
            "avg_hr": 142 + i,
            "max_hr": 150 + i,
            "avg_cadence": 168,
        }
        for i in range(5)
    ]
    body = {
        "sport": "running",  # nomenclatura da fonte, nao do banco
        "start_time": _START.isoformat(),
        "duration_s": seconds,
        "moving_time_s": seconds,
        "source": "garmin_api",
        "source_activity_id": "12345678",
        "distance_m": 5000.0,
        "avg_hr": 145,
        "max_hr": 152,
        "calories": 320,
        "title": "Corrida matinal",
        "points": points,
        "laps": laps,
    }
    body.update(overrides)
    return body


def _post(client: TestClient, **overrides):
    return client.post("/activities/import-normalized", json=_payload(**overrides))


def test_import_normalized_creates_activity_with_points_and_laps(
    auth_client: tuple[TestClient, dict], db_session: Session
) -> None:
    client, user = auth_client
    resp = _post(client)

    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["duplicate"] is False
    assert body["sport"] == "run"  # "running" normalizado
    assert body["distance_m"] == 5000.0
    assert body["points_stored"] > 0

    activity = db_session.get(Activity, body["activity_id"])
    assert activity is not None
    assert activity.user_id == user["id"]
    assert activity.source == "garmin_api"
    assert activity.source_activity_id == "12345678"
    assert activity.title == "Corrida matinal"
    assert activity.file_hash is None and activity.file_path is None
    # resumo explicito da fonte tem precedencia sobre a serie (que tem pico 199)
    assert activity.max_hr == 152
    # pace de 5min/km em segundos
    assert abs(float(activity.avg_pace_s_per_km) - 300) < 1

    stored = db_session.execute(
        select(ActivityPoint).where(ActivityPoint.activity_id == activity.id)
    ).scalars().all()
    assert len(stored) == body["points_stored"]
    laps = db_session.execute(
        select(ActivityLap).where(ActivityLap.activity_id == activity.id)
    ).scalars().all()
    assert len(laps) == 5


def test_import_normalized_downsamples_points(auth_client: tuple[TestClient, dict]) -> None:
    """1501 pontos a 1Hz devem cair para ~1/3 com gps_downsample_seconds=3."""
    client, _user = auth_client
    body = _post(client).json()
    assert 400 < body["points_stored"] < 700


def test_import_normalized_dedups_by_source_activity_id(
    auth_client: tuple[TestClient, dict], db_session: Session
) -> None:
    """Reimportar a mesma atividade da fonte nao pode duplicar -- e o caso
    mais provavel num MCP, que relista as ultimas atividades a cada chamada."""
    client, user = auth_client
    first = _post(client).json()
    second = _post(client)

    assert second.status_code == 201
    assert second.json()["duplicate"] is True
    assert second.json()["activity_id"] == first["activity_id"]

    count = db_session.execute(
        select(Activity).where(Activity.user_id == user["id"], Activity.deleted_at.is_(None))
    ).scalars().all()
    assert len(count) == 1


def test_import_normalized_derives_summary_from_points(
    auth_client: tuple[TestClient, dict], db_session: Session
) -> None:
    """Fonte que so manda streams (sem resumo) ainda produz atividade completa."""
    client, _user = auth_client
    resp = _post(
        client,
        distance_m=None, avg_hr=None, max_hr=None,
        source_activity_id="sem-resumo",
    )
    assert resp.status_code == 201

    activity = db_session.get(Activity, resp.json()["activity_id"])
    assert abs(float(activity.distance_m) - 5000.0) < 5  # do ultimo ponto
    assert activity.avg_hr is not None and 140 <= activity.avg_hr <= 152
    # 199 so existe em t=1, ponto que o downsample descarta -- confirma que a
    # derivacao le a serie completa.
    assert activity.max_hr == 199
    assert float(activity.elevation_gain_m) > 0  # derivado da altitude


def test_import_normalized_updates_records_and_metrics(
    auth_client: tuple[TestClient, dict], db_session: Session
) -> None:
    """Atividade importada tem que entrar nos PRs e na carga -- se nao entrar,
    o MCP produz atividade 'fantasma' que nao aparece no dashboard."""
    client, user = auth_client
    resp = _post(client)
    assert resp.status_code == 201

    prs = db_session.execute(
        select(PersonalRecord).where(PersonalRecord.user_id == user["id"])
    ).scalars().all()
    types = {p.record_type for p in prs}
    assert "fastest_5k" in types
    assert "longest_run" in types

    from ondilow_api.models import DailyMetric

    metrics = db_session.execute(
        select(DailyMetric).where(
            DailyMetric.user_id == user["id"], DailyMetric.date == _START.date()
        )
    ).scalars().all()
    assert len(metrics) == 1


def test_import_normalized_accepts_strava_sport_names(
    auth_client: tuple[TestClient, dict]
) -> None:
    client, _user = auth_client
    resp = _post(client, sport="TrailRun", source="strava_api", source_activity_id="s-1")
    assert resp.status_code == 201
    assert resp.json()["sport"] == "trail_run"


def test_import_normalized_rejects_unknown_source(auth_client: tuple[TestClient, dict]) -> None:
    """source e o unico campo com allowlist: 'fit'/'gpx' viriam de upload."""
    client, _user = auth_client
    resp = _post(client, source="fit")
    assert resp.status_code == 422


def test_import_normalized_requires_auth(client: TestClient) -> None:
    resp = client.post("/activities/import-normalized", json=_payload())
    assert resp.status_code == 401


def test_import_normalized_minimal_payload_without_points(
    auth_client: tuple[TestClient, dict], db_session: Session
) -> None:
    """Treino de esteira/forca sem GPS: so resumo."""
    client, _user = auth_client
    resp = client.post(
        "/activities/import-normalized",
        json={
            "sport": "treadmill_running",
            "start_time": (_START + timedelta(days=1)).isoformat(),
            "duration_s": 1800,
            "source": "garmin_api",
            "source_activity_id": "sem-gps",
            "distance_m": 6000.0,
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["sport"] == "treadmill"
    assert body["points_stored"] == 0

    activity = db_session.get(Activity, body["activity_id"])
    assert activity.location_start_lat is None
