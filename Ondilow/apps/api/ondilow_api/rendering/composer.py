"""Composicao de cards/stories de atividade com Pillow.

Templates:
- card  : 1080x1080 (feed Instagram)
- story : 1080x1920 (stories / TikTok)
"""

from __future__ import annotations

import io
from datetime import datetime

from PIL import Image, ImageDraw

from ondilow_api.rendering.fonts import get_font
from ondilow_api.rendering.static_map import render_route_map
from ondilow_api.rendering.sticker import render_route_polyline

# Paleta Ondilow (dark)
BG       = (13, 17, 23)      # #0d1117
SURFACE  = (22, 27, 34)      # #161b22
BORDER   = (48, 54, 61)      # #30363d
ACCENT   = (47, 129, 247)    # #2f81f7
TEXT     = (230, 237, 243)   # #e6edf3
MUTED    = (139, 148, 158)   # #8b949e
SUCCESS  = (63, 185, 80)     # #3fb950
DANGER   = (248, 81, 73)     # #f85149

SPORT_COLOR = {
    "run": (47, 129, 247),
    "trail_run": (63, 185, 80),
    "bike": (227, 179, 65),
    "mtb": (240, 136, 62),
    "swim": (86, 182, 194),
    "open_water_swim": (86, 182, 194),
    "other": (139, 148, 158),
}


def _sport_color(sport: str) -> tuple:
    return SPORT_COLOR.get(sport, MUTED)


def _fmt_duration(s: int) -> str:
    h, rem = divmod(int(s), 3600)
    m, sec = divmod(rem, 60)
    if h > 0:
        return f"{h}h{m:02d}m"
    return f"{m}m{sec:02d}s"


def _fmt_dist(m: float | None) -> str:
    if not m:
        return "—"
    return f"{m/1000:.2f} km" if m >= 1000 else f"{m:.0f} m"


def _fmt_pace(spm: float | None) -> str:
    if not spm:
        return "—"
    m, s = divmod(int(spm), 60)
    return f"{m}:{s:02d}/km"


def _fmt_speed(kmh: float | None) -> str:
    if not kmh:
        return "—"
    return f"{kmh:.1f} km/h"


def _fmt_hr(hr: int | None) -> str:
    if not hr:
        return "—"
    return f"{hr} bpm"


def _stat_block(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    width: int,
    label: str,
    value: str,
) -> None:
    draw.text((x, y), label.upper(), font=get_font(22), fill=MUTED)
    draw.text((x, y + 30), value, font=get_font(44, bold=True), fill=TEXT)


def _header_bar(draw: ImageDraw.ImageDraw, width: int, sport: str, title: str, date_str: str) -> int:
    """Desenha barra de header; retorna a altura ocupada."""
    sc = _sport_color(sport)
    # Badge de esporte
    draw.rectangle([0, 0, width, 80], fill=(*sc, 255))
    sport_label = sport.replace("_", " ").title()
    draw.text((30, 18), sport_label, font=get_font(40, bold=True), fill=BG)
    # Data no canto direito
    draw.text((width - 250, 24), date_str, font=get_font(28), fill=(*BG, 180))
    # Titulo da atividade
    if title:
        draw.text((30, 88), title[:40], font=get_font(34), fill=MUTED)
        return 140
    return 100


