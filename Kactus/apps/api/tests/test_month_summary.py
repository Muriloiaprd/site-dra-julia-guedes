"""Resumo do mes: totais, esportes, maior treino e comparacao com o mes anterior."""

from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient


def _post(client: TestClient, sid: str, day: date, km: float, sport: str = "running", seconds: int = 1800) -> None:
    start = datetime.combine(day, time(7), tzinfo=ZoneInfo("America/Sao_Paulo"))
    resp = client.post("/activities/import-normalized", json={
        "sport": sport, "start_time": start.isoformat(), "duration_s": seconds, "moving_time_s": seconds,
        "distance_m": km * 1000, "source": "garmin_api", "source_activity_id": sid,
    })
    assert resp.status_code in (200, 201), resp.text


def test_month_summary(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    _post(client, "1", date(2026, 9, 3), 10)
    _post(client, "2", date(2026, 9, 10), 6, seconds=2160)
    _post(client, "3", date(2026, 9, 12), 30, sport="cycling", seconds=3600)
    _post(client, "4", date(2026, 8, 20), 8)

    m = client.get("/metrics/month?month=2026-09").json()

    assert m["mes"] == "2026-09" and m["inicio"] == "2026-09-01" and m["fim"] == "2026-09-30"
    assert m["total"] == {"treinos": 3, "km": 46.0, "horas": 2.1, "dias": 3}
    assert m["anterior"]["km"] == 8.0 and m["variacao"]["km_pct"] == 475 and m["variacao"]["treinos"] == 2
    assert [e["tipo"] for e in m["esportes"]] == ["run", "bike"]
    assert m["corrida"] == {"km": 16.0, "treinos": 2, "pace_medio_s_km": 248}
    assert m["maior_treino"]["km"] == 30.0 and m["maior_treino"]["data"] == "2026-09-12"
    assert "2026-09" in m["meses_disponiveis"]


def test_empty_month_and_bad_param(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    m = client.get("/metrics/month?month=2020-02").json()
    assert m["total"]["treinos"] == 0 and m["corrida"] is None and m["maior_treino"] is None and m["fim"] == "2020-02-29"
    assert client.get("/metrics/month?month=2026-9").status_code == 422
    assert client.get("/metrics/month").json()["mes"] == date.today().strftime("%Y-%m")
