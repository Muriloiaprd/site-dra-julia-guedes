from datetime import UTC, datetime
from types import SimpleNamespace

from kactus_api.metrics.load import compute_tss
from kactus_api.parsers.base import NormalizedActivity, NormalizedPoint, compute_moving_time_s
from kactus_api.services.import_service import resolve_moving_time


def _run(*segments: tuple[int, float], dt: int = 1, lat0: float = -23.5) -> list[NormalizedPoint]:
    """Pontos a cada `dt` s; cada segmento e (duracao em s, velocidade em m/s), andando pro norte."""
    points = [NormalizedPoint(elapsed_time_s=0, lat=lat0, lon=-46.6, distance_m=0.0)]
    t, dist = 0, 0.0
    for duration, speed in segments:
        for _ in range(0, duration, dt):
            t += dt
            dist += speed * dt
            points.append(NormalizedPoint(elapsed_time_s=t, lat=lat0 + dist / 111_195, lon=-46.6, distance_m=dist))
    return points


def test_running_without_stops_is_all_moving():
    assert compute_moving_time_s(_run((600, 3.0)), "run") == 600


def test_stop_in_the_middle_is_discarded():
    # 5 min correndo, 2 min parado no semaforo, 5 min correndo
    moving = compute_moving_time_s(_run((300, 3.0), (120, 0.0), (300, 3.0)), "run")
    # a janela de 10 s arrasta alguns segundos nas bordas da parada
    assert 590 <= moving <= 615


def test_gps_jitter_while_stopped_does_not_count():
    points = _run((300, 3.0))
    t = points[-1].elapsed_time_s
    lat = points[-1].lat
    for i in range(1, 121):  # 2 min parado, GPS tremendo ~3 m pra la e pra ca
        jitter = (3 if i % 2 else -3) / 111_195
        points.append(NormalizedPoint(elapsed_time_s=t + i, lat=lat + jitter, lon=-46.6, distance_m=None))
    moving = compute_moving_time_s(points, "run")
    assert moving <= 310


def test_pause_gap_without_displacement_is_a_pause():
    points = _run((300, 3.0))
    last = points[-1]
    # auto-pause: 3 min sem ponto, retoma no mesmo lugar
    points.append(NormalizedPoint(elapsed_time_s=last.elapsed_time_s + 180, lat=last.lat, lon=last.lon, distance_m=last.distance_m))
    assert compute_moving_time_s(points, "run") == 300


def test_sparse_recording_with_displacement_is_movement():
    # modo economia: um ponto por minuto, mas correndo
    assert compute_moving_time_s(_run((600, 3.0), dt=60), "run") == 600


def test_watch_speed_wins_over_position():
    points = _run((60, 3.0))
    for p in points[31:]:
        p.speed_ms = 0.0  # o relogio diz que parou
    assert compute_moving_time_s(points, "run") == 30


def test_bike_uses_higher_threshold():
    points = _run((300, 0.8))  # 2,9 km/h: andando com a bike, nao pedalando
    assert compute_moving_time_s(points, "run") == 300
    assert compute_moving_time_s(points, "bike") == 0


def test_unknown_when_no_signal_or_sport_without_threshold():
    no_signal = [NormalizedPoint(elapsed_time_s=i) for i in range(100)]
    assert compute_moving_time_s(no_signal, "treadmill") is None
    assert compute_moving_time_s(_run((300, 1.2)), "swim") is None
    assert compute_moving_time_s(_run((300, 3.0)), "strength") is None


def _norm(points, moving_time_s=None) -> NormalizedActivity:
    return NormalizedActivity(
        sport="run",
        start_time=datetime(2026, 9, 27, 7, tzinfo=UTC),
        duration_s=points[-1].elapsed_time_s,
        source="gpx",
        points=points,
        moving_time_s=moving_time_s,
    )


def test_resolve_keeps_the_smaller_of_watch_timer_and_computed():
    points = _run((300, 3.0), (120, 0.0), (300, 3.0))
    # relogio sem auto-pause: timer = decorrido; o calculado desconta a parada
    norm = _norm(points, moving_time_s=720)
    resolve_moving_time(norm)
    assert norm.moving_time_s < 720

    # sem timer (GPX): passa a ter tempo em movimento
    gpx = _norm(_run((300, 3.0)))
    resolve_moving_time(gpx)
    assert gpx.moving_time_s == 300


def test_tss_uses_moving_time():
    base = dict(start_time=datetime(2026, 9, 27, tzinfo=UTC), sport="run", avg_hr=None, avg_power_w=None)
    elapsed_only = SimpleNamespace(**base, duration_s=3600, moving_time_s=None)
    with_stops = SimpleNamespace(**base, duration_s=3600, moving_time_s=1800)
    assert compute_tss(with_stops) == compute_tss(elapsed_only) / 2
