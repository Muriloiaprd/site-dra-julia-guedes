"""Esqueleto do plano do objetivo: semanas ate a prova, km de cada semana e de
cada treino, fases e paces. Tudo calculado pelo codigo (mesmos dados → mesmo
plano); a Duni so escolhe o tipo de cada treino dentro das opcoes da fase e
escreve titulo e objetivo (coach_service.generate_goal_plan).

Regras (corrida amadora, 3 a 5 dias por semana):
- parte do volume atual (media das ultimas 4 semanas) e sobe no maximo 10% por
  semana ate o pico da distancia;
- a cada 4 semanas, uma semana de alivio (75% do volume), inclusive no pico;
- longao cresce no maximo 2 km por semana; teto por fase (base 65%, construcao
  90%, pico 100% do teto da distancia), e no pico o longao maximo alterna com um
  mais curto (85%) para nao repetir 32 km toda semana;
- polimento nas ultimas semanas (3 na maratona, 2 na meia, 1 nas curtas), com a
  prova no dia;
- fases nas semanas de treino: base 40%, construcao 35%, pico 25%.
"""

import math
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, timedelta

from kactus_api.metrics.predictions import estimate_vdot

PHASES = ("base", "construcao", "pico", "polimento")
PHASE_LABEL = {"base": "Base", "construcao": "Construção", "pico": "Pico", "polimento": "Polimento"}

# Dias da semana (0 = segunda) e papel de cada treino. Qualidade longe do longao.
DAY_LAYOUT: dict[int, dict[int, str]] = {
    3: {1: "qualidade", 3: "leve", 6: "longao"},
    4: {1: "qualidade", 2: "leve", 4: "leve", 6: "longao"},
    5: {0: "leve", 1: "qualidade", 3: "leve", 4: "leve", 6: "longao"},
}

# Volume de pico (km/semana) por distancia e dias; teto do longao; semanas de polimento.
_PEAK_KM = {42.2: {3: 55, 4: 60, 5: 70}, 21.1: {3: 38, 4: 45, 5: 52}, 10.0: {3: 30, 4: 35, 5: 42}, 5.0: {3: 24, 4: 28, 5: 34}}
_LONG_CAP = {42.2: 32.0, 21.1: 20.0, 10.0: 15.0, 5.0: 12.0}
_TAPER_WEEKS = {42.2: 3, 21.1: 2, 10.0: 1, 5.0: 1}
# Teto do longao como parte do volume da semana (menos dias → longao pesa mais).
_LONG_SHARE = {3: 0.6, 4: 0.5, 5: 0.42}
# Polimento: fracao do volume de pico em cada semana (a ultima e a da prova).
_TAPER_FACTORS = {3: (0.75, 0.6, 0.4), 2: (0.7, 0.45), 1: (0.5,)}
_LONG_PHASE_CAP = {"base": 0.65, "construcao": 0.9, "pico": 1.0}

# Tipos que a Duni pode escolher para cada papel em cada fase. O primeiro e o padrao.
TYPE_OPTIONS: dict[str, dict[str, tuple[str, ...]]] = {
    "base": {"qualidade": ("progressivo", "fartlek"), "leve": ("rodagem leve",), "longao": ("longão",)},
    "construcao": {
        "qualidade": ("limiar", "intervalado", "progressivo"),
        "leve": ("rodagem leve", "regenerativo"),
        "longao": ("longão", "longão progressivo"),
    },
    "pico": {
        "qualidade": ("ritmo de prova", "limiar", "intervalado"),
        "leve": ("rodagem leve", "regenerativo"),
        "longao": ("longão com ritmo de prova", "longão"),
    },
    "polimento": {"qualidade": ("ritmo de prova",), "leve": ("rodagem leve", "regenerativo"), "longao": ("longão",)},
}
# Semana de alivio: nada forte.
CUTBACK_OPTIONS = {"qualidade": ("progressivo", "fartlek"), "leve": ("rodagem leve", "regenerativo"), "longao": ("longão",)}

