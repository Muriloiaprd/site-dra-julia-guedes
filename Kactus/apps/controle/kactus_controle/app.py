"""Kactus Controle: icone perto do relogio + janelinha.

    kactus-controle            abre a janelinha
    kactus-controle --inicio   liga o Kactus (e as Financas, se marcado) sem abrir o navegador
    kactus-controle --abrir    liga (se preciso) e abre o Kactus no navegador do PC

Se ja houver um controle rodando, so manda o pedido para ele e sai.

Tambem liga e desliga as Financas (Gestao-Financeira, porta 5000 / 10000 no iPhone).
"""

from __future__ import annotations

import argparse
import contextlib
import ctypes
import os
import queue
import subprocess
import sys
import threading
import time
import tkinter as tk
import webbrowser
from collections.abc import Callable
from pathlib import Path
from tkinter import messagebox

import pystray

from . import backup, garmin, icones, relogio, sistema, tailscale, web
from .config import Config
from .janela import ROTULO, Janela
from .servidor import (
    FINANCAS,
    PORTA_FINANCAS,
    Estado,
    Info,
    Servidor,
    checar_financas,
    comandos_financas,
)

URL_PC = "http://localhost:3003"
URL_FINANCAS_PC = f"http://localhost:{PORTA_FINANCAS}"
AVISO = {
    "ligado": "Kactus ligado. Já dá para abrir no iPhone.",
    "caiu": "O Kactus caiu. Religando…",
    "preparando": "Preparando a versão rápida do site (1–2 min)…",
}
AVISO_FINANCAS = {"caiu": "As Finanças caíram. Religando…"}
ACOES_EXTERNAS = {
    "mostrar", "inicio", "abrir", "ligar", "desligar", "reiniciar",
    "financas-ligar", "financas-desligar", "financas-reiniciar",
}


