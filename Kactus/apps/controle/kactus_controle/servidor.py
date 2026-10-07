"""Ciclo de vida do servidor do Kactus (API + site), sem nenhuma tela.

Liga (modo rapido = build de producao, ou dev), desliga a arvore de processos,
religa sozinho se cair e acompanha o estado conferindo o site e a API. Tudo que
toca o sistema (comandos, checagem, portas) e injetavel para os testes.
"""

from __future__ import annotations

import collections
import contextlib
import os
import subprocess
import threading
import time
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path

# C:\Cloude Code\Kactus (apps/controle/kactus_controle/servidor.py -> 3 niveis acima)
RAIZ = Path(__file__).resolve().parents[3]
SEM_JANELA = getattr(subprocess, "CREATE_NO_WINDOW", 0)
LOG_MAX_BYTES = 5 * 1024 * 1024


class Estado(StrEnum):
    DESLIGADO = "desligado"
    PREPARANDO = "preparando"  # build da versao rapida
    LIGANDO = "ligando"
    LIGADO = "ligado"
    ERRO = "erro"


@dataclass(frozen=True)
class Info:
    """Retrato do estado para as telas (icone, janela, iPhone)."""

    estado: Estado
    mensagem: str
    modo: str  # preferido: "rapido" | "dev"
    modo_atual: str | None  # o que esta rodando de fato (o build pode ter falhado)
    externo: bool  # servidor aberto fora do controle (.bat, Claude)
    desde: float | None  # quando ficou ligado (time.time)


@dataclass
class Comandos:
    rapido: list[str]
    dev: list[str]
    build: list[str]
    # saida 0 = build em dia; qualquer outra = precisa refazer
    precisa_build: list[str] | None = None


def comandos_kactus(raiz: Path = RAIZ) -> Comandos:
    pnpm = ["cmd.exe", "/d", "/c", "pnpm"]
    return Comandos(
        rapido=[*pnpm, "start:prod"],
        dev=[*pnpm, "dev"],
        build=[*pnpm, "build:prod"],
        precisa_build=[
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(raiz / "scripts" / "precisa-build.ps1"),
        ],
    )


def ambiente() -> dict[str, str]:
    """O mesmo ajuste de PATH do `Abrir Kactus.bat`: o Explorer pode estar com um PATH antigo."""
    env = dict(os.environ)
    extras = [
        os.path.join(env.get("APPDATA", ""), "npm"),
        os.path.join(env.get("USERPROFILE", ""), ".local", "bin"),
        os.path.join(env.get("PROGRAMFILES", r"C:\Program Files"), "nodejs"),
    ]
    env["PATH"] = os.pathsep.join([*extras, env.get("PATH", "")])
    # o NEXT_DIST_DIR de uma sessao de preview nao pode vazar para o modo rapido
    env.pop("NEXT_DIST_DIR", None)
    return env


def responde(url: str, timeout: float = 2.0) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return 200 <= r.status < 400
    except Exception:
        return False


def checar_kactus() -> bool:
    return responde("http://127.0.0.1:3003/") and responde("http://127.0.0.1:8000/health")


def pids_nas_portas(portas: tuple[int, ...]) -> set[int]:
    """PIDs que estao ouvindo nessas portas (servidor aberto fora do controle)."""
    try:
        saida = subprocess.run(
            ["netstat", "-ano"], capture_output=True, text=True, timeout=10, creationflags=SEM_JANELA
        ).stdout
    except Exception:
        return set()
    pids: set[int] = set()
    for linha in saida.splitlines():
        partes = linha.split()
        if len(partes) < 5 or not partes[0].upper().startswith("TCP") or partes[3].upper() != "LISTENING":
            continue
        if any(partes[1].endswith(f":{p}") for p in portas) and partes[4].isdigit():
            pids.add(int(partes[4]))
    pids.discard(0)
    pids.discard(os.getpid())
    return pids


def matar_arvore(pid: int) -> None:
    subprocess.run(
        ["taskkill", "/PID", str(pid), "/T", "/F"],
        capture_output=True,
        timeout=15,
        creationflags=SEM_JANELA,
    )


def matar_lancadores_bat() -> None:
    """Fecha o `Abrir Kactus.bat` que estiver rodando: ele religaria o servidor em 5 s."""
    ps = (
        "Get-CimInstance Win32_Process -Filter \"Name='cmd.exe'\" | "
        "Where-Object { $_.CommandLine -like '*Abrir Kactus.bat*' } | "
        "ForEach-Object { taskkill /PID $_.ProcessId /T /F | Out-Null }"
    )
    with contextlib.suppress(Exception):
        subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps], capture_output=True, timeout=30, creationflags=SEM_JANELA
        )


