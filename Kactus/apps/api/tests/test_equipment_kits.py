"""'Meu kit': o boneco montado por preset."""

import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from kactus_api.models import Equipment, User
from kactus_api.security import hash_password
from kactus_api.services.equipment_kits import DEFAULTS, PRESETS, SLOTS


def test_defaults_are_valid() -> None:
    """Todo padrao usa encaixes e pecas que existem, e cobre todos os encaixes."""
    for preset, slots in DEFAULTS.items():
        assert preset in PRESETS
        assert set(slots) == set(SLOTS), preset
        for key, value in slots.items():
            assert value["piece"] in SLOTS[key][0], (preset, key)


def test_get_returns_four_presets_with_defaults(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    kits = client.get("/equipment/kits").json()
    assert [k["preset"] for k in kits] == ["corrida", "prova", "calor", "frio"]
    assert not any(k["saved"] for k in kits)
    assert kits[2]["slots"]["torso"]["piece"] == "singlet"  # calor = regata


def test_put_saves_merges_and_links_equipment(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    shoe = client.post("/equipment", json={"name": "Tênis de treino", "type": "shoe"}).json()

    resp = client.put("/equipment/kits/calor", json={"slots": {
        "torso": {"piece": "tshirt", "color": "#ff6a00"},
        "feet": {"piece": "shoe", "color": "#00ff66", "equipment_id": shoe["id"]},
    }})
    assert resp.status_code == 200, resp.text
    kit = resp.json()
    assert kit["saved"] is True
    assert kit["slots"]["torso"] == {"piece": "tshirt", "color": "#FF6A00", "equipment_id": None}
    assert kit["slots"]["feet"]["equipment_id"] == shoe["id"]
    assert kit["slots"]["head"]["piece"] == "visor"  # encaixe nao enviado fica com o padrao

    again = {k["preset"]: k for k in client.get("/equipment/kits").json()}
    assert again["calor"]["saved"] and again["calor"]["slots"]["feet"]["equipment_id"] == shoe["id"]
    assert not again["corrida"]["saved"]

    # equipamento apagado sai do encaixe
    client.delete(f"/equipment/{shoe['id']}")
    after = {k["preset"]: k for k in client.get("/equipment/kits").json()}
    assert after["calor"]["slots"]["feet"]["equipment_id"] is None


def test_put_rejects_invalid(auth_client: tuple[TestClient, dict], db_session: Session) -> None:
    client, _user = auth_client
    cap = client.post("/equipment", json={"name": "Boné", "type": "cap"}).json()

    other = User(email=f"pytest-{uuid.uuid4().hex[:12]}@kactus.test", password_hash=hash_password("x-123456"))
    db_session.add(other)
    db_session.flush()
    foreign = Equipment(user_id=other.id, name="Tênis alheio", type="shoe")
    db_session.add(foreign)
    db_session.commit()

    bad = [
        {"cabelo": {"piece": "none", "color": "#000000"}},                                   # encaixe inexistente
        {"torso": {"piece": "sunga", "color": "#000000"}},                                   # peca inexistente
        {"torso": {"piece": "tshirt", "color": "laranja"}},                                  # cor invalida
        {"feet": {"piece": "shoe", "color": "#000000", "equipment_id": str(foreign.id)}},    # de outro usuario
        {"feet": {"piece": "shoe", "color": "#000000", "equipment_id": cap["id"]}},          # tipo errado
    ]
    for slots in bad:
        resp = client.put("/equipment/kits/prova", json={"slots": slots})
        assert resp.status_code == 422, slots
    assert client.put("/equipment/kits/praia", json={"slots": {}}).status_code == 404
