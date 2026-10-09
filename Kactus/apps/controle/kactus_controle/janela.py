"""Janelinha do Kactus Controle (tkinter, no visual escuro do app)."""

from __future__ import annotations

import time
import tkinter as tk
from typing import Protocol

from PIL import ImageTk

from . import icones
from .servidor import Estado, Info

BG = "#0A0A0A"
PAINEL = "#141414"
BORDA = "#262626"
TEXTO = "#FFFFFF"
MUDO = "#8A8A8A"
VERDE = "#00FF66"
FONTE = "Segoe UI"

ROTULO = {
    Estado.DESLIGADO: "Desligado",
    Estado.PREPARANDO: "Preparando…",
    Estado.LIGANDO: "Ligando…",
    Estado.LIGADO: "Ligado",
    Estado.ERRO: "Com erro",
}
DICA = {Estado.DESLIGADO: "O iPhone só abre o Kactus com ele ligado"}


class Acoes(Protocol):
    endereco: str | None

    def ligar(self) -> None: ...
    def desligar(self) -> None: ...
    def reiniciar(self) -> None: ...
    def abrir_pc(self) -> None: ...
    def copiar_iphone(self) -> None: ...
    def ver_log(self) -> None: ...
    def definir_modo(self, modo: str) -> None: ...
    def consertar_tailscale(self) -> None: ...
    def importar_relogio_agora(self) -> None: ...
    def alternar_relogio(self) -> None: ...
    def relogio_ativo(self) -> bool: ...


def ha_quanto(desde: float | None) -> str:
    if not desde:
        return ""
    s = max(0, time.time() - desde)
    if s < 60:
        return "agora há pouco"
    if s < 3600:
        return f"há {int(s // 60)} min"
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    return f"há {h} h {m:02d}" if m else f"há {h} h"


class Botao(tk.Label):
    """Botao chapado (o tk.Button do Windows ignora parte das cores)."""

    def __init__(self, pai, texto: str, comando, primario: bool = False):
        self.cor = (VERDE, "#000000") if primario else ("#1F1F1F", TEXTO)
        super().__init__(
            pai, text=texto, bg=self.cor[0], fg=self.cor[1], font=(FONTE, 10, "bold"), padx=12, pady=9, cursor="hand2"
        )
        self.comando = comando
        self.ativo = True
        self.bind("<Button-1>", lambda _e: self.ativo and self.comando())
        self.bind("<Enter>", lambda _e: self.ativo and self.configure(bg=self._clarear()))
        self.bind("<Leave>", lambda _e: self.configure(bg=self.cor[0] if self.ativo else "#161616"))

    def _clarear(self) -> str:
        return "#5CFF9D" if self.cor[0] == VERDE else "#2A2A2A"

    def habilitar(self, sim: bool) -> None:
        self.ativo = sim
        self.configure(
            bg=self.cor[0] if sim else "#161616",
            fg=self.cor[1] if sim else "#4A4A4A",
            cursor="hand2" if sim else "arrow",
        )


