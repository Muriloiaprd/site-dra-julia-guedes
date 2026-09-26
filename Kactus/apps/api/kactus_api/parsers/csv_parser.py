"""Parser de CSV para importar historico/treinos sem GPS.

Colunas obrigatorias: date, sport, duration (segundos ou HH:MM:SS), distance (m).
Colunas opcionais: avg_hr, max_hr, avg_power, calories, title, elevation_gain.
Separador virgula ou ponto-e-virgula, cabecalho case-insensitive.
"""

import csv
import io
from datetime import UTC, datetime

from kactus_api.parsers.base import NormalizedActivity, ParserError
from kactus_api.parsers.sports import normalize_sport

_REQUIRED = {"date", "sport", "duration", "distance"}


def parse_csv(content: bytes) -> list[NormalizedActivity]:
    text = content.decode("utf-8-sig", errors="replace")
    sample = text[:2048]
    delimiter = ";" if sample.count(";") > sample.count(",") else ","

    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    if reader.fieldnames is None:
        raise ParserError("CSV vazio ou sem cabecalho")

    header_map = {h.strip().lower(): h for h in reader.fieldnames}
    missing = _REQUIRED - set(header_map)
    if missing:
        raise ParserError(f"CSV faltando colunas obrigatorias: {sorted(missing)}")

    activities: list[NormalizedActivity] = []
    for line_no, row in enumerate(reader, start=2):
        try:
            activities.append(_row_to_activity(row, header_map))
        except (ValueError, KeyError) as e:
            raise ParserError(f"CSV linha {line_no}: {e}") from e

    if not activities:
        raise ParserError("CSV sem linhas de dados")
    return activities


def _row_to_activity(row: dict, hm: dict) -> NormalizedActivity:
    def val(key: str) -> str | None:
        raw = row.get(hm[key]) if key in hm else None
        return raw.strip() if raw and raw.strip() else None

    start = _parse_date(val("date"))
    duration = _parse_duration(val("duration"))

    return NormalizedActivity(
        sport=normalize_sport(val("sport")),
        start_time=start,
        duration_s=duration,
        source="csv",
        distance_m=_num(val("distance")),
        elevation_gain_m=_num(val("elevation_gain")),
        avg_hr=_int(val("avg_hr")),
        max_hr=_int(val("max_hr")),
        avg_power_w=_int(val("avg_power")),
        calories=_int(val("calories")),
        title=val("title"),
    )


def _parse_date(v: str | None) -> datetime:
    if not v:
        raise ValueError("date vazia")
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%d/%m/%Y %H:%M", "%d/%m/%Y"):
        try:
            return datetime.strptime(v, fmt).replace(tzinfo=UTC)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(v.replace("Z", "+00:00")).astimezone(UTC)
    except ValueError as e:
        raise ValueError(f"formato de data nao reconhecido: {v}") from e


def _parse_duration(v: str | None) -> int:
    if not v:
        raise ValueError("duration vazia")
    if ":" in v:
        parts = [int(p) for p in v.split(":")]
        while len(parts) < 3:
            parts.insert(0, 0)
        h, m, s = parts[-3], parts[-2], parts[-1]
        return h * 3600 + m * 60 + s
    return int(float(v))


def _num(v: str | None) -> float | None:
    if not v:
        return None
    try:
        return float(v.replace(",", "."))
    except ValueError:
        return None


def _int(v: str | None) -> int | None:
    n = _num(v)
    return int(n) if n is not None else None
