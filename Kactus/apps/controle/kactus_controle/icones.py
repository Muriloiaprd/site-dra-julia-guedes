"""Icone da bandeja: o simbolo do Kactus com uma bolinha da cor do estado."""

from __future__ import annotations

from functools import cache

from PIL import Image, ImageDraw

from .servidor import RAIZ, Estado

LOGO = RAIZ / "apps" / "web" / "public" / "brand" / "kactus-simbolo.png"

COR = {
    Estado.DESLIGADO: "#8A8A8A",
    Estado.PREPARANDO: "#FFC145",
    Estado.LIGANDO: "#FFC145",
    Estado.LIGADO: "#00FF66",
    Estado.ERRO: "#F85149",
}


@cache
def logo(tamanho: int) -> Image.Image:
    base = Image.open(LOGO).convert("RGBA")
    base.thumbnail((tamanho, tamanho), Image.LANCZOS)
    img = Image.new("RGBA", (tamanho, tamanho), (0, 0, 0, 0))
    img.alpha_composite(base, ((tamanho - base.width) // 2, (tamanho - base.height) // 2))
    return img


@cache
def bandeja(estado: Estado, tamanho: int = 64) -> Image.Image:
    img = logo(int(tamanho * 0.9)).copy()
    tela = Image.new("RGBA", (tamanho, tamanho), (0, 0, 0, 0))
    tela.alpha_composite(img, (0, 0))
    d = ImageDraw.Draw(tela)
    r = int(tamanho * 0.2)
    cx, cy = tamanho - r - 1, tamanho - r - 1
    d.ellipse((cx - r - 3, cy - r - 3, cx + r + 3, cy + r + 3), fill="#0A0A0A")
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=COR[estado])
    return tela
