"""Editar a atividade: a descricao volta no detalhe (o formulario abre preenchido)."""

from fastapi.testclient import TestClient
from test_import_normalized_router import _payload


def test_description_round_trips_through_the_detail(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    resp = client.post("/activities/import-normalized", json=_payload(source_activity_id="edit-1"))
    activity_id = resp.json()["activity_id"]

    assert client.get(f"/activities/{activity_id}").json()["description"] is None

    patched = client.patch(f"/activities/{activity_id}", json={"description": "Longão com o grupo"})

    assert patched.status_code == 200 and patched.json()["description"] == "Longão com o grupo"
    assert client.get(f"/activities/{activity_id}").json()["description"] == "Longão com o grupo"
    # editar so o titulo nao mexe na descricao
    client.patch(f"/activities/{activity_id}", json={"title": "Domingo"})
    assert client.get(f"/activities/{activity_id}").json()["description"] == "Longão com o grupo"