class Janela:
    def __init__(self, root: tk.Tk, acoes: Acoes, modo: str):
        self.root = root
        self.acoes = acoes
        self.info: Info | None = None
        root.title("Kactus Controle")
        root.configure(bg=BG)
        root.resizable(False, False)
        root.protocol("WM_DELETE_WINDOW", self.esconder)
        self._icone = ImageTk.PhotoImage(icones.logo(64))
        root.iconphoto(True, self._icone)

        corpo = tk.Frame(root, bg=BG, padx=22, pady=20)
        corpo.pack(fill="both", expand=True)

        # cabecalho
        topo = tk.Frame(corpo, bg=BG)
        topo.pack(fill="x")
        self._logo = ImageTk.PhotoImage(icones.logo(40))
        tk.Label(topo, image=self._logo, bg=BG).pack(side="left")
        tit = tk.Frame(topo, bg=BG)
        tit.pack(side="left", padx=10)
        tk.Label(tit, text="Kactus Controle", bg=BG, fg=TEXTO, font=(FONTE, 14, "bold")).pack(anchor="w")
        tk.Label(tit, text="o servidor do Kactus neste PC", bg=BG, fg=MUDO, font=(FONTE, 9)).pack(anchor="w")

        # estado
        caixa = tk.Frame(corpo, bg=PAINEL, highlightbackground=BORDA, highlightthickness=1, padx=16, pady=14)
        caixa.pack(fill="x", pady=(18, 12))
        linha = tk.Frame(caixa, bg=PAINEL)
        linha.pack(fill="x")
        self.bolinha = tk.Canvas(linha, width=16, height=16, bg=PAINEL, highlightthickness=0)
        self.bolinha.pack(side="left")
        self._circulo = self.bolinha.create_oval(2, 2, 14, 14, fill=icones.COR[Estado.DESLIGADO], outline="")
        self.rotulo = tk.Label(linha, text="…", bg=PAINEL, fg=TEXTO, font=(FONTE, 16, "bold"))
        self.rotulo.pack(side="left", padx=8)
        self.detalhe = tk.Label(
            caixa, text="", bg=PAINEL, fg=MUDO, font=(FONTE, 9), justify="left", wraplength=300, anchor="w"
        )
        self.detalhe.pack(fill="x", pady=(6, 0))

        # botoes
        grade = tk.Frame(corpo, bg=BG)
        grade.pack(fill="x")
        grade.columnconfigure((0, 1), weight=1, uniform="b")
        self.b_ligar = Botao(grade, "Ligar", acoes.ligar, primario=True)
        self.b_desligar = Botao(grade, "Desligar", acoes.desligar)
        self.b_reiniciar = Botao(grade, "Reiniciar", acoes.reiniciar)
        self.b_abrir = Botao(grade, "Abrir no PC", acoes.abrir_pc)
        for i, b in enumerate((self.b_ligar, self.b_desligar, self.b_reiniciar, self.b_abrir)):
            b.grid(row=i // 2, column=i % 2, sticky="ew", padx=(0 if i % 2 == 0 else 4, 4 if i % 2 == 0 else 0), pady=4)

        # iPhone
        tk.Label(corpo, text="IPHONE", bg=BG, fg=MUDO, font=(FONTE, 8, "bold")).pack(anchor="w", pady=(16, 4))
        cel = tk.Frame(corpo, bg=BG)
        cel.pack(fill="x")
        self.endereco = tk.Label(
            cel,
            text=acoes.endereco or "Tailscale não encontrado",
            bg=BG,
            fg=TEXTO if acoes.endereco else MUDO,
            font=(FONTE, 10),
        )
        self.endereco.pack(side="left")
        if acoes.endereco:
            self.b_copiar = Botao(cel, "Copiar", self._copiar)
            self.b_copiar.configure(padx=10, pady=4, font=(FONTE, 9, "bold"))
            self.b_copiar.pack(side="right")

        # acesso do iPhone (Tailscale do PC)
        acesso = tk.Frame(corpo, bg=BG)
        acesso.pack(fill="x", pady=(6, 0))
        self.ts_bola = tk.Canvas(acesso, width=10, height=10, bg=BG, highlightthickness=0)
        self.ts_bola.pack(side="left")
        self._ts_circulo = self.ts_bola.create_oval(1, 1, 9, 9, fill=MUDO, outline="")
        self.ts_texto = tk.Label(acesso, text="Conferindo o Tailscale…", bg=BG, fg=MUDO, font=(FONTE, 9))
        self.ts_texto.pack(side="left", padx=6)
        self.b_consertar = Botao(acesso, "Consertar", acoes.consertar_tailscale)
        self.b_consertar.configure(padx=10, pady=3, font=(FONTE, 9, "bold"))

        # relogio no USB
        tk.Label(corpo, text="RELÓGIO NO USB", bg=BG, fg=MUDO, font=(FONTE, 8, "bold")).pack(anchor="w", pady=(16, 4))
        rel = tk.Frame(corpo, bg=BG)
        rel.pack(fill="x")
        self.rel_texto = tk.Label(
            rel, text="Ligue o Garmin no USB: os treinos novos entram sozinhos.", bg=BG, fg=MUDO,
            font=(FONTE, 9), justify="left", wraplength=230, anchor="w",
        )
        self.rel_texto.pack(side="left", fill="x", expand=True)
        self.b_relogio = Botao(rel, "Importar agora", acoes.importar_relogio_agora)
        self.b_relogio.configure(padx=10, pady=3, font=(FONTE, 9, "bold"))
        self.b_relogio.pack(side="right")
        self.rel_auto = tk.BooleanVar(value=acoes.relogio_ativo())
        tk.Checkbutton(
            corpo, text="Importar sozinho ao ligar no USB", variable=self.rel_auto,
            command=acoes.alternar_relogio, bg=BG, fg=TEXTO, selectcolor=PAINEL, activebackground=BG,
            activeforeground=TEXTO, font=(FONTE, 9), anchor="w", highlightthickness=0, cursor="hand2",
        ).pack(fill="x", pady=(4, 0))

        # modo
        tk.Label(corpo, text="MODO", bg=BG, fg=MUDO, font=(FONTE, 8, "bold")).pack(anchor="w", pady=(16, 4))
        self.modo = tk.StringVar(value=modo)
        for valor, texto in (
            ("rapido", "Rápido  —  melhor para o iPhone"),
            ("dev", "Desenvolvimento  —  mostra mudanças no código na hora"),
        ):
            tk.Radiobutton(
                corpo,
                text=texto,
                value=valor,
                variable=self.modo,
                command=lambda: acoes.definir_modo(self.modo.get()),
                bg=BG,
                fg=TEXTO,
                selectcolor=PAINEL,
                activebackground=BG,
                activeforeground=TEXTO,
                font=(FONTE, 9),
                anchor="w",
                highlightthickness=0,
                cursor="hand2",
            ).pack(fill="x")

        # rodape
        pe = tk.Frame(corpo, bg=BG)
        pe.pack(fill="x", pady=(16, 0))
        log = tk.Label(pe, text="Ver log", bg=BG, fg=VERDE, font=(FONTE, 9, "underline"), cursor="hand2")
        log.pack(side="left")
        log.bind("<Button-1>", lambda _e: acoes.ver_log())
        tk.Label(pe, text="Fechar a janela não desliga o Kactus", bg=BG, fg="#5A5A5A", font=(FONTE, 8)).pack(
            side="right"
        )

        self._tique()

    # ── atualizacao ──────────────────────────────────────────────────────
    def atualizar(self, info: Info) -> None:
        self.info = info
        self.bolinha.itemconfigure(self._circulo, fill=icones.COR[info.estado])
        self.rotulo.configure(text=ROTULO[info.estado])
        self._detalhe()
        self.b_ligar.habilitar(info.estado in (Estado.DESLIGADO, Estado.ERRO))
        self.b_desligar.habilitar(info.estado != Estado.DESLIGADO)
        self.b_reiniciar.habilitar(info.estado in (Estado.LIGADO, Estado.LIGANDO, Estado.ERRO))
        self.b_abrir.habilitar(info.estado == Estado.LIGADO)
        if self.modo.get() != info.modo:
            self.modo.set(info.modo)

    def _detalhe(self) -> None:
        if not self.info:
            return
        msg = self.info.mensagem
        if msg.startswith("Ligado · "):  # o titulo ja diz "Ligado"
            msg = msg.removeprefix("Ligado · ").capitalize()
        elif msg == ROTULO[self.info.estado]:
            msg = DICA.get(self.info.estado, "")
        partes = [msg]
        if self.info.estado == Estado.LIGADO and self.info.desde:
            partes.append(ha_quanto(self.info.desde))
        self.detalhe.configure(text="  ·  ".join(p for p in partes if p))

    def _tique(self) -> None:
        self._detalhe()
        self.root.after(30_000, self._tique)

    def atualizar_tailscale(self, ok: bool, texto: str, consertavel: bool) -> None:
        self.ts_bola.itemconfigure(self._ts_circulo, fill=VERDE if ok else "#F85149")
        self.ts_texto.configure(text=texto, fg=TEXTO if ok else "#F85149")
        if consertavel and not ok:
            self.b_consertar.pack(side="right")
        else:
            self.b_consertar.pack_forget()

    def atualizar_relogio(self, texto: str, ocupado: bool = False) -> None:
        self.rel_texto.configure(text=texto, fg=TEXTO)
        self.b_relogio.habilitar(not ocupado)

    def _copiar(self) -> None:
        self.acoes.copiar_iphone()
        self.b_copiar.configure(text="Copiado!")
        self.root.after(1500, lambda: self.b_copiar.configure(text="Copiar"))

    # ── mostrar/esconder ─────────────────────────────────────────────────
    def mostrar(self) -> None:
        self.root.deiconify()
        self.root.lift()
        self.root.attributes("-topmost", True)
        self.root.after(300, lambda: self.root.attributes("-topmost", False))
        self.root.focus_force()

    def esconder(self) -> None:
        self.root.withdraw()