class App:
    def __init__(self) -> None:
        self.config = Config.carregar()
        self.endereco = sistema.endereco_iphone()
        self.fila: queue.Queue[Callable[[], None]] = queue.Queue()
        self._abrir_ao_ligar = False
        self.servidor = Servidor(modo=self.config.modo, ao_mudar=self._ao_mudar)
        self.financas = Servidor(
            raiz=FINANCAS,
            comandos=comandos_financas(),
            checar=checar_financas,
            portas=(PORTA_FINANCAS,),
            matar_lancadores=lambda: None,
            log=self.servidor.log.with_name("financas.log"),
            ao_mudar=self._ao_mudar_financas,
        )
        self.root = tk.Tk()
        self.root.withdraw()
        self.janela = Janela(self.root, self, self.config.modo)
        self.icone = pystray.Icon("kactus", icones.bandeja(Estado.DESLIGADO), "Kactus: desligado", menu=self._menu())
        self.acordado = sistema.Acordado(lambda: self.config.manter_acordado and self.algum_ligado())
        self.web: web.ThreadingHTTPServer | None = None
        self.ts: tailscale.EstadoTailscale | None = None
        self._ts_consertou = False  # tenta consertar sozinho uma vez por queda
        self._ts_parar = threading.Event()
        self.relogio = relogio.VigiaRelogio(
            ativo=lambda: self.config.importar_relogio,
            ao_terminar=lambda texto, res: self.na_tela(lambda: self._relogio_terminou(texto, res)),
        )
        self.garmin = garmin.VigiaGarmin(
            ativo=lambda: self.config.sync_garmin,
            ultimo=lambda: self.config.ultimo_garmin,
            ao_tentar=lambda quando: self.na_tela(lambda: self._garmin_tentou(quando)),
            ao_terminar=lambda texto, res, avisar: self.na_tela(lambda: self._garmin_terminou(texto, avisar)),
        )
        self.backup = backup.VigiaBackup(
            ultimo=lambda: self.config.ultimo_backup,
            pasta=self.pasta_backup,
            ao_terminar=lambda texto, res: self.na_tela(lambda: self._backup_terminou(texto, res)),
        )

    # ── ciclo ────────────────────────────────────────────────────────────
    def rodar(self, acao: str) -> None:
        self.servidor.iniciar_vigia()
        self.financas.iniciar_vigia()
        self.acordado.iniciar()
        threading.Thread(target=self._vigiar_tailscale, name="kactus-tailscale", daemon=True).start()
        self.relogio.iniciar()
        self.garmin.iniciar()
        self.backup.iniciar()
        self.icone.run_detached()
        self.comando(acao)
        self.janela.atualizar(self.servidor.info)
        self.janela.atualizar_financas(self.financas.info)
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
            if self.config.financas_no_inicio:
                self.financas.ligar()
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
        elif acao == "financas-ligar":
            self.financas_ligar()
        elif acao == "financas-desligar":
            self.financas_desligar()
        elif acao == "financas-reiniciar":
            self.financas_reiniciar()

    def comando_externo(self, acao: str) -> bool:
        """Chamado pela thread do mini servidor."""
        if acao not in ACOES_EXTERNAS:
            return False
        self.na_tela(lambda: self.comando(acao))
        return True

    def status(self) -> dict:
        """Para a pagina do iPhone e as telas "Kactus desligado" e "Financas desligadas"."""
        info = self.servidor.info
        fin = self.financas.info
        return {
            "estado": info.estado.value,
            "rotulo": ROTULO[info.estado],
            "mensagem": info.mensagem,
            "modo": info.modo,
            "externo": info.externo,
            "desde": info.desde,
            "tailscale": None if self.ts is None else {"ok": self.ts.ok, "texto": self.ts.texto},
            "financas": {
                "estado": fin.estado.value,
                "rotulo": ROTULO[fin.estado],
                "mensagem": fin.mensagem,
                "externo": fin.externo,
                "desde": fin.desde,
                "no_inicio": self.config.financas_no_inicio,
            },
        }

    def algum_ligado(self) -> bool:
        return self.servidor.estado != Estado.DESLIGADO or self.financas.estado != Estado.DESLIGADO

    def _ao_mudar(self, info: Info, evento: str | None) -> None:
        self.na_tela(lambda: self._aplicar(info, evento))

    def _aplicar(self, info: Info, evento: str | None) -> None:
        self.janela.atualizar(info)
        self._atualizar_icone()
        self.icone.update_menu()
        texto = info.mensagem if evento == "erro" else AVISO.get(evento or "")
        if texto:
            with contextlib.suppress(Exception):
                self.icone.notify(texto, "Kactus")
        if info.estado == Estado.LIGADO and self._abrir_ao_ligar:
            self._abrir_ao_ligar = False
            webbrowser.open(URL_PC)

    def _ao_mudar_financas(self, info: Info, evento: str | None) -> None:
        self.na_tela(lambda: self._aplicar_financas(info, evento))

    def _aplicar_financas(self, info: Info, evento: str | None) -> None:
        self.janela.atualizar_financas(info)
        self._atualizar_icone()
        self.icone.update_menu()
        texto = info.mensagem if evento == "erro" else AVISO_FINANCAS.get(evento or "")
        if texto:
            with contextlib.suppress(Exception):
                self.icone.notify(texto, "Finanças")

    def _atualizar_icone(self) -> None:
        info = self.servidor.info
        sem_iphone = self.ts is not None and not self.ts.ok
        # ligado mas o iPhone sem acesso: bolinha amarela, nao verde
        estado = Estado.LIGANDO if info.estado == Estado.LIGADO and sem_iphone else info.estado
        self.icone.icon = icones.bandeja(estado)
        extra = " · iPhone sem acesso" if sem_iphone else ""
        fin = ROTULO[self.financas.estado].lower()
        self.icone.title = f"Kactus: {ROTULO[info.estado].lower()}{extra} · Finanças: {fin}"

    # ── Tailscale (acesso do iPhone) ─────────────────────────────────────
    def _vigiar_tailscale(self) -> None:
        while True:
            e = tailscale.checar()
            self.na_tela(lambda e=e: self._aplicar_tailscale(e))
            if self._ts_parar.wait(20):
                break

    def _aplicar_tailscale(self, e: tailscale.EstadoTailscale) -> None:
        anterior, self.ts = self.ts, e
        consertavel = e.motivo in ("parado", "sem_endereco")
        self.janela.atualizar_tailscale(e.ok, e.texto, consertavel)
        self._atualizar_icone()
        if e.ok:
            if not self.endereco:
                self.endereco = sistema.endereco_iphone()
            if anterior is not None and not anterior.ok:
                self._avisar("Tailscale de volta: o iPhone tem acesso de novo.")
            self._ts_consertou = False
            return
        if anterior is None or anterior.ok:
            self._avisar(f"{e.texto}. Tentando consertar…" if consertavel else e.texto)
        if consertavel and not self._ts_consertou:
            self._ts_consertou = True
            self.consertar_tailscale()

    def consertar_tailscale(self) -> None:
        estado = self.ts

        def rodar() -> None:
            feito = tailscale.consertar(estado) if estado else None
            if feito:
                self.na_tela(lambda: self._avisar(feito))
            # confere de novo logo, sem esperar os 20 s
            for espera in (5, 10):
                self._ts_parar.wait(espera)
                e = tailscale.checar()
                self.na_tela(lambda e=e: self._aplicar_tailscale(e))
                if e.ok:
                    break

        threading.Thread(target=rodar, daemon=True).start()

    # ── relogio no USB ───────────────────────────────────────────────────
    def relogio_ativo(self) -> bool:
        return self.config.importar_relogio

    def alternar_relogio(self) -> None:
        self.config.importar_relogio = not self.config.importar_relogio
        self.config.salvar()
        self.janela.rel_auto.set(self.config.importar_relogio)
        self.icone.update_menu()

    def importar_relogio_agora(self) -> None:
        self.janela.atualizar_relogio("Procurando o relógio no USB…", ocupado=True)
        threading.Thread(target=lambda: self.relogio.passo(forcar=True), daemon=True).start()

    def _relogio_terminou(self, texto: str, res: dict | None) -> None:
        hora = time.strftime("%H:%M")
        self.janela.atualizar_relogio(f"{texto} ({hora})")
        if res is None or res.get("importadas") or res.get("erros"):
            self._avisar(texto)

    # ── Garmin pela API pessoal ──────────────────────────────────────────
    def garmin_ativo(self) -> bool:
        return self.config.sync_garmin

    def alternar_garmin(self) -> None:
        self.config.sync_garmin = not self.config.sync_garmin
        self.config.salvar()
        self.janela.gar_auto.set(self.config.sync_garmin)
        self.janela.atualizar_garmin(self.texto_garmin())
        self.icone.update_menu()

    def texto_garmin(self) -> str:
        if not self.config.sync_garmin:
            return "Desligado: ligue depois de rodar o --conferir (README)."
        u = self.config.ultimo_garmin
        if not u:
            return "A primeira busca sai alguns minutos depois de abrir o Controle."
        return f"Última busca: {time.strftime('%d/%m às %H:%M', time.localtime(u))}"

    def garmin_agora(self) -> None:
        self.janela.atualizar_garmin("Buscando no Garmin…", ocupado=True)
        threading.Thread(target=lambda: self.garmin.sincronizar(manual=True), daemon=True).start()

    def _garmin_tentou(self, quando: float) -> None:
        self.config.ultimo_garmin = quando
        self.config.salvar()

    def _garmin_terminou(self, texto: str, avisar: bool) -> None:
        self.janela.atualizar_garmin(f"{texto} ({time.strftime('%H:%M')})")
        if avisar:
            self._avisar(texto)

    # ── backup semanal ───────────────────────────────────────────────────
    def pasta_backup(self) -> Path:
        return Path(self.config.pasta_backup) if self.config.pasta_backup else backup.PASTA_PADRAO

    def texto_ultimo_backup(self) -> str:
        u = self.config.ultimo_backup
        if not u:
            return "Ainda sem backup: o primeiro sai alguns minutos depois de abrir o Controle."
        return f"Último: {time.strftime('%d/%m às %H:%M', time.localtime(u))} · clique para abrir a pasta"

    def backup_agora(self) -> None:
        self.janela.atualizar_backup("Fazendo o backup… (cerca de meio minuto)", ocupado=True)
        threading.Thread(target=self.backup.fazer, daemon=True).start()

    def abrir_backups(self) -> None:
        pasta = self.pasta_backup()
        pasta.mkdir(parents=True, exist_ok=True)
        os.startfile(pasta)  # noqa: S606 - abre o Explorer na pasta

    def _backup_terminou(self, texto: str, res: dict | None) -> None:
        if res is not None:
            self.config.ultimo_backup = time.time()
            self.config.salvar()
            self.janela.atualizar_backup(self.texto_ultimo_backup())
        else:
            self.janela.atualizar_backup(texto)
        self._avisar(texto)

    def _avisar(self, texto: str) -> None:
        with contextlib.suppress(Exception):
            self.icone.notify(texto, "Kactus")

    # ── acoes (janela e menu) ────────────────────────────────────────────
    def ligar(self) -> None:
        self.servidor.ligar()

    def desligar(self) -> None:
        threading.Thread(target=self.servidor.desligar, daemon=True).start()

    def reiniciar(self) -> None:
        threading.Thread(target=self.servidor.reiniciar, daemon=True).start()

    def abrir_pc(self) -> None:
        webbrowser.open(URL_PC)

    # ── Financas ─────────────────────────────────────────────────────────
    def financas_ligar(self) -> None:
        self.financas.ligar()

    def financas_desligar(self) -> None:
        threading.Thread(target=self.financas.desligar, daemon=True).start()

    def financas_reiniciar(self) -> None:
        threading.Thread(target=self.financas.reiniciar, daemon=True).start()

    def abrir_financas_pc(self) -> None:
        webbrowser.open(URL_FINANCAS_PC)

    def financas_no_inicio(self) -> bool:
        return self.config.financas_no_inicio

    def alternar_financas_inicio(self) -> None:
        self.config.financas_no_inicio = not self.config.financas_no_inicio
        self.config.salvar()
        self.janela.fin_inicio.set(self.config.financas_no_inicio)
        self.icone.update_menu()

    def ver_log_financas(self) -> None:
        log = self.financas.log
        log.parent.mkdir(parents=True, exist_ok=True)
        log.touch(exist_ok=True)
        subprocess.Popen(["notepad.exe", str(log)])

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
        if self.algum_ligado():
            resp = messagebox.askyesnocancel(
                "Kactus Controle",
                "Desligar os servidores (Kactus e Finanças) também?\n\n"
                "Sim: desliga tudo.\nNão: continuam no ar, sem o controle.",
                parent=self.root,
            )
            if resp is None:
                return
        if resp:
            self.servidor.desligar()
            self.financas.desligar()
        self.servidor.parar_vigia()
        self.financas.parar_vigia()
        self._ts_parar.set()
        self.relogio.parar()
        self.garmin.parar()
        self.backup.parar()
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
            pystray.MenuItem("Finanças", self._menu_financas()),
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
            pystray.MenuItem(
                "Importar do relógio no USB",
                tela(self.alternar_relogio),
                checked=lambda _i: self.config.importar_relogio,
            ),
            pystray.MenuItem("Importar do relógio agora", tela(self.importar_relogio_agora)),
            pystray.MenuItem(
                "Buscar no Garmin a cada 3 h",
                tela(self.alternar_garmin),
                checked=lambda _i: self.config.sync_garmin,
            ),
            pystray.MenuItem("Buscar no Garmin agora", tela(self.garmin_agora)),
            pystray.MenuItem("Fazer backup agora", tela(self.backup_agora)),
            pystray.MenuItem("Abrir pasta de backups", tela(self.abrir_backups)),
            pystray.MenuItem("Ver log", tela(self.ver_log)),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Sair", tela(self.sair)),
        )


    def _menu_financas(self) -> pystray.Menu:
        def tela(f: Callable[[], None]):
            return lambda: self.na_tela(f)

        estado = lambda: self.financas.estado  # noqa: E731
        return pystray.Menu(
            pystray.MenuItem(lambda _i: f"Finanças: {ROTULO[estado()].lower()}", None, enabled=False),
            pystray.MenuItem(
                "Ligar", tela(self.financas_ligar), enabled=lambda _i: estado() in (Estado.DESLIGADO, Estado.ERRO)
            ),
            pystray.MenuItem("Desligar", tela(self.financas_desligar), enabled=lambda _i: estado() != Estado.DESLIGADO),
            pystray.MenuItem("Reiniciar", tela(self.financas_reiniciar)),
            pystray.MenuItem("Abrir no PC", tela(self.abrir_financas_pc), enabled=lambda _i: estado() == Estado.LIGADO),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem(
                "Ligar junto no início do Windows",
                tela(self.alternar_financas_inicio),
                checked=lambda _i: self.config.financas_no_inicio,
            ),
            pystray.MenuItem("Ver log das Finanças", tela(self.ver_log_financas)),
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
        app.web = web.iniciar(app.comando_externo, app.status, web.origens_permitidas(app.endereco))
    except OSError:
        # ja tem um controle rodando: entrega o pedido para ele
        web.enviar(acao)
        app.root.destroy()
        return
    app.rodar(acao)


if __name__ == "__main__":
    main()
