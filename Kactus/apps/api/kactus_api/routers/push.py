"""Notificações: chave pública, inscrição do aparelho, preferências e teste."""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select

from kactus_api.deps import CurrentUser, DbSession
from kactus_api.models import AthleteProfile, PushSubscription
from kactus_api.services import push

router = APIRouter(prefix="/push", tags=["push"])


class SubscriptionKeys(BaseModel):
    p256dh: str = Field(min_length=10, max_length=300)
    auth: str = Field(min_length=8, max_length=100)


class SubscriptionIn(BaseModel):
    endpoint: str = Field(min_length=10, max_length=2000, pattern=r"^https://")
    keys: SubscriptionKeys
    device: str | None = Field(None, max_length=120)


class UnsubscribeIn(BaseModel):
    endpoint: str = Field(min_length=10, max_length=2000)


class PrefsIn(BaseModel):
    treino_hoje: bool | None = None
    recorde: bool | None = None
    sem_treino: bool | None = None


def _config(db, user_id) -> dict:
    devices = db.execute(
        select(func.count()).select_from(PushSubscription).where(PushSubscription.user_id == user_id)
    ).scalar_one()
    return {"public_key": push.public_key(), "prefs": push.user_prefs(db, user_id), "devices": devices}


@router.get("/config")
def get_config(current_user: CurrentUser, db: DbSession) -> dict:
    """Chave para inscrever o aparelho, o que está ligado e quantos aparelhos recebem."""
    return _config(db, current_user.id)


@router.post("/subscribe", status_code=status.HTTP_201_CREATED)
def subscribe(payload: SubscriptionIn, current_user: CurrentUser, db: DbSession) -> dict:
    """Guarda (ou atualiza) a inscrição deste aparelho."""
    sub = db.execute(select(PushSubscription).where(PushSubscription.endpoint == payload.endpoint)).scalar_one_or_none()
    if sub is None:
        sub = PushSubscription(endpoint=payload.endpoint, user_id=current_user.id, p256dh="", auth="")
        db.add(sub)
    sub.user_id = current_user.id
    sub.p256dh = payload.keys.p256dh
    sub.auth = payload.keys.auth
    sub.device = payload.device
    sub.failures = 0
    db.commit()
    return _config(db, current_user.id)


@router.post("/unsubscribe")
def unsubscribe(payload: UnsubscribeIn, current_user: CurrentUser, db: DbSession) -> dict:
    """Este aparelho para de receber."""
    db.execute(
        delete(PushSubscription).where(
            PushSubscription.user_id == current_user.id, PushSubscription.endpoint == payload.endpoint
        )
    )
    db.commit()
    return _config(db, current_user.id)


@router.put("/prefs")
def update_prefs(payload: PrefsIn, current_user: CurrentUser, db: DbSession) -> dict:
    """Liga e desliga cada tipo de aviso."""
    profile = db.get(AthleteProfile, current_user.id)
    if profile is None:
        profile = AthleteProfile(user_id=current_user.id)
        db.add(profile)
    prefs = {**push.DEFAULT_PREFS, **(profile.push_prefs or {})}
    prefs.update(payload.model_dump(exclude_none=True))
    profile.push_prefs = prefs
    db.commit()
    return _config(db, current_user.id)


@router.post("/test")
def send_test(current_user: CurrentUser, db: DbSession) -> dict:
    """Manda um aviso de teste agora para os aparelhos inscritos."""
    has = db.execute(
        select(func.count()).select_from(PushSubscription).where(PushSubscription.user_id == current_user.id)
    ).scalar_one()
    if not has:
        raise HTTPException(
            status_code=409,
            detail={"error": "no_devices", "message": "Nenhum aparelho com notificações ligadas."},
        )
    delivered = push.send_now(
        db, current_user.id, push.Message(title="Kactus", body="Notificações ligadas neste aparelho. 🌵", url="/profile")
    )
    return {"delivered": delivered}
