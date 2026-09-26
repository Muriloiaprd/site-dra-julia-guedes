"""Motor de analise do atleta (sem IA): calcula os fatos que a Duni interpreta.

A regra de ouro da Duni e "nunca inventar numero". Por isso toda conta
(volume por janela, distribuicao de intensidade, sinais de fadiga, sessoes
equivalentes, lacunas de dados) e feita aqui, em Python, e a IA recebe o
resultado pronto. Modelos erram soma e media; o codigo nao.

Dividido em duas partes:
- `analyze()` e pura: recebe atividades ja resumidas e devolve o dict. Testavel
  sem banco.
- `build_analysis()` le do banco e chama `analyze()`.
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time, timedelta
from statistics import median
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from ondilow_api.metrics.basic import PointLike, hr_zone_distribution, resolve_hr_zones
from ondilow_api.metrics.derived import RUN_SPORTS
from ondilow_api.metrics.load import ACWR_MIN_CHRONIC_DAILY_LOAD, compute_tss, update_daily_metrics
from ondilow_api.models import Activity, ActivityPoint
from ondilow_api.models.daily_metric import DailyMetric
from ondilow_api.models.user import AthleteProfile

# ── parametros ──────────────────────────────────────────────────────────────

_DEFAULT_TZ = "America/Sao_Paulo"
# "Corrida" mais lenta que isso e caminhada na pratica (no historico do usuario,
# corridas a 10-12 min/km com FC baixa e ~110 passos/min).
WALK_PACE_S_PER_KM = 540.0
WINDOWS = (7, 14, 28)
TREND_WEEKS = 8
# Sinais de fadiga comparam os ultimos 14 dias com a linha de base dos dias 15-90.
_RECENT_DAYS = 14
_BASELINE_DAYS = 90
_EF_DROP = 0.05            # eficiencia (velocidade por batimento) 5% abaixo da base
_DECOUPLING_HIGH = 5.0     # deriva acima de 5% (Friel)
_CADENCE_DEV = 0.05        # cadencia 5% fora do habitual para a mesma faixa de ritmo
_RPE_HIGH_ON_EASY = 6      # PSE >= 6 num treino que a FC diz que foi leve
_LOAD_JUMP = 1.3           # semana 30% acima da media das 3 anteriores
_MIN_RUN_S = 15 * 60       # corridas mais curtas nao entram na eficiencia
_EQUIV_DIST = 0.10         # sessoes equivalentes: distancia +-10%
_EQUIV_CLIMB_M_PER_KM = 10.0
_EQUIV_EF = 0.03           # +-3% de eficiencia = estavel
_GAP_DAYS = 7              # buraco de dados que vale avisar
_NEGATIVE_FEELINGS = {"cansado", "pernas_pesadas", "sem_energia"}

# Dados que o prompt da Duni pede e o Kactus nao tem (ver PLANEJAMENTO_2026-09-21).
ALWAYS_UNAVAILABLE = [
    "sono",
    "HRV",
    "Training Readiness",
    "tempo de recuperação do relógio",
    "tipo de terreno (só há elevação)",
]


@dataclass
class ActSummary:
    """O que a analise le de cada atividade (sem os pontos)."""

    id: uuid.UUID
    day: date
    sport: str
    duration_s: int
    moving_s: int | None = None
    distance_m: float | None = None
    elevation_gain_m: float | None = None
    avg_hr: int | None = None
    pace_s_per_km: float | None = None
    gap_s_per_km: float | None = None
    cadence: float | None = None
    decoupling_pct: float | None = None
    tss: float = 0.0
    rpe: int | None = None
    srpe: float | None = None
    feeling: str | None = None
    pain_level: int | None = None
    pain_location: str | None = None
    notes: str | None = None
    # minutos por intensidade (so corridas recentes com FC e zonas)
    easy_min: float | None = None
    moderate_min: float | None = None
    hard_min: float | None = None
    kind: str = field(init=False)

    def __post_init__(self) -> None:
        self.kind = effective_kind(self.sport, self.pace_s_per_km)

    @property
    def minutes(self) -> float:
        return (self.moving_s or self.duration_s) / 60

    @property
    def km(self) -> float:
        return (self.distance_m or 0.0) / 1000

    @property
    def efficiency(self) -> float | None:
        """Metros por minuto (no plano, se houver GAP) por batimento."""
        pace = self.gap_s_per_km or self.pace_s_per_km
        if not pace or not self.avg_hr or (self.moving_s or self.duration_s) < _MIN_RUN_S:
            return None
        return (60000 / pace) / self.avg_hr


def effective_kind(sport: str, pace_s_per_km: float | None) -> str:
    """Categoria usada na analise: run, walk, bike, swim, strength, pilates, other."""
    if sport in RUN_SPORTS:
        return "walk" if pace_s_per_km and pace_s_per_km > WALK_PACE_S_PER_KM else "run"
    if sport == "walk":
        return "walk"
    if sport in {"bike", "mtb", "gravel", "indoor_bike"}:
        return "bike"
    if sport in {"swim", "open_water_swim"}:
        return "swim"
    if sport in {"strength", "pilates"}:
        return sport
    return "other"


# ── analise pura ────────────────────────────────────────────────────────────


def analyze(acts: list[ActSummary], today: date, *, load: dict | None = None) -> dict:
    """Todos os fatos que a Duni recebe. `acts` = historico (qualquer ordem).
    Atividades depois de `today` sao ignoradas (analise de uma data passada)."""
    acts = sorted((a for a in acts if a.day <= today), key=lambda a: a.day)
    return {
        "hoje": today.isoformat(),
        "cobertura_de_dados": _coverage(acts, today),
        "janelas": {f"{d}d": _window(acts, today, d) for d in WINDOWS},
        "tendencia_semanal": _weekly_trend(acts, today),
        "distribuicao_intensidade_28d": _intensity(acts, today),
        "carga": load or {},
        "sinais_de_fadiga": _fatigue_signals(acts, today),
        "sessoes_equivalentes": _equivalent_sessions(acts, today),
        "cadencia_habitual": _cadence_profile(acts, today),
        "checkins_28d": _checkins(acts, today),
    }


def _in_last(acts: list[ActSummary], today: date, days: int) -> list[ActSummary]:
    start = today - timedelta(days=days - 1)
    return [a for a in acts if start <= a.day <= today]


def _pace(seconds: float, km: float) -> str | None:
    if km <= 0:
        return None
    s = round(seconds / km)
    return f"{s // 60}:{s % 60:02d}/km"


def _window(acts: list[ActSummary], today: date, days: int) -> dict:
    sel = _in_last(acts, today, days)
    runs = [a for a in sel if a.kind == "run"]
    walks = [a for a in sel if a.kind == "walk"]
    comp: dict[str, dict] = defaultdict(lambda: {"sessoes": 0, "minutos": 0.0})
    for a in sel:
        if a.kind not in ("run", "walk"):
            comp[a.kind]["sessoes"] += 1
            comp[a.kind]["minutos"] += a.minutes

    run_km = sum(a.km for a in runs)
    run_s = sum(a.minutes * 60 for a in runs)
    active_days = {a.day for a in sel}
    with_rpe = [a for a in sel if a.rpe is not None]
    longest = max(runs, key=lambda a: a.km, default=None)

    return {
        "dias": days,
        "corrida": {
            "sessoes": len(runs),
            "km": round(run_km, 1),
            "minutos": round(run_s / 60),
            "ritmo_medio": _pace(run_s, run_km),
            "longao_km": round(longest.km, 1) if longest else None,
            "longao_data": longest.day.isoformat() if longest else None,
        },
        "caminhada": {
            "sessoes": len(walks),
            "km": round(sum(a.km for a in walks), 1),
            "minutos": round(sum(a.minutes for a in walks)),
        },
        "complementar": {k: {"sessoes": v["sessoes"], "minutos": round(v["minutos"])} for k, v in sorted(comp.items())},
        "sessoes_total": len(sel),
        "dias_com_treino": len(active_days),
        "dias_sem_treino": days - len(active_days),
        "carga_tss": round(sum(a.tss for a in sel)),
        "carga_interna_srpe": round(sum(a.srpe or 0 for a in with_rpe)) if with_rpe else None,
        "atividades_com_pse": f"{len(with_rpe)} de {len(sel)}",
        "pse_media": round(sum(a.rpe for a in with_rpe) / len(with_rpe), 1) if with_rpe else None,
    }


def _weekly_trend(acts: list[ActSummary], today: date) -> list[dict]:
    monday = today - timedelta(days=today.weekday())
    weeks = []
    for i in range(TREND_WEEKS - 1, -1, -1):
        start = monday - timedelta(weeks=i)
        end = start + timedelta(days=6)
        sel = [a for a in acts if start <= a.day <= end]
        runs = [a for a in sel if a.kind == "run"]
        with_rpe = [a for a in sel if a.srpe is not None]
        weeks.append({
            "semana": start.isoformat(),
            "em_andamento": end >= today,
            "corrida_km": round(sum(a.km for a in runs), 1),
            "corrida_sessoes": len(runs),
            "corrida_minutos": round(sum(a.minutes for a in runs)),
            "longao_km": round(max((a.km for a in runs), default=0.0), 1),
            "caminhada_km": round(sum(a.km for a in sel if a.kind == "walk"), 1),
            "complementar_minutos": round(sum(a.minutes for a in sel if a.kind not in ("run", "walk"))),
            "carga_tss": round(sum(a.tss for a in sel)),
            "carga_interna_srpe": round(sum(a.srpe or 0 for a in with_rpe)) if with_rpe else None,
        })
    return weeks


def _intensity(acts: list[ActSummary], today: date) -> dict:
    """Tempo de corrida por intensidade (modelo de 3 zonas: Z1-Z2 / Z3 / Z4-Z5)."""
    runs = [a for a in _in_last(acts, today, 28) if a.kind == "run" and a.easy_min is not None]
    easy = sum(a.easy_min or 0 for a in runs)
    moderate = sum(a.moderate_min or 0 for a in runs)
    hard = sum(a.hard_min or 0 for a in runs)
    total = easy + moderate + hard
    if total <= 0:
        return {"disponivel": False, "motivo": "nenhuma corrida com FC nos últimos 28 dias"}
    return {
        "disponivel": True,
        "corridas_consideradas": len(runs),
        "minutos": {"leve_z1_z2": round(easy), "moderado_z3": round(moderate), "forte_z4_z5": round(hard)},
        "percentual": {
            "leve_z1_z2": round(easy / total * 100),
            "moderado_z3": round(moderate / total * 100),
            "forte_z4_z5": round(hard / total * 100),
        },
    }


def _signal(code: str, label: str, occurrences: int, evidence: str) -> dict:
    return {
        "codigo": code,
        "sinal": label,
        "tipo": "tendencia" if occurrences >= 2 else "isolado",
        "ocorrencias": occurrences,
        "evidencia": evidence,
    }


def _fatigue_signals(acts: list[ActSummary], today: date) -> list[dict]:
    recent = _in_last(acts, today, _RECENT_DAYS)
    base_start = today - timedelta(days=_BASELINE_DAYS - 1)
    base_end = today - timedelta(days=_RECENT_DAYS)
    baseline = [a for a in acts if base_start <= a.day <= base_end]
    signals: list[dict] = []

    # 1) mesmo ritmo custando mais batimentos
    base_ef = [a.efficiency for a in baseline if a.kind == "run" and a.efficiency]
    rec_runs = [a for a in recent if a.kind == "run" and a.efficiency]
    if len(base_ef) >= 3 and rec_runs:
        ref = median(base_ef)
        worse = [a for a in rec_runs if a.efficiency < ref * (1 - _EF_DROP)]
        if worse:
            drops = ", ".join(f"{a.day.isoformat()} ({(a.efficiency / ref - 1) * 100:+.0f}%)" for a in worse)
            signals.append(_signal(
                "eficiencia_caindo", "Ritmo custando mais batimentos que o habitual", len(worse),
                f"Eficiência (ritmo por batimento) abaixo da mediana dos dias 15–90 em {drops}.",
            ))

    # 2) deriva cardiaca alta em corrida continua
    high_drift = [a for a in recent if a.kind == "run" and a.decoupling_pct is not None and a.decoupling_pct > _DECOUPLING_HIGH]
    if high_drift:
        base_drift = [a.decoupling_pct for a in baseline if a.decoupling_pct is not None]
        ref = f"; habitual {median(base_drift):.1f}%" if base_drift else ""
        items = ", ".join(f"{a.day.isoformat()} {a.decoupling_pct:+.1f}%" for a in high_drift)
        signals.append(_signal(
            "deriva_alta", "Coração subindo ao longo do treino no mesmo ritmo", len(high_drift),
            f"Deriva acima de {_DECOUPLING_HIGH:.0f}%: {items}{ref}.",
        ))

    # 3) cadencia fora do habitual para a mesma faixa de ritmo
    profile = _cadence_bands([a for a in baseline if a.kind == "run"])
    odd = []
    for a in recent:
        if a.kind != "run" or not a.cadence or not a.pace_s_per_km:
            continue
        band = profile.get(_band(a.pace_s_per_km))
        if band and abs(a.cadence / band - 1) > _CADENCE_DEV:
            odd.append(f"{a.day.isoformat()} {a.cadence:.0f} ppm (habitual {band:.0f})")
    if odd:
        signals.append(_signal(
            "cadencia_incomum", "Cadência diferente do habitual para o mesmo ritmo", len(odd), "; ".join(odd) + ".",
        ))

    # 4) PSE alta em treino que a FC diz que foi leve
    easy_hard = [
        a for a in recent
        if a.rpe is not None and a.rpe >= _RPE_HIGH_ON_EASY and a.easy_min is not None
        and a.easy_min >= 0.7 * ((a.easy_min or 0) + (a.moderate_min or 0) + (a.hard_min or 0))
    ]
    if easy_hard:
        items = ", ".join(f"{a.day.isoformat()} PSE {a.rpe}" for a in easy_hard)
        signals.append(_signal(
            "pse_alta_em_treino_leve", "Treino leve pela FC pareceu pesado", len(easy_hard),
            f"Mais de 70% do tempo em Z1–Z2, mas PSE alta: {items}.",
        ))

    # 5) salto de carga semanal (TSS), so com base suficiente
    week = sum(a.tss for a in _in_last(acts, today, 7))
    prev = [a for a in acts if today - timedelta(days=27) <= a.day <= today - timedelta(days=7)]
    prev_avg = sum(a.tss for a in prev) / 3
    if prev_avg >= ACWR_MIN_CHRONIC_DAILY_LOAD * 7 and week > prev_avg * _LOAD_JUMP:
        signals.append(_signal(
            "salto_de_carga", "Carga da semana bem acima das anteriores", 1,
            f"Últimos 7 dias: {week:.0f} TSS; média das 3 semanas anteriores: {prev_avg:.0f} TSS "
            f"({(week / prev_avg - 1) * 100:+.0f}%).",
        ))

    # 6) dias seguidos sem descanso
    streak = _longest_streak({a.day for a in _in_last(acts, today, 14)})
    if streak >= 6:
        signals.append(_signal(
            "sem_descanso", "Muitos dias seguidos treinando", 1,
            f"{streak} dias consecutivos com atividade nos últimos 14 dias (contando complementares).",
        ))

    # 7) dor relatada no check-in
    pains = [a for a in recent if a.pain_level and a.pain_level >= 3]
    if pains:
        spots = defaultdict(list)
        for a in pains:
            spots[(a.pain_location or "local não informado").lower()].append(f"{a.day.isoformat()} {a.pain_level}/10")
        items = "; ".join(f"{spot}: {', '.join(v)}" for spot, v in spots.items())
        repeated = max(len(v) for v in spots.values())
        signals.append(_signal("dor_relatada", "Dor relatada no check-in", repeated, items + "."))

    # 8) sensacao ruim no check-in
    bad = [a for a in recent if a.feeling in _NEGATIVE_FEELINGS]
    if bad:
        items = ", ".join(f"{a.day.isoformat()} {a.feeling.replace('_', ' ')}" for a in bad)
        signals.append(_signal("sensacao_ruim", "Cansaço ou pernas pesadas relatados", len(bad), items + "."))

    return signals


def _longest_streak(days: set[date]) -> int:
    best = run = 0
    for d in sorted(days):
        run = run + 1 if (d - timedelta(days=1)) in days else 1
        best = max(best, run)
    return best


def _band(pace: float) -> int:
    """Faixa de ritmo de 30s (ex.: 330 = 5:30-5:59/km)."""
    return int(pace // 30 * 30)


def _cadence_bands(runs: list[ActSummary]) -> dict[int, float]:
    by_band: dict[int, list[float]] = defaultdict(list)
    for a in runs:
        if a.cadence and a.pace_s_per_km:
            by_band[_band(a.pace_s_per_km)].append(a.cadence)
    return {b: median(v) for b, v in by_band.items() if len(v) >= 2}


def _cadence_profile(acts: list[ActSummary], today: date) -> list[dict]:
    runs = [a for a in _in_last(acts, today, 180) if a.kind == "run"]
    counts = defaultdict(int)
    for a in runs:
        if a.cadence and a.pace_s_per_km:
            counts[_band(a.pace_s_per_km)] += 1
    out = []
    for b, cad in sorted(_cadence_bands(runs).items()):
        out.append({
            "faixa_ritmo": f"{b // 60}:{b % 60:02d}–{(b + 29) // 60}:{(b + 29) % 60:02d}/km",
            "cadencia_mediana_ppm": round(cad),
            "corridas": counts[b],
        })
    return out


def _equivalent_sessions(acts: list[ActSummary], today: date) -> list[dict]:
    """Corrida recente x a corrida anterior mais parecida (distancia e subida)."""
    runs = [a for a in acts if a.kind == "run" and a.km >= 3 and a.pace_s_per_km]
    recent = [a for a in runs if a.day >= today - timedelta(days=27)][-5:]
    out = []
    for cur in reversed(recent):
        climb = (cur.elevation_gain_m or 0) / cur.km
        prev = [
            p for p in runs
            if p.day < cur.day and p.day >= cur.day - timedelta(days=365)
            and abs(p.km / cur.km - 1) <= _EQUIV_DIST
            and abs((p.elevation_gain_m or 0) / p.km - climb) <= _EQUIV_CLIMB_M_PER_KM
        ]
        if not prev:
            continue
        p = prev[-1]
        verdict, note = _compare(cur, p)
        out.append({
            "atual": _session(cur),
            "anterior": _session(p),
            "diferenca_ritmo_s_km": round(cur.pace_s_per_km - p.pace_s_per_km),
            "diferenca_fc": (cur.avg_hr - p.avg_hr) if cur.avg_hr and p.avg_hr else None,
            "veredito": verdict,
            "leitura": note,
        })
    return out


def _session(a: ActSummary) -> dict:
    s = f"{a.day.isoformat()}: {a.km:.1f} km a {_pace(a.pace_s_per_km * a.km, a.km)}"
    if a.gap_s_per_km:
        s += f" (GAP {_pace(a.gap_s_per_km * a.km, a.km)})"
    if a.avg_hr:
        s += f", FC média {a.avg_hr}"
    if a.elevation_gain_m:
        s += f", +{a.elevation_gain_m:.0f} m"
    return {"data": a.day.isoformat(), "resumo": s}


def _compare(cur: ActSummary, prev: ActSummary) -> tuple[str, str]:
    if cur.efficiency and prev.efficiency:
        delta = cur.efficiency / prev.efficiency - 1
        if delta > _EQUIV_EF:
            return "mais_eficiente", f"Mais velocidade por batimento que antes ({delta * 100:+.0f}%)."
        if delta < -_EQUIV_EF:
            return "custo_maior", f"Mesmo esforço rendeu menos: eficiência {delta * 100:+.0f}%."
        return "estavel", f"Eficiência parecida ({delta * 100:+.0f}%)."
    missing = "sem FC" if not (cur.avg_hr and prev.avg_hr) else "corrida curta demais para medir eficiência"
    diff = cur.pace_s_per_km - prev.pace_s_per_km
    if abs(diff) <= 5:
        return "estavel", f"Ritmo parecido ({missing}, só o ritmo foi comparado)."
    word = "mais rápido" if diff < 0 else "mais lento"
    return ("mais_rapido" if diff < 0 else "mais_lento"), f"Ritmo {abs(diff):.0f} s/km {word} ({missing}, só o ritmo foi comparado)."


def _checkins(acts: list[ActSummary], today: date) -> list[dict]:
    out = []
    for a in _in_last(acts, today, 28):
        if a.rpe is None and a.feeling is None and a.pain_level is None and not a.notes:
            continue
        out.append({
            "data": a.day.isoformat(),
            "atividade": a.kind,
            "pse": a.rpe,
            "carga_interna_srpe": a.srpe,
            "sensacao": a.feeling,
            "dor": a.pain_level,
            "local_dor": a.pain_location,
            "observacoes": a.notes,
        })
    return out


def _coverage(acts: list[ActSummary], today: date) -> dict:
    if not acts:
        return {"tem_atividades": False, "dados_indisponiveis": ALWAYS_UNAVAILABLE}
    last = acts[-1].day
    since = (today - last).days

    days = sorted({a.day for a in acts if a.day >= today - timedelta(days=TREND_WEEKS * 7)})
    gaps = []
    checkpoints = days + [today + timedelta(days=1)]  # buraco ate hoje tambem conta
    for prev, nxt in zip(checkpoints, checkpoints[1:]):
        empty = (nxt - prev).days - 1
        if empty >= _GAP_DAYS:
            gaps.append({"de": (prev + timedelta(days=1)).isoformat(), "ate": (nxt - timedelta(days=1)).isoformat(), "dias": empty})

    last28 = _in_last(acts, today, 28)
    runs28 = [a for a in last28 if a.kind == "run"]
    runs_as_walk = [a for a in acts if a.sport in RUN_SPORTS and a.kind == "walk" and a.day >= today - timedelta(days=89)]

    coverage = {
        "tem_atividades": True,
        "primeira_atividade": acts[0].day.isoformat(),
        "ultima_atividade": last.isoformat(),
        "dias_desde_a_ultima": since,
        "buracos_ultimas_8_semanas": gaps,
        "corridas_com_fc_28d": f"{sum(1 for a in runs28 if a.avg_hr)} de {len(runs28)}",
        "atividades_com_checkin_28d": f"{sum(1 for a in last28 if a.rpe is not None)} de {len(last28)}",
        "corridas_contadas_como_caminhada_90d": len(runs_as_walk),
        "dados_indisponiveis": ALWAYS_UNAVAILABLE,
    }
    if since >= _GAP_DAYS:
        coverage["aviso"] = (
            f"Nenhuma atividade registrada desde {last.isoformat()} ({since} dias). "
            "Pode ser pausa nos treinos ou atividades ainda não importadas — pergunte antes de concluir."
        )
    if runs_as_walk:
        coverage["nota_caminhada"] = (
            f"{len(runs_as_walk)} atividade(s) registrada(s) como corrida nos últimos 90 dias têm ritmo acima de "
            f"{int(WALK_PACE_S_PER_KM // 60)}:00/km e foram contadas como caminhada."
        )
    return coverage


# ── leitura do banco ────────────────────────────────────────────────────────


def _local_day(dt: datetime, tz: str | None) -> date:
    return dt.astimezone(ZoneInfo(tz or _DEFAULT_TZ)).date()


def _f(v) -> float | None:
    return float(v) if v is not None else None


def build_analysis(db: Session, user_id: uuid.UUID, today: date | None = None) -> dict:
    today = today or date.today()
    profile = db.execute(select(AthleteProfile).where(AthleteProfile.user_id == user_id)).scalar_one_or_none()

    rows = db.execute(
        select(Activity).where(
            Activity.user_id == user_id,
            Activity.deleted_at.is_(None),
            # 1 ano + folga: sessoes equivalentes buscam ate 365 dias antes
            Activity.start_time >= datetime.combine(today - timedelta(days=400), time.min, tzinfo=UTC),
        )
    ).scalars().all()
    first_ever = db.execute(
        select(Activity.start_time).where(Activity.user_id == user_id, Activity.deleted_at.is_(None))
        .order_by(Activity.start_time).limit(1)
    ).scalar_one_or_none()

    acts = [
        ActSummary(
            id=r.id,
            day=_local_day(r.start_time, r.timezone),
            sport=r.sport,
            duration_s=r.duration_s,
            moving_s=r.moving_time_s,
            distance_m=_f(r.distance_m),
            elevation_gain_m=_f(r.elevation_gain_m),
            avg_hr=r.avg_hr,
            pace_s_per_km=_f(r.avg_pace_s_per_km),
            gap_s_per_km=_f(r.gap_pace_s_per_km),
            cadence=_f(r.avg_cadence),
            decoupling_pct=_f(r.hr_decoupling_pct),
            tss=compute_tss(r, profile),
            rpe=r.rpe,
            srpe=r.srpe,
            feeling=r.feeling,
            pain_level=r.pain_level,
            pain_location=r.pain_location,
            notes=r.checkin_notes,
        )
        for r in rows
    ]
    _fill_intensity(db, acts, today, profile)

    result = analyze(acts, today, load=_load_status(db, user_id, today))
    if first_ever is not None and result["cobertura_de_dados"].get("tem_atividades"):
        result["cobertura_de_dados"]["primeira_atividade"] = _local_day(first_ever, None).isoformat()
    return result


def _fill_intensity(db: Session, acts: list[ActSummary], today: date, profile) -> None:
    """Minutos em Z1-Z2 / Z3 / Z4-Z5 das corridas dos ultimos 28 dias (le os pontos)."""
    zones = resolve_hr_zones(profile)
    if zones is None:
        return
    targets = {a.id: a for a in _in_last(acts, today, 28) if a.kind == "run" and a.avg_hr}
    if not targets:
        return
    points: dict[uuid.UUID, list[PointLike]] = defaultdict(list)
    for activity_id, t, hr in db.execute(
        select(ActivityPoint.activity_id, ActivityPoint.elapsed_time_s, ActivityPoint.hr)
        .where(ActivityPoint.activity_id.in_(list(targets)))
        .order_by(ActivityPoint.activity_id, ActivityPoint.elapsed_time_s)
    ):
        points[activity_id].append(PointLike(elapsed_time_s=t, hr=hr))
    for activity_id, pts in points.items():
        buckets = {b.zone: b.seconds / 60 for b in hr_zone_distribution(pts, zones)}
        if sum(buckets.values()) <= 0:
            continue
        a = targets[activity_id]
        a.easy_min = buckets.get(1, 0) + buckets.get(2, 0)
        a.moderate_min = buckets.get(3, 0)
        a.hard_min = buckets.get(4, 0) + buckets.get(5, 0)


def _load_status(db: Session, user_id: uuid.UUID, today: date) -> dict:
    # daily_metrics so e recalculada quando entra atividade: numa pausa, a ultima
    # linha fica parada no dia do ultimo import (e o CTL/ATL nao "decaem").
    if today == date.today():
        last = db.execute(
            select(DailyMetric.date)
            .where(DailyMetric.user_id == user_id, DailyMetric.sport.is_(None))
            .order_by(DailyMetric.date.desc()).limit(1)
        ).scalar_one_or_none()
        if last is not None and last < today:
            update_daily_metrics(db, user_id, from_date=last)

    recent = db.execute(
        select(DailyMetric)
        .where(DailyMetric.user_id == user_id, DailyMetric.sport.is_(None), DailyMetric.date <= today)
        .order_by(DailyMetric.date.desc())
        .limit(28)
    ).scalars().all()
    if not recent:
        return {"disponivel": False}
    latest = recent[0]
    chronic = sum(_f(m.daily_load) or 0 for m in recent) / 28
    status = {
        "disponivel": True,
        "data": latest.date.isoformat(),
        "ctl_forma_cronica": _f(latest.ctl),
        "atl_fadiga_aguda": _f(latest.atl),
        "tsb_equilibrio": _f(latest.tsb),
        "acwr": _f(latest.acwr),
        "carga_media_diaria_28d": round(chronic, 1),
    }
    if latest.acwr is None:
        status["nota_acwr"] = (
            f"ACWR não calculado: carga média de {chronic:.1f} TSS/dia em 28 dias, abaixo do mínimo de "
            f"{ACWR_MIN_CHRONIC_DAILY_LOAD:.0f} para a razão ter significado."
        )
    return status
