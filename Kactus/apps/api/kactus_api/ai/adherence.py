"""Planejado × feito: cada treino planejado dos últimos dias ao lado do que foi feito.

Tudo calculado, sem IA: volume (distância ou duração) e ritmo contra o alvo. O
comentário da Duni é o comentário da atividade (que já lê o planejado do dia) e
só é gerado quando o atleta pede.
"""

from __future__ import annotations

import re
import uuid
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from kactus_api.models.activity import Activity
from kactus_api.models.coach import CoachInteraction, PlannedWorkout

# fora de ±15% do planejado o volume conta como "a mais" ou "a menos"
_VOLUME_TOL = 0.15
# folga do ritmo em torno da faixa do alvo (s/km)
_PACE_TOL_S = 5
# alvo de ritmo com um valor só vira uma faixa de ±10 s
_SINGLE_PACE_SPREAD_S = 10

_RUN_SPORTS = {"run", "trail_run", "treadmill"}
_PACE_RE = re.compile(r"(\d{1,2}):([0-5]\d)")


def pace_range(text: str | None) -> tuple[float, float | None] | None:
    """Faixa de ritmo (s/km) a partir do texto do alvo ("6:10–6:40/km", "5:58/km",
    "6:55/km ou mais lento"). None quando o texto não tem ritmo."""
    if not text:
        return None
    paces = [int(m) * 60 + int(s) for m, s in _PACE_RE.findall(text)]
    if not paces:
        return None
    if len(paces) == 1:
        p = paces[0]
        if "mais lento" in text:
            return float(p), None
        return float(p - _SINGLE_PACE_SPREAD_S), float(p + _SINGLE_PACE_SPREAD_S)
    return float(min(paces)), float(max(paces))


def volume_verdict(planned: PlannedWorkout, act: Activity) -> tuple[str | None, float | None]:
    """'cumpriu', 'a_mais' ou 'a_menos' pela distância (ou duração) e a razão feito/planejado."""
    if planned.target_distance_m and act.distance_m:
        ratio = float(act.distance_m) / float(planned.target_distance_m)
    elif planned.target_duration_s:
        done_s = act.moving_time_s or act.duration_s
        ratio = float(done_s) / float(planned.target_duration_s) if done_s else None
    else:
        ratio = None
    if ratio is None:
        return None, None
    if ratio < 1 - _VOLUME_TOL:
        return "a_menos", round(ratio, 2)
    if ratio > 1 + _VOLUME_TOL:
        return "a_mais", round(ratio, 2)
    return "cumpriu", round(ratio, 2)


def pace_verdict(planned: PlannedWorkout, act: Activity) -> str | None:
    """'no_ritmo', 'mais_rapido' ou 'mais_lento' contra a faixa do alvo (só corrida)."""
    if act.sport not in _RUN_SPORTS or act.avg_pace_s_per_km is None:
        return None
    rng = pace_range((planned.targets or {}).get("ritmo"))
    if rng is None:
        return None
    lo, hi = rng
    pace = float(act.avg_pace_s_per_km)
    if pace < lo - _PACE_TOL_S:
        return "mais_rapido"
    if hi is not None and pace > hi + _PACE_TOL_S:
        return "mais_lento"
    return "no_ritmo"


def _f(v) -> float | None:
    return float(v) if v is not None else None


def recent_adherence(db: Session, user_id: uuid.UUID, days: int = 7, today: date | None = None) -> list[dict]:
    """Treinos planejados de `days` dias para trás até hoje que já têm desfecho
    (feito ou pulado), o mais recente primeiro."""
    today = today or date.today()
    rows = db.execute(
        select(PlannedWorkout)
        .where(
            PlannedWorkout.user_id == user_id,
            PlannedWorkout.date >= today - timedelta(days=days),
            PlannedWorkout.date <= today,
            PlannedWorkout.status.in_(("done", "skipped")),
        )
        .order_by(PlannedWorkout.date.desc())
    ).scalars().all()

    act_ids = [w.activity_id for w in rows if w.activity_id]
    acts = {
        a.id: a
        for a in db.execute(
            select(Activity).where(Activity.id.in_(act_ids), Activity.deleted_at.is_(None))
        ).scalars()
    } if act_ids else {}
    comments: dict[uuid.UUID, CoachInteraction] = {}
    if acts:
        for c in db.execute(
            select(CoachInteraction)
            .where(
                CoachInteraction.user_id == user_id,
                CoachInteraction.kind == "activity",
                CoachInteraction.activity_id.in_(list(acts)),
            )
            .order_by(CoachInteraction.created_at.desc())
        ).scalars():
            comments.setdefault(c.activity_id, c)

    out = []
    for w in rows:
        act = acts.get(w.activity_id) if w.activity_id else None
        targets = w.targets or {}
        item = {
            "id": w.id,
            "date": w.date,
            "title": w.title,
            "sport": w.sport,
            "status": "done" if act else "skipped",
            "planned": {
                "distance_m": _f(w.target_distance_m),
                "duration_s": w.target_duration_s,
                "intensity": w.target_intensity,
                "ritmo": targets.get("ritmo"),
                "zona_fc": targets.get("zona_fc"),
            },
            "actual": None,
            "volume": None,
            "ratio": None,
            "ritmo": None,
            "comment": None,
        }
        if act:
            item["actual"] = {
                "activity_id": act.id,
                "title": act.title,
                "sport": act.sport,
                "distance_m": _f(act.distance_m),
                "moving_s": act.moving_time_s or act.duration_s,
                "pace_s_per_km": _f(act.avg_pace_s_per_km),
                "avg_hr": act.avg_hr,
                "rpe": act.rpe,
            }
            item["volume"], item["ratio"] = volume_verdict(w, act)
            item["ritmo"] = pace_verdict(w, act)
            c = comments.get(act.id)
            if c:
                item["comment"] = {"text": c.content, "generated_at": c.created_at, "model_used": c.model_used}
        out.append(item)
    return out
