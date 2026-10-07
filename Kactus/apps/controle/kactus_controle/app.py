"""Kactus Controle: icone perto do relogio + janelinha.

    kactus-controle            abre a janelinha
    kactus-controle --inicio   liga o Kactus sem abrir o navegador (Inicializar do Windows)
    kactus-controle --abrir    liga (se preciso) e abre o Kactus no navegador do PC

Se ja houver um controle rodando, so manda o pedido para ele e sai.
"""

from __future__ import annotations

import argparse
import contextlib
import ctypes
import queue
import subprocess
import sys
import threading
import tkinter as tk
import webbrowser
from collections.abc import Callable
from tkinter import messagebox

import pystray

from . import icones, sistema, web
from .config import Config
from .janela import ROTULO, Janela
from .servidor import Estado, Info, Servidor

URL_PC = "http://localhost:3003"
AVISO = {
    "ligado": "Kactus ligado. Já dá para abrir no iPhone.",
    "caiu": "O Kactus caiu. Religando…",
    "preparando": "Preparando a versão rápida do site (1–2 min)…",
}
ACOES_EXTERNAS = {"mostrar", "inicio", "abrir", "ligar", "desligar", "reiniciar"}


class App:
    def __init__(self) -> None:
        self.config = Config.carregar()
        self.endereco = sistema.endereco_iphone()
        self.fila: queue.Queue[Callable[[], None]] = queue.Queue()
        self._abrir_ao_ligar = False
        self.servidor = Servidor(modo=self.config.modo, ao_mudar=self._ao_mudar)
        self.root = tk.Tk()
        self.root.withdraw()
        self.janela = Janela(self.root, self, self.config.modo)
        self.icone = pystray.Icon("kactus", icones.bandeja(Estado.DESLIGADO), "Kactus: desligado", menu=self._menu())
        self.acordado = sistema.Acordado(
            lambda: self.config.manter_acordado and self.servidor.estado != Estado.DESLIGADO
        )
        self.web: web.ThreadingHTTPServer | None = None

    # ── ciclo ────────────────────────────────────────────────────────────
    def rodar(self, acao: str) -> None:
        self.servidor.iniciar_vigia()
        self.acordado.iniciar()
        self.icone.run_detached()
        self.comando(acao)
        self.janela.atualizar(self.servidor.info)
        self.root.after(150, self._drenar)
        self.root.mainloop()

    def _drenar(self) -> None:
        """Executa na thread do Tk o que chegou das outras (servidor, icone, web)."""
        while True:
            try:
                f = self.fila.get_nowait()
            except queue.Empty:
                break
            with contextlib.suppress(Exception):
                f()
        self.root.after(150, self._drenar)

    def na_tela(self, f: Callable[[], None]) -> None:
        self.fila.put(f)

    def comando(self, acao: str) -> None:
        if acao == "mostrar":
            self.janela.mostrar()
        elif acao == "inicio":
            self.servidor.ligar()
        elif acao == "abrir":
            if self.servidor.estado == Estado.LIGADO:
                webbrowser.open(URL_PC)
            else:
                self._abrir_ao_ligar = True
                self.servidor.ligar()
        elif acao == "ligar":
            self.ligar()
        elif acao == "desligar":
            self.desligar()
        elif acao == "reiniciar":
            self.reiniciar()

    def comando_externo(self, acao: str) -> bool:
        """Chamado pela thread do mini servidor."""
        if acao not in ACOES_EXTERNAS:
            return False
        self.na_tela(lambda: self.comando(acao))
        return True

    def _ao_mudar(self, info: Info, evento: str | None) -> None:
        self.na_tela(lambda: self._aplicar(info, evento))

    def _aplicar(self, info: Info, evento: str | None) -> None:
        self.janela.atualizar(info)
        self.icone.icon = icones.bandeja(info.estado)
        self.icone.title = f"Kactus: {ROTULO[info.estado].lower()}"
        self.icone.update_menu()
        texto = info.mensagem if evento == "erro" else AVISO.get(evento or "")
        if texto:
            with contextlib.suppress(Exception):
                self.icone.notify(texto, "Kactus")
        if info.estado == Estado.LIGADO and self._abrir_ao_ligar:
            self._abrir_ao_ligar = False
            webbrowser.open(URL_PC)

    # ── acoes (janela e menu) ────────────────────────────────────────────
    def ligar(self) -> None:
        self.servidor.ligar()

    def desligar(self) -> None:
        threading.Thread(target=self.servidor.desligar, daemon=True).start()

    def reiniciar(self) -> None:
        threading.Thread(target=self.servidor.reiniciar, daemon=True).start()

    def abrir_pc(self) -> None:
        webbrowser.open(URL_PC)

    def copiar_iphone(self) -> None:
        if self.endereco:
            self.root.clipboard_clear()
            self.root.clipboard_append(self.endereco)

    def ver_log(self) -> None:
        log = self.servidor.log
        log.parent.mkdir(parents=True, exist_ok=True)
        log.touch(exist_ok=True)
        subprocess.Popen(["notepad.exe", str(log)])

    def definir_modo(self, modo: str) -> None:
        if modo == self.config.modo:
            return
        self.config.modo = modo
        self.config.salvar()
        self.servidor.modo = modo
        info = self.servidor.info
        # ja rodando no outro modo (e sob o controle): troca agora
        if info.estado != Estado.DESLIGADO and not info.externo and info.modo_atual not in (None, modo):
            self.reiniciar()
        self.janela.atualizar(self.servidor.info)
        self.icone.update_menu()

    def alternar_inicio(self) -> None:
        try:
            sistema.definir_iniciar_com_windows(not sistema.iniciar_com_windows())
        except Exception as e:  # noqa: BLE001 - mostra qualquer falha ao usuario
            messagebox.showerror("Kactus Controle", f"Não consegui mudar o início com o Windows:\n{e}")
        self.icone.update_menu()

    def alternar_acordado(self) -> None:
        self.config.manter_acordado = not self.config.manter_acordado
        self.config.salvar()
        self.icone.update_menu()

    def sair(self) -> None:
        self.janela.mostrar()
        resp = True
        if self.servidor.estado != Estado.DESLIGADO:
            resp = messagebox.askyesnocancel(
                "Kactus Controle",
                "Desligar o servidor do Kactus também?\n\n"
                "Sim: desliga tudo.\nNão: o Kactus continua no ar, sem o controle.",
                parent=self.root,
            )
            if resp is None:
                return
        if resp:
            self.servidor.desligar()
        self.servidor.parar_vigia()
        self.acordado.parar()
        self.icone.stop()
        if self.web:
            self.web.shutdown()
        self.root.destroy()

    # ── menu do icone (roda na thread do pystray: tudo passa pela fila) ───
    def _menu(self) -> pystray.Menu:
        def tela(f: Callable[[], None]):
            return lambda: self.na_tela(f)

        estado = lambda: self.servidor.estado  # noqa: E731
        return pystray.Menu(
            pystray.MenuItem("Abrir o painel", tela(self.janela.mostrar), default=True),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Ligar", tela(self.ligar), enabled=lambda _i: estado() in (Estado.DESLIGADO, Estado.ERRO)),
            pystray.MenuItem("Desligar", tela(self.desligar), enabled=lambda _i: estado() != Estado.DESLIGADO),
            pystray.MenuItem("Reiniciar", tela(self.reiniciar)),
            pystray.MenuItem("Abrir no PC", tela(self.abrir_pc), enabled=lambda _i: estado() == Estado.LIGADO),
            pystray.MenuItem("Copiar endereço do iPhone", tela(self.copiar_iphone), visible=bool(self.endereco)),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem(
                "Modo rápido (iPhone)",
                tela(lambda: self.definir_modo("rapido")),
                checked=lambda _i: self.config.modo == "rapido",
                radio=True,
            ),
            pystray.MenuItem(
                "Modo desenvolvimento",
                tela(lambda: self.definir_modo("dev")),
                checked=lambda _i: self.config.modo == "dev",
                radio=True,
            ),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem(
                "Iniciar com o Windows", tela(self.alternar_inicio), checked=lambda _i: sistema.iniciar_com_windows()
            ),
            pystray.MenuItem(
                "Manter o PC acordado enquanto ligado",
                tela(self.alternar_acordado),
                checked=lambda _i: self.config.manter_acordado,
            ),
            pystray.MenuItem("Ver log", tela(self.ver_log)),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Sair", tela(self.sair)),
        )


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(prog="kactus-controle")
    p.add_argument("--inicio", action="store_true", help="liga sem abrir o navegador")
    p.add_argument("--abrir", action="store_true", help="liga e abre no navegador")
    args = p.parse_args(argv)
    acao = "inicio" if args.inicio else "abrir" if args.abrir else "mostrar"

    if sys.platform == "win32":
        with contextlib.suppress(Exception):
            ctypes.windll.shcore.SetProcessDpiAwareness(1)  # janela nitida em tela com escala

    app = App()
    try:
        app.web = web.iniciar(app.comando_externo)
    except OSError:
        # ja tem um controle rodando: entrega o pedido para ele
        web.enviar(acao)
        app.root.destroy()
        return
    app.rodar(acao)


if __name__ == "__main__":
    main()
