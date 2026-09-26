from pathlib import Path

import pytest

from kactus_api.parsers import parse_file
from kactus_api.parsers.base import ParserError
from kactus_api.parsers.dispatch import UnsupportedFormatError
from kactus_api.parsers.sports import normalize_sport

FIXTURES = Path(__file__).parent / "fixtures"


def _read(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


def test_gpx_parsing():
    (act,) = parse_file("sample_run.gpx", _read("sample_run.gpx"))
    assert act.sport == "run"
    assert act.source == "gpx"
    assert act.duration_s == 90
    assert len(act.points) == 4
    assert act.points[0].hr == 120
    assert act.points[0].cadence == 82
    assert act.distance_m and act.distance_m > 0
    # avg_hr/max_hr sao derivados no import_service, nao no parser
    assert act.elevation_gain_m and act.elevation_gain_m > 0


def test_tcx_parsing():
    (act,) = parse_file("sample_bike.tcx", _read("sample_bike.tcx"))
    assert act.sport == "bike"
    assert act.source == "tcx"
    assert len(act.points) == 3
    assert act.points[0].power_w == 180
    assert act.points[-1].distance_m == 750.0
    assert len(act.laps) == 1
    assert act.laps[0].avg_hr == 140
    assert act.laps[0].distance_m == 750.0


def test_csv_parsing_multiple_activities():
    acts = parse_file("sample_history.csv", _read("sample_history.csv"))
    assert len(acts) == 3
    run, swim, bike = acts
    assert run.sport == "run"
    assert run.duration_s == 1800
    assert run.distance_m == 6000
    assert run.avg_hr == 148
    assert swim.sport == "swim"
    assert bike.sport == "bike"
    assert bike.duration_s == 4800


def test_dispatch_sniffs_without_extension():
    (act,) = parse_file("no_ext_file", _read("sample_run.gpx"))
    assert act.sport == "run"


def test_unsupported_format():
    with pytest.raises(UnsupportedFormatError):
        parse_file("foo.txt", b"conteudo qualquer sem formato")


def test_invalid_gpx_raises():
    with pytest.raises(ParserError):
        parse_file("bad.gpx", b"<gpx>quebrado")


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("running", "run"),
        ("Biking", "bike"),
        ("lap_swimming", "swim"),
        ("Mountain Biking", "mtb"),
        ("open_water_swimming", "open_water_swim"),
        ("xpto", "other"),
        (None, "other"),
    ],
)
def test_sport_normalization(raw, expected):
    assert normalize_sport(raw) == expected
