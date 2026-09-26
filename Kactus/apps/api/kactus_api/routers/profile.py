import json
from datetime import UTC, datetime

from fastapi import APIRouter, Response
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from kactus_api.deps import CurrentUser, DbSession
from kactus_api.models import Activity, AthleteProfile, Equipment, PersonalRecord
from kactus_api.schemas.activity import ActivityDetail
from kactus_api.schemas.profile import ProfileOut, ProfileUpdate, RecordOut

router = APIRouter(tags=["profile"])


@router.get("/profile", response_model=ProfileOut)
def get_profile(current_user: CurrentUser, db: DbSession) -> AthleteProfile:
    profile = current_user.profile
    if profile is None:
        profile = AthleteProfile(user_id=current_user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@router.put("/profile", response_model=ProfileOut)
def update_profile(payload: ProfileUpdate, current_user: CurrentUser, db: DbSession) -> AthleteProfile:
    profile = current_user.profile
    if profile is None:
        profile = AthleteProfile(user_id=current_user.id)
        db.add(profile)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return profile


@router.get("/records", response_model=list[RecordOut])
def list_records(current_user: CurrentUser, db: DbSession) -> list[PersonalRecord]:
    """Retorna o PR vigente (mais recente) de cada combinacao sport+record_type."""
    rows = db.execute(
        select(PersonalRecord)
        .where(PersonalRecord.user_id == current_user.id)
        .order_by(PersonalRecord.achieved_at.desc())
    ).scalars()

    seen: set[tuple[str, str]] = set()
    current: list[PersonalRecord] = []
    for r in rows:
        key = (r.sport, r.record_type)
        if key not in seen:
            seen.add(key)
            current.append(r)
    return current


@router.get("/profile/export")
def export_data(current_user: CurrentUser, db: DbSession) -> Response:
    """Exporta todos os dados do usuario em JSON (portabilidade/LGPD).

    Monta o payload inteiro em memoria antes de responder -- de proposito NAO
    usa StreamingResponse: a dependency `db` fecha a sessao no teardown antes
    do generator de um streaming rodar, um erro classico de "Session is
    closed" no meio do arquivo. Para o volume de dados de um uso pessoal isso
    e rapido o bastante; se um dia o historico ficar grande demais pra caber
    em memoria, ai sim vale paginar/streamar de verdade.
    """
    activities = db.execute(
        select(Activity)
        .where(Activity.user_id == current_user.id, Activity.deleted_at.is_(None))
        .options(selectinload(Activity.points), selectinload(Activity.laps))
        .order_by(Activity.start_time)
    ).scalars().all()

    records = db.execute(
        select(PersonalRecord).where(PersonalRecord.user_id == current_user.id)
    ).scalars().all()

    equipment = db.execute(
        select(Equipment).where(Equipment.user_id == current_user.id)
    ).scalars().all()

    payload = {
        "exported_at": datetime.now(UTC).isoformat(),
        "user": {
            "id": str(current_user.id),
            "email": current_user.email,
            "created_at": current_user.created_at.isoformat(),
        },
        "profile": (
            ProfileOut.model_validate(current_user.profile).model_dump(mode="json")
            if current_user.profile
            else None
        ),
        "equipment": [
            {
                "id": str(e.id),
                "name": e.name,
                "type": e.type,
                "brand": e.brand,
                "model": e.model,
                "purchase_date": e.purchase_date.isoformat() if e.purchase_date else None,
                "retired_at": e.retired_at.isoformat() if e.retired_at else None,
                "initial_distance_m": float(e.initial_distance_m),
                "notes": e.notes,
            }
            for e in equipment
        ],
        "records": [RecordOut.model_validate(r).model_dump(mode="json") for r in records],
        "activities": [ActivityDetail.model_validate(a).model_dump(mode="json") for a in activities],
    }

    body = json.dumps(payload, ensure_ascii=False)
    return Response(
        content=body,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="kactus_export_{current_user.id}.json"'},
    )
