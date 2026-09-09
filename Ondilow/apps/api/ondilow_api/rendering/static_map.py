"""Gera mapa PNG da rota usando staticmap + tiles OSM (sem custo)."""

from __future__ import annotations

import io
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from PIL.Image import Image as PILImage

# Downsample para mapa: max 500 pontos (staticmap e lento com muitos)
_MAX_MAP_POINTS = 500


def render_route_map(
    points: list[tuple[float, float]],
    width: int = 600,
    height: int = 400,
) -> "PILImage | None":
    """Retorna imagem PIL com o mapa da rota ou None se falhar."""
    if not points or len(points) < 2:
        return None

    try:
        from staticmap import CircleMarker, Line, StaticMap

        # Downsample se necessario
        if len(points) > _MAX_MAP_POINTS:
            step = len(points) // _MAX_MAP_POINTS
            pts = points[::step]
            if pts[-1] != points[-1]:
                pts.append(points[-1])
        else:
            pts = list(points)

        coords = [[lon, lat] for lat, lon in pts]

        m = StaticMap(width, height, padding_x=10, padding_y=10)
        m.add_line(Line(coords, "#2f81f7", 3))

        # Marcador verde no inicio, vermelho no fim
        m.add_marker(CircleMarker(coords[0], "#3fb950", 10))
        m.add_marker(CircleMarker(coords[-1], "#f85149", 10))

        return m.render()

    except Exception:
        return None


def render_route_map_bytes(
    points: list[tuple[float, float]],
    width: int = 600,
    height: int = 400,
) -> bytes | None:
    """Retorna bytes PNG ou None se falhar."""
    img = render_route_map(points, width, height)
    if img is None:
        return None
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
