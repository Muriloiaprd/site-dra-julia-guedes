from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from ondilow_api.config import Settings
from ondilow_api.metrics.records import recompute_all_records
from ondilow_api.models import Activity, ActivityPoint, PersonalRecord

_STRONG_SECRET = "x" * 40
_REMOTE_DB = "postgresql+psycopg://u:p@ep-abc.neon.tech/db"


def _run_with_points(user_id, start: datetime, seconds_per_km: int, km: int = 6) -> Activity:
    """Corrida a pace constante, um ponto por segundo de 100 em 100 m."""
    total = seconds_per_km * km
    activity = Activity(
        user_id=user_id, sport="run", start_time=start, duration_s=total,
        distance_m=km * 1000, max_hr=170, source="manual",
    )
    activity.points = [
        ActivityPoint(elapsed_time_s=t, distance_m=t * 1000 / seconds_per_km)
        for t in range(0, total + 1, 10)
    ]
    return activity


def test_recompute_keeps_best_per_type_from_streamed_points(
    auth_client, db_session: Session
) -> None:
    _client, user = auth_client
    base = datetime(2026, 1, 1, tzinfo=UTC)
    slow = _run_with_points(user["id"], base, seconds_per_km=360)
    fast = _run_with_points(user["id"], base + timedelta(days=1), seconds_per_km=300)
    db_session.add_all([slow, fast])
    db_session.commit()

    recompute_all_records(db_session, user["id"])

    rows = db_session.execute(
        select(PersonalRecord)
        .where(PersonalRecord.user_id == user["id"], PersonalRecord.record_type == "fastest_5k")
        .order_by(PersonalRecord.achieved_at)
    ).scalars().all()
    assert [r.activity_id for r in rows] == [slow.id, fast.id]
    assert rows[1].previous_activity_id == slow.id
    assert float(rows[1].value) < float(rows[0].value)

    longest = db_session.execute(
        select(PersonalRecord).where(
            PersonalRecord.user_id == user["id"], PersonalRecord.record_type == "longest_run"
        )
    ).scalars().all()
    assert len(longest) == 1  # empate de distancia nao gera PR novo


def test_recompute_ignores_soft_deleted_activities(auth_client, db_session: Session) -> None:
    _client, user = auth_client
    fast = _run_with_points(user["id"], datetime(2026, 1, 2, tzinfo=UTC), seconds_per_km=300)
    fast.deleted_at = datetime.now(UTC)
    slow = _run_with_points(user["id"], datetime(2026, 1, 1, tzinfo=UTC), seconds_per_km=360)
    db_session.add_all([fast, slow])
    db_session.commit()

    recompute_all_records(db_session, user["id"])

    rec = db_session.execute(
        select(PersonalRecord).where(
            PersonalRecord.user_id == user["id"], PersonalRecord.record_type == "fastest_5k"
        )
    ).scalar_one()
    assert rec.activity_id == slow.id


def test_settings_dev_accepts_defaults() -> None:
    Settings(app_env="dev", _env_file=None)


def test_settings_prod_rejects_default_secret() -> None:
    with pytest.raises(ValidationError, match="JWT_SECRET_KEY"):
        Settings(
            app_env="prod", jwt_secret_key="dev-secret-change-me", database_url=_REMOTE_DB, _env_file=None
        )


def test_settings_prod_rejects_short_secret() -> None:
    with pytest.raises(ValidationError, match="JWT_SECRET_KEY"):
        Settings(app_env="prod", jwt_secret_key="curta", database_url=_REMOTE_DB, _env_file=None)


def test_settings_prod_rejects_localhost_database() -> None:
    with pytest.raises(ValidationError, match="DATABASE_URL"):
        Settings(
            app_env="prod", jwt_secret_key=_STRONG_SECRET,
            database_url="postgresql+psycopg://u:p@localhost:5432/db", _env_file=None,
        )


def test_settings_prod_accepts_valid_config() -> None:
    s = Settings(app_env="prod", jwt_secret_key=_STRONG_SECRET, database_url=_REMOTE_DB, _env_file=None)
    assert s.app_env == "prod"
