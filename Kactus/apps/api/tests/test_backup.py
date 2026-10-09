"""Backup semanal: grava .json.gz e guarda so as ultimas copias."""

import gzip
import json
from datetime import datetime, timedelta

from kactus_api.scripts.backup import gravar


def test_backup_writes_gzip_and_keeps_the_last_copies(tmp_path) -> None:
    base = datetime(2026, 10, 9, 8, 0)
    for i in range(10):
        out = gravar({"n": i}, tmp_path, manter=8, agora=base + timedelta(days=7 * i))
    arquivos = sorted(p.name for p in tmp_path.iterdir())
    assert len(arquivos) == 8 and arquivos[0].startswith("kactus_backup_2026-10-23")
    assert out["apagados"] == 1
    with gzip.open(out["arquivo"], "rt", encoding="utf-8") as f:
        assert json.load(f) == {"n": 9}
