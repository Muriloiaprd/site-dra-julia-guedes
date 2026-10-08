"""Tailscale do PC: sem ele o iPhone nao alcanca o Kactus.

Problemas ja vistos (2026-10-07):
- o app do Tailscale (tailscale-ipn.exe) foi fechado e o servico ficou em
  `NoState`: o `serve` some e os dois enderecos param de abrir;
- a VPN do iPhone desligada (isso o PC nao enxerga).
"""

from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass

from .servidor import SEM_JANELA
from .sistema import TAILSCALE

APP_TAILSCALE = TAILSCALE.parent / "tailscale-ipn.exe"
# porta publicada no Tailscale -> servico local
ENDERECOS = {"443": "http://127.0.0.1:3003", "8443": "http://127.0.0.1:3010"}


@dataclass(frozen=True)
class EstadoTailscale:
    ok: bool
    motivo: str  # ok | ausente | parado | sem_endereco
    texto: str


OK = EstadoTailscale(True, "ok", "iPhone com acesso")


def avaliar(status_json: str | None, serve_json: str | None) -> EstadoTailscale:
    """Decide o estado a partir da saida de `tailscale status/serve status --json`."""
    try:
        status = json.loads(status_json or "")
    except ValueError:
        status = {}
    if status.get("BackendState") != "Running":
        return EstadoTailscale(False, "parado", "Tailscale parado — iPhone sem acesso")
    try:
        portas = set((json.loads(serve_json or "") or {}).get("TCP", {}))
    except ValueError:
        portas = set()
    faltando = [p for p in ENDERECOS if p not in portas]
    if faltando:
        return EstadoTailscale(False, "sem_endereco", "Endereço do iPhone desligado no Tailscale")
    return OK


def _rodar(*args: str) -> str | None:
    try:
        return subprocess.run(
            [str(TAILSCALE), *args],
            capture_output=True,
            text=True,
            timeout=20,
            creationflags=SEM_JANELA,
            check=False,
        ).stdout
    except (OSError, subprocess.SubprocessError):
        return None


def checar() -> EstadoTailscale:
    if not TAILSCALE.exists():
        return EstadoTailscale(False, "ausente", "Tailscale não instalado")
    return avaliar(_rodar("status", "--json"), _rodar("serve", "status", "--json"))


def consertar(estado: EstadoTailscale) -> str | None:
    """Tenta resolver sozinho. Devolve o que foi feito (para o aviso) ou None."""
    if estado.motivo == "parado" and APP_TAILSCALE.exists():
        # sem o app aberto o servico do Tailscale fica parado no Windows
        subprocess.Popen([str(APP_TAILSCALE)], creationflags=SEM_JANELA)
        return "Abri o app do Tailscale de novo"
    if estado.motivo == "sem_endereco":
        for porta, alvo in ENDERECOS.items():
            _rodar("serve", "--bg", f"--https={porta}", alvo)
        return "Refiz os endereços do iPhone no Tailscale"
    return None
