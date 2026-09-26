"""Traz atividades do Garmin Connect baixando o arquivo ORIGINAL (.fit) e
reaproveitando o parser que ja processa os uploads manuais.

Por que o arquivo original, e nao o JSON da API: o .fit passa pelo mesmo
caminho do upload manual, entao nao ha uma segunda implementacao de
normalizacao para manter, e o dedup por `file_hash` funciona identico -- uma
atividade ja subida a mao nao duplica.

A parte que fala com a rede fica isolada em `fetch_*`/`login`; o resto e
testavel sem Garmin e sem credencial.
"""

from __future__ import annotations

import hashlib
import io
import zipfile
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Any, Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from ondilow_api.logger import get_logger
from ondilow_api.metrics.load import update_daily_metrics
from ondilow_api.models import Activity
from ondilow_api.parsers.base import ParserError
from ondilow_api.parsers.dispatch import UnsupportedFormatError, parse_file
from ondilow_api.services.import_service import file_sha256, import_activity

log = get_logger(__name__)

TOKEN_STORE = Path.home() / ".garminconnect"
SOURCE = "garmin_api"

# Extensoes que o parser aceita, em ordem de preferencia dentro do zip.
_PARSEABLE = (".fit", ".tcx", ".gpx")


class GarminClient(Protocol):
    """So o que este modulo usa de `garminconnect.Garmin` -- permite testar a
    orquestracao com um duble, sem rede."""

    def get_activities_by_date(
        self, startdate: str, enddate: str | None = ..., activitytype: str | None = ...
    ) -> list[dict[str, Any]]: ...

    def download_activity(self, activity_id: str, dl_fmt: Any = ...) -> bytes: ...


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
    """Falha que impede o sync inteiro (login, token ausente)."""


# ---------- parte pura: zip -> arquivo parseavel ----------


def extract_activity_file(content: bytes) -> tuple[str, bytes]:
    """Devolve (nome, bytes) do arquivo de atividade dentro do que o Garmin
    entregou. O formato ORIGINAL vem como zip; a propria biblioteca diz que
    extrair e responsabilidade de quem chama.

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
    listed = client.get_activities_by_date(start.isoformat(), end.isoformat())
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
            content = _download_original(client, garmin_id)
            status, activity_date, detail = import_downloaded(
                db, user_id, content, garmin_id=garmin_id
            )
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


def _download_original(client: GarminClient, garmin_id: str) -> bytes:
    from garminconnect import Garmin

    return client.download_activity(garmin_id, dl_fmt=Garmin.ActivityDownloadFormat.ORIGINAL)


# ---------- rede: login ----------


def build_client(email: str | None = None, password: str | None = None):
    """Cria e autentica o cliente do Garmin.

    Primeiro tenta o token salvo (`~/.garminconnect`), que renova sozinho e nao
    pede MFA. So cai para login com senha se o token faltar ou expirar -- e ai
    o MFA e pedido no terminal.

    O handshake de MFA e ligado a UM cliente em memoria: o `prompt_mfa` roda
    dentro do mesmo `login()`, por isso nao se cria outro cliente aqui.
    """
    from garminconnect import (
        Garmin,
        GarminConnectAuthenticationError,
        GarminConnectTooManyRequestsError,
    )

    if TOKEN_STORE.exists():
        try:
            client = Garmin()
            client.login(str(TOKEN_STORE))
            return client
        except Exception as e:  # noqa: BLE001 - token velho/revogado cai no login completo
            log.warning("garmin_token_login_failed", error=str(e))

    if not email or not password:
        raise GarminSyncError(
            "Sem token valido em ~/.garminconnect. Rode uma vez com --garmin-login "
            "(a senha e o codigo MFA sao pedidos no terminal) para autenticar; "
            "depois disso o token renova sozinho."
        )

    # retry_attempts=1: o padrao (3) insiste sozinho e, num 429, so aprofunda o
    # bloqueio de IP. Melhor falhar rapido e orientar a esperar.
    client = Garmin(
        email,
        password,
        prompt_mfa=lambda: input("Codigo MFA do Garmin: ").strip(),
        retry_attempts=1,
    )
    try:
        client.login(str(TOKEN_STORE))
    except GarminConnectTooManyRequestsError as e:
        raise GarminSyncError(
            "O Garmin respondeu 429: o IP desta maquina esta bloqueado temporariamente "
            "por excesso de tentativas.\n"
            "NAO tente de novo em seguida -- cada tentativa renova o bloqueio. Espere "
            "pelo menos 1 hora (as vezes algumas horas) e rode outra vez.\n"
            "O bloqueio e por IP, nao por conta: trocar de senha ou de e-mail nao resolve. "
            "Se tiver pressa, trocar de rede (4G do celular, por exemplo) costuma dar outro IP.\n"
            "Enquanto isso, o upload manual em /import continua funcionando normalmente."
        ) from e
    except GarminConnectAuthenticationError as e:
        raise GarminSyncError(
            f"O Garmin recusou as credenciais de '{email}'. Confira o e-mail (use "
            "--garmin-email se o login do Garmin for diferente do e-mail do Kactus) "
            "e a senha."
        ) from e
    return client


def parse_start(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()
