"""Ritmo x calor: faixas de temperatura e a comparacao fria x quente."""

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient


def _run(client: TestClient, sid: str, days_ago: int, temp: float, pace: int, hr: int, km: float = 8.0, sport: str = "running") -> None:
    start = datetime.now(UTC) - timedelta(days=days_ago)
    seconds = int(pace * km)
    resp = client.post("/activities/import-normalized", json={
        "sport": sport, "start_time": start.isoformat(), "duration_s": seconds, "moving_time_s": seconds,
        "distance_m": km * 1000, "avg_hr": hr, "avg_temperature_c": temp, "source": "garmin_api", "source_activity_id": sid,
    })
    assert resp.status_code in (200, 201), resp.text


def test_heat_bands_and_comparison(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    for i in range(3):
        _run(client, f"f{i}", 10 + i, 14.0, 360, 145)
    for i in range(3):
        _run(client, f"q{i}", 20 + i, 31.0, 385, 156)
    _run(client, "esteira", 30, 33.0, 300, 150, sport="treadmill")  # esteira nao conta
    _run(client, "curta", 31, 33.0, 300, 150, km=2.0)  # menos de 3 km nao conta

    h = client.get("/metrics/heat").json()

    assert h["corridas"] == 6
    assert [f["corridas"] for f in h["faixas"]] == [3, 0, 0, 0, 3]
    assert h["faixas"][0]["pace_s_km"] == 360 and h["faixas"][-1]["fc"] == 156
    assert h["comparacao"] == {"fria": "até 15 °C", "quente": "30 °C ou mais", "pace_diff_s_km": 25, "fc_diff": 11}


def test_heat_without_data(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    h = client.get("/metrics/heat").json()
    assert h["corridas"] == 0 and h["comparacao"] is None and len(h["faixas"]) == 5
