"""Carrega fontes para renderizacao com Pillow.

Tenta fontes do sistema Windows primeiro; cai para fonte padrao PIL se nao encontrar.
"""

from pathlib import Path

from PIL import ImageFont

from ondilow_api.logger import get_logger

_WIN_FONTS = Path("C:/Windows/Fonts")

_FONT_CACHE: dict[tuple[str, int], "ImageFont.ImageFont"] = {}

log = get_logger(__name__)


def _try_font(name: str, size: int) -> "ImageFont.ImageFont | None":
    path = _WIN_FONTS / name
    if path.exists():
        try:
            return ImageFont.truetype(str(path), size)
        except Exception:
            log.debug("font_load_failed", font_name=name, size=size)
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
