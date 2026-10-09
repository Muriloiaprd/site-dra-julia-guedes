"""Tecnica de corrida mes a mes: medias ponderadas, filtros e comparacao."""

from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import Session

from kactus_api.metrics.technique import level
from kactus_api.models import Activity


def _month_start(back: int) -> datetime:
    now = datetime.now(UTC)
    y, m = divmod(now.year * 12 + now.month - 1 - back, 12)
    return datetime(y, m + 1, 5, 7, 0, tzinfo=UTC)


def _run(client: TestClient, db: Session, sid: str, start: datetime, cad: float, gct: float, km: float = 8.0) -> None:
    seconds = int(330 * km)
    resp = client.post("/activities/import-normalized", json={
        "sport": "running", "start_time": start.isoformat(), "duration_s": seconds, "moving_time_s": seconds,
        "distance_m": km * 1000, "avg_cadence": cad, "source": "garmin_api", "source_activity_id": sid,
    })
    assert resp.status_code in (200, 201), resp.text
    # a importacao por JSON nao traz a dinamica de corrida (so o FIT): grava direto
    db.execute(update(Activity).where(Activity.source_activity_id == sid).values(
        avg_stance_time_ms=gct, avg_vertical_oscillation_mm=85, avg_vertical_ratio_pct=7.9, avg_step_length_m=1.08,
    ))
    db.flush()


def test_technique_by_month_and_comparison(auth_client: tuple[TestClient, dict], db_session: Session) -> None:
    client, _user = auth_client
    for back in range(6, 0, -1):  # 6 meses: cadencia sobe 2 por mes, contato cai 5
        _run(client, db_session, f"m{back}", _month_start(back), 160 + (6 - back) * 2, 260 - (6 - back) * 5)
    # mes mais recente: duas corridas, a de 12 km pesa mais na media
    _run(client, db_session, "extra", _month_start(1).replace(day=12), 180, 230, km=12.0)
    _run(client, db_session, "caminhada", _month_start(1).replace(day=14), 120, 300)  # cadencia de caminhada nao entra
    _run(client, db_session, "curta", _month_start(1).replace(day=15), 175, 240, km=2.0)  # menos de 3 km nao entra

    t = client.get("/metrics/technique").json()

    assert t["corridas"] == 7
    assert len(t["meses"]) == 6
    ultimo = t["meses"][-1]
    assert ultimo["corridas"] == 2 and ultimo["km"] == 20.0
    assert ultimo["cadencia"] == round((170 * 8 + 180 * 12) / 20)
    assert ultimo["passada_m"] == 1.08
    assert t["atual"]["faixas"]["oscilacao_mm"] == "média"
    assert t["comparacao"]["cadencia"] > 0 and t["comparacao"]["contato_ms"] < 0


def test_technique_without_data(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    t = client.get("/metrics/technique").json()
    assert t == {"meses": [], "atual": None, "comparacao": None, "corridas": 0}


def test_levels() -> None:
    assert level("cadencia", 185) == "excelente"
    assert level("cadencia", 170) == "média"
    assert level("cadencia", 150) == "baixa"
    assert level("contato_ms", 200) == "excelente"
    assert level("contato_ms", 320) == "baixa"
    assert level("razao_vertical_pct", 7.0) == "boa"
    assert level("passada_m", 1.1) is None
