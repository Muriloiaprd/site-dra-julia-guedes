"""Os ultimos 6 meses de corrida do atleta, resumidos para o plano do objetivo.

O ultimo mes pesa mais (de onde o plano parte), mas o historico entra: o volume e
o longao que o atleta ja aguentou, as pausas, a dor recente e o nivel (VDOT).
Tudo calculado pelo codigo, para o plano sair igual com os mesmos dados.
"""

import re
import statistics
import unicodedata
from dataclasses import dataclass, field
from datetime import date, timedelta

from kactus_api.metrics.predictions import estimate_vdot

HISTORY_WEEKS = 26
# Mais lento que isso e caminhada registrada como corrida: fora do volume e do nivel.
WALK_PACE_S = 540
# Semana com menos que isso conta como pausa.
PAUSE_KM = 5.0
# Peso do ultimo mes no nivel (VDOT); o resto vem dos recordes do historico.
RECENT_WEIGHT = 0.7

_WEEKDAYS = {"seg": 0, "ter": 1, "qua": 2, "qui": 3, "sex": 4, "sab": 5, "dom": 6}
WEEKDAY_NAMES = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]


@dataclass
class Run:
    day: date
    km: float
    seconds: float
    avg_hr: float | None = None
    pain_level: int | None = None
    pain_location: str | None = None


@dataclass
class WeekStat:
    start: date
    km: float = 0.0
    runs: int = 0
    longest: float = 0.0
    seconds: float = 0.0
    hr: list[float] = field(default_factory=list)

    @property
    def pace(self) -> float | None:
        return self.seconds / self.km if self.km else None

    @property
    def avg_hr(self) -> float | None:
        return round(sum(self.hr) / len(self.hr)) if self.hr else None


@dataclass
class History:
    weeks: list[WeekStat]  # semanas completas, mais antiga primeiro
    recent_km: float  # media ponderada das 4 ultimas (a mais recente pesa mais)
    last_week_km: float
    recent_longest: float
    runs_per_week: float  # media das 4 ultimas
    peak_block_km: float  # melhor media de 4 semanas seguidas nos 6 meses
    peak_block_start: date | None
    longest_6m: float
    longest_pause: int  # maior sequencia de semanas paradas
    pain: list[tuple[date, int, str]]  # dor >= 2 no ultimo mes
    vdot_recent: float | None  # pelo pace x FC das corridas do ultimo mes


def week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _vo2_cost(pace_s: float) -> float:
    v = 60000 / pace_s  # m/min
    return -4.60 + 0.182258 * v + 0.000104 * v * v


def summarize(runs: list[Run], today: date, max_hr: int | None, resting_hr: int | None) -> History:
    runs = [r for r in runs if r.km > 0 and r.seconds / r.km <= WALK_PACE_S]
    this_week = week_start(today)
    first = this_week - timedelta(weeks=HISTORY_WEEKS)
    weeks = {first + timedelta(weeks=i): WeekStat(first + timedelta(weeks=i)) for i in range(HISTORY_WEEKS)}
    for r in runs:
        w = weeks.get(week_start(r.day))
        if w is None:
            continue
        w.km += r.km
        w.runs += 1
        w.longest = max(w.longest, r.km)
        w.seconds += r.seconds
        if r.avg_hr:
            w.hr.append(r.avg_hr)
    ordered = [weeks[k] for k in sorted(weeks)]
    last4 = ordered[-4:]
    recent_km = sum(w.km * p for w, p in zip(reversed(last4), (0.4, 0.3, 0.2, 0.1), strict=False))

    best, best_start = 0.0, None
    for i in range(len(ordered) - 3):
        avg = sum(w.km for w in ordered[i:i + 4]) / 4
        if avg > best:
            best, best_start = avg, ordered[i].start
    longest_pause = run = 0
    for w in ordered:
        run = run + 1 if w.km < PAUSE_KM else 0
        longest_pause = max(longest_pause, run)

    month_ago = today - timedelta(days=28)
    recent_runs = [r for r in runs if r.day >= month_ago]
    pain = [(r.day, r.pain_level, r.pain_location or "") for r in recent_runs if (r.pain_level or 0) >= 2]

    vdot_recent = None
    if max_hr and resting_hr and max_hr > resting_hr:
        est = []
        for r in recent_runs:
            if not r.avg_hr:
                continue
            frac = (r.avg_hr - resting_hr) / (max_hr - resting_hr)  # % da FC de reserva ≈ % do VO2 de reserva
            if 0.6 <= frac <= 0.95:
                est.append(_vo2_cost(r.seconds / r.km) / frac)
        if est:
            vdot_recent = round(statistics.median(est), 1)

    return History(
        weeks=ordered,
        recent_km=round(recent_km, 1),
        last_week_km=round(ordered[-1].km, 1),
        recent_longest=max((w.longest for w in last4), default=0.0),
        runs_per_week=sum(w.runs for w in last4) / 4,
        peak_block_km=round(best, 1),
        peak_block_start=best_start,
        longest_6m=max((w.longest for w in ordered), default=0.0),
        longest_pause=longest_pause,
        pain=pain,
        vdot_recent=vdot_recent,
    )


def blended_vdot(vdot_recent: float | None, records: list[tuple[float, float, date]], hist: History, today: date) -> float | None:
    """Nivel: 70% pelo ultimo mes, 30% pelos recordes do ultimo ano, estes descontados
    1% por semana de pausa depois do recorde (ate 12%). records = (tempo_s, dist_m, data)."""
    recent_cut = today - timedelta(days=365)
    hist_vdot = None
    for t, dist, day in records:
        if day < recent_cut:
            continue
        paused = sum(1 for w in hist.weeks if w.start >= week_start(day) and w.km < PAUSE_KM)
        v = estimate_vdot(t, dist) * (1 - min(0.12, 0.01 * paused))
        hist_vdot = max(hist_vdot or 0.0, v)
    if vdot_recent and hist_vdot:
        return round(RECENT_WEIGHT * vdot_recent + (1 - RECENT_WEIGHT) * hist_vdot, 1)
    return round(vdot_recent or hist_vdot, 1) if (vdot_recent or hist_vdot) else None


def preferred_days(texts: list[str]) -> list[int]:
    """Dias da semana citados nas memorias de disponibilidade ("terças, quintas e sábados")."""
    found: set[int] = set()
    for t in texts:
        plain = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode().lower()
        if re.search(r"\bnao\b|\bsem\b", plain):
            continue  # "nao treino as quartas": nao e dia disponivel
        for m in re.finditer(r"\b(seg|ter|qua|qui|sex|sab|dom)\w*", plain):
            found.add(_WEEKDAYS[m.group(1)])
    return sorted(found)
