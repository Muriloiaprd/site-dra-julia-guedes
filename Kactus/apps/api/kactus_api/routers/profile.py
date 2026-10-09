import json

from fastapi import APIRouter, Response
from sqlalchemy import select

from kactus_api.deps import CurrentUser, DbSession
from kactus_api.models import AthleteProfile, PersonalRecord
from kactus_api.schemas.profile import ProfileOut, ProfileUpdate, RecordOut
from kactus_api.services.export import build_export

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
    """Exporta todos os dados do usuario em JSON (portabilidade/LGPD): perfil,
    equipamentos, recordes, atividades, o que a Duni sabe e planejou, e a carga diaria."""
    body = json.dumps(build_export(db, current_user), ensure_ascii=False)
    return Response(
        content=body,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="kactus_export_{current_user.id}.json"'},
    )