_INTENSITY = {
    "rodagem leve": "leve", "regenerativo": "leve", "longão": "leve", "progressivo": "moderado",
    "fartlek": "moderado", "longão progressivo": "moderado", "longão com ritmo de prova": "moderado",
    "limiar": "forte", "intervalado": "forte", "ritmo de prova": "moderado", "prova": "forte",
}


@dataclass
class Slot:
    date: date
    role: str  # qualidade | leve | longao | prova
    km: float
    options: tuple[str, ...]


@dataclass
class Week:
    index: int  # 1..N
    start: date
    end: date
    phase: str
    km: float
    long_km: float
    cutback: bool
    slots: list[Slot] = field(default_factory=list)


# ── prova ───────────────────────────────────────────────────────────────────


def _plain(text: str) -> str:
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()


def race_distance_km(text: str) -> float | None:
    """Distancia da prova a partir do texto da memoria ("Maratona do Rio" → 42.2)."""
    t = _plain(text)
    if "meia" in t or "21k" in t.replace(" ", "") or "21 km" in t or "half" in t:
        return 21.1
    if "maratona" in t or "42k" in t.replace(" ", "") or "42 km" in t or "marathon" in t:
        return 42.2
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:km|k)\b", t)
    if m:
        km = float(m.group(1).replace(",", "."))
        return min(_PEAK_KM, key=lambda d: abs(d - km))
    return None


# ── paces (Jack Daniels) ───────────────────────────────────────────────────


def _pace_at(vdot: float, pct: float) -> float:
    """s/km na velocidade que usa `pct` do VO2max (equacao de custo de Daniels)."""
    vo2 = vdot * pct
    a, b, c = 0.000104, 0.182258, -4.60 - vo2
    v = (-b + math.sqrt(b * b - 4 * a * c)) / (2 * a)  # m/min
    return 60000 / v


def race_time_s(vdot: float, distance_km: float) -> float:
    """Tempo de prova previsto pelo VDOT (busca binaria em estimate_vdot)."""
    dist_m = distance_km * 1000
    lo, hi = 60.0, 60.0 * 60 * 10
    for _ in range(60):
        mid = (lo + hi) / 2
        if estimate_vdot(mid, dist_m) > vdot:
            lo = mid  # rapido demais para esse VDOT
        else:
            hi = mid
    return (lo + hi) / 2


def paces(vdot: float, race_km: float) -> dict[str, float]:
    """Paces de treino em s/km: leve (faixa), limiar, intervalo e o da prova."""
    return {
        "leve_rapido": _pace_at(vdot, 0.74),
        "leve_lento": _pace_at(vdot, 0.66),
        "limiar": _pace_at(vdot, 0.88),
        "intervalo": _pace_at(vdot, 0.975),
        "prova": race_time_s(vdot, race_km) / race_km,
    }


def vdot_from_easy_pace(pace_s_per_km: float) -> float:
    """VDOT em que o pace medio dos treinos recentes cai no meio da faixa leve."""
    lo, hi = 20.0, 85.0
    for _ in range(60):
        mid = (lo + hi) / 2
        if _pace_at(mid, 0.70) > pace_s_per_km:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def fmt_pace(s: float) -> str:
    r = round(s)
    return f"{r // 60}:{r % 60:02d}"


