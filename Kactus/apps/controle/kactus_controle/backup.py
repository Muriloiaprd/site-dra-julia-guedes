"""Backup semanal: uma vez por semana o Controle roda o script de backup da API
(`kactus_api.scripts.backup`), que grava um .json.gz com todos os dados e guarda as
últimas 8 cópias. A pasta padrão é Documentos/Kactus backups (a do OneDrive, se houver).

Na mesma rodada salva também as Finanças (Gestao-Financeira/scripts/backup.py), na mesma
pasta com o prefixo financas-backup-. Se só as Finanças falharem, o do Kactus vale e o
aviso conta a falha.
"""

from __future__ import annotations

import json
import subprocess
import threading
import time
from collections.abc import Callable
from pathlib import Path

from .servidor import FINANCAS, RAIZ, ambiente

SEMANA_S = 7 * 24 * 3600


def pasta_documentos() -> Path:
    """A pasta Documentos de verdade: com o OneDrive ela vira OneDrive/Documentos,
    e Path.home()/"Documents" é uma pasta velha que o Explorer não mostra."""
    try:
        import ctypes

        buf = ctypes.create_unicode_buffer(260)
        if ctypes.windll.shell32.SHGetFolderPathW(None, 5, None, 0, buf) == 0 and buf.value:  # CSIDL_PERSONAL
            return Path(buf.value)
    except (AttributeError, OSError):
        pass
    return Path.home() / "Documents"


PASTA_PADRAO = pasta_documentos() / "Kactus backups"
_SEM_JANELA = 0x08000000  # CREATE_NO_WINDOW


def rodar_backup(pasta: Path, manter: int = 8) -> dict:
    """Roda o script da API. Devolve {"arquivo", "tamanho", "apagados"}."""
    cmd = [
        "cmd.exe", "/d", "/c", "uv", "run", "--directory", str(RAIZ / "apps" / "api"),
        "python", "-m", "kactus_api.scripts.backup", "--pasta", str(pasta), "--manter", str(manter), "--json",
    ]
    return _json_do_script(cmd)


def _json_do_script(cmd: list[str], cwd: Path | None = None) -> dict:
    r = subprocess.run(
        cmd, capture_output=True, text=True, encoding="utf-8", errors="replace",
        env=ambiente(), cwd=cwd, timeout=900, creationflags=_SEM_JANELA,
    )
    linhas = [ln for ln in r.stdout.strip().splitlines() if ln.startswith("{")]
    if r.returncode != 0 or not linhas:
        raise RuntimeError((r.stderr or r.stdout).strip()[-300:] or f"código {r.returncode}")
    return json.loads(linhas[-1])


def rodar_backup_financas(pasta: Path, manter: int = 8) -> dict:
    """Roda o script das Finanças com o Python do venv delas."""
    py = FINANCAS / "venv" / "Scripts" / "python.exe"
    cmd = [str(py), "scripts/backup.py", "--pasta", str(pasta), "--manter", str(manter), "--json"]
    return _json_do_script(cmd, cwd=FINANCAS)


def rodar_tudo(
    pasta: Path,
    kactus: Callable[[Path], dict] = rodar_backup,
    financas: Callable[[Path], dict] = rodar_backup_financas,
) -> dict:
    """Kactus (obrigatório) + Finanças (se falhar, vira "financas_erro")."""
    res = dict(kactus(pasta))
    try:
        res["financas"] = financas(pasta)
    except Exception as e:  # noqa: BLE001 - o backup do Kactus já saiu; só avisa
        res["financas_erro"] = str(e)[-200:]
    return res


def _mb(n: int) -> str:
    return f"{n / 1_000_000:.1f} MB".replace(".", ",")


def texto_backup(res: dict) -> str:
    texto = f"Backup do Kactus salvo ({_mb(res.get('tamanho', 0))})"
    if "financas" in res:
        texto = f"Backup salvo (Kactus {_mb(res.get('tamanho', 0))} · Finanças {_mb(res['financas'].get('tamanho', 0))})"
    elif "financas_erro" in res:
        texto += f" · Finanças falhou: {res['financas_erro']}"
    return texto


class VigiaBackup:
    """Confere de hora em hora se já passou uma semana do último backup."""

    def __init__(
        self,
        ultimo: Callable[[], float | None],
        pasta: Callable[[], Path],
        ao_terminar: Callable[[str, dict | None], None],
        rodar: Callable[[Path], dict] = rodar_tudo,
        intervalo: float = 3600.0,
        primeira_espera: float = 120.0,
        agora: Callable[[], float] = time.time,
    ) -> None:
        self.ultimo, self.pasta, self.ao_terminar = ultimo, pasta, ao_terminar
        self._rodar = rodar
        self.intervalo, self.primeira_espera = intervalo, primeira_espera
        self._agora = agora
        self._parar = threading.Event()
        self._trava = threading.Lock()

    def iniciar(self) -> None:
        threading.Thread(target=self._loop, name="kactus-backup", daemon=True).start()

    def parar(self) -> None:
        self._parar.set()

    def _loop(self) -> None:
        if self._parar.wait(self.primeira_espera):
            return
        while True:
            if self.vencido():
                self.fazer()
            if self._parar.wait(self.intervalo):
                return

    def vencido(self) -> bool:
        u = self.ultimo()
        return u is None or self._agora() - u >= SEMANA_S

    def fazer(self) -> dict | None:
        if not self._trava.acquire(blocking=False):
            return None
        try:
            try:
                res = self._rodar(self.pasta())
            except Exception as e:  # noqa: BLE001 - vira aviso; tenta de novo na próxima hora
                self.ao_terminar(f"Não consegui fazer o backup do Kactus: {e}", None)
                return None
            self.ao_terminar(texto_backup(res), res)
            return res
        finally:
            self._trava.release()
