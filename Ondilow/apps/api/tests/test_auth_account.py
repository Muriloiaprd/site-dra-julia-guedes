from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from kactus_api.models import Activity, Equipment, PersonalRecord, User


def test_change_password_wrong_current_returns_401(auth_client: tuple[TestClient, dict]) -> None:
    client, _user = auth_client
    resp = client.post(
        "/auth/change-password",
        json={"current_password": "senha-errada", "new_password": "nova-senha-123"},
    )
    assert resp.status_code == 401


def test_change_password_success_allows_login_with_new_password(
    auth_client: tuple[TestClient, dict],
) -> None:
    client, user = auth_client
    resp = client.post(
        "/auth/change-password",
        json={"current_password": user["password"], "new_password": "nova-senha-123"},
    )
    assert resp.status_code == 204

    # a senha antiga nao funciona mais
    login_old = client.post("/auth/login", data={"username": user["email"], "password": user["password"]})
    assert login_old.status_code == 401

    # a nova funciona
    login_new = client.post("/auth/login", data={"username": user["email"], "password": "nova-senha-123"})
    assert login_new.status_code == 200


def test_change_password_too_short_rejected(auth_client: tuple[TestClient, dict]) -> None:
    client, user = auth_client
    resp = client.post(
        "/auth/change-password",
        json={"current_password": user["password"], "new_password": "curta"},
    )
    assert resp.status_code == 422


def test_delete_account_cascades_all_user_data(
    auth_client: tuple[TestClient, dict], db_session: Session
) -> None:
    client, user = auth_client

    activity = Activity(
        user_id=user["id"],
        sport="run",
        start_time=datetime.now(UTC),
        duration_s=1800,
        distance_m=5000,
        source="manual",
    )
    db_session.add(activity)
    db_session.flush()

    db_session.add(
        PersonalRecord(
            user_id=user["id"],
            sport="run",
            record_type="fastest_5k",
            value=1500,
            unit="s",
            achieved_at=datetime.now(UTC),
            activity_id=activity.id,
        )
    )
    db_session.add(Equipment(user_id=user["id"], name="Tenis de teste", type="shoes"))
    db_session.commit()

    resp = client.delete("/auth/account")
    assert resp.status_code == 204

    # o token antigo nao autentica mais (usuario nao existe)
    resp_me = client.get("/auth/me")
    assert resp_me.status_code == 401

    assert db_session.execute(select(User).where(User.id == user["id"])).scalar_one_or_none() is None
    assert (
        db_session.execute(select(Activity).where(Activity.user_id == user["id"])).scalar_one_or_none()
        is None
    )
    assert (
        db_session.execute(
            select(PersonalRecord).where(PersonalRecord.user_id == user["id"])
        ).scalar_one_or_none()
        is None
    )
    assert (
        db_session.execute(select(Equipment).where(Equipment.user_id == user["id"])).scalar_one_or_none()
        is None
    )
