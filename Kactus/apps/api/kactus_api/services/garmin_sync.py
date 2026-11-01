"""Traz atividades do Garmin Connect baixando o arquivo ORIGINAL (.fit) e
reaproveitando o parser que ja processa os uploads manuais.

Por que o arquivo original, e nao o JSON da API: o .fit passa pelo mesmo
caminho do upload manual, entao nao ha uma segunda implementacao de
normalizacao para manter, e o dedup por `file_hash` funciona identico -- uma
atividade ja subida a mao nao duplica.

Usa a API pessoal oficial do Garmin (aberta em 2026-10-21): uma chave criada
pelo proprio usuario no Garmin Connect vira um token de 24 h. Nao ha senha,
MFA nem o login SSO que dava 429 com a biblioteca nao oficial.

A parte que fala com a rede fica isolada em `PersonalApiClient`; o resto e
testavel sem Garmin e sem credencial.
"""

from __future__ import annotations

import base64
import hashlib
import io
import json
import zipfile
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any, Protocol

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from kactus_api.config import settings
from kactus_api.logger import get_logger
from kactus_api.metrics.load import update_daily_metrics
from kactus_api.models import Activity
from kactus_api.parsers.base import ParserError
from kactus_api.parsers.dispatch import UnsupportedFormatError, parse_file
from kactus_api.services.import_service import (
    file_sha256,
    find_duplicate,
    garmin_fields,
    import_activity,
)

log = get_logger(__name__)

SOURCE = "garmin_api"

API_BASE = "https://personal.connectapi.garmin.com"
KEY_PAGE = "https://connect.garmin.com/app/settings/personalApiToken"
# Mesmo arquivo que o cliente oficial do Garmin (gc-personal) le.
KEY_FILE = Path.home() / ".config" / "garmin" / "connect-personal-api-key"
TOKEN_CACHE = Path.home() / ".config" / "garmin" / "kactus-personal-api-token.json"

_TOKEN_PATH = "/personalapitoken-service/personal-api/personal-api-key/token"
_SEARCH_PATH = "/activitylist-service/activities/search/activities"
_DOWNLOAD_PATH = "/download-service/files/activity/{activity_id}"
_PAGE_SIZE = 100
# O token vale 24 h e nao tem refresh; troca com folga para nao vencer no meio do lote.
_TOKEN_MARGIN = timedelta(hours=1)

# Extensoes que o parser aceita, em ordem de preferencia dentro do zip.
_PARSEABLE = (".fit", ".tcx", ".gpx")


class GarminClient(Protocol):
    """So o que este modulo usa do cliente -- permite testar a orquestracao
    com um duble, sem rede."""

    def list_activities(self, start: date, end: date) -> list[dict[str, Any]]: ...

    def download_activity(self, activity_id: str) -> bytes: ...


@dataclass(slots=True)
class SyncItem:
    garmin_id: str
    name: str
    status: str  # "importada" | "duplicada" | "ignorada" | "erro"
    detail: str = ""


@dataclass(slots=True)
class SyncReport:
    items: list[SyncItem] = field(default_factory=list)
    earliest_imported: date | None = None
    stopped: str | None = None  # motivo de o lote ter parado no meio (429)

    @property
    def imported(self) -> int:
        return sum(1 for i in self.items if i.status == "importada")

    @property
    def duplicates(self) -> int:
        return sum(1 for i in self.items if i.status == "duplicada")

    @property
    def failed(self) -> int:
        return sum(1 for i in self.items if i.status == "erro")

    @property
    def skipped(self) -> int:
        return sum(1 for i in self.items if i.status == "ignorada")


class GarminSyncError(Exception):
    """Falha que impede o sync inteiro (chave ausente ou recusada, 429)."""


# ---------- parte pura: zip -> arquivo parseavel ----------


def extract_activity_file(content: bytes) -> tuple[str, bytes]:
    """Devolve (nome, bytes) do arquivo de atividade dentro do que o Garmin
    entregou. O download do arquivo original vem como zip; a API nao extrai.

    Alguns downloads ja vem como .fit cru (sem zip) -- aceita os dois.
    """
    if not content:
        raise UnsupportedFormatError("Download vazio")

    if not zipfile.is_zipfile(io.BytesIO(content)):
        # Nao e zip: assume arquivo de atividade cru. O parser tem sniff de
        # conteudo, entao o nome generico nao atrapalha.
        return "garmin_activity.fit", content

    with zipfile.ZipFile(io.BytesIO(content)) as zf:
        names = [n for n in zf.namelist() if not n.endswith("/")]
        for ext in _PARSEABLE:
            for name in names:
                if name.lower().endswith(ext):
                    return Path(name).name, zf.read(name)
        raise UnsupportedFormatError(
            f"Zip do Garmin sem arquivo de atividade reconhecivel (conteudo: {names or 'vazio'})"
        )


