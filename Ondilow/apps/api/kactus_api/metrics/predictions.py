"""Previsoes de corrida e avaliacao de risco de treino."""

import math
from datetime import date, timedelta

from kactus_api.metrics.load import ACWR_MIN_CHRONIC_DAILY_LOAD
from kactus_api.models.daily_metric import DailyMetric
from kactus_api.models.record import PersonalRecord

_K_CTL = 1 - math.exp(-1 / 42)
_K_ATL = 1 - math.exp(-1 / 7)

# Distancias de prova padrao (metros)
RACE_DISTANCES = {
    "5k": 5000,
    "10k": 10000,
    "21k": 21097,
    "42k": 42195,
}

# Records de corrida que servem como base para projecoes
_SOURCE_RECORDS = {
    "fastest_1k": 1000,
    "fastest_5k": 5000,
    "fastest_10k": 10000,
    "fastest_21k": 21097,
    "fastest_42k": 42195,
}


def predict_race_time_riegel(time_s: float, source_m: float, target_m: float) -> float:
    """Riegel: T2 = T1 x (D2/D1)^1.06."""
    return time_s * (target_m / source_m) ** 1.06


def estimate_vdot(time_s: float, dist_m: float) -> float:
    """Estima VDOT (VO2max Jack Daniels) a partir de tempo e distancia."""
    t = time_s / 60
    v = dist_m / t
    vo2 = -4.60 + 0.182258 * v + 0.000104 * v ** 2
    pct = 0.8 + 0.1894393 * math.exp(-0.012778 * t) + 0.2989558 * math.exp(-0.1932605 * t)
    if pct <= 0:
        return 0.0
    return max(0.0, vo2 / pct)


def predict_race_times(records: list[PersonalRecord]) -> list[dict]:
    """Retorna previsoes para 5k, 10k, 21k, 42k com base nos recordes de corrida."""
    run_records = {r.record_type: float(r.value) for r in records if r.record_type in _SOURCE_RECORDS}

    results = []
    for name, target_m in RACE_DISTANCES.items():
        exact_key = f"fastest_{name}"
        if exact_key in run_records:
            t = run_records[exact_key]
            results.append({
                "distance": name,
                "distance_m": target_m,
                "predicted_s": round(t),
                "confidence": 1.0,
                "source": exact_key,
                "vdot": round(estimate_vdot(t, target_m), 1),
            })
            continue

        candidates = []
        for rtype, source_m in _SOURCE_RECORDS.items():
            if rtype in run_records and source_m != target_m:
                t_source = run_records[rtype]
                t_pred = predict_race_time_riegel(t_source, source_m, target_m)
                ratio = min(source_m, target_m) / max(source_m, target_m)
                confidence = round(0.5 + 0.5 * ratio, 2)
                candidates.append((t_pred, confidence, rtype))

        if candidates:
            candidates.sort(key=lambda x: -x[1])
            best_t, best_conf, best_src = candidates[0]
            results.append({
                "distance": name,
                "distance_m": target_m,
                "predicted_s": round(best_t),
                "confidence": best_conf,
                "source": best_src,
                "vdot": round(estimate_vdot(best_t, target_m), 1),
            })

    return results