class Servidor:
    def __init__(
        self,
        raiz: Path = RAIZ,
        comandos: Comandos | None = None,
        checar: Callable[[], bool] = checar_kactus,
        portas: tuple[int, ...] = (3003, 8000),
        matar_lancadores: Callable[[], None] = matar_lancadores_bat,
        log: Path | None = None,
        modo: str = "rapido",
        intervalo: float = 3.0,
        espera_religar: float = 5.0,
        limite_quedas: int = 5,
        janela_quedas: float = 120.0,
        tempo_max_ligando: float = 600.0,
        ao_mudar: Callable[[Info, str | None], None] | None = None,
    ):
        self.raiz = raiz
        self.comandos = comandos or comandos_kactus(raiz)
        self._checar = checar
        self.portas = portas
        self._matar_lancadores = matar_lancadores
        self.log = log or (Path(__file__).resolve().parents[1] / "logs" / "servidor.log")
        self.modo = modo
        self.intervalo = intervalo
        self.espera_religar = espera_religar
        self.limite_quedas = limite_quedas
        self.janela_quedas = janela_quedas
        self.tempo_max_ligando = tempo_max_ligando
        self.ao_mudar = ao_mudar

        self._lock = threading.RLock()
        self._desejado = False  # o usuario quer o servidor ligado
        self._bloqueado = False  # caiu demais: para de religar ate um novo Ligar
        self._iniciando = False
        self._proc: subprocess.Popen | None = None
        self._build: subprocess.Popen | None = None
        self._quedas: collections.deque[float] = collections.deque()
        self._religar_em: float | None = None
        self._ligando_desde = 0.0
        self._falhas_checagem = 0
        self._parar = threading.Event()
        self._vigia: threading.Thread | None = None

        self._estado = Estado.DESLIGADO
        self._mensagem = "Desligado"
        self._modo_atual: str | None = None
        self._externo = False
        self._desde: float | None = None

    # ── leitura ──────────────────────────────────────────────────────────
    @property
    def info(self) -> Info:
        with self._lock:
            return Info(self._estado, self._mensagem, self.modo, self._modo_atual, self._externo, self._desde)

    @property
    def estado(self) -> Estado:
        return self._estado

    @property
    def desejado(self) -> bool:
        return self._desejado

    # ── comandos ─────────────────────────────────────────────────────────
    def ligar(self, modo: str | None = None) -> None:
        """Pede o servidor ligado. Nao bloqueia: o build/subida rodam numa thread."""
        with self._lock:
            if modo:
                self.modo = modo
            self._desejado = True
            self._bloqueado = False
            self._quedas.clear()
            self._religar_em = None
            if self._iniciando or (self._proc and self._proc.poll() is None):
                return
            self._iniciando = True
        threading.Thread(target=self._subir, name="kactus-subir", daemon=True).start()

    def desligar(self) -> None:
        with self._lock:
            self._desejado = False
            self._bloqueado = False
            self._religar_em = None
            proc, build = self._proc, self._build
            self._proc = None
            self._build = None
        for p in (build, proc):
            if p and p.poll() is None:
                matar_arvore(p.pid)
        # o .bat religaria em 5 s; depois, o que sobrou ouvindo nas portas
        # (aberto pelo .bat, pelo Claude, ou filho orfao)
        self._matar_lancadores()
        for pid in pids_nas_portas(self.portas):
            matar_arvore(pid)
        for p in (build, proc):
            if p:
                with contextlib.suppress(Exception):
                    p.wait(timeout=10)
        self._mudar(Estado.DESLIGADO, "Desligado", evento="desligado", externo=False)

    def reiniciar(self, modo: str | None = None) -> None:
        self.desligar()
        self.ligar(modo)

    def iniciar_vigia(self) -> None:
        if self._vigia and self._vigia.is_alive():
            return
        self._parar.clear()
        self._vigia = threading.Thread(target=self._vigiar, name="kactus-vigia", daemon=True)
        self._vigia.start()

    def parar_vigia(self) -> None:
        self._parar.set()
        if self._vigia:
            self._vigia.join(timeout=self.intervalo + 5)

    # ── interno ──────────────────────────────────────────────────────────
    def _mudar(self, estado: Estado, mensagem: str, evento: str | None = None, externo: bool | None = None) -> None:
        with self._lock:
            mudou = estado != self._estado or mensagem != self._mensagem
            if estado == Estado.LIGADO and self._estado != Estado.LIGADO:
                self._desde = time.time()
            elif estado != Estado.LIGADO:
                self._desde = None
            if estado == Estado.DESLIGADO:
                self._modo_atual = None
            if externo is not None:
                mudou = mudou or externo != self._externo
                self._externo = externo
            self._estado = estado
            self._mensagem = mensagem
            info = self.info
        if (mudou or evento) and self.ao_mudar:
            with contextlib.suppress(Exception):
                self.ao_mudar(info, evento)

    def _abrir_log(self):
        self.log.parent.mkdir(parents=True, exist_ok=True)
        if self.log.exists() and self.log.stat().st_size > LOG_MAX_BYTES:
            antigo = self.log.with_suffix(".log.1")
            antigo.unlink(missing_ok=True)
            self.log.rename(antigo)
        f = open(self.log, "ab")  # noqa: SIM115 - o handle vai para o processo filho; _popen fecha
        f.write(f"\n===== {time.strftime('%Y-%m-%d %H:%M:%S')} =====\n".encode())
        f.flush()
        return f

    def _popen(self, cmd: list[str]) -> subprocess.Popen:
        log = self._abrir_log()
        try:
            return subprocess.Popen(
                cmd,
                cwd=self.raiz,
                env=ambiente(),
                stdout=log,
                stderr=subprocess.STDOUT,
                stdin=subprocess.DEVNULL,
                creationflags=SEM_JANELA,
            )
        finally:
            log.close()  # o filho herdou o handle

    def _precisa_build(self) -> bool:
        cmd = self.comandos.precisa_build
        if not cmd:
            return True
        try:
            r = subprocess.run(cmd, cwd=self.raiz, capture_output=True, timeout=60, creationflags=SEM_JANELA)
            return r.returncode != 0
        except Exception:
            return True

    def _subir(self) -> None:
        try:
            if self._checar():
                # ja tem um Kactus no ar, aberto por fora: adota em vez de brigar pela porta
                self._mudar(Estado.LIGADO, "Ligado (aberto fora do controle)", evento="ligado", externo=True)
                return
            modo = self.modo
            aviso = ""
            if modo == "rapido" and self._precisa_build():
                self._mudar(
                    Estado.PREPARANDO, "Preparando a versão rápida (1–2 min)", evento="preparando", externo=False
                )
                with self._lock:
                    if not self._desejado:
                        return
                    self._build = self._popen(self.comandos.build)
                    build = self._build
                ok = build.wait() == 0
                with self._lock:
                    self._build = None
                    if not self._desejado:
                        return
                if not ok:
                    modo = "dev"
                    aviso = " · build falhou, rodando em modo dev"
            with self._lock:
                if not self._desejado:
                    return
                self._proc = self._popen(self.comandos.rapido if modo == "rapido" else self.comandos.dev)
                self._modo_atual = modo
                self._ligando_desde = time.time()
                self._falhas_checagem = 0
            self._mudar(Estado.LIGANDO, "Ligando…" + aviso, externo=False)
        except Exception as e:  # pnpm sumiu, pasta errada...
            self._mudar(Estado.ERRO, f"Não consegui ligar: {e}", evento="erro")
        finally:
            with self._lock:
                self._iniciando = False

    def _vigiar(self) -> None:
        while not self._parar.wait(self.intervalo):
            with contextlib.suppress(Exception):
                self._passo()

    def _passo(self) -> None:
        """Uma rodada da vigia (separada para os testes chamarem direto)."""
        with self._lock:
            desejado, proc, iniciando = self._desejado, self._proc, self._iniciando
            bloqueado, religar_em, externo = self._bloqueado, self._religar_em, self._externo
        if iniciando:
            return

        if not desejado:
            # ninguem pediu, mas pode haver um Kactus aberto por fora
            if self._checar():
                self._mudar(Estado.LIGADO, "Ligado (aberto fora do controle)", externo=True)
            elif self._estado != Estado.ERRO:
                self._mudar(Estado.DESLIGADO, "Desligado", externo=False)
            return

        if bloqueado:
            return

        if religar_em is not None:
            if time.time() >= religar_em:
                with self._lock:
                    self._religar_em = None
                    self._iniciando = True
                threading.Thread(target=self._subir, name="kactus-religar", daemon=True).start()
            return

        if proc is None:
            if externo and not self._checar():
                # o servidor de fora caiu: agora o controle assume
                self._agendar_religar("O servidor caiu, religando…")
            elif not externo:
                self._agendar_religar("Religando…")
            return

        if proc.poll() is not None:  # caiu
            with self._lock:
                self._proc = None
            # filhos orfaos (api/web) podem ter ficado com a porta
            for pid in pids_nas_portas(self.portas):
                matar_arvore(pid)
            self._agendar_religar("O servidor caiu, religando…")
            return

        if self._checar():
            with self._lock:
                self._falhas_checagem = 0
            if self._estado != Estado.LIGADO:
                modo = "modo rápido" if self._modo_atual == "rapido" else "modo dev"
                self._mudar(Estado.LIGADO, f"Ligado · {modo}", evento="ligado", externo=False)
            return

        with self._lock:
            self._falhas_checagem += 1
            falhas = self._falhas_checagem
        if self._estado == Estado.LIGADO and falhas >= 2:
            self._mudar(Estado.LIGANDO, "Sem resposta, aguardando…")
        elif self._estado == Estado.LIGANDO and time.time() - self._ligando_desde > self.tempo_max_ligando:
            self._mudar(Estado.ERRO, "Não respondeu a tempo; veja o log", evento="erro")

    def _agendar_religar(self, mensagem: str) -> None:
        """Religa em alguns segundos; se cair demais em pouco tempo, desiste e mostra erro."""
        with self._lock:
            agora = time.time()
            self._quedas.append(agora)
            while self._quedas and agora - self._quedas[0] > self.janela_quedas:
                self._quedas.popleft()
            demais = len(self._quedas) >= self.limite_quedas
            if demais:
                self._bloqueado = True
            else:
                self._religar_em = agora + self.espera_religar
        if demais:
            self._mudar(
                Estado.ERRO, f"Caiu {self.limite_quedas} vezes seguidas; veja o log", evento="erro", externo=False
            )
        else:
            self._mudar(Estado.LIGANDO, mensagem, evento="caiu", externo=False)