def _derived_hash(file_hash: str, index: int) -> str:
    return hashlib.sha256(f"{file_hash}:{index}".encode()).hexdigest()


def import_downloaded(
    db: Session, user_id, content: bytes, *, garmin_id: str, recompute_metrics: bool = False
) -> tuple[str, date | None, str]:
    """Importa um download do Garmin. Devolve (status, data_da_atividade, detalhe).

    `recompute_metrics=False` de proposito: em lote, o proprio import_service
    recomenda recalcular a carga uma vez so no final.
    """
    filename, raw = extract_activity_file(content)
    normalized = parse_file(filename, raw)
    if not normalized:
        return "ignorada", None, "arquivo sem atividade"

    file_hash = file_sha256(raw)
    status = "ignorada"
    earliest: date | None = None
    detail = ""

    # Os formatos aceitos aqui (.fit/.tcx/.gpx) sempre rendem uma atividade so.
    # Ainda assim o id e o hash sao derivados por indice, como no router de
    # upload: se um formato multi-atividade entrar em _PARSEABLE um dia, a
    # segunda atividade nao pode ser confundida com duplicata da primeira.
    multi = len(normalized) > 1
    for i, norm in enumerate(normalized):
        # O id do Garmin fecha o dedup mesmo que o .fit seja reexportado com
        # bytes diferentes; o file_hash cobre o caso de ja ter subido a mao.
        norm.source = SOURCE
        norm.source_activity_id = f"{garmin_id}:{i}" if multi else garmin_id
        result = import_activity(
            db,
            user_id,
            norm,
            file_hash=_derived_hash(file_hash, i) if multi else file_hash,
            recompute_metrics=recompute_metrics,
        )
        if result.duplicate:
            status = "duplicada" if status != "importada" else status
            detail = "ja existia"
        else:
            status = "importada"
            activity_date = norm.start_time.date()
            earliest = activity_date if earliest is None else min(earliest, activity_date)
            detail = f"{result.sport} · {(result.distance_m or 0) / 1000:.2f} km"

    return status, earliest, detail


# ---------- orquestracao (recebe o cliente pronto) ----------


def sync_activities(
    db: Session,
    user_id,
    client: GarminClient,
    *,
    start: date,
    end: date | None = None,
    limit: int | None = None,
    dry_run: bool = False,
) -> SyncReport:
    """Percorre as atividades do periodo, importando o que ainda nao existe."""
    end = end or date.today()
    listed = client.list_activities(start, end)
    if limit is not None:
        listed = listed[:limit]

    report = SyncReport()
    for raw in listed:
        garmin_id = str(raw.get("activityId", "")).strip()
        name = str(raw.get("activityName") or "sem titulo")
        if not garmin_id:
            report.items.append(SyncItem("?", name, "erro", "resposta sem activityId"))
            continue

        if _already_imported(db, user_id, garmin_id):
            report.items.append(SyncItem(garmin_id, name, "duplicada", "ja importada antes"))
            continue

        if dry_run:
            report.items.append(SyncItem(garmin_id, name, "ignorada", "dry-run"))
            continue

        try:
            content = client.download_activity(garmin_id)
            status, activity_date, detail = import_downloaded(
                db, user_id, content, garmin_id=garmin_id
            )
        except GarminSyncError as e:
            # 429 no meio do lote: parar ja (insistir so prolonga o bloqueio),
            # mas sem perder o que entrou nem o recalculo da carga abaixo
            report.stopped = str(e)
            break
        except (UnsupportedFormatError, ParserError) as e:
            # Atividade sem arquivo (registro manual no Garmin, por exemplo)
            # nao deve derrubar o lote inteiro.
            report.items.append(SyncItem(garmin_id, name, "ignorada", str(e)))
            continue
        except Exception as e:  # noqa: BLE001 - lote nao pode morrer numa atividade
            log.exception("garmin_sync_item_failed", garmin_id=garmin_id)
            report.items.append(SyncItem(garmin_id, name, "erro", f"{type(e).__name__}: {e}"))
            continue

        report.items.append(SyncItem(garmin_id, name, status, detail))
        if activity_date is not None:
            report.earliest_imported = (
                activity_date
                if report.earliest_imported is None
                else min(report.earliest_imported, activity_date)
            )

    # Uma varredura de carga so, com a data mais antiga do lote.
    if report.earliest_imported is not None:
        update_daily_metrics(db, user_id, from_date=report.earliest_imported)

    return report


