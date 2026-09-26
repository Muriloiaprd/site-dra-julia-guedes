"""Metricas basicas derivadas da serie de pontos (funcoes puras).

Entrada: lista de pontos com pelo menos elapsed_time_s; distance_m e hr quando
disponiveis. Nenhuma dependencia de banco ou FastAPI — facil de testar e de
reaproveitar em workers.
"""

from dataclasses import dataclass

from kactus_api.metrics.derived import gap_pace


@dataclass(slots=True)
class PointLike:
    elapsed_time_s: int
    distance_m: float | None = None
    hr: int | None = None
    altitude_m: float | None = None


@dataclass(slots=True)
class Split:
    index: int
    distance_m: float
    duration_s: int
    pace_s_per_km: float | None
    avg_hr: int | None
    elevation_gain_m: float | None
    gap_pace_s_per_km: float | None = None


@dataclass(slots=True)
class ZoneBucket:
    zone: int
    seconds: int
    percent: float


@dataclass(slots=True)
class BestEffort:
    distance_m: float
    duration_s: int
    start_elapsed_s: int


def compute_splits(points: list, split_m: float = 1000.0) -> list[Split]:
    """Divide a atividade em trechos de `split_m` metros, interpolando o tempo
    no cruzamento de cada marca de distancia."""
    pts = [p for p in points if p.distance_m is not None]
    if len(pts) < 2:
        return []

    splits: list[Split] = []
    boundary = split_m
    idx = 1
    seg_start_time = pts[0].elapsed_time_s
    seg_start_hr_acc: list[int] = []
    seg_start_alt = pts[0].altitude_m

    prev = pts[0]
    for p in pts[1:]:
        if p.hr is not None:
            seg_start_hr_acc.append(p.hr)
        while p.distance_m is not None and p.distance_m >= boundary:
            t_cross = _interp_time(prev, p, boundary)
            gain = _gain(seg_start_alt, p.altitude_m)
            splits.append(
                Split(
                    index=idx,
                    distance_m=split_m,
                    duration_s=int(round(t_cross - seg_start_time)),
                    pace_s_per_km=round((t_cross - seg_start_time) / (split_m / 1000), 2),
                    avg_hr=round(sum(seg_start_hr_acc) / len(seg_start_hr_acc))
                    if seg_start_hr_acc
                    else None,
                    elevation_gain_m=gain,
                )
            )
            idx += 1
            seg_start_time = t_cross
            seg_start_alt = p.altitude_m
            seg_start_hr_acc = []
            boundary += split_m
        prev = p

    # trecho parcial final
    last = pts[-1]
    if last.distance_m and last.distance_m > (boundary - split_m):
        partial_dist = last.distance_m - (boundary - split_m)
        dur = last.elapsed_time_s - seg_start_time
        if partial_dist > 1 and dur > 0:
            splits.append(
                Split(
                    index=idx,
                    distance_m=round(partial_dist, 1),
                    duration_s=int(dur),
                    pace_s_per_km=round(dur / (partial_dist / 1000), 2),
                    avg_hr=round(sum(seg_start_hr_acc) / len(seg_start_hr_acc))
                    if seg_start_hr_acc
                    else None,
                    elevation_gain_m=_gain(seg_start_alt, last.altitude_m),
                )
            )

    # GAP de cada trecho: so os pontos dentro dele (com as bordas).
    start_m = 0.0
    for s in splits:
        end_m = start_m + s.distance_m
        seg = [p for p in pts if start_m <= p.distance_m <= end_m]
        s.gap_pace_s_per_km = gap_pace(s.pace_s_per_km, seg)
        start_m = end_m
    return splits


def default_hr_zones(max_hr: int) -> dict[str, list[int]]:
    """Zonas por %FCmax (padrao 5 zonas): Z1<60, Z2 60-70, Z3 70-80, Z4 80-90, Z5>90."""
    edges = [0, 0.60, 0.70, 0.80, 0.90, 1.01]
    zones = {}
    for i in range(5):
        lo = round(max_hr * edges[i])
        hi = round(max_hr * edges[i + 1])
        zones[f"z{i + 1}"] = [lo, hi]
    return zones


