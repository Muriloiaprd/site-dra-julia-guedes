from types import SimpleNamespace

import pytest

from ondilow_api.metrics.basic import (
    PointLike,
    compute_splits,
    default_hr_zones,
    karvonen_hr_zones,
    resolve_hr_zones,
)
from ondilow_api.metrics.derived import (
    flat_equivalent,
    gap_pace,
    grade_factor,
    hr_decoupling_pct,
    step_cadence_factor,
)
from ondilow_api.parsers.sports import normalize_sport
from ondilow_api.services.derived_metrics import (
    DERIVED_VERSION,
    apply_derived_metrics,
    normalize_step_cadence,
)


def _track(n: int, *, step_m: float = 10.0, dt: int = 3, grade: float = 0.0, hr=None, alt0: float = 100.0):
    """n pontos a cada `step_m` metros e `dt` segundos, em inclinacao constante."""
    pts = []
    for i in range(n):
        pts.append(
            PointLike(
                elapsed_time_s=i * dt,
                distance_m=i * step_m,
                altitude_m=alt0 + i * step_m * grade,
                hr=hr(i) if callable(hr) else hr,
            )
        )
    return pts


# ── cadencia ────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("sport", "avg", "points", "expected"),
    [
        ("run", 80.6, [], 2),          # por perna (FIT da Garmin)
        ("run", 165.0, [], 1),         # ja em passos/min
        ("walk", 59.0, [], 2),         # caminhada tambem vem por perna
        ("trail_run", None, [82, 84, 0, None, 86], 2),  # sem media: usa a mediana dos pontos
        ("run", None, [None, 0], 1),   # sem dado nenhum: nao mexe
        ("bike", 85.0, [], 1),         # ciclismo e rpm do pedal, nunca dobra
        ("other", 60.0, [], 1),
    ],
)
def test_step_cadence_factor(sport, avg, points, expected):
    assert step_cadence_factor(sport, avg, points) == expected


def _activity(sport="run", avg_cadence=80.0, points=(), laps=(), avg_pace=None, duration_s=None, moving_time_s=None):
    return SimpleNamespace(
        sport=sport,
        avg_cadence=avg_cadence,
        avg_pace_s_per_km=avg_pace,
        duration_s=duration_s,
        moving_time_s=moving_time_s,
        points=list(points),
        laps=list(laps),
        gap_pace_s_per_km=None,
        hr_decoupling_pct=None,
        derived_version=None,
    )


def test_normalize_step_cadence_doubles_summary_laps_and_points():
    act = _activity(
        avg_cadence=80.5,
        points=[SimpleNamespace(cadence=80), SimpleNamespace(cadence=None)],
        laps=[SimpleNamespace(avg_cadence=81), SimpleNamespace(avg_cadence=None)],
    )
    assert normalize_step_cadence(act) == 2
    assert act.avg_cadence == 161.0
    assert [lap.avg_cadence for lap in act.laps] == [162, None]
    assert [p.cadence for p in act.points] == [160, None]


def test_normalize_step_cadence_can_leave_points_to_the_caller():
    act = _activity(points=[SimpleNamespace(cadence=80)])
    assert normalize_step_cadence(act, update_points=False) == 2
    assert act.points[0].cadence == 80


def test_normalize_step_cadence_leaves_bike_alone():
    act = _activity(sport="bike", avg_cadence=85.0)
    assert normalize_step_cadence(act) == 1
    assert act.avg_cadence == 85.0


# ── GAP ─────────────────────────────────────────────────────────────────────


def test_grade_factor_is_one_on_flat_and_grows_uphill():
    assert grade_factor(0.0) == pytest.approx(1.0)
    assert grade_factor(0.05) > 1.2
    assert grade_factor(0.10) > grade_factor(0.05)
    # descida leve custa menos que o plano
    assert grade_factor(-0.05) < 1.0


def test_grade_factor_clamps_absurd_grades():
    # altitude errada nao pode virar fator infinito
    assert grade_factor(2.0) == grade_factor(0.30)
    assert grade_factor(-2.0) == grade_factor(-0.30)


def test_gap_on_flat_equals_real_pace():
    pts = _track(200)
    assert gap_pace(300.0, pts) == pytest.approx(300.0)


def test_gap_uphill_is_faster_than_real_pace():
    pts = _track(200, grade=0.06)
    gap = gap_pace(360.0, pts)
    assert gap is not None and gap < 360.0


def test_gap_downhill_is_slower_than_real_pace():
    pts = _track(200, grade=-0.06)
    gap = gap_pace(270.0, pts)
    assert gap is not None and gap > 270.0


def test_gap_ignores_small_altitude_noise_inside_the_window():
    # +-2m de ruido a cada ponto (10m): ponto a ponto seria +-20% de inclinacao
    pts = _track(200)
    for i, p in enumerate(pts):
        p.altitude_m += 2.0 if i % 2 else -2.0
    real, flat = flat_equivalent(pts)
    # sem a media movel isso dava 1,09
    assert flat / real == pytest.approx(1.0, abs=0.01)


def test_gap_needs_altitude_and_pace():
    no_alt = [PointLike(elapsed_time_s=i * 3, distance_m=i * 10.0) for i in range(50)]
    assert gap_pace(300.0, no_alt) is None
    assert gap_pace(None, _track(50)) is None


