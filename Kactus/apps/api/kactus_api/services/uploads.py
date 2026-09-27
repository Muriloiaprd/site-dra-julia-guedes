"""Localiza o arquivo original de uma atividade no disco."""

import re
from pathlib import Path

from kactus_api.config import settings

_UPLOADS_SPLIT = re.compile(r"[\\/]data[\\/]uploads[\\/]")


def resolve_upload_path(stored: str | None) -> Path | None:
    """O `file_path` e gravado absoluto. Se a pasta do projeto mudou de lugar
    (ex.: Ondilow/ -> Kactus/ em 2026-09-26), o arquivo e reencontrado pelo
    trecho depois de `data/uploads/`, dentro do `data_path` atual."""
    if not stored:
        return None
    path = Path(stored)
    if path.exists():
        return path
    parts = _UPLOADS_SPLIT.split(stored, maxsplit=1)
    if len(parts) == 2:
        candidate = settings.data_path / "uploads" / parts[1].replace("\\", "/")
        if candidate.exists():
            return candidate
    return None
