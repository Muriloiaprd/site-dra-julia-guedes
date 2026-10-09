"""Relógio Garmin no USB: acha os treinos novos em GARMIN/Activity e importa sozinho.

Dois jeitos de o Windows mostrar o relógio:
- como pendrive (letra de unidade): lido direto daqui;
- como dispositivo (MTP, os Forerunner/Fenix atuais): só o Shell do Windows enxerga,
  por isso o `relogio.ps1` lista e copia os arquivos.

Os arquivos novos são copiados para uma pasta e importados pelo script da API
(`kactus_api.scripts.import_files`), que grava direto no banco e ignora duplicados.
O que já foi visto fica em `relogio_vistos.json`, para não reler o relógio inteiro
toda vez.
"""

from __future__ import annotations

import json
import shutil
import string
import subprocess
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from .servidor import RAIZ, ambiente

AQUI = Path(__file__).resolve().parent
SCRIPT_MTP = AQUI / "relogio.ps1"
VISTOS = AQUI.parent / "relogio_vistos.json"
CHEGADA = AQUI.parent / "relogio_chegada"
EXTENSOES = {".fit"}
_SEM_JANELA = 0x08000000  # CREATE_NO_WINDOW


@dataclass(frozen=True)
class ArquivoRelogio:
    origem: str  # "unidade" ou "mtp"
    dispositivo: str  # letra (E:) ou nome do relógio
    nome: str  # nome do arquivo como o Windows mostra
    caminho: str | None = None  # só na unidade com letra

    @property
    def chave(self) -> str:
        # o Shell pode esconder a extensão: a chave ignora
        return f"{self.dispositivo}|{Path(self.nome).stem.lower()}"


def arquivos_em_unidades(letras: str = string.ascii_uppercase) -> list[ArquivoRelogio]:
    out = []
    for letra in letras:
        pasta = Path(f"{letra}:/GARMIN/Activity")
        try:
            if not pasta.is_dir():
                continue
            arquivos = sorted(pasta.iterdir())
        except OSError:
            continue
        for f in arquivos:
            if f.suffix.lower() in EXTENSOES:
                out.append(ArquivoRelogio("unidade", f"{letra}:", f.name, str(f)))
    return out


def _powershell(*args: str, timeout: float = 180) -> str:
    r = subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(SCRIPT_MTP), *args],
        capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout, creationflags=_SEM_JANELA,
    )
    return r.stdout.strip()


def ler_lista_mtp(saida: str) -> list[ArquivoRelogio]:
    """Lê o JSON do relogio.ps1 (o PowerShell 5 entrega objeto solto quando há um só)."""
    if not saida:
        return []
    try:
        dados = json.loads(saida)
    except ValueError:
        return []
    if isinstance(dados, dict):
        dados = [dados]
    out = []
    for d in dados:
        nome = str(d.get("nome") or "")
        # sem extensão visível, aceita; com extensão, só .fit
        if nome and (Path(nome).suffix.lower() in EXTENSOES or not Path(nome).suffix):
            out.append(ArquivoRelogio("mtp", str(d.get("dispositivo") or "relógio"), nome))
    return out


def arquivos_mtp() -> list[ArquivoRelogio]:
    try:
        return ler_lista_mtp(_powershell(timeout=60))
    except (OSError, subprocess.SubprocessError):
        return []


def achar() -> list[ArquivoRelogio]:
    return arquivos_em_unidades() + arquivos_mtp()


def copiar(arquivos: list[ArquivoRelogio], destino: Path) -> list[Path]:
    destino.mkdir(parents=True, exist_ok=True)
    for a in arquivos:
        if a.origem == "unidade" and a.caminho:
            shutil.copy2(a.caminho, destino / a.nome)
    mtp = [a.nome for a in arquivos if a.origem == "mtp"]
    if mtp:
        _powershell("-Destino", str(destino), "-Nomes", ",".join(mtp))
    copiados = sorted(p for p in destino.iterdir() if p.is_file())
    # o Shell tira a extensão do nome na lista, mas o arquivo copiado vem com .fit
    return [p for p in copiados if p.suffix.lower() in EXTENSOES]


