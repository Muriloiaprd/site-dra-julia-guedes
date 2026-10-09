"""Preferencias do Kactus Controle (fora do git): modo, manter o PC acordado e importar do relogio."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path

ARQUIVO = Path(__file__).resolve().parents[1] / "config.json"


@dataclass
class Config:
    modo: str = "rapido"  # "rapido" | "dev"
    manter_acordado: bool = False  # so enquanto o Kactus estiver ligado
    importar_relogio: bool = True  # importa sozinho os treinos do relogio ligado no USB
    ultimo_backup: float | None = None  # epoch do ultimo backup semanal
    pasta_backup: str | None = None  # None = Documentos/Kactus backups

    @classmethod
    def carregar(cls, arquivo: Path = ARQUIVO) -> Config:
        try:
            dados = json.loads(arquivo.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return cls()
        c = cls()
        if dados.get("modo") in ("rapido", "dev"):
            c.modo = dados["modo"]
        c.manter_acordado = bool(dados.get("manter_acordado", False))
        c.importar_relogio = bool(dados.get("importar_relogio", True))
        u = dados.get("ultimo_backup")
        c.ultimo_backup = float(u) if isinstance(u, int | float) else None
        p = dados.get("pasta_backup")
        c.pasta_backup = p if isinstance(p, str) and p else None
        return c

    def salvar(self, arquivo: Path = ARQUIVO) -> None:
        arquivo.write_text(json.dumps(asdict(self), indent=2), encoding="utf-8")
