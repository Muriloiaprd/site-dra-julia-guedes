"""Pedacos de Windows: endereco do iPhone (Tailscale), atalho na Inicializar e manter o PC acordado."""

from __future__ import annotations

import ctypes
import json
import os
import subprocess
import sys
import threading
from collections.abc import Callable
from pathlib import Path

from .servidor import RAIZ, SEM_JANELA

TAILSCALE = Path(os.environ.get("PROGRAMFILES", r"C:\Program Files")) / "Tailscale" / "tailscale.exe"
ICONE_ICO = RAIZ / "kactus.ico"


def endereco_iphone() -> str | None:
    """https://<pc>.<tailnet>.ts.net, ou None sem Tailscale."""
    if not TAILSCALE.exists():
        return None
    try:
        saida = subprocess.run(
            [str(TAILSCALE), "status", "--json"],
            capture_output=True,
            text=True,
            timeout=10,
            creationflags=SEM_JANELA,
            check=False,
        ).stdout
        nome = (json.loads(saida).get("Self") or {}).get("DNSName", "").rstrip(".")
    except (OSError, ValueError, subprocess.SubprocessError):
        return None
    return f"https://{nome}" if nome else None


# ── Inicializar do Windows ────────────────────────────────────────────────
def _pasta_inicializar() -> Path:
    return Path(os.environ["APPDATA"]) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"


ATALHO_INICIO = _pasta_inicializar() / "Kactus.lnk"


def alvo_controle() -> Path:
    """O .exe sem console que o uv cria para o projeto (gui-scripts)."""
    scripts = Path(sys.executable).parent
    exe = scripts / "kactus-controle.exe"
    return exe if exe.exists() else scripts / "pythonw.exe"


def criar_atalho(caminho: Path, argumentos: str, descricao: str) -> None:
    """Atalho .lnk via WScript.Shell (sem pywin32). Minimizado, com o icone do Kactus."""
    alvo = alvo_controle()
    args = argumentos if alvo.name != "pythonw.exe" else f"-m kactus_controle {argumentos}"
    ps = (
        "$s=(New-Object -ComObject WScript.Shell).CreateShortcut($env:K_LNK);"
        "$s.TargetPath=$env:K_ALVO;$s.Arguments=$env:K_ARGS;$s.WorkingDirectory=$env:K_DIR;"
        "$s.IconLocation=$env:K_ICO+',0';$s.Description=$env:K_DESC;$s.WindowStyle=7;$s.Save()"
    )
    env = dict(
        os.environ,
        K_LNK=str(caminho),
        K_ALVO=str(alvo),
        K_ARGS=args,
        K_DIR=str(RAIZ / "apps" / "controle"),
        K_ICO=str(ICONE_ICO),
        K_DESC=descricao,
    )
    subprocess.run(
        ["powershell", "-NoProfile", "-Command", ps],
        env=env,
        capture_output=True,
        timeout=30,
        creationflags=SEM_JANELA,
        check=True,
    )


def iniciar_com_windows() -> bool:
    return ATALHO_INICIO.exists()


def definir_iniciar_com_windows(ativo: bool) -> None:
    if ativo:
        criar_atalho(ATALHO_INICIO, "--inicio", "Liga o Kactus ao entrar no Windows (para o iPhone)")
    else:
        ATALHO_INICIO.unlink(missing_ok=True)


# ── Manter o PC acordado ──────────────────────────────────────────────────
ES_CONTINUOUS = 0x80000000
ES_SYSTEM_REQUIRED = 0x00000001


class Acordado:
    """Thread que segura a suspensao enquanto `deve()` for verdadeiro.

    SetThreadExecutionState vale para a thread que chamou, entao a mesma thread
    fica viva conferindo a cada 30 s. A tela continua desligando normalmente.
    """

    def __init__(self, deve: Callable[[], bool], intervalo: float = 30.0):
        self.deve = deve
        self.intervalo = intervalo
        self._parar = threading.Event()
        self._thread = threading.Thread(target=self._rodar, name="kactus-acordado", daemon=True)

    def iniciar(self) -> None:
        self._thread.start()

    def parar(self) -> None:
        self._parar.set()

    def _rodar(self) -> None:
        kernel = ctypes.windll.kernel32 if sys.platform == "win32" else None
        ligado = None
        while True:
            quer = bool(self.deve())
            if kernel and quer != ligado:
                kernel.SetThreadExecutionState(ES_CONTINUOUS | (ES_SYSTEM_REQUIRED if quer else 0))
                ligado = quer
            if self._parar.wait(self.intervalo):
                break
        if kernel:
            kernel.SetThreadExecutionState(ES_CONTINUOUS)
