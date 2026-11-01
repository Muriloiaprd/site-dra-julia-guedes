"""Sync do Garmin pela API pessoal: de tempos em tempos o Controle roda o script da API
(`kactus_api.scripts.sync_garmin --json`), que busca os treinos novos e ignora duplicados.

Vem desligado: liga na janela ou no menu depois de o `--conferir` mostrar que o arquivo da
API traz os campos do Garmin. A cada 3 h, contadas da última tentativa (guardada no
config.json, para não repetir ao reabrir o Controle). Falha também conta como tentativa:
com 429 o Garmin precisa de folga, não de insistência.
"""

from __future__ import annotations

import json
import subprocess
import threading
import time
from collections.abc import Callable

from .servidor import RAIZ, ambiente

INTERVALO_S = 3 * 3600
_SEM_JANELA = 0x08000000  # CREATE_NO_WINDOW


def rodar_sync() -> dict:
    """Roda o script da API. Devolve o resumo do --json ({"erro": ...} quando nada rodou)."""
    cmd = [
        "cmd.exe", "/d", "/c", "uv", "run", "--directory", str(RAIZ / "apps" / "api"),
        "python", "-m", "kactus_api.scripts.sync_garmin", "--json",
    ]
    r = subprocess.run(
        cmd, capture_output=True, text=True, encoding="utf-8", errors="replace",
        env=ambiente(), timeout=900, creationflags=_SEM_JANELA,
    )
    # o script sai com 1 também quando escreve o motivo no JSON: vale o JSON
    linhas = [ln for ln in r.stdout.strip().splitlines() if ln.startswith("{")]
    if not linhas:
        raise RuntimeError((r.stderr or r.stdout).strip()[-300:] or f"código {r.returncode}")
    return json.loads(linhas[-1])


def texto_sync(res: dict) -> str:
    if res.get("erro"):
        return res["erro"]
    n, d, e = res.get("importadas", 0), res.get("duplicadas", 0), res.get("erros", 0)
    if n:
        partes = [f"{n} treino{'s' if n != 1 else ''} novo{'s' if n != 1 else ''} do Garmin no Kactus"]
    else:
        partes = ["Nada novo no Garmin"]
    if d:
        partes.append(f"{d} já estava{'m' if d != 1 else ''} lá")
    if e:
        partes.append(f"{e} com erro")
    if res.get("parou"):
        partes.append(f"parou no meio: {res['parou']}")
    return " · ".join(partes)


def merece_aviso(res: dict | None) -> bool:
    """Notificação só para treino novo ou problema; "nada novo" fica só na janela."""
    return res is None or bool(res.get("importadas") or res.get("erros") or res.get("parou") or res.get("erro"))


class VigiaGarmin:
    """Confere a cada `checagem` segundos se já passaram 3 h da última tentativa."""

    def __init__(
        self,
        ativo: Callable[[], bool],
        ultimo: Callable[[], float | None],
        ao_tentar: Callable[[float], None],
        ao_terminar: Callable[[str, dict | None, bool], None],  # (texto, resultado, notificar)
        rodar: Callable[[], dict] = rodar_sync,
        checagem: float = 600.0,
        primeira_espera: float = 300.0,
        agora: Callable[[], float] = time.time,
    ) -> None:
        self.ativo, self.ultimo, self.ao_tentar, self.ao_terminar = ativo, ultimo, ao_tentar, ao_terminar
        self._rodar = rodar
        self.checagem, self.primeira_espera = checagem, primeira_espera
        self._agora = agora
        self._parar = threading.Event()
        self._trava = threading.Lock()
        self._ultimo_aviso: str | None = None  # o mesmo erro não vira notificação a cada 3 h

    def iniciar(self) -> None:
        threading.Thread(target=self._loop, name="kactus-garmin", daemon=True).start()

    def parar(self) -> None:
        self._parar.set()

    def _loop(self) -> None:
        if self._parar.wait(self.primeira_espera):
            return
        while True:
            if self.ativo() and self.vencido():
                self.sincronizar()
            if self._parar.wait(self.checagem):
                return

    def vencido(self) -> bool:
        u = self.ultimo()
        return u is None or self._agora() - u >= INTERVALO_S

    def sincronizar(self, manual: bool = False) -> dict | None:
        """Uma rodada. `manual` (botão) sempre avisa o resultado, até o "nada novo"."""
        if not self._trava.acquire(blocking=False):
            return None
        try:
            self.ao_tentar(self._agora())
            try:
                res = self._rodar()
            except Exception as e:  # noqa: BLE001 - vira aviso; tenta de novo na próxima janela de 3 h
                texto, res = f"Não consegui buscar no Garmin: {e}", None
            else:
                texto = texto_sync(res)
            repetido = texto == self._ultimo_aviso
            self._ultimo_aviso = texto if merece_aviso(res) else None
            self.ao_terminar(texto, res, manual or (merece_aviso(res) and not repetido))
            return res
        finally:
            self._trava.release()
