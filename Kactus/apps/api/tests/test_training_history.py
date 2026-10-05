"""Leitura dos 6 meses para o plano do objetivo: ultimo mes pesa mais, historico entra."""

from datetime import date, timedelta

from kactus_api.ai import goal_plan, training_history
from kactus_api.ai.training_history import Run, summarize

TODAY = date(2026, 10, 5)  # segunda


def _week(weeks_ago: int, day: int = 1) -> date:
    return training_history.week_start(TODAY) - timedelta(weeks=weeks_ago) + timedelta(days=day)


def test_recent_month_weighs_more_and_walks_do_not_count() -> None:
    runs = [
        Run(_week(1), 10.0, 3600),  # semana passada
        Run(_week(1, 5), 8.0, 2880),
        Run(_week(2), 9.0, 3240),
        Run(_week(3), 5.0, 1800),
        Run(_week(1, 3), 4.5, 4.5 * 725),  # caminhada a 12:05/km
    ]
    h = summarize(runs, TODAY, None, None)
    assert h.last_week_km == 18.0
    assert h.recent_km == round(18 * 0.4 + 9 * 0.3 + 5 * 0.2, 1)
    assert h.recent_longest == 10.0 and h.runs_per_week == 1.0


def test_history_peak_pause_and_pain() -> None:
    runs = [Run(_week(w), 50.0, 50 * 330) for w in range(20, 24)]  # 4 semanas fortes em abril
    runs += [Run(_week(1), 10.0, 3600, avg_hr=150, pain_level=3, pain_location="lombar")]
    h = summarize(runs, TODAY, 190, 56)
    assert h.peak_block_km == 50.0 and h.longest_6m == 50.0
    assert h.longest_pause >= 15  # junho a setembro parado
    assert h.pain == [(_week(1), 3, "lombar")]
    assert h.vdot_recent is not None and 30 < h.vdot_recent < 45


def test_blended_vdot_is_70_percent_recent_and_discounts_the_pause() -> None:
    h = summarize([Run(_week(30), 10, 3000)], TODAY, None, None)
    paused = sum(1 for w in h.weeks if w.km < training_history.PAUSE_KM)
    record = (6645.0, 21097, TODAY - timedelta(days=130))  # meia em 1:50:45
    v = training_history.blended_vdot(36.0, [record], h, TODAY)
    hist = goal_plan.estimate_vdot(6645, 21097) * (1 - min(0.12, 0.01 * paused))
    assert v == round(0.7 * 36.0 + 0.3 * hist, 1)
    assert training_history.blended_vdot(None, [], h, TODAY) is None
    old = (1400.0, 5000, TODAY - timedelta(days=500))  # recorde velho nao conta
    assert training_history.blended_vdot(36.0, [old], h, TODAY) == 36.0


def test_preferred_days_from_memories() -> None:
    assert training_history.preferred_days(["Treina nas terças, quintas e sábados"]) == [1, 3, 5]
    assert training_history.preferred_days(["Não treino às quartas"]) == []


def test_layout_puts_long_run_on_the_weekend_and_quality_far_from_it() -> None:
    assert goal_plan.layout_from_days([1, 3, 5], 3) == {1: "qualidade", 3: "leve", 5: "longao"}
    assert goal_plan.layout_from_days([0, 2, 6], 3) == {0: "leve", 2: "qualidade", 6: "longao"}
    assert goal_plan.layout_from_days([1, 3], 3) is None
    weeks = goal_plan.build_skeleton(
        TODAY, date(2027, 5, 29), 42.2, 3, 18.0, 10.0, layout={1: "qualidade", 3: "leve", 5: "longao"},
    )
    assert [(s.date.weekday(), s.role) for s in weeks[1].slots] == [(1, "qualidade"), (3, "leve"), (5, "longao")]
    assert weeks[-1].slots[-1].date == date(2027, 5, 29) and weeks[-1].slots[-1].role == "prova"


def test_pain_slows_the_ramp() -> None:
    fast = goal_plan.build_skeleton(TODAY, date(2027, 5, 30), 42.2, 3, 20.0, 10.0, ramp=0.10)
    slow = goal_plan.build_skeleton(TODAY, date(2027, 5, 30), 42.2, 3, 20.0, 10.0, ramp=0.08)
    assert slow[10].km < fast[10].km