def test_splits_carry_gap():
    pts = _track(300, grade=0.05)  # 3km de subida constante
    splits = compute_splits(pts)
    assert splits
    assert all(s.gap_pace_s_per_km is not None and s.gap_pace_s_per_km < s.pace_s_per_km for s in splits)


# ── deriva cardiaca ─────────────────────────────────────────────────────────


def test_decoupling_zero_when_hr_is_steady():
    pts = _track(800, hr=150)  # 40 min, mesmo ritmo, mesma FC
    assert hr_decoupling_pct(pts) == pytest.approx(0.0, abs=0.01)


def test_decoupling_positive_when_hr_drifts_up_at_same_pace():
    pts = _track(800, hr=lambda i: 140 + i * 20 // 800)  # FC sobe 140 -> 160
    d = hr_decoupling_pct(pts)
    assert d is not None and d > 3


def test_decoupling_needs_thirty_minutes():
    pts = _track(400, hr=150)  # 20 min
    assert hr_decoupling_pct(pts) is None


def test_decoupling_needs_hr():
    assert hr_decoupling_pct(_track(800)) is None


# ── servico ────────────────────────────────────────────────────────────────


def _pt(i, *, step_m=10.0, dt=3, grade=0.0, hr=150):
    return SimpleNamespace(elapsed_time_s=i * dt, distance_m=i * step_m, altitude_m=100 + i * step_m * grade, hr=hr, cadence=None)


def test_apply_derived_metrics_fills_run_activity_and_laps():
    points = [_pt(i, grade=0.04) for i in range(800)]
    lap = SimpleNamespace(start_elapsed_s=0, duration_s=300, distance_m=1000.0, avg_pace_s_per_km=None, gap_pace_s_per_km=None)
    act = _activity(points=points, laps=[lap], avg_pace=300.0)

    apply_derived_metrics(act)

    assert act.gap_pace_s_per_km is not None and act.gap_pace_s_per_km < 300.0
    assert act.hr_decoupling_pct == pytest.approx(0.0, abs=0.5)
    assert lap.avg_pace_s_per_km == 300.0
    assert lap.gap_pace_s_per_km is not None and lap.gap_pace_s_per_km < 300.0
    assert act.derived_version == DERIVED_VERSION


def test_apply_derived_metrics_skips_decoupling_for_run_with_long_stops():
    # caso real: 27 de 45 min em movimento dava deriva de -134%
    act = _activity(points=[_pt(i) for i in range(900)], avg_pace=300.0, duration_s=2714, moving_time_s=1646)
    apply_derived_metrics(act)
    assert act.hr_decoupling_pct is None
    assert act.gap_pace_s_per_km is not None  # GAP continua valendo


def test_apply_derived_metrics_ignores_tiny_and_standing_laps():
    # casos reais do backfill: volta de 2m em 40s estourava a coluna numeric(6,2)
    tiny = SimpleNamespace(start_elapsed_s=0, duration_s=40, distance_m=2.0, avg_pace_s_per_km=None, gap_pace_s_per_km=None)
    standing = SimpleNamespace(start_elapsed_s=0, duration_s=600, distance_m=100.0, avg_pace_s_per_km=None, gap_pace_s_per_km=None)
    act = _activity(points=[_pt(i) for i in range(300)], laps=[tiny, standing], avg_pace=300.0)

    apply_derived_metrics(act)

    assert tiny.avg_pace_s_per_km is None and tiny.gap_pace_s_per_km is None
    assert standing.avg_pace_s_per_km is None and standing.gap_pace_s_per_km is None


def test_apply_derived_metrics_skips_gap_for_bike():
    act = _activity(sport="bike", points=[_pt(i) for i in range(800)], avg_pace=120.0)
    apply_derived_metrics(act)
    assert act.gap_pace_s_per_km is None
    assert act.hr_decoupling_pct is None
    assert act.derived_version == DERIVED_VERSION


# ── zonas e modalidades ───────────────────────────────────────────────────────


def test_karvonen_zones_use_heart_rate_reserve():
    zones = karvonen_hr_zones(190, 48)  # reserva 142
    assert zones["z1"] == [0, 133]      # 48 + 0.60*142 = 133.2
    assert zones["z2"] == [133, 147]
    assert zones["z4"] == [162, 176]
    assert zones["z5"] == [176, 191]


def test_resolve_hr_zones_priority():
    saved = {"z1": [0, 1], "z2": [1, 2], "z3": [2, 3], "z4": [3, 4], "z5": [4, 5]}
    assert resolve_hr_zones(SimpleNamespace(hr_zones=saved, max_hr=190, resting_hr=48)) == saved
    assert resolve_hr_zones(SimpleNamespace(hr_zones=None, max_hr=190, resting_hr=48)) == karvonen_hr_zones(190, 48)
    assert resolve_hr_zones(SimpleNamespace(hr_zones=None, max_hr=190, resting_hr=None)) == default_hr_zones(190)
    assert resolve_hr_zones(SimpleNamespace(hr_zones=None, max_hr=None, resting_hr=48)) is None
    assert resolve_hr_zones(None) is None


@pytest.mark.parametrize(
    ("raw", "sub", "expected"),
    [
        ("walking", "generic", "walk"),
        ("training", "strength_training", "strength"),
        ("training", "cardio_training", "other"),
        ("fitness_equipment", "elliptical", "other"),
        ("training", "pilates", "pilates"),
        ("running", "generic", "run"),
    ],
)
def test_normalize_sport_complementary_activities(raw, sub, expected):
    assert normalize_sport(raw, sub) == expected
