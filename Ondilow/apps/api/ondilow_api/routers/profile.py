from fastapi import APIRouter
from sqlalchemy import select

from ondilow_api.deps import CurrentUser, DbSession
from ondilow_api.models import AthleteProfile, PersonalRecord
from ondilow_api.schemas.profile import ProfileOut, ProfileUpdate, RecordOut

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
