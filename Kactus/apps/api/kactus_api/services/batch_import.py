"""Importação de vários arquivos de uma vez: a tela /import e o relógio pelo USB.

O recálculo de CTL/ATL/TSB (varre todo o histórico) roda UMA vez ao final, a partir
da menor data afetada no lote. Um arquivo com erro fica registrado no próprio item
e não interrompe os demais.
"""

import hashlib
import uuid
from datetime import date

from sqlalchemy.orm import Session

from kactus_api.config import settings
from kactus_api.metrics.load import update_daily_metrics
from kactus_api.parsers import ParserError, UnsupportedFormatError, parse_file
from kactus_api.services.import_service import file_sha256, import_activity

MAX_BYTES = 50 * 1024 * 1024


def derived_hash(file_hash: str, index: int) -> str:
    """Hash de cada atividade de um arquivo com várias (CSV)."""
    return hashlib.sha256(f"{file_hash}:{index}".encode()).hexdigest()


def persist_raw(user_id: uuid.UUID, filename: str, content: bytes) -> str | None:
    """Guarda o arquivo original em disco. file_path e write-only (nenhum codigo
    o le), entao em deploy sem disco persistente isto fica desligado."""
    if not settings.persist_raw_uploads:
        return None
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
    user_dir = settings.data_path / "uploads" / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)
    path = user_dir / f"{file_sha256(content)[:16]}.{ext}"
    path.write_bytes(content)
    return str(path)


def import_batch(db: Session, user_id: uuid.UUID, files: list[tuple[str, bytes]]) -> list[dict]:
    """Importa cada (nome, conteúdo). Devolve, por arquivo:
    {filename, imported: [{activity_id, duplicate, sport, distance_m, points_stored}], error}."""
    responses: list[dict] = []
    min_date: date | None = None

    for filename, content in files:
        if not content:
            responses.append({"filename": filename, "imported": [], "error": "Arquivo vazio"})
            continue
        if len(content) > MAX_BYTES:
            responses.append({"filename": filename, "imported": [], "error": "Arquivo maior que 50MB"})
            continue

        try:
            normalized = parse_file(filename, content)
        except (UnsupportedFormatError, ParserError) as e:
            responses.append({"filename": filename, "imported": [], "error": str(e)})
            continue

        file_hash = file_sha256(content)
        saved_path = persist_raw(user_id, filename, content)

        results: list[dict] = []
        multi = len(normalized) > 1
        file_error: str | None = None
        for i, norm in enumerate(normalized):
            hash_for_item = derived_hash(file_hash, i) if multi else file_hash
            try:
                r = import_activity(
                    db, user_id, norm,
                    file_hash=hash_for_item, file_path=saved_path,
                    recompute_metrics=False,
                )
            except Exception as e:
                db.rollback()
                file_error = f"Falha ao importar: {e}"
                break
            results.append({
                "activity_id": r.activity_id,
                "duplicate": r.duplicate,
                "sport": r.sport,
                "distance_m": r.distance_m,
                "points_stored": r.points_stored,
            })
            if not r.duplicate:
                d = norm.start_time.date()
                if min_date is None or d < min_date:
                    min_date = d

        responses.append({"filename": filename, "imported": results, "error": file_error})

    if min_date is not None:
        update_daily_metrics(db, user_id, from_date=min_date)

    return responses
