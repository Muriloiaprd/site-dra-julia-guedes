"""Carrega fontes para renderizacao com Pillow.

Tenta fontes do sistema Windows primeiro; cai para fonte padrao PIL se nao encontrar.
"""

from pathlib import Path

from PIL import ImageFont

_WIN_FONTS = Path("C:/Windows/Fonts")

_FONT_CACHE: dict[tuple[str, int], "ImageFont.ImageFont"] = {}


def _try_font(name: str, size: int) -> "ImageFont.ImageFont | None":
    path = _WIN_FONTS / name
    if path.exists():
        try:
            return ImageFont.truetype(str(path), size)
        except Exception:
            pass
    return None


def get_font(size: int, bold: bool = False) -> "ImageFont.ImageFont":
    key = (f"bold{size}" if bold else f"reg{size}", size)
    if key in _FONT_CACHE:
        return _FONT_CACHE[key]

    candidates = (
        ["arialbd.ttf", "Arial Bold.ttf", "segoeui.ttf"] if bold
        else ["arial.ttf", "Arial.ttf", "segoeui.ttf", "Roboto-Regular.ttf"]
    )
    font = None
    for name in candidates:
        font = _try_font(name, size)
        if font:
            break

    if font is None:
        font = ImageFont.load_default()

    _FONT_CACHE[key] = font
    return font
