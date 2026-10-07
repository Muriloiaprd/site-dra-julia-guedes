"""Preferencias do Kactus Controle (fora do git): modo e manter o PC acordado."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path

ARQUIVO = Path(__file__).resolve().parents[1] / "config.json"


@dataclass
class Config:
    modo: str = "rapido"  # "rapido" | "dev"
    manter_acordado: bool = False  # so enquanto o Kactus estiver ligado

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
        return c

    def salvar(self, arquivo: Path = ARQUIVO) -> None:
        arquivo.write_text(json.dumps(asdict(self), indent=2), encoding="utf-8")
