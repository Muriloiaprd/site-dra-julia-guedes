"""Cobre o sync do Garmin sem tocar na rede: o cliente e um duble e os
arquivos vem das fixtures, empacotados em zip como o Garmin entrega.

O que NAO da para testar aqui e exatamente o que exige credencial: o login e
o download reais. Tudo entre "bytes baixados" e "atividade no banco" esta
coberto.
"""

import io
import zipfile
from datetime import date
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from kactus_api.models import Activity
from kactus_api.parsers.dispatch import UnsupportedFormatError
from kactus_api.services.garmin_sync import (
    SOURCE,
    extract_activity_file,
    import_downloaded,
    last_synced_date,
    sync_activities,
)

_FIXTURES = Path(__file__).parent / "fixtures"


def _zipped(name: str, payload: bytes) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr(name, payload)
    return buf.getvalue()


@pytest.fixture
def tcx_bytes() -> bytes:
    return (_FIXTURES / "sample_bike.tcx").read_bytes()


@pytest.fixture
def gpx_bytes() -> bytes:
    return (_FIXTURES / "sample_run.gpx").read_bytes()


class FakeGarmin:
    """Duble do cliente do Garmin com so o que o sync usa."""

    def __init__(self, listing: list[dict], downloads: dict[str, bytes]):
        self.listing = listing
        self.downloads = downloads
        self.downloaded: list[str] = []

    def get_activities_by_date(self, startdate, enddate=None, activitytype=None):
        return self.listing

    def download_activity(self, activity_id, dl_fmt=None):
        self.downloaded.append(str(activity_id))
        payload = self.downloads.get(str(activity_id))
        if payload is None:
            raise RuntimeError("download falhou no Garmin")
        return payload


# ---------- extracao ----------


def test_extract_prefers_fit_inside_zip() -> None:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("leiame.txt", b"ignorar")
        zf.writestr("12345_ACTIVITY.fit", b"conteudo-fit")
    name, payload = extract_activity_file(buf.getvalue())
    assert name == "12345_ACTIVITY.fit"
    assert payload == b"conteudo-fit"


def test_extract_strips_directory_from_name() -> None:
    name, _ = extract_activity_file(_zipped("pasta/sub/9_ACTIVITY.fit", b"x"))
    assert name == "9_ACTIVITY.fit"


def test_extract_accepts_raw_non_zip_download(tcx_bytes: bytes) -> None:
    """Nem todo download vem zipado; o parser tem sniff de conteudo."""
    name, payload = extract_activity_file(tcx_bytes)
    assert payload == tcx_bytes
    assert name.endswith(".fit")  # nome generico, o sniff resolve


def test_extract_rejects_zip_without_activity() -> None:
    with pytest.raises(UnsupportedFormatError, match="sem arquivo de atividade"):
        extract_activity_file(_zipped("leiame.txt", b"nada aqui"))


def test_extract_rejects_empty_download() -> None:
    with pytest.raises(UnsupportedFormatError, match="vazio"):
        extract_activity_file(b"")


# ---------- import de um download ----------


def test_import_downloaded_marks_source_and_garmin_id(
    auth_client, db_session: Session, tcx_bytes: bytes
) -> None:
    _client, user = auth_client
    status, activity_date, _detail = import_downloaded(
        db_session, user["id"], _zipped("a.tcx", tcx_bytes), garmin_id="777"
    )
    assert status == "importada"
    assert activity_date is not None

    activity = db_session.execute(
        select(Activity).where(Activity.user_id == user["id"])
    ).scalar_one()
    assert activity.source == SOURCE
    assert activity.source_activity_id == "777"
    assert activity.file_hash is not None  # dedup com upload manual


def test_import_downloaded_is_idempotent(
    auth_client, db_session: Session, tcx_bytes: bytes
) -> None:
    """Rodar o sync duas vezes nao pode duplicar."""
    _client, user = auth_client
    payload = _zipped("a.tcx", tcx_bytes)
    first, _, _ = import_downloaded(db_session, user["id"], payload, garmin_id="777")
    second, _, _ = import_downloaded(db_session, user["id"], payload, garmin_id="777")

    assert (first, second) == ("importada", "duplicada")
    activities = db_session.execute(
        select(Activity).where(Activity.user_id == user["id"])
    ).scalars().all()
    assert len(activities) == 1


def test_import_downloaded_dedups_against_manual_upload(
    auth_client, db_session: Session, tcx_bytes: bytes
) -> None:
    """O mesmo treino ja subido a mao nao pode virar uma segunda atividade --
    e o motivo de reusar o arquivo original em vez do JSON da API."""
    client, user = auth_client
    up = client.post(
        "/activities/upload", files={"file": ("sample_bike.tcx", tcx_bytes, "application/xml")}
    )
    assert up.status_code in (200, 201), up.text

    status, _, _ = import_downloaded(
        db_session, user["id"], _zipped("a.tcx", tcx_bytes), garmin_id="777"
    )
    assert status == "duplicada"
    activities = db_session.execute(
        select(Activity).where(Activity.user_id == user["id"], Activity.deleted_at.is_(None))
    ).scalars().all()
    assert len(activities) == 1


# ---------- orquestracao ----------