def last_synced_date(db: Session, user_id) -> date | None:
    """Data da atividade mais recente ja vinda do Garmin, para sync incremental."""
    latest = db.execute(
        select(Activity.start_time)
        .where(
            Activity.user_id == user_id,
            Activity.source == SOURCE,
            Activity.deleted_at.is_(None),
        )
        .order_by(Activity.start_time.desc())
        .limit(1)
    ).scalar_one_or_none()
    return latest.date() if latest else None


def _already_imported(db: Session, user_id, garmin_id: str) -> bool:
    hit = db.execute(
        select(Activity.id).where(
            Activity.user_id == user_id,
            Activity.source == SOURCE,
            Activity.source_activity_id == garmin_id,
            Activity.deleted_at.is_(None),
        )
    ).scalar_one_or_none()
    return hit is not None


# ---------- conferencia: o arquivo da API vem completo? ----------

# O Garmin apaga dos FIT entregues por API os campos que nao documenta -- e o
# parser le justamente alguns assim (suor, FC de recuperacao, sensacao...).
_COMPARED = (
    "training_effect_aerobic",
    "training_effect_anaerobic",
    "primary_benefit",
    "hr_recovery",
    "sweat_loss_ml",
    "resting_calories",
    "min_temperature_c",
    "max_temperature_c",
    "watch_feel",
    "watch_rpe",
    "avg_vertical_oscillation_mm",
    "avg_stance_time_ms",
    "avg_vertical_ratio_pct",
    "avg_step_length_m",
    "total_strides",
    "normalized_power_w",
)


@dataclass(slots=True)
class FieldCheck:
    garmin_id: str
    name: str
    compared: bool = False
    missing: list[str] = field(default_factory=list)  # tem no Kactus, faltou na API
    different: list[tuple[str, Any, Any]] = field(default_factory=list)  # (campo, kactus, api)
    detail: str = ""


def compare_fields(api_values: dict[str, Any], stored: Activity) -> tuple[list[str], list]:
    """Compara os campos do Garmin do arquivo da API com os da atividade ja
    salva (vinda de upload ou do relogio no USB, com o arquivo completo)."""
    missing, different = [], []
    for name in _COMPARED:
        have, got = getattr(stored, name, None), api_values.get(name)
        if have is None:
            continue
        if got is None:
            missing.append(name)
        elif abs(float(have) - float(got)) > 0.01 * max(abs(float(have)), 1.0):
            different.append((name, have, got))
    return missing, different


def check_api_files(
    db: Session, user_id, client: GarminClient, *, start: date, end: date | None = None, limit: int = 3
) -> list[FieldCheck]:
    """Baixa poucas atividades pela API e compara com o mesmo treino ja salvo.
    Nao grava nada."""
    end = end or date.today()
    checks = []
    for raw in client.list_activities(start, end)[:limit]:
        garmin_id = str(raw.get("activityId", "")).strip()
        check = FieldCheck(garmin_id or "?", str(raw.get("activityName") or "sem titulo"))
        checks.append(check)
        if not garmin_id:
            check.detail = "resposta sem activityId"
            continue
        try:
            filename, content = extract_activity_file(client.download_activity(garmin_id))
            normalized = parse_file(filename, content)
        except (UnsupportedFormatError, ParserError) as e:
            check.detail = str(e)
            continue
        if not normalized:
            check.detail = "arquivo sem atividade"
            continue
        norm = normalized[0]
        stored = find_duplicate(db, user_id, norm, file_sha256(content))
        if stored is None or stored.source == SOURCE:
            check.detail = "sem o mesmo treino vindo de arquivo no Kactus para comparar"
            continue
        check.compared = True
        check.missing, check.different = compare_fields(garmin_fields(norm), stored)
    return checks


# ---------- rede: API pessoal do Garmin ----------


def resolve_api_key() -> str:
    """Chave do .env (GARMIN_PERSONAL_API_KEY) ou do arquivo do cliente oficial."""
    key = (settings.garmin_personal_api_key or "").strip()
    if not key and KEY_FILE.is_file():
        key = KEY_FILE.read_text(encoding="utf-8").strip()
    if not key:
        raise GarminSyncError(
            "Falta a chave pessoal do Garmin.\n"
            f"1. Abra {KEY_PAGE} e clique em Create Key (e gratis, sem aprovacao).\n"
            "2. Cole a chave em GARMIN_PERSONAL_API_KEY no .env do Kactus "
            f"(ou sozinha no arquivo {KEY_FILE}).\n"
            "A chave e mostrada uma vez so; se perder, apague e crie outra."
        )
    return key


