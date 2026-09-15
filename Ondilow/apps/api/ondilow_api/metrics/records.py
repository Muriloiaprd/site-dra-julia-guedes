"""Atualiza personal_records a partir de uma atividade recem-importada.

Mantem historico: um novo PR so e inserido quando bate o melhor valor atual
para aquela combinacao (sport, record_type). O PR "vigente" e sempre a linha
mais recente por combinacao.
"""

import uuid

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from ondilow_api.metrics.basic import PointLike, best_efforts
from ondilow_api.models import Activity, PersonalRecord

# (record_type, valor, unidade, "menor e melhor?")
_RecordCandidate = tuple[str, float, str, bool]

# distancia alvo (m) -> record_type, por grupo de esporte
_RUN_EFFORTS = {
    1000: "fastest_1k",
    5000: "fastest_5k",
    10000: "fastest_10k",
    21097: "fastest_21k",
    42195: "fastest_42k",
}
_SWIM_EFFORTS = {
    100: "fastest_100m_swim",
    400: "fastest_400m_swim",
}
_RUN_SPORTS = {"run", "trail_run", "treadmill"}
_SWIM_SPORTS = {"swim", "open_water_swim"}
_BIKE_SPORTS = {"bike", "mtb", "gravel", "indoor_bike"}


def update_records(db: Session, activity: Activity) -> list[str]:
    """Retorna os record_types que foram batidos/registrados nesta atividade."""
    points = [
        PointLike(elapsed_time_s=p.elapsed_time_s, distance_m=_f(p.distance_m))
        for p in activity.points
    ]
    broken: list[str] = []
    for record_type, value, unit, lower_is_better in _record_candidates(activity, points):
        if _maybe_record(db, activity, record_type, value, unit, lower_is_better=lower_is_better):
            broken.append(record_type)

    db.commit()
    return broken


def recompute_all_records(db: Session, user_id) -> None:
    """Apaga todos os PRs do usuario e reprocessa as atividades em ordem
    cronologica. Necessario quando uma atividade e editada (modalidade muda
    de grupo) ou excluida, pois um PR pode ter sido sustentado por ela.

    Ao contrario de update_records() (que consulta o banco pra achar o
    "melhor atual"), aqui o melhor de cada combinacao (sport, record_type) e
    mantido em memoria enquanto percorre as atividades em ordem cronologica
    -- com muito historico (100+ atividades), um SELECT por combinacao a
    cada atividade levava dezenas de segundos contra o Neon."""
    db.execute(delete(PersonalRecord).where(PersonalRecord.user_id == user_id))
    db.commit()

    activities = db.execute(
        select(Activity)
        .where(Activity.user_id == user_id, Activity.deleted_at.is_(None))
        .options(selectinload(Activity.points))
        .order_by(Activity.start_time.asc())
    ).scalars().all()

    best: dict[tuple[str, str], tuple[float, uuid.UUID]] = {}
    for activity in activities:
        points = [
            PointLike(elapsed_time_s=p.elapsed_time_s, distance_m=_f(p.distance_m))
            for p in activity.points
        ]
        for record_type, value, unit, lower_is_better in _record_candidates(activity, points):
            key = (activity.sport, record_type)
            prev = best.get(key)
            better = prev is None or (value < prev[0] if lower_is_better else value > prev[0])
            if not better:
                continue
            db.add(
                PersonalRecord(
                    user_id=user_id,
                    sport=activity.sport,
                    record_type=record_type,
                    value=value,
                    unit=unit,
                    activity_id=activity.id,
                    achieved_at=activity.start_time,
                    previous_value=prev[0] if prev else None,
                    previous_activity_id=prev[1] if prev else None,
                )
            )
            best[key] = (value, activity.id)

    db.commit()


def _record_candidates(activity: Activity, points: list[PointLike]) -> list[_RecordCandidate]:
    """Candidatos a recorde desta atividade, sem tocar o banco."""
    candidates: list[_RecordCandidate] = []

    efforts = _efforts_for_sport(activity.sport)
    if efforts and points:
        best = best_efforts(points, list(efforts.keys()))
        for dist, be in best.items():
            candidates.append((efforts[dist], be.duration_s, "seconds", True))

    longest = _longest_type(activity.sport)
    if longest and activity.distance_m:
        candidates.append((longest, float(activity.distance_m), "meters", False))

    if activity.max_hr:
        candidates.append(("max_hr_recorded", float(activity.max_hr), "bpm", False))

    return candidates


def _efforts_for_sport(sport: str) -> dict[int, str]:
    if sport in _RUN_SPORTS:
        return _RUN_EFFORTS
    if sport in _SWIM_SPORTS:
        return _SWIM_EFFORTS
    return {}


def _longest_type(sport: str) -> str | None:
    if sport in _RUN_SPORTS:
        return "longest_run"
    if sport in _BIKE_SPORTS:
        return "longest_ride"
    if sport in _SWIM_SPORTS:
        return "longest_swim"
    return None


def _maybe_record(
    db: Session,
    activity: Activity,
    record_type: str,
    value: float,
    unit: str,
    *,
    lower_is_better: bool,
) -> bool:
    current = db.execute(
        select(PersonalRecord)
        .where(
            PersonalRecord.user_id == activity.user_id,
            PersonalRecord.sport == activity.sport,
            PersonalRecord.record_type == record_type,
        )
        .order_by(PersonalRecord.achieved_at.desc())
        .limit(1)
    ).scalar_one_or_none()

    if current is not None:
        cur = float(current.value)
        better = value < cur if lower_is_better else value > cur
        if not better:
            return False

    db.add(
        PersonalRecord(
            user_id=activity.user_id,
            sport=activity.sport,
            record_type=record_type,
            value=value,
            unit=unit,
            activity_id=activity.id,
            achieved_at=activity.start_time,
            previous_value=float(current.value) if current else None,
            previous_activity_id=current.activity_id if current else None,
        )
    )
    return True


def _f(v) -> float | None:
    return float(v) if v is not None else None
