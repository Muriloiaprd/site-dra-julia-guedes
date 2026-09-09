from datetime import UTC, datetime

from ondilow_api.parsers.base import NormalizedActivity, NormalizedPoint
from ondilow_api.services.import_service import (
    _avg_pace,
    _avg_speed,
    _derive_summary,
    _downsample,
    _similar_distance,
)


def _points(n: int, step: int = 1) -> list[NormalizedPoint]:
    return [NormalizedPoint(elapsed_time_s=i * step, hr=100 + i) for i in range(n)]


def test_downsample_keeps_one_per_bucket_and_last():
    pts = _points(10, step=1)  # 0..9 segundos
    kept = _downsample(pts, seconds=3)
    # buckets: {0,1,2}->0, {3,4,5}->3, {6,7,8}->6, {9}->9  = 4, e ultimo (9) incluso
    assert [p.elapsed_time_s for p in kept] == [0, 3, 6, 9]


def test_downsample_noop_when_seconds_le_1():
    pts = _points(5)
    assert _downsample(pts, seconds=1) is pts


def test_derive_summary_fills_hr_and_distance():
    pts = [
        NormalizedPoint(elapsed_time_s=0, hr=120, distance_m=0.0, altitude_m=100.0),
        NormalizedPoint(elapsed_time_s=30, hr=140, distance_m=200.0, altitude_m=110.0),
        NormalizedPoint(elapsed_time_s=60, hr=160, distance_m=500.0, altitude_m=105.0),
    ]
    norm = NormalizedActivity(
        sport="run", start_time=datetime(2026, 9, 1, tzinfo=UTC), duration_s=60,
        source="gpx", points=pts,
    )
    _derive_summary(norm)
    assert norm.distance_m == 500.0
    assert norm.avg_hr == 140
    assert norm.max_hr == 160
    assert norm.elevation_gain_m == 10.0  # subiu 10, desceu 5
    assert norm.elevation_loss_m == 5.0


def test_avg_pace_and_speed():
    norm = NormalizedActivity(
        sport="run", start_time=datetime(2026, 9, 1, tzinfo=UTC), duration_s=300,
        source="gpx", distance_m=1000.0,
    )
    assert _avg_pace(norm) == 300.0  # 300s / 1km
    assert _avg_speed(norm) == 12.0  # 1000m em 300s = 3.333 m/s = 12 km/h


def test_avg_pace_none_for_bike():
    norm = NormalizedActivity(
        sport="bike", start_time=datetime(2026, 9, 1, tzinfo=UTC), duration_s=300,
        source="gpx", distance_m=1000.0,
    )
    assert _avg_pace(norm) is None


def test_similar_distance():
    assert _similar_distance(10000.0, 10050.0) is True  # 0.5% diff
    assert _similar_distance(10000.0, 10200.0) is False  # 2% diff
    assert _similar_distance(None, None) is True
