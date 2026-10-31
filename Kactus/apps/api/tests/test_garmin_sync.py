"""Cobre o sync do Garmin sem tocar na rede: o cliente e um duble e os
arquivos vem das fixtures, empacotados em zip como o Garmin entrega.

O cliente da API pessoal roda contra um transporte falso do httpx: cobre
token, cache, paginacao e erros sem chave de verdade. O que NAO da para testar
aqui e a resposta real do Garmin -- para isso existe o `--conferir`.
"""

import base64
import io
import json
import time
import zipfile
from datetime import date
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from kactus_api.models import Activity
from kactus_api.parsers.dispatch import UnsupportedFormatError
from kactus_api.services.garmin_sync import (
    SOURCE,
    GarminSyncError,
    PersonalApiClient,
    check_api_files,
    compare_fields,
    extract_activity_file,
    import_downloaded,
    jwt_expiry,
    last_synced_date,
    resolve_api_key,
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

    def list_activities(self, start, end):
        return self.listing

    def download_activity(self, activity_id):
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


def test_sync_stops_batch_on_429_but_keeps_what_was_imported(
    auth_client, db_session: Session, tcx_bytes: bytes
) -> None:
    """429 no meio: para de baixar (insistir prolonga o bloqueio), mas o que
    ja entrou fica e o lote informa o motivo."""
    _client, user = auth_client

    class Blocked(FakeGarmin):
        def download_activity(self, activity_id):
            if str(activity_id) == "2":
                raise GarminSyncError("429")
            return super().download_activity(activity_id)

    fake = Blocked(
        listing=[{"activityId": i, "activityName": f"T{i}"} for i in (1, 2, 3)],
        downloads={"1": _zipped("a.tcx", tcx_bytes)},
    )
    report = sync_activities(db_session, user["id"], fake, start=date(2020, 1, 1))

    assert report.imported == 1
    assert report.stopped == "429"
    assert fake.downloaded == ["1"]  # o 3 nem foi tentado


# ---------- conferencia dos campos do Garmin ----------


def test_compare_fields_reports_missing_and_different() -> None:
    stored = SimpleNamespace(sweat_loss_ml=466, hr_recovery=37, training_effect_aerobic=3.0)
    missing, different = compare_fields(
        {"sweat_loss_ml": None, "hr_recovery": 37, "training_effect_aerobic": 4.2}, stored
    )
    assert missing == ["sweat_loss_ml"]
    assert different == [("training_effect_aerobic", 3.0, 4.2)]


def test_compare_fields_ignores_what_kactus_never_had() -> None:
    """Campo nulo no Kactus nao e prova de nada (o relogio pode nao medir)."""
    missing, different = compare_fields({"sweat_loss_ml": 500}, SimpleNamespace())
    assert (missing, different) == ([], [])


def test_check_api_files_compares_with_the_uploaded_activity(
    auth_client, db_session: Session, tcx_bytes: bytes
) -> None:
    client, user = auth_client
    up = client.post(
        "/activities/upload", files={"file": ("sample_bike.tcx", tcx_bytes, "application/xml")}
    )
    assert up.status_code in (200, 201), up.text
    stored = db_session.execute(select(Activity).where(Activity.user_id == user["id"])).scalar_one()
    stored.sweat_loss_ml = 466  # como se o arquivo do relogio trouxesse o suor
    db_session.commit()

    fake = FakeGarmin(
        listing=[{"activityId": 1, "activityName": "Pedal"}],
        downloads={"1": _zipped("a.tcx", tcx_bytes)},
    )
    [check] = check_api_files(db_session, user["id"], fake, start=date(2020, 1, 1))

    assert check.compared
    assert check.missing == ["sweat_loss_ml"]
    # conferir nao grava nada
    assert len(db_session.execute(select(Activity).where(Activity.user_id == user["id"])).all()) == 1


def test_check_api_files_without_a_match_says_so(
    auth_client, db_session: Session, tcx_bytes: bytes
) -> None:
    _client, user = auth_client
    fake = FakeGarmin(
        listing=[{"activityId": 1, "activityName": "Pedal"}],
        downloads={"1": _zipped("a.tcx", tcx_bytes)},
    )
    [check] = check_api_files(db_session, user["id"], fake, start=date(2020, 1, 1))
    assert not check.compared
    assert "comparar" in check.detail


# ---------- cliente da API pessoal (transporte falso, sem rede) ----------


def _jwt(exp: float) -> str:
    def part(d: dict) -> str:
        return base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip("=")

    return f"{part({'alg': 'none'})}.{part({'exp': int(exp)})}.assinatura"


class FakeApi:
    """Servidor falso: conta os pedidos de token e responde as rotas usadas."""

    def __init__(self, *, activities: int = 0, token_status: int = 200, data_status: int = 200):
        self.activities = [{"activityId": i, "activityName": f"T{i}"} for i in range(activities)]
        self.token_status = token_status
        self.data_status = data_status
        self.tokens_issued = 0
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        path = request.url.path
        if path.endswith("/personal-api-key/token"):
            assert request.headers["Authorization"] == "ApiKey chave-teste"
            if self.token_status != 200:
                return httpx.Response(self.token_status)
            self.tokens_issued += 1
            return httpx.Response(200, text=_jwt(time.time() + 24 * 3600))
        assert request.headers["Authorization"].startswith("Bearer ")
        if self.data_status != 200:
            return httpx.Response(self.data_status)
        if path.endswith("/search/activities"):
            start, limit = int(request.url.params["start"]), int(request.url.params["limit"])
            return httpx.Response(200, json=self.activities[start : start + limit])
        if "/download-service/files/activity/" in path:
            return httpx.Response(200, content=b"zip-bytes")
        return httpx.Response(404)


def _api_client(server: FakeApi, cache: Path | None = None) -> PersonalApiClient:
    return PersonalApiClient(
        "chave-teste", http=httpx.Client(transport=httpx.MockTransport(server)), token_cache=cache
    )


def test_client_pages_through_all_activities() -> None:
    server = FakeApi(activities=230)
    listed = _api_client(server).list_activities(date(2026, 1, 1), date(2026, 10, 31))
    assert len(listed) == 230
    search = [r for r in server.requests if r.url.path.endswith("/search/activities")]
    assert [r.url.params["start"] for r in search] == ["0", "100", "200"]
    assert search[0].url.params["startDate"] == "2026-01-01"
    assert server.tokens_issued == 1  # um token serve o lote todo


def test_client_downloads_original_bytes() -> None:
    server = FakeApi()
    assert _api_client(server).download_activity("123") == b"zip-bytes"
    assert server.requests[-1].url.path.endswith("/download-service/files/activity/123")


def test_client_reuses_cached_token_between_runs(tmp_path: Path) -> None:
    server = FakeApi()
    cache = tmp_path / "token.json"
    _api_client(server, cache).list_activities(date(2026, 1, 1), date(2026, 1, 2))
    _api_client(server, cache).list_activities(date(2026, 1, 1), date(2026, 1, 2))
    assert server.tokens_issued == 1


def test_client_ignores_cached_token_of_another_key(tmp_path: Path) -> None:
    cache = tmp_path / "token.json"
    cache.write_text(json.dumps({"key": "outra", "token": _jwt(time.time() + 9999)}))
    server = FakeApi()
    _api_client(server, cache).download_activity("1")
    assert server.tokens_issued == 1


def test_client_ignores_token_close_to_expiry(tmp_path: Path) -> None:
    server = FakeApi()
    client = _api_client(server, tmp_path / "token.json")
    client._cache.write_text(json.dumps({"key": client._key_id(), "token": _jwt(time.time() + 600)}))
    client.download_activity("1")
    assert server.tokens_issued == 1


def test_client_refused_key_explains_how_to_fix() -> None:
    with pytest.raises(GarminSyncError, match="Crie outra"):
        _api_client(FakeApi(token_status=401)).download_activity("1")


def test_client_429_becomes_friendly_error_without_retry() -> None:
    server = FakeApi(data_status=429)
    with pytest.raises(GarminSyncError, match="429"):
        _api_client(server).download_activity("1")
    assert len([r for r in server.requests if "download" in r.url.path]) == 1


def test_client_401_on_data_gets_one_new_token_then_gives_up() -> None:
    server = FakeApi(data_status=401)
    with pytest.raises(httpx.HTTPStatusError):
        _api_client(server).download_activity("1")
    assert server.tokens_issued == 2


def test_jwt_expiry_reads_exp_and_tolerates_garbage() -> None:
    assert jwt_expiry(_jwt(1_800_000_000)).timestamp() == 1_800_000_000
    assert jwt_expiry("nao-e-jwt") is None


def test_resolve_api_key_without_key_explains_where_to_create(monkeypatch, tmp_path: Path) -> None:
    from kactus_api.services import garmin_sync

    monkeypatch.setattr(garmin_sync.settings, "garmin_personal_api_key", None)
    monkeypatch.setattr(garmin_sync, "KEY_FILE", tmp_path / "nao-existe")
    with pytest.raises(GarminSyncError, match="personalApiToken"):
        resolve_api_key()


def test_resolve_api_key_reads_official_client_file(monkeypatch, tmp_path: Path) -> None:
    from kactus_api.services import garmin_sync

    key_file = tmp_path / "connect-personal-api-key"
    key_file.write_text("  chave-do-arquivo\n")
    monkeypatch.setattr(garmin_sync.settings, "garmin_personal_api_key", "")
    monkeypatch.setattr(garmin_sync, "KEY_FILE", key_file)
    assert resolve_api_key() == "chave-do-arquivo"
