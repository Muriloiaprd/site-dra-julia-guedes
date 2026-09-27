"""Aba Carga em linguagem simples (metrics/summary.py)."""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient

from kactus_api.metrics.summary import _period, _safe_range, _training_effect, _weeks

TODAY = date(2026, 9, 27)  # domingo


def _act(days_ago: int, km: float = 8.0, kind: str = "run", tss: float = 60.0, effect: float | None = None) -> dict:
    return {
        "day": TODAY - timedelta(days=days_ago), "kind": kind, "km": km, "min": km * 6,
        "tss": tss, "effect": effect, "benefit": "Base" if effect else None,
    }


def test_safe_range_follows_the_last_4_weeks() -> None:
    # 4 corridas de 8 km (60 TSS) por semana, 4 semanas: 32 km/semana
    acts = [_act(d) for w in range(4) for d in (w * 7 + 1, w * 7 + 3, w * 7 + 5, w * 7 + 6)]
    r = _safe_range(acts, TODAY)
    assert r["disponivel"] is True
    # carga cronica = 960/28 por dia; faixa 0,8x-1,3x da semana media = 25,6-41,6 km
    assert (r["min_km"], r["max_km"]) == (26, 42)
    assert r["feito_7d_km"] == 32.0


def test_other_sports_take_part_of_the_budget() -> None:
    runs = [_act(d) for w in range(4) for d in (w * 7 + 1, w * 7 + 3, w * 7 + 5, w * 7 + 6)]
    bikes = [_act(w * 7 + 2, km=30, kind="bike", tss=60) for w in range(4)]
    r = _safe_range(runs + bikes, TODAY)
    # a carga cronica sobe com a bike, mas 60 TSS/semana dela saem da conta da corrida
    assert r["max_km"] == 44 and r["min_km"] == 24


def test_safe_range_needs_a_base() -> None:
    assert _safe_range([_act(2, km=3, tss=20)], TODAY) == {"disponivel": False, "motivo": "base_baixa", "feito_7d_km": 3.0}
    bikes = [_act(d, km=30, kind="bike", tss=80) for d in range(0, 28, 2)]
    assert _safe_range(bikes, TODAY)["motivo"] == "sem_corrida"


def test_weeks_period_and_effect() -> None:
    acts = [_act(0, effect=3.5), _act(1, kind="bike", km=20, effect=2.5), _act(10)]
    first = TODAY - timedelta(days=TODAY.weekday()) - timedelta(weeks=15)
    weeks = _weeks(acts, first, TODAY)
    assert len(weeks) == 16 and weeks[-1]["em_andamento"] is True
    assert (weeks[-1]["corrida_km"], weeks[-1]["bike_km"], weeks[-1]["treinos"]) == (8.0, 20.0, 2)
    assert weeks[-2]["corrida_km"] == 8.0
    assert _period(acts, TODAY, 7) == {"corrida_km": 8.0, "horas": 2.8, "treinos": 2}
    effect = _training_effect(acts, TODAY)
    assert effect == {"media_aerobico": 3.0, "treinos": 2, "beneficios": {"Base": 2}}
    assert _training_effect([_act(0)], TODAY) is None


def test_summary_endpoint(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    noon = datetime.combine(date.today(), time(12), tzinfo=ZoneInfo("America/Sao_Paulo"))
    for i in range(3):
        client.post("/activities/import-normalized", json={
            "sport": "running", "start_time": (noon - timedelta(days=i * 2)).isoformat(),
            "duration_s": 2400, "moving_time_s": 2400, "distance_m": 7000.0, "avg_hr": 150,
            "source": "garmin_api", "source_activity_id": f"carga-{i}",
        })

    body = client.get("/metrics/summary").json()

    assert body["hoje"]["label"] and "TSB" not in body["hoje"]["detail"]
    assert body["semana"]["corrida_km"] == 21.0 and body["semana"]["treinos"] == 3
    assert len(body["semanas"]) == 16
    assert body["faixa_segura"]["feito_7d_km"] == 21.0
    assert client.get("/metrics/summary", headers={"Authorization": ""}).status_code == 401