def jwt_expiry(token: str) -> datetime | None:
    """`exp` do token, sem conferir assinatura (so serve para saber quando trocar)."""
    try:
        payload = token.split(".")[1]
        data = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        return datetime.fromtimestamp(int(data["exp"]), UTC)
    except (IndexError, KeyError, TypeError, ValueError):
        return None


class PersonalApiClient:
    """Cliente minimo da API pessoal: listar atividades e baixar o original.

    Nao usa o pacote oficial (`garmin-connect-personal-api-python`, 1.0.0 beta)
    porque sao tres chamadas e o projeto ja tem httpx."""

    def __init__(
        self,
        api_key: str,
        *,
        http: httpx.Client | None = None,
        token_cache: Path | None = TOKEN_CACHE,
        base_url: str = API_BASE,
    ) -> None:
        self._key = api_key
        self._http = http or httpx.Client(timeout=30)
        self._cache = token_cache
        self._base = base_url.rstrip("/")
        self._token: str | None = None

    # -- token --

    def _key_id(self) -> str:
        # o cache e da chave: criar outra chave invalida o token guardado
        return hashlib.sha256(self._key.encode()).hexdigest()

    def _cached_token(self) -> str | None:
        if self._cache is None or not self._cache.is_file():
            return None
        try:
            data = json.loads(self._cache.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return None
        token = data.get("token") if data.get("key") == self._key_id() else None
        exp = jwt_expiry(token) if token else None
        if exp is None or exp - _TOKEN_MARGIN <= datetime.now(UTC):
            return None
        return token

    def _new_token(self) -> str:
        r = self._http.post(
            self._base + _TOKEN_PATH,
            headers={"Authorization": f"ApiKey {self._key}", "Accept": "*/*"},
        )
        if r.status_code in (401, 403):
            raise GarminSyncError(
                f"O Garmin recusou a chave pessoal (HTTP {r.status_code}): ela venceu ou foi "
                f"apagada. Crie outra em {KEY_PAGE} e troque no .env."
            )
        _raise_for_status(r)
        token = r.text.strip().strip('"')
        if self._cache is not None:
            self._cache.parent.mkdir(parents=True, exist_ok=True)
            self._cache.write_text(
                json.dumps({"key": self._key_id(), "token": token}), encoding="utf-8"
            )
        return token

    def _bearer(self, *, fresh: bool = False) -> str:
        if fresh or self._token is None:
            self._token = (None if fresh else self._cached_token()) or self._new_token()
        return self._token

    # -- chamadas --

    def _get(self, path: str, params: dict | None = None, *, accept: str = "application/json"):
        for attempt in range(2):
            r = self._http.get(
                self._base + path,
                params=params,
                headers={
                    "Authorization": f"Bearer {self._bearer(fresh=attempt > 0)}",
                    "Accept": accept,
                },
            )
            # 401 com token "valido": revogado ou cache velho -- pede outro uma vez
            if r.status_code != 401:
                break
        _raise_for_status(r)
        return r

    def list_activities(self, start: date, end: date) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        offset = 0
        while True:
            page = self._get(
                _SEARCH_PATH,
                {
                    "start": offset,
                    "limit": _PAGE_SIZE,
                    "startDate": start.isoformat(),
                    "endDate": end.isoformat(),
                },
            ).json() or []
            out.extend(page)
            if len(page) < _PAGE_SIZE:
                return out
            offset += _PAGE_SIZE

    def download_activity(self, activity_id: str) -> bytes:
        r = self._get(
            _DOWNLOAD_PATH.format(activity_id=int(activity_id)),
            # o mesmo do cliente oficial: sem o x-zip-compressed o Garmin responde 406
            accept="application/zip, application/x-zip-compressed, application/octet-stream",
        )
        return r.content


def _raise_for_status(r: httpx.Response) -> None:
    if r.status_code == 429:
        raise GarminSyncError(
            "O Garmin respondeu 429 (muitas requisicoes). Espere pelo menos 1 hora antes "
            "de rodar de novo -- insistir so prolonga o bloqueio."
        )
    r.raise_for_status()


def build_client() -> PersonalApiClient:
    return PersonalApiClient(resolve_api_key())


def parse_start(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()
