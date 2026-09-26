"""Parser de arquivos GPX (formato universal, baseado em XML)."""

from datetime import UTC

import gpxpy

from kactus_api.parsers.base import NormalizedActivity, NormalizedPoint, ParserError
from kactus_api.parsers.sports import normalize_sport

# extensoes comuns (garmin/strava) carregam hr/cadence/power num namespace proprio
_EXT_KEYS = {
    "hr": ("hr", "heartrate"),
    "cadence": ("cad", "cadence"),
    "power": ("power", "watts"),
    "temperature": ("atemp", "temp"),
}


def parse_gpx(content: bytes) -> NormalizedActivity:
    try:
        gpx = gpxpy.parse(content.decode("utf-8", errors="replace"))
    except Exception as e:  # noqa: BLE001
        raise ParserError(f"GPX invalido: {e}") from e

    points: list[NormalizedPoint] = []
    start_time = None
    last_time = None
    total_distance = 0.0
    prev = None
    sport_raw = None

    for track in gpx.tracks:
        if track.type and sport_raw is None:
            sport_raw = track.type
        for segment in track.segments:
            for pt in segment.points:
                if pt.time is None:
                    continue
                t = pt.time.astimezone(UTC)
                if start_time is None:
                    start_time = t
                last_time = t

                if prev is not None:
                    total_distance += pt.distance_2d(prev) or 0.0
                prev = pt

                ext = _read_extensions(pt)
                points.append(
                    NormalizedPoint(
                        elapsed_time_s=int((t - start_time).total_seconds()),
                        lat=pt.latitude,
                        lon=pt.longitude,
                        altitude_m=pt.elevation,
                        distance_m=round(total_distance, 2),
                        hr=ext.get("hr"),
                        cadence=ext.get("cadence"),
                        power_w=ext.get("power"),
                        temperature_c=ext.get("temperature"),
                    )
                )

    if start_time is None or not points:
        raise ParserError("GPX sem pontos com timestamp")

    duration = int((last_time - start_time).total_seconds())
    elevation = gpx.get_uphill_downhill()

    return NormalizedActivity(
        sport=normalize_sport(sport_raw),
        start_time=start_time,
        duration_s=duration,
        source="gpx",
        points=points,
        distance_m=round(total_distance, 2),
        elevation_gain_m=round(elevation.uphill, 2) if elevation else None,
        elevation_loss_m=round(elevation.downhill, 2) if elevation else None,
        title=gpx.tracks[0].name if gpx.tracks else None,
    )


def _read_extensions(pt) -> dict[str, int | float | None]:
    out: dict[str, int | float | None] = {}
    for ext in pt.extensions:
        _walk_extension(ext, out)
    return out


def _walk_extension(node, out: dict) -> None:
    tag = _localname(node.tag).lower()
    text = (node.text or "").strip()
    if text:
        for field_name, keys in _EXT_KEYS.items():
            if tag in keys and field_name not in out:
                try:
                    value = float(text)
                    out[field_name] = int(value) if field_name != "temperature" else value
                except ValueError:
                    pass
    for child in node:
        _walk_extension(child, out)


def _localname(tag: str) -> str:
    return tag.split("}")[-1] if "}" in tag else tag
