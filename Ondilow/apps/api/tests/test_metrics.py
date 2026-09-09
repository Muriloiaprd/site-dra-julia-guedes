from ondilow_api.metrics.basic import (
    PointLike,
    best_efforts,
    compute_splits,
    default_hr_zones,
    hr_zone_distribution,
)


def _steady_run(total_m: float, pace_s_per_km: float, hr: int = 150, step_m: float = 100.0):
    """Serie sintetica: velocidade constante, 1 ponto a cada step_m."""
    speed = 1000 / pace_s_per_km  # m/s
    pts = []
    dist = 0.0
    while dist <= total_m + 0.001:
        pts.append(PointLike(elapsed_time_s=int(dist / speed), distance_m=round(dist, 1), hr=hr))
        dist += step_m
    return pts


def test_splits_steady_pace():
    # 3 km a 300 s/km (5:00/km)
    pts = _steady_run(3000, 300)
    splits = compute_splits(pts, 1000)
    assert len(splits) == 3
    for s in splits:
        assert abs(s.pace_s_per_km - 300) < 5  # ~5:00/km
        assert s.distance_m == 1000
        assert s.avg_hr == 150


def test_splits_partial_last():
    pts = _steady_run(2500, 300)
    splits = compute_splits(pts, 1000)
    assert len(splits) == 3
    assert splits[-1].distance_m < 1000  # ultimo trecho parcial (~500m)


def test_default_hr_zones():
    zones = default_hr_zones(200)
    assert zones["z1"] == [0, 120]
    assert zones["z2"] == [120, 140]
    assert zones["z5"] == [180, 202]


def test_hr_zone_distribution():
    # 60s em cada FC: 130 (z2), 150 (z3), 170 (z4) para max_hr=200
    zones = default_hr_zones(200)
    pts = []
    for i in range(61):
        pts.append(PointLike(elapsed_time_s=i, hr=130))
    for i in range(61, 122):
        pts.append(PointLike(elapsed_time_s=i, hr=150))
    buckets = hr_zone_distribution(pts, zones)
    z2 = next(b for b in buckets if b.zone == 2)
    z3 = next(b for b in buckets if b.zone == 3)
    assert z2.seconds > 0
    assert z3.seconds > 0
    assert abs(sum(b.percent for b in buckets) - 100.0) < 0.5


def test_best_efforts():
    # 5 km a 300 s/km -> melhor 1k ~300s, melhor 5k ~1500s
    pts = _steady_run(5000, 300, step_m=50)
    best = best_efforts(pts, [1000, 5000, 10000])
    assert 1000 in best
    assert 5000 in best
    assert 10000 not in best  # nao cobriu 10k
    assert abs(best[1000].duration_s - 300) < 15
    assert abs(best[5000].duration_s - 1500) < 30


def test_best_efforts_negative_split_is_faster():
    # primeiro km lento (360s), segundo km rapido (240s)
    pts = [PointLike(elapsed_time_s=0, distance_m=0.0)]
    for i in range(1, 11):
        pts.append(PointLike(elapsed_time_s=int(360 * i / 10), distance_m=i * 100.0))
    base = pts[-1].elapsed_time_s
    for i in range(1, 11):
        pts.append(PointLike(elapsed_time_s=int(base + 240 * i / 10), distance_m=1000 + i * 100.0))
    best = best_efforts(pts, [1000])
    assert best[1000].duration_s <= 360  # a melhor janela de 1k <= 360s
