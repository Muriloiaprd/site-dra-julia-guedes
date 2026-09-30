"""Foto real do equipamento (data URL redimensionada no navegador)."""

from fastapi.testclient import TestClient

from kactus_api.schemas.equipment import PHOTO_MAX_CHARS

_JPEG = "data:image/jpeg;base64," + "A" * 200


def test_photo_is_saved_and_removed(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    resp = client.post("/equipment", json={"name": "Camiseta laranja", "type": "top", "photo_data_url": _JPEG})
    assert resp.status_code == 201, resp.text
    eq = resp.json()
    assert eq["photo_data_url"] == _JPEG
    assert eq["type"] == "top"

    listed = client.get("/equipment").json()
    assert [e["photo_data_url"] for e in listed] == [_JPEG]

    # string vazia remove a foto
    resp = client.patch(f"/equipment/{eq['id']}", json={"photo_data_url": ""})
    assert resp.status_code == 200, resp.text
    assert resp.json()["photo_data_url"] is None


def test_photo_rejects_other_formats_and_big_files(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    for bad in ("https://exemplo.com/foto.jpg", "data:image/svg+xml;base64,AAAA", "data:image/jpeg;base64," + "A" * PHOTO_MAX_CHARS):
        resp = client.post("/equipment", json={"name": "Tênis", "type": "shoe", "photo_data_url": bad})
        assert resp.status_code == 422, bad[:40]
