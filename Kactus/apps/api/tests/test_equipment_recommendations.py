"""Recomendacoes de equipamento personalizadas pelo uso."""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient

from kactus_api.equipment_catalog import CATALOG, CATEGORIES, TIERS

_NOON = datetime.combine(date.today(), time(12), tzinfo=ZoneInfo("America/Sao_Paulo"))


def _import(client: TestClient, sport: str, km: float, minutes: int, days_ago: int, n: int) -> None:
    resp = client.post("/activities/import-normalized", json={
        "sport": sport, "start_time": (_NOON - timedelta(days=days_ago)).isoformat(),
        "duration_s": minutes * 60, "moving_time_s": minutes * 60, "distance_m": km * 1000,
        "source": "garmin_api", "source_activity_id": f"eq-{sport}-{n}",
    })
    assert resp.status_code == 201, resp.text


def test_catalog_is_complete() -> None:
    """Toda categoria tem uma opcao por faixa de preco."""
    for sport, cats in CATEGORIES.items():
        for cat_id, _label in cats:
            tiers = sorted(i.tier for i in CATALOG if i.sport == sport and i.category == cat_id)
            assert tiers == sorted(TIERS), (sport, cat_id)
    assert all(i.price_brl.startswith("R$ ") for i in CATALOG)


def test_practiced_sports_come_first_with_highlights(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    for i in range(6):
        _import(client, "running", 10, 50, i * 3, i)  # ritmo 5:00/km
    _import(client, "trail_running", 8, 60, 2, 99)
    _import(client, "cycling", 30, 60, 5, 0)

    body = client.get("/equipment/recommendations").json()

    assert body["atualizado_em"] == "2026-09"
    assert [(s["sport"], s["praticado"]) for s in body["esportes"]] == [("run", True), ("bike", True), ("swim", False)]
    run = {c["id"]: c for c in body["esportes"][0]["categorias"]}
    assert "km por semana" in run["tenis_dia_a_dia"]["destaque"]
    assert run["tenis_prova"]["destaque"]  # 5:00/km e rapido
    assert run["tenis_trilha"]["destaque"]
    assert run["cinta"]["destaque"] is None
    # destaques primeiro
    cats = body["esportes"][0]["categorias"]
    assert all(c["destaque"] for c in cats[:3]) and cats[-1]["destaque"] is None
    assert [i["tier"] for i in run["relogio"]["itens"]] == list(TIERS)


def test_worn_shoe_alert(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    for name, km in (("Tênis velho", 650), ("Tênis médio", 520), ("Tênis novo", 50)):
        client.post("/equipment", json={"name": name, "type": "shoe", "initial_distance_m": km * 1000})
    old = client.post("/equipment", json={"name": "Aposentado", "type": "shoe", "initial_distance_m": 900_000}).json()
    assert client.patch(f"/equipment/{old['id']}", json={"retired_at": "2026-01-01"}).status_code == 200

    alerts = client.get("/equipment/recommendations").json()["alertas"]

    assert sorted((a["equipamento"], a["nivel"], a["km"]) for a in alerts) == [
        ("Tênis médio", "atencao", 520), ("Tênis velho", "trocar", 650),
    ]


def test_no_activities_shows_every_sport(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    body = client.get("/equipment/recommendations").json()
    assert [s["praticado"] for s in body["esportes"]] == [False, False, False]
    assert client.get("/equipment/recommendations", headers={"Authorization": ""}).status_code == 401