def workout_targets(kind: str, km: float, p: dict[str, float], zones: dict[str, list[int]] | None) -> dict:
    """Ritmo, zona de FC (com bpm, se houver zonas), intensidade e duracao de um tipo de treino."""
    easy = f"{fmt_pace(p['leve_rapido'])}–{fmt_pace(p['leve_lento'])}/km"

    def zone(*names: str) -> str:
        label = "–".join(n.upper() for n in names)
        if not zones:
            return label
        lo = zones.get(names[0].lower(), [None])[0]
        hi = zones.get(names[-1].lower(), [None, None])[1]
        return f"{label} ({lo}–{hi} bpm)" if lo is not None and hi is not None else label

    mid_easy = (p["leve_rapido"] + p["leve_lento"]) / 2
    finish = min(6.0, round(km * 0.3))
    by_kind = {
        "rodagem leve": (easy, zone("Z2"), mid_easy),
        "regenerativo": (f"{fmt_pace(p['leve_lento'] + 15)}/km ou mais lento", zone("Z1", "Z2"), p["leve_lento"] + 15),
        "longão": (easy, zone("Z2"), mid_easy),
        "progressivo": (f"{fmt_pace(p['leve_lento'])} → {fmt_pace(p['prova'])}/km", zone("Z2", "Z3"), (p["leve_lento"] + p["prova"]) / 2),
        "fartlek": (f"{easy}, com estímulos a {fmt_pace(p['limiar'])}/km", zone("Z2", "Z4"), mid_easy - 15),
        "longão progressivo": (f"{fmt_pace(p['leve_lento'])} → {fmt_pace(p['prova'])}/km", zone("Z2", "Z3"), mid_easy - 10),
        "longão com ritmo de prova": (
            f"{easy}; os últimos {finish} km a {fmt_pace(p['prova'])}/km", zone("Z2", "Z3"), mid_easy - 10,
        ),
        "limiar": (f"blocos a {fmt_pace(p['limiar'])}/km", zone("Z4"), (p["limiar"] + mid_easy) / 2),
        "intervalado": (f"tiros a {fmt_pace(p['intervalo'])}/km", zone("Z4", "Z5"), (p["intervalo"] + mid_easy) / 2),
        "ritmo de prova": (f"{fmt_pace(p['prova'])}/km", zone("Z3"), (p["prova"] + mid_easy) / 2),
        "prova": (f"{fmt_pace(p['prova'])}/km", zone("Z3", "Z4"), p["prova"]),
    }
    ritmo, zona_fc, avg_pace = by_kind.get(kind, by_kind["rodagem leve"])
    return {
        "ritmo": ritmo,
        "zona_fc": zona_fc,
        "intensidade": _INTENSITY.get(kind, "leve"),
        "duracao_s": round(km * avg_pace),
    }


# ── esqueleto ───────────────────────────────────────────────────────────────


def _round_half(x: float) -> float:
    return max(0.0, round(x * 2) / 2)


def layout_from_days(days: list[int], days_per_week: int) -> dict[int, str] | None:
    """Papel de cada dia a partir dos dias que o atleta tem: longao no fim de semana
    (ou no ultimo dia), qualidade no dia mais longe do longao, o resto leve.
    None se os dias nao bastam (usa o padrao)."""
    days = sorted(set(days))
    if len(days) < days_per_week:
        return None
    weekend = [d for d in days if d >= 5]
    long_day = weekend[0] if weekend else days[-1]  # sabado antes de domingo
    gap = lambda d: min((d - long_day) % 7, (long_day - d) % 7)  # noqa: E731
    others = sorted((d for d in days if d != long_day), key=lambda d: (-gap(d), d))
    chosen = others[: days_per_week - 1]
    layout = {long_day: "longao", chosen[0]: "qualidade"}
    layout.update({d: "leve" for d in chosen[1:]})
    return dict(sorted(layout.items()))


def _phase_for(i: int, train_weeks: int) -> str:
    base_n = max(1, round(train_weeks * 0.40))
    build_n = max(1, round(train_weeks * 0.35))
    if i < base_n:
        return "base"
    if i < base_n + build_n:
        return "construcao"
    return "pico"


