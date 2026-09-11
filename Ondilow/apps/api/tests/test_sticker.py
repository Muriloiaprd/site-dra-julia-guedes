from ondilow_api.rendering.sticker import render_route_polyline


def test_returns_none_for_insufficient_points():
    assert render_route_polyline([], 400, 400, (0, 0, 255)) is None
    assert render_route_polyline([(0.0, 0.0)], 400, 400, (0, 0, 255)) is None


def test_renders_transparent_rgba_with_visible_line():
    # quadrado simples ao redor de sao paulo
    points = [
        (-23.55, -46.63),
        (-23.55, -46.62),
        (-23.54, -46.62),
        (-23.54, -46.63),
    ]
    img = render_route_polyline(points, 300, 300, (47, 129, 247))
    assert img is not None
    assert img.mode == "RGBA"
    assert img.size == (300, 300)

    alpha = img.getchannel("A")
    lo, hi = alpha.getextrema()
    assert lo == 0  # fundo transparente
    assert hi == 255  # linha/marcadores opacos


def test_route_does_not_touch_canvas_edges():
    # margem de 8% deve manter a rota longe da borda
    points = [(-23.55, -46.63), (-23.54, -46.62)]
    img = render_route_polyline(points, 200, 200, (0, 255, 0), line_width=2, supersample=2)
    assert img is not None
    alpha = img.getchannel("A")
    # canto superior-esquerdo deve estar transparente (fora da margem)
    assert alpha.getpixel((0, 0)) == 0
