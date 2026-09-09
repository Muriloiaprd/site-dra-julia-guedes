"""Parser de arquivos TCX (Garmin Training Center XML)."""

from datetime import UTC, datetime
from xml.etree import ElementTree as ET

from ondilow_api.parsers.base import (
    NormalizedActivity,
    NormalizedLap,
    NormalizedPoint,
    ParserError,
)
from ondilow_api.parsers.sports import normalize_sport

_NS = {
    "tcx": "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2",
    "ext": "http://www.garmin.com/xmlschemas/ActivityExtension/v2",
}


def parse_tcx(content: bytes) -> NormalizedActivity:
    try:
        root = ET.fromstring(content)
    except ET.ParseError as e:
        raise ParserError(f"TCX invalido: {e}") from e

    activity = root.find(".//tcx:Activities/tcx:Activity", _NS)
    if activity is None:
        raise ParserError("TCX sem elemento Activity")

    sport_raw = activity.get("Sport")
    points: list[NormalizedPoint] = []
    laps: list[NormalizedLap] = []
    start_time: datetime | None = None
    last_time: datetime | None = None
    total_distance = 0.0

    for lap_idx, lap_el in enumerate(activity.findall("tcx:Lap", _NS)):
        lap_start = _parse_time(lap_el.get("StartTime"))
        if start_time is None and lap_start is not None:
            start_time = lap_start

        laps.append(
            NormalizedLap(
                lap_index=lap_idx,
                start_elapsed_s=(
                    int((lap_start - start_time).total_seconds())
                    if lap_start and start_time
                    else None
                ),
                duration_s=_to_int(_text(lap_el, "tcx:TotalTimeSeconds")),
                distance_m=_to_float(_text(lap_el, "tcx:DistanceMeters")),
                avg_hr=_to_int(_text(lap_el, "tcx:AverageHeartRateBpm/tcx:Value")),
                max_hr=_to_int(_text(lap_el, "tcx:MaximumHeartRateBpm/tcx:Value")),
            )
        )

        for tp in lap_el.findall("tcx:Track/tcx:Trackpoint", _NS):
            t = _parse_time(_text(tp, "tcx:Time"))
            if t is None:
                continue
            if start_time is None:
                start_time = t
            last_time = t

            dist = _to_float(_text(tp, "tcx:DistanceMeters"))
            if dist is not None:
                total_distance = dist

            points.append(
                NormalizedPoint(
                    elapsed_time_s=int((t - start_time).total_seconds()),
                    lat=_to_float(_text(tp, "tcx:Position/tcx:LatitudeDegrees")),
                    lon=_to_float(_text(tp, "tcx:Position/tcx:LongitudeDegrees")),
                    altitude_m=_to_float(_text(tp, "tcx:AltitudeMeters")),
                    distance_m=round(total_distance, 2) if dist is not None else None,
                    hr=_to_int(_text(tp, "tcx:HeartRateBpm/tcx:Value")),
                    cadence=_to_int(_text(tp, "tcx:Cadence")),
                    power_w=_to_int(_text(tp, ".//ext:Watts")),
                    speed_ms=_to_float(_text(tp, ".//ext:Speed")),
                )
            )

    if start_time is None or not points:
        raise ParserError("TCX sem trackpoints com timestamp")

    duration = int((last_time - start_time).total_seconds())

    return NormalizedActivity(
        sport=normalize_sport(sport_raw),
        start_time=start_time,
        duration_s=duration,
        source="tcx",
        points=points,
        laps=laps,
        distance_m=round(total_distance, 2) or None,
    )


def _text(el: ET.Element, path: str) -> str | None:
    found = el.find(path, _NS)
    return found.text if found is not None and found.text else None


def _to_float(v: str | None) -> float | None:
    if v is None:
        return None
    try:
        return float(v)
    except ValueError:
        return None


def _to_int(v: str | None) -> int | None:
    f = _to_float(v)
    return int(f) if f is not None else None


def _parse_time(v: str | None) -> datetime | None:
    if not v:
        return None
    try:
        return datetime.fromisoformat(v.replace("Z", "+00:00")).astimezone(UTC)
    except ValueError:
        return None
