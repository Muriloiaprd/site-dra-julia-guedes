"""Preferencias do Kactus Controle (fora do git): modo, manter o PC acordado, relogio, Garmin e Financas."""

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
    sync_garmin: bool = False  # busca sozinho no Garmin (API pessoal); liga depois do --conferir
    ultimo_garmin: float | None = None  # epoch da ultima tentativa de sync do Garmin
    ultimo_backup: float | None = None  # epoch do ultimo backup semanal
    pasta_backup: str | None = None  # None = Documentos/Kactus backups
    financas_no_inicio: bool = True  # liga as Financas junto com o Kactus no inicio do Windows

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
        c.sync_garmin = bool(dados.get("sync_garmin", False))
        g = dados.get("ultimo_garmin")
        c.ultimo_garmin = float(g) if isinstance(g, int | float) else None
        u = dados.get("ultimo_backup")
        c.ultimo_backup = float(u) if isinstance(u, int | float) else None
        p = dados.get("pasta_backup")
        c.pasta_backup = p if isinstance(p, str) and p else None
        c.financas_no_inicio = bool(dados.get("financas_no_inicio", True))
        return c

    def salvar(self, arquivo: Path = ARQUIVO) -> None:
        arquivo.write_text(json.dumps(asdict(self), indent=2), encoding="utf-8")
