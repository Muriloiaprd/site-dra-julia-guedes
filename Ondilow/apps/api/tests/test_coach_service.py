from datetime import date, timedelta

import pytest

from ondilow_api.ai.coach_service import (
    CoachPlanParseError,
    PlannedWorkoutItem,
    _same_sport_group,
    _validate_plan_items,
)


def _item(offset_days: int, **overrides) -> PlannedWorkoutItem:
    defaults = {
        "date": (date.today() + timedelta(days=offset_days)).isoformat(),
        "sport": "run",
        "title": "Treino",
        "description": "desc",
    }
    defaults.update(overrides)
    return PlannedWorkoutItem(**defaults)


def test_same_sport_group_groups_related_disciplines():
    assert _same_sport_group("run", "trail_run") is True
    assert _same_sport_group("bike", "mtb") is True
    assert _same_sport_group("swim", "open_water_swim") is True
    assert _same_sport_group("run", "bike") is False


def test_validate_plan_items_keeps_only_future_items_within_horizon():
    items = [
        _item(1),
        _item(7),
        _item(0),   # hoje -- fora da janela (deve ser > hoje)
        _item(8),   # fora do horizonte de 7 dias
        _item(-1),  # no passado
    ]
    valid = _validate_plan_items(items, days=7)
    assert {v.date for v in valid} == {
        (date.today() + timedelta(days=1)).isoformat(),
        (date.today() + timedelta(days=7)).isoformat(),
    }


def test_validate_plan_items_drops_negative_tss():
    items = [_item(1, target_tss=-10), _item(2, target_tss=50)]
    valid = _validate_plan_items(items, days=7)
    assert len(valid) == 1
    assert valid[0].target_tss == 50


def test_validate_plan_items_ignores_malformed_dates():
    items = [_item(1, date="not-a-date"), _item(2)]
    valid = _validate_plan_items(items, days=7)
    assert len(valid) == 1


def test_validate_plan_items_raises_when_nothing_survives():
    items = [_item(0), _item(-1)]  # todos fora da janela
    with pytest.raises(CoachPlanParseError):
        _validate_plan_items(items, days=7)