def assess_injury_risk(metrics: list[DailyMetric]) -> dict:
    """Avalia risco de lesao com base nos ultimos 14 dias de metricas.

    ACWR > 1.5 por 3+ dias = ALTO
    TSB < -30 por 3+ dias = ALTO
    Aumento de carga > 30% em 7d = MODERADO
    """
    if not metrics:
        return {"level": "unknown", "reasons": ["Sem dados de treino ainda"], "recommendation": "Importe atividades para ver a avaliação"}

    recent = sorted(metrics, key=lambda m: m.date)[-14:]

    acwr_high = sum(1 for m in recent if m.acwr is not None and float(m.acwr) > 1.5)
    tsb_low = sum(1 for m in recent if m.tsb is not None and float(m.tsb) < -30)

    spike = False
    if len(recent) >= 14:
        load_recent7 = sum(float(m.daily_load or 0) for m in recent[-7:]) / 7
        load_prev7 = sum(float(m.daily_load or 0) for m in recent[-14:-7]) / 7
        # com base quase zero, qualquer treino vira "aumento de 30%"
        spike = load_prev7 >= ACWR_MIN_CHRONIC_DAILY_LOAD and (load_recent7 / load_prev7) > 1.3

    reasons: list[str] = []
    level = "low"

    if acwr_high >= 3:
        reasons.append(f"ACWR > 1.5 por {acwr_high} dias consecutivos")
        level = "high"
    if tsb_low >= 3:
        reasons.append(f"TSB < −30 por {tsb_low} dias (acúmulo de fadiga)")
        level = "high"
    if spike and level != "high":
        reasons.append("Carga aumentou > 30% comparado à semana anterior")
        level = "moderate"

    if not reasons:
        reasons.append("Carga dentro da zona segura")

    rec_map = {
        "high": "Reduza a carga por 3–5 dias e priorize sono e recuperação",
        "moderate": "Mantenha a intensidade atual; evite elevar mais a carga agora",
        "low": "Tudo certo — pode progredir normalmente",
        "unknown": "Importe atividades para ver a avaliação",
    }

    return {"level": level, "reasons": reasons, "recommendation": rec_map[level]}


def simulate_tsb(current_ctl: float, current_atl: float, planned_tss: list[float]) -> list[dict]:
    """Simula CTL/ATL/TSB para os proximos N dias com base nos TSS planejados."""
    ctl = current_ctl
    atl = current_atl
    results = []
    start = date.today()

    for i, tss in enumerate(planned_tss):
        tsb = ctl - atl
        ctl = ctl + _K_CTL * (tss - ctl)
        atl = atl + _K_ATL * (tss - atl)
        results.append({
            "date": str(start + timedelta(days=i + 1)),
            "ctl": round(ctl, 2),
            "atl": round(atl, 2),
            "tsb": round(tsb, 2),
            "planned_tss": tss,
        })

    return results


def training_recommendation(latest_metric: "DailyMetric | None") -> dict:
    """Recomendacao de treino para hoje baseada em TSB e ACWR."""
    if not latest_metric:
        return {"type": "unknown", "label": "Sem dados", "color": "#8b949e", "detail": "Importe atividades para ver a recomendação"}

    tsb = float(latest_metric.tsb) if latest_metric.tsb is not None else 0.0
    acwr = float(latest_metric.acwr) if latest_metric.acwr is not None else 1.0
    ctl = float(latest_metric.ctl) if latest_metric.ctl is not None else 0.0

    # TSB positivo depois de uma pausa nao e "forma em alta": e condicionamento
    # que se perdeu. Sem base, a recomendacao e retomar leve, nunca intensidade.
    if ctl < ACWR_MIN_CHRONIC_DAILY_LOAD:
        return {
            "type": "easy",
            "label": "Retomada gradual",
            "color": "#00BFFF",
            "detail": f"Pouco treino nas últimas semanas (CTL {ctl:.0f}) — volte com corridas leves antes de qualquer intensidade",
        }
    if acwr > 1.5 or tsb < -30:
        return {
            "type": "rest",
            "label": "Descanso / Recovery",
            "color": "#f85149",
            "detail": f"Carga muito alta — priorize recuperação hoje (TSB {tsb:+.1f})",
        }
    if tsb > 5:
        return {
            "type": "hard",
            "label": "Treino Duro",
            "color": "#3fb950",
            "detail": f"Forma em alta (TSB {tsb:+.1f}) — bom dia para intensidade ou prova",
        }
    if tsb >= -10:
        return {
            "type": "moderate",
            "label": "Treino Moderado",
            "color": "#e3b341",
            "detail": f"Forma moderada (TSB {tsb:+.1f}) — manutenção ou volume leve",
        }
    return {
        "type": "easy",
        "label": "Treino Leve / Regenerativo",
        "color": "#f0883e",
        "detail": f"Fadiga elevada (TSB {tsb:+.1f}) — volume baixo, sem intensidade",
    }