def render_card(activity: dict, points: list[tuple[float, float]]) -> bytes:
    """Card 1080x1080."""
    W, H = 1080, 1080
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)

    sport = activity.get("sport", "other")
    title = activity.get("title") or ""
    start = activity.get("start_time", "")
    try:
        date_str = datetime.fromisoformat(start).strftime("%d/%m/%Y")
    except Exception:
        date_str = ""

    # Header
    header_h = _header_bar(draw, W, sport, title, date_str)

    # Mapa (metade superior)
    map_y = header_h
    map_h = 420
    map_img = render_route_map(points, W - 60, map_h)
    if map_img:
        map_img = map_img.resize((W - 60, map_h), Image.LANCZOS)
        # borda arredondada aproximada
        img.paste(map_img, (30, map_y))
    else:
        draw.rectangle([30, map_y, W - 30, map_y + map_h], fill=SURFACE, outline=BORDER)
        draw.text((W // 2 - 80, map_y + map_h // 2 - 20), "Sem GPS", font=get_font(32), fill=MUTED)

    # Stats grid (2 colunas x 3 linhas)
    stats_y = map_y + map_h + 30
    col_w = W // 2 - 30
    stats = [
        ("Distância", _fmt_dist(activity.get("distance_m"))),
        ("Duração", _fmt_duration(activity.get("duration_s") or 0)),
        ("Pace", _fmt_pace(activity.get("avg_pace_s_per_km"))),
        ("Velocidade", _fmt_speed(activity.get("avg_speed_kmh"))),
        ("FC Média", _fmt_hr(activity.get("avg_hr"))),
        ("Elevação", f"{activity.get('elevation_gain_m', 0) or 0:.0f} m" if activity.get("elevation_gain_m") else "—"),
    ]

    for i, (label, value) in enumerate(stats):
        col = i % 2
        row = i // 2
        x = 40 + col * col_w
        y = stats_y + row * 130
        # separador
        draw.rectangle([x - 10, y - 10, x + col_w - 20, y + 110], fill=SURFACE)
        _stat_block(draw, x, y, col_w, label, value)

    # Watermark
    draw.text((W - 180, H - 40), "Ondilow", font=get_font(26, bold=True), fill=(*ACCENT, 180))

    return _to_bytes(img)


def render_story(activity: dict, points: list[tuple[float, float]]) -> bytes:
    """Story 1080x1920."""
    W, H = 1080, 1920
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)

    sport = activity.get("sport", "other")
    title = activity.get("title") or ""
    start = activity.get("start_time", "")
    try:
        date_str = datetime.fromisoformat(start).strftime("%d/%m/%Y")
    except Exception:
        date_str = ""

    # Header grande
    sc = _sport_color(sport)
    draw.rectangle([0, 0, W, 140], fill=(*sc, 255))
    sport_label = sport.replace("_", " ").title()
    draw.text((50, 30), sport_label, font=get_font(60, bold=True), fill=BG)
    draw.text((W - 320, 52), date_str, font=get_font(40), fill=(*BG, 180))

    if title:
        draw.text((50, 152), title[:35], font=get_font(48), fill=MUTED)

    # Mapa central grande
    map_top = 220
    map_h = 900
    map_img = render_route_map(points, W - 80, map_h)
    if map_img:
        map_img = map_img.resize((W - 80, map_h), Image.LANCZOS)
        img.paste(map_img, (40, map_top))
    else:
        draw.rectangle([40, map_top, W - 40, map_top + map_h], fill=SURFACE, outline=BORDER)
        draw.text((W // 2 - 60, map_top + map_h // 2), "Sem GPS", font=get_font(40), fill=MUTED)

    # Stats (3x2 grid)
    stats_y = map_top + map_h + 40
    col_w = W // 2 - 40
    stats = [
        ("Distância", _fmt_dist(activity.get("distance_m"))),
        ("Duração", _fmt_duration(activity.get("duration_s") or 0)),
        ("Pace", _fmt_pace(activity.get("avg_pace_s_per_km"))),
        ("FC Média", _fmt_hr(activity.get("avg_hr"))),
        ("Elevação", f"{activity.get('elevation_gain_m') or 0:.0f} m" if activity.get("elevation_gain_m") else "—"),
        ("Velocidade", _fmt_speed(activity.get("avg_speed_kmh"))),
    ]

    for i, (label, value) in enumerate(stats):
        col = i % 2
        row = i // 2
        x = 50 + col * col_w
        y = stats_y + row * 160
        draw.rectangle([x - 10, y - 10, x + col_w - 30, y + 130], fill=SURFACE)
        _stat_block(draw, x, y, col_w, label, value)

    # Watermark
    draw.text((W - 220, H - 50), "Ondilow", font=get_font(36, bold=True), fill=(*ACCENT, 200))

    return _to_bytes(img)


def render_photo_overlay(photo_bytes: bytes, activity: dict) -> bytes:
    """Sobrepoe stats em uma foto enviada pelo usuario."""
    photo = Image.open(io.BytesIO(photo_bytes)).convert("RGB")

    # Redimensiona para story (1080x1920) mantendo proporcao
    photo = photo.resize((1080, 1920), Image.LANCZOS)

    # Gradiente escuro na parte inferior (para legibilidade dos stats)
    overlay = Image.new("RGBA", photo.size, (0, 0, 0, 0))
    draw_ov = ImageDraw.Draw(overlay)
    for i in range(400):
        alpha = int(200 * (i / 400))
        draw_ov.rectangle([0, 1920 - 400 + i, 1080, 1920 - 400 + i + 1], fill=(0, 0, 0, alpha))

    photo_rgba = photo.convert("RGBA")
    composite = Image.alpha_composite(photo_rgba, overlay).convert("RGB")

    draw = ImageDraw.Draw(composite)
    sport = activity.get("sport", "other")
    sc = _sport_color(sport)

    # Stats na parte inferior
    stats = [
        ("Distância", _fmt_dist(activity.get("distance_m"))),
        ("Duração", _fmt_duration(activity.get("duration_s") or 0)),
        ("Pace", _fmt_pace(activity.get("avg_pace_s_per_km"))),
        ("FC Média", _fmt_hr(activity.get("avg_hr"))),
    ]

    y = 1920 - 360
    for i, (label, value) in enumerate(stats):
        col = i % 2
        row = i // 2
        x = 50 + col * 490
        draw.text((x, y + row * 140), label.upper(), font=get_font(24), fill=(*MUTED, 255))
        draw.text((x, y + row * 140 + 32), value, font=get_font(52, bold=True), fill=TEXT)

    # Badge de esporte
    draw.rectangle([0, 0, 1080, 90], fill=(*sc, 220))
    draw.text((40, 18), sport.replace('_', ' ').title(), font=get_font(50, bold=True), fill=BG)
    draw.text((1080 - 220, 28), "Ondilow", font=get_font(40, bold=True), fill=(*BG, 220))

    return _to_bytes(composite)


def _sticker_stats(activity: dict) -> list[tuple[str, str]]:
    stats = [("Distância", _fmt_dist(activity.get("distance_m"))), ("Duração", _fmt_duration(activity.get("duration_s") or 0))]
    if activity.get("avg_pace_s_per_km"):
        stats.append(("Pace", _fmt_pace(activity.get("avg_pace_s_per_km"))))
    elif activity.get("avg_speed_kmh"):
        stats.append(("Velocidade", _fmt_speed(activity.get("avg_speed_kmh"))))
    if activity.get("avg_hr"):
        stats.append(("FC Média", _fmt_hr(activity.get("avg_hr"))))
    return stats


def _sticker_watermark(draw: ImageDraw.ImageDraw, W: int, H: int, sc: tuple) -> None:
    draw.text((W - 170, H - 44), "Ondilow", font=get_font(24, bold=True), fill=(*sc, 200))


def render_sticker(activity: dict, points: list[tuple[float, float]], layout: str = "full") -> bytes:
    """Sticker com fundo transparente (PNG RGBA) para sobrepor em qualquer foto.

    Layouts:
    - route : so a linha da rota, sem stats, sem fundo.
    - stats : so um badge compacto de estatisticas, sem rota.
    - full  : rota (topo) + grade de stats (painéis semi-transparentes) abaixo.
    """
    W, H = 1080, 1080
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    sport = activity.get("sport", "other")
    sc = _sport_color(sport)
    stats = _sticker_stats(activity)

    if layout == "route":
        route = render_route_polyline(points, W - 80, H - 80, sc)
        if route:
            img.alpha_composite(route, (40, 40))
        _sticker_watermark(draw, W, H, sc)
        return _to_bytes(img)

    if layout == "stats":
        panel_h = 90 * len(stats) + 40
        panel_y = (H - panel_h) // 2
        draw.rounded_rectangle([60, panel_y, W - 60, panel_y + panel_h], radius=24, fill=(*SURFACE, 210), outline=(*sc, 160), width=2)
        draw.rectangle([60, panel_y, 72, panel_y + panel_h], fill=(*sc, 255))
        y = panel_y + 20
        for label, value in stats:
            draw.text((100, y), label.upper(), font=get_font(22), fill=(*MUTED, 255))
            draw.text((100, y + 28), value, font=get_font(46, bold=True), fill=(*TEXT, 255))
            y += 90
        _sticker_watermark(draw, W, H, sc)
        return _to_bytes(img)

    # layout == "full"
    route_h = 620
    route = render_route_polyline(points, W - 80, route_h, sc)
    if route:
        img.alpha_composite(route, (40, 20))
    else:
        draw.text((W // 2 - 70, route_h // 2), "Sem GPS", font=get_font(32), fill=(*MUTED, 255))

    stats_y = route_h + 60
    col_w = W // 2 - 30
    for i, (label, value) in enumerate(stats):
        col = i % 2
        row = i // 2
        x = 40 + col * col_w
        y = stats_y + row * 130
        draw.rounded_rectangle([x - 10, y - 10, x + col_w - 20, y + 110], radius=16, fill=(*SURFACE, 150))
        _stat_block(draw, x, y, col_w, label, value)

    _sticker_watermark(draw, W, H, sc)
    return _to_bytes(img)


def _to_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()
