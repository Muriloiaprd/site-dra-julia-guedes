"""Renderizador de rota com fundo transparente, sem tiles OSM (para stickers)."""

from __future__ import annotations

import math

from PIL import Image, ImageDraw


def render_route_polyline(
    points: list[tuple[float, float]],
    width: int,
    height: int,
    color: tuple[int, int, int],
    start_color: tuple[int, int, int] = (63, 185, 80),
    end_color: tuple[int, int, int] | None = None,
    line_width: int = 6,
    supersample: int = 4,
) -> Image.Image | None:
    """Desenha a rota (lat/lon) numa imagem RGBA transparente.

    Usa projecao equiretangular com correcao de cosseno da latitude, e
    supersampling (desenha maior, depois reduz com LANCZOS) para anti-aliasing,
    ja que ImageDraw.line nao suaviza nativamente.
    """
    if not points or len(points) < 2:
        return None

    end_color = end_color or color

    lats = [p[0] for p in points]
    lons = [p[1] for p in points]
    min_lat, max_lat = min(lats), max(lats)
    min_lon, max_lon = min(lons), max(lons)

    lat_mid = (min_lat + max_lat) / 2
    lon_scale = math.cos(math.radians(lat_mid))

    span_lat = max_lat - min_lat
    span_lon = (max_lon - min_lon) * lon_scale
    span_lat = span_lat or 1e-6
    span_lon = span_lon or 1e-6

    ss = max(1, supersample)
    W, H = width * ss, height * ss
    margin = 0.08
    usable_w = W * (1 - 2 * margin)
    usable_h = H * (1 - 2 * margin)

    scale = min(usable_w / span_lon, usable_h / span_lat)
    draw_w = span_lon * scale
    draw_h = span_lat * scale
    offset_x = (W - draw_w) / 2
    offset_y = (H - draw_h) / 2

    def project(lat: float, lon: float) -> tuple[float, float]:
        x = offset_x + (lon - min_lon) * lon_scale * scale
        y = offset_y + (max_lat - lat) * scale
        return (x, y)

    projected = [project(lat, lon) for lat, lon in points]

    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.line(projected, fill=(*color, 255), width=line_width * ss, joint="curve")

    marker_r = 9 * ss
    sx, sy = projected[0]
    draw.ellipse([sx - marker_r, sy - marker_r, sx + marker_r, sy + marker_r], fill=(*start_color, 255))
    ex, ey = projected[-1]
    draw.ellipse([ex - marker_r, ey - marker_r, ex + marker_r, ey + marker_r], fill=(*end_color, 255))

    return img.resize((width, height), Image.LANCZOS)
