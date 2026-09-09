from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from ondilow_api.deps import CurrentUser, DbSession
from ondilow_api.integrations.garmin import (
    PROVIDER,
    SyncResult,
    encrypt_credentials,
    sync_garmin,
)
from ondilow_api.models.user import UserIntegration
from ondilow_api.schemas.integrations import (
    GarminCredentials,
    IntegrationStatus,
    SyncResultOut,
)

router = APIRouter(prefix="/integrations", tags=["integrations"])


def _get_integration(db, user_id) -> UserIntegration | None:
    return db.execute(
        select(UserIntegration).where(
            UserIntegration.user_id == user_id,
            UserIntegration.provider == PROVIDER,
        )
    ).scalar_one_or_none()


@router.get("/garmin", response_model=IntegrationStatus)
def get_garmin_status(current_user: CurrentUser, db: DbSession) -> dict:
    integration = _get_integration(db, current_user.id)
    if not integration:
        return {
            "provider": PROVIDER,
            "is_enabled": False,
            "last_sync_at": None,
            "last_sync_status": None,
            "last_sync_error": None,
            "has_credentials": False,
        }
    return {
        "provider": PROVIDER,
        "is_enabled": integration.is_enabled,
        "last_sync_at": integration.last_sync_at,
        "last_sync_status": integration.last_sync_status,
        "last_sync_error": integration.last_sync_error,
        "has_credentials": True,
    }


@router.post("/garmin/credentials", response_model=IntegrationStatus, status_code=status.HTTP_201_CREATED)
def save_garmin_credentials(body: GarminCredentials, current_user: CurrentUser, db: DbSession) -> dict:
    encrypted = encrypt_credentials(body.email, body.password)
    integration = _get_integration(db, current_user.id)
    if integration:
        integration.credentials_encrypted = encrypted
        integration.is_enabled = True
        integration.last_sync_status = None
        integration.last_sync_error = None
    else:
        integration = UserIntegration(
            user_id=current_user.id,
            provider=PROVIDER,
            credentials_encrypted=encrypted,
            is_enabled=True,
        )
        db.add(integration)
    db.commit()
    db.refresh(integration)
    return {
        "provider": PROVIDER,
        "is_enabled": integration.is_enabled,
        "last_sync_at": integration.last_sync_at,
        "last_sync_status": integration.last_sync_status,
        "last_sync_error": integration.last_sync_error,
        "has_credentials": True,
    }


@router.post("/garmin/sync", response_model=SyncResultOut)
def trigger_garmin_sync(
    current_user: CurrentUser,
    db: DbSession,
    limit: int = Query(default=25, ge=1, le=100),
) -> dict:
    integration = _get_integration(db, current_user.id)
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Credenciais do Garmin nao cadastradas. Va em Perfil > Garmin.",
        )
    if not integration.is_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Integracao com Garmin esta desabilitada.",
        )

    result: SyncResult = sync_garmin(db, current_user.id, integration, limit=limit)
    return {"imported": result.imported, "skipped": result.skipped, "errors": result.errors}


@router.delete("/garmin/credentials", status_code=status.HTTP_204_NO_CONTENT)
def remove_garmin_credentials(current_user: CurrentUser, db: DbSession) -> None:
    integration = _get_integration(db, current_user.id)
    if integration:
        db.delete(integration)
        db.commit()