def test_sync_imports_and_reports(
    auth_client, db_session: Session, tcx_bytes: bytes, gpx_bytes: bytes
) -> None:
    _client, user = auth_client
    fake = FakeGarmin(
        listing=[
            {"activityId": 1, "activityName": "Pedal"},
            {"activityId": 2, "activityName": "Corrida"},
        ],
        downloads={"1": _zipped("a.tcx", tcx_bytes), "2": _zipped("b.gpx", gpx_bytes)},
    )
    report = sync_activities(
        db_session, user["id"], fake, start=date(2020, 1, 1), end=date.today()
    )

    assert report.imported == 2
    assert report.failed == 0
    assert report.earliest_imported is not None
    stored = db_session.execute(
        select(Activity).where(Activity.user_id == user["id"])
    ).scalars().all()
    assert len(stored) == 2
    assert {a.source_activity_id for a in stored} == {"1", "2"}


def test_sync_skips_already_imported_without_downloading(
    auth_client, db_session: Session, tcx_bytes: bytes
) -> None:
    """Economiza download: o que ja tem o activityId no banco nem e baixado."""
    _client, user = auth_client
    fake = FakeGarmin(
        listing=[{"activityId": 1, "activityName": "Pedal"}],
        downloads={"1": _zipped("a.tcx", tcx_bytes)},
    )
    sync_activities(db_session, user["id"], fake, start=date(2020, 1, 1))
    assert fake.downloaded == ["1"]

    again = sync_activities(db_session, user["id"], fake, start=date(2020, 1, 1))
    assert again.duplicates == 1
    assert fake.downloaded == ["1"]  # nao baixou de novo


def test_sync_one_broken_activity_does_not_kill_batch(
    auth_client, db_session: Session, tcx_bytes: bytes
) -> None:
    _client, user = auth_client
    fake = FakeGarmin(
        listing=[
            {"activityId": 1, "activityName": "Quebrada"},  # download falha
            {"activityId": 2, "activityName": "Sem arquivo"},  # zip sem atividade
            {"activityId": 3, "activityName": "Boa"},
        ],
        downloads={
            "2": _zipped("leiame.txt", b"nada"),
            "3": _zipped("c.tcx", tcx_bytes),
        },
    )
    report = sync_activities(db_session, user["id"], fake, start=date(2020, 1, 1))

    assert report.imported == 1
    assert report.failed == 1  # a que deu erro de download
    assert report.skipped == 1  # a sem arquivo reconhecivel
    stored = db_session.execute(
        select(Activity).where(Activity.user_id == user["id"])
    ).scalars().all()
    assert len(stored) == 1


def test_sync_handles_listing_without_activity_id(auth_client, db_session: Session) -> None:
    _client, user = auth_client
    fake = FakeGarmin(listing=[{"activityName": "sem id"}], downloads={})
    report = sync_activities(db_session, user["id"], fake, start=date(2020, 1, 1))
    assert report.failed == 1
    assert fake.downloaded == []


def test_sync_dry_run_does_not_import(
    auth_client, db_session: Session, tcx_bytes: bytes
) -> None:
    _client, user = auth_client
    fake = FakeGarmin(
        listing=[{"activityId": 1, "activityName": "Pedal"}],
        downloads={"1": _zipped("a.tcx", tcx_bytes)},
    )
    report = sync_activities(db_session, user["id"], fake, start=date(2020, 1, 1), dry_run=True)

    assert report.imported == 0
    assert fake.downloaded == []
    assert (
        db_session.execute(select(Activity).where(Activity.user_id == user["id"]))
        .scalars()
        .all()
        == []
    )


def test_sync_limit_caps_the_batch(
    auth_client, db_session: Session, tcx_bytes: bytes, gpx_bytes: bytes
) -> None:
    _client, user = auth_client
    fake = FakeGarmin(
        listing=[
            {"activityId": 1, "activityName": "Pedal"},
            {"activityId": 2, "activityName": "Corrida"},
        ],
        downloads={"1": _zipped("a.tcx", tcx_bytes), "2": _zipped("b.gpx", gpx_bytes)},
    )
    report = sync_activities(db_session, user["id"], fake, start=date(2020, 1, 1), limit=1)
    assert len(report.items) == 1
    assert fake.downloaded == ["1"]


# ---------- sync incremental ----------


def test_last_synced_date_none_when_nothing_from_garmin(auth_client, db_session: Session) -> None:
    _client, user = auth_client
    assert last_synced_date(db_session, user["id"]) is None


def test_last_synced_date_returns_most_recent_garmin_activity(
    auth_client, db_session: Session, tcx_bytes: bytes, gpx_bytes: bytes
) -> None:
    _client, user = auth_client
    fake = FakeGarmin(
        listing=[
            {"activityId": 1, "activityName": "Pedal"},
            {"activityId": 2, "activityName": "Corrida"},
        ],
        downloads={"1": _zipped("a.tcx", tcx_bytes), "2": _zipped("b.gpx", gpx_bytes)},
    )
    sync_activities(db_session, user["id"], fake, start=date(2020, 1, 1))

    latest = db_session.execute(
        select(Activity.start_time)
        .where(Activity.user_id == user["id"])
        .order_by(Activity.start_time.desc())
        .limit(1)
    ).scalar_one()
    assert last_synced_date(db_session, user["id"]) == latest.date()


def test_last_synced_date_ignores_manual_uploads(
    auth_client, db_session: Session, tcx_bytes: bytes
) -> None:
    """Upload manual nao pode mover a janela do sync incremental."""
    client, user = auth_client
    up = client.post(
        "/activities/upload", files={"file": ("sample_bike.tcx", tcx_bytes, "application/xml")}
    )
    assert up.status_code in (200, 201)
    assert last_synced_date(db_session, user["id"]) is None