def karvonen_hr_zones(max_hr: int, resting_hr: int) -> dict[str, list[int]]:
    """Zonas por % da FC de reserva (Karvonen): Z1<60, Z2 60-70, Z3 70-80,
    Z4 80-90, Z5>90 de (FCmax - FCrepouso), somado a FC de repouso. Mais fiel que
    %FCmax quando a FC de repouso e conhecida."""
    reserve = max_hr - resting_hr
    edges = [0.60, 0.70, 0.80, 0.90]
    bounds = [0] + [round(resting_hr + reserve * e) for e in edges] + [max_hr + 1]
    return {f"z{i + 1}": [bounds[i], bounds[i + 1]] for i in range(5)}


def resolve_hr_zones(profile) -> dict[str, list[int]] | None:
    """Zonas salvas no perfil > Karvonen (max + repouso) > %FCmax > None."""
    if profile is None:
        return None
    if profile.hr_zones:
        return profile.hr_zones
    if profile.max_hr and profile.resting_hr and profile.max_hr > profile.resting_hr:
        return karvonen_hr_zones(profile.max_hr, profile.resting_hr)
    if profile.max_hr:
        return default_hr_zones(profile.max_hr)
    return None


def hr_zone_distribution(points: list, zones: dict[str, list[int]]) -> list[ZoneBucket]:
    """Tempo (s) em cada zona de FC, somando o intervalo entre pontos consecutivos."""
    ordered = sorted(zones.items(), key=lambda kv: kv[1][0])
    seconds = [0] * len(ordered)

    prev = None
    for p in points:
        if prev is not None and p.hr is not None:
            dt = p.elapsed_time_s - prev.elapsed_time_s
            if 0 < dt <= 60:  # ignora gaps grandes (pausa/perda de sinal)
                z = _zone_for_hr(p.hr, ordered)
                if z is not None:
                    seconds[z] += dt
        prev = p

    total = sum(seconds)
    return [
        ZoneBucket(
            zone=i + 1,
            seconds=seconds[i],
            percent=round(seconds[i] / total * 100, 1) if total else 0.0,
        )
        for i in range(len(ordered))
    ]


def best_efforts(points: list, distances: list[float]) -> dict[float, BestEffort]:
    """Menor tempo para cobrir cada distancia alvo (sliding window sobre a serie)."""
    pts = [p for p in points if p.distance_m is not None]
    if len(pts) < 2:
        return {}

    result: dict[float, BestEffort] = {}
    for target in distances:
        if pts[-1].distance_m is None or pts[-1].distance_m < target:
            continue
        best = _best_window(pts, target)
        if best is not None:
            result[target] = best
    return result


def _best_window(pts: list, target: float) -> BestEffort | None:
    best_time = None
    best_start = 0
    left = 0
    for right in range(len(pts)):
        while pts[right].distance_m - pts[left].distance_m >= target:
            dt = pts[right].elapsed_time_s - pts[left].elapsed_time_s
            if best_time is None or dt < best_time:
                best_time = dt
                best_start = pts[left].elapsed_time_s
            left += 1
    if best_time is None:
        return None
    return BestEffort(distance_m=target, duration_s=int(best_time), start_elapsed_s=best_start)


def _interp_time(a, b, boundary: float) -> float:
    if a.distance_m is None or b.distance_m is None or b.distance_m == a.distance_m:
        return float(b.elapsed_time_s)
    frac = (boundary - a.distance_m) / (b.distance_m - a.distance_m)
    return a.elapsed_time_s + frac * (b.elapsed_time_s - a.elapsed_time_s)


def _gain(start_alt: float | None, end_alt: float | None) -> float | None:
    if start_alt is None or end_alt is None:
        return None
    return round(max(0.0, end_alt - start_alt), 1)


def _zone_for_hr(hr: int, ordered: list) -> int | None:
    for i, (_, (lo, hi)) in enumerate(ordered):
        if lo <= hr < hi:
            return i
    if ordered and hr >= ordered[-1][1][0]:
        return len(ordered) - 1
    return None