def importar(arquivos: list[Path]) -> dict:
    """Roda o script da API. Devolve {"importadas", "duplicadas", "erros", "atividades"}."""
    cmd = [
        "cmd.exe", "/d", "/c", "uv", "run", "--directory", str(RAIZ / "apps" / "api"),
        "python", "-m", "kactus_api.scripts.import_files", "--json", *map(str, arquivos),
    ]
    r = subprocess.run(
        cmd, capture_output=True, text=True, encoding="utf-8", errors="replace",
        env=ambiente(), timeout=600, creationflags=_SEM_JANELA,
    )
    linhas = [ln for ln in r.stdout.strip().splitlines() if ln.startswith("{")]
    if r.returncode != 0 or not linhas:
        raise RuntimeError((r.stderr or r.stdout).strip()[-300:] or f"código {r.returncode}")
    return json.loads(linhas[-1])


def ler_vistos(arquivo: Path = VISTOS) -> set[str]:
    try:
        return set(json.loads(arquivo.read_text(encoding="utf-8")))
    except (OSError, ValueError):
        return set()


def salvar_vistos(vistos: set[str], arquivo: Path = VISTOS) -> None:
    arquivo.write_text(json.dumps(sorted(vistos), indent=1), encoding="utf-8")


def texto_resultado(res: dict) -> str:
    n, d, e = res.get("importadas", 0), res.get("duplicadas", 0), len(res.get("erros", []))
    partes = [f"{n} treino{'s' if n != 1 else ''} novo{'s' if n != 1 else ''} do relógio no Kactus"]
    if d:
        partes.append(f"{d} já estava{'m' if d != 1 else ''} lá")
    if e:
        partes.append(f"{e} com erro")
    return " · ".join(partes)


class VigiaRelogio:
    """Confere o USB a cada `intervalo` segundos e importa o que for novo."""

    def __init__(
        self,
        ativo: Callable[[], bool],
        ao_terminar: Callable[[str, dict | None], None],
        achar: Callable[[], list[ArquivoRelogio]] = achar,
        copiar: Callable[[list[ArquivoRelogio], Path], list[Path]] = copiar,
        importar: Callable[[list[Path]], dict] = importar,
        vistos_arquivo: Path = VISTOS,
        chegada: Path = CHEGADA,
        intervalo: float = 15.0,
    ) -> None:
        self.ativo = ativo
        self.ao_terminar = ao_terminar
        self._achar, self._copiar, self._importar = achar, copiar, importar
        self.vistos_arquivo = vistos_arquivo
        self.vistos = ler_vistos(vistos_arquivo)
        self.chegada = chegada
        self.intervalo = intervalo
        self._parar = threading.Event()
        self._trava = threading.Lock()
        self.ultimo: str | None = None  # texto do último resultado (janela)

    def iniciar(self) -> None:
        threading.Thread(target=self._loop, name="kactus-relogio", daemon=True).start()

    def parar(self) -> None:
        self._parar.set()

    def _loop(self) -> None:
        while not self._parar.wait(self.intervalo):
            if self.ativo():
                self.passo()

    def passo(self, forcar: bool = False) -> dict | None:
        """Uma conferência. `forcar` reimporta tudo o que está no relógio (o import ignora duplicados)."""
        if not self._trava.acquire(blocking=False):
            return None
        try:
            achados = self._achar()
            novos = achados if forcar else [a for a in achados if a.chave not in self.vistos]
            if not novos:
                if forcar:
                    self.ao_terminar("Nenhum relógio com treinos encontrado no USB.", None)
                return None
            pasta = self.chegada / time.strftime("%Y%m%d-%H%M%S")
            try:
                arquivos = self._copiar(novos, pasta)
                res = self._importar(arquivos) if arquivos else {"importadas": 0, "duplicadas": 0, "erros": [], "atividades": []}
            except Exception as e:  # noqa: BLE001 - qualquer falha vira aviso e nova tentativa depois
                self.ao_terminar(f"Não consegui importar do relógio: {e}", None)
                return None
            finally:
                shutil.rmtree(pasta, ignore_errors=True)
            self.vistos |= {a.chave for a in novos}
            salvar_vistos(self.vistos, self.vistos_arquivo)
            self.ultimo = texto_resultado(res)
            if res.get("importadas") or res.get("erros") or forcar:
                self.ao_terminar(self.ultimo, res)
            return res
        finally:
            self._trava.release()