def build_skeleton(
    today: date,
    race_date: date,
    race_km: float,
    days_per_week: int,
    base_km: float,
    base_long_km: float,
    *,
    ramp: float = 0.10,
    comeback_km: float | None = None,
    comeback_ramp: float = 0.15,
    long_step: float = 2.0,
    peak_km: float | None = None,
    layout: dict[int, str] | None = None,
) -> list[Week]:
    """Semanas de 7 dias a partir de hoje ate a semana da prova (inclusive).

    ramp: subida semanal do volume. comeback_km: abaixo desse volume (o atleta ja
    treinou bem mais antes de uma pausa) a subida pode ser comeback_ramp. peak_km:
    teto vindo do historico (nunca acima do pico da distancia). layout: dia → papel."""
    if days_per_week not in DAY_LAYOUT:
        raise ValueError("days_per_week deve ser 3, 4 ou 5")
    dist = min(_PEAK_KM, key=lambda d: abs(d - race_km))
    total_weeks = (race_date - today).days // 7 + 1
    taper_n = min(_TAPER_WEEKS[dist], total_weeks)
    train_n = total_weeks - taper_n
    table_peak = _PEAK_KM[dist][days_per_week]
    peak_km = max(min(table_peak, peak_km) if peak_km else table_peak, base_km)
    layout = layout or DAY_LAYOUT[days_per_week]
    long_cap = _LONG_CAP[dist]
    share = _LONG_SHARE[days_per_week]

    weeks: list[Week] = []
    top_km = max(base_km, 8.0)  # ultimo nivel sem alivio (de onde a subida continua)
    top_long = min(max(base_long_km, 5.0), long_cap)
    for i in range(total_weeks):
        start = today + timedelta(days=7 * i)
        if i < train_n:
            phase = _phase_for(i, train_n)
            cutback = i % 4 == 3
            if i > 0 and not cutback:
                # sobe ate `ramp` por semana ate o pico (e segura la); na volta de pausa, mais rapido
                step = comeback_ramp if comeback_km and top_km < comeback_km else ramp
                top_km = min(top_km * (1 + step), max(peak_km, top_km))
                cap = long_cap * _LONG_PHASE_CAP[phase]
                top_long = min(top_long + long_step, cap, max(top_km * share, top_long))
            km = top_km * (0.75 if cutback else 1.0)
            long_km = top_long * (0.75 if cutback else 1.0)
            if phase == "pico" and not cutback and i % 2 == 1:
                long_km = top_long * 0.85
        else:
            phase, cutback = "polimento", False
            km = top_km * _TAPER_FACTORS[taper_n][i - train_n]
            long_km = min(top_long, km * share)
        w = Week(i + 1, start, start + timedelta(days=6), phase, 0.0, _round_half(long_km), cutback)
        w.slots = _week_slots(w, layout, race_date, race_km, km)
        w.km = round(sum(s.km for s in w.slots), 1)
        weeks.append(w)
    return weeks


def _week_slots(w: Week, layout: dict[int, str], race_date: date, race_km: float, target: float) -> list[Slot]:
    options = CUTBACK_OPTIONS if w.cutback else TYPE_OPTIONS[w.phase]
    days = [w.start + timedelta(days=k) for k in range(7)]
    race_week = w.start <= race_date <= w.end

    slots: list[Slot] = []
    if race_week:
        # semana da prova: a prova no dia; antes, so treinos curtos (nada depois)
        rest = max(target - race_km, 0.0)
        before = [d for d in days if d < race_date and layout.get(d.weekday()) in ("qualidade", "leve")]
        for d in before:
            role = layout[d.weekday()]
            km = _round_half(max(min(rest / max(len(before), 1), 8.0), 4.0))
            slots.append(Slot(d, role, km, options[role]))
        slots.append(Slot(race_date, "prova", race_km, ("prova",)))
        return sorted(slots, key=lambda s: s.date)

    others = [d for d in days if layout.get(d.weekday()) in ("qualidade", "leve")]
    remaining = max(target - w.long_km, 0.0)
    q_share = 0.55 if len(layout) == 3 else 0.4
    leves = [d for d in others if layout[d.weekday()] == "leve"]
    for d in days:
        role = layout.get(d.weekday())
        if role is None:
            continue
        if role == "longao":
            km = w.long_km
        elif role == "qualidade":
            km = max(remaining * q_share, 5.0)
        else:
            km = max(remaining * (1 - q_share) / max(len(leves), 1), 4.0)
        slots.append(Slot(d, role, _round_half(km), options[role]))
    return slots
