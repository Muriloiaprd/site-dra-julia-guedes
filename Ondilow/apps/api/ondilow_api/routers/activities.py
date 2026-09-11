import hashlib
import uuid
from dataclasses import asdict
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select

from ondilow_api.config import settings
from ondilow_api.deps import CurrentUser, DbSession
from ondilow_api.metrics import compute_splits, default_hr_zones, hr_zone_distribution
from ondilow_api.metrics.basic import PointLike
from ondilow_api.models import Activity
from ondilow_api.parsers import ParserError, UnsupportedFormatError, parse_file
from ondilow_api.parsers.base import NormalizedActivity, NormalizedLap, NormalizedPoint
from ondilow_api.parsers.sports import normalize_sport
from ondilow_api.schemas.activity import (
    ActivityDetail,
    ActivitySummary,
    NormalizedActivityIn,
    SplitOut,
    UploadItemResult,
    UploadResponse,
    ZoneBucketOut,
)
from ondilow_api.services.import_service import file_sha256, import_activity

router = APIRouter(prefix="/activities", tags=["activities"])

_MAX_BYTES = 50 * 1024 * 1024


@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
def upload_activity(
    current_user: CurrentUser,
    db: DbSession,
    file: Annotated[UploadFile, File()],
) -> UploadResponse:
    content = file.file.read()
    if not content:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Arquivo vazio")
    if len(content) > _MAX_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Arquivo maior que 50MB")

    filename = file.filename or "upload"
    try:
        normalized = parse_file(filename, content)
    except UnsupportedFormatError as e:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, str(e)) from e
    except ParserError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e)) from e

    file_hash = file_sha256(content)
    saved_path = _persist_raw(current_user.id, filename, content)

    results: list[UploadItemResult] = []
    multi = len(normalized) > 1
    for i, norm in enumerate(normalized):
        # CSV gera varias atividades de um arquivo; deriva um hash de 64 chars por
        # linha para manter idempotencia no reupload sem estourar a coluna.
        hash_for_item = _derived_hash(file_hash, i) if multi else file_hash
        r = import_activity(
            db, current_user.id, norm, file_hash=hash_for_item, file_path=saved_path
        )
        results.append(
            UploadItemResult(
                activity_id=r.activity_id,
                duplicate=r.duplicate,
                sport=r.sport,
                distance_m=r.distance_m,
                points_stored=r.points_stored,
            )
        )

    return UploadResponse(filename=filename, imported=results)


@router.post(
    "/import-normalized", response_model=UploadItemResult, status_code=status.HTTP_201_CREATED
)
def import_normalized_activity(
    current_user: CurrentUser,
    db: DbSession,
    payload: NormalizedActivityIn,
) -> UploadItemResult:
    """Import direto de atividade ja estruturada (sem arquivo bruto).

    Usado para trazer atividades buscadas via MCP (Garmin/Strava) quando a
    fonte so devolve JSON (resumo + streams), nao um .fit/.gpx pronto para
    reupload em /activities/upload.
    """
    norm = NormalizedActivity(
        sport=normalize_sport(payload.sport),
        start_time=payload.start_time,
        duration_s=payload.duration_s,
        source=payload.source,
        source_activity_id=payload.source_activity_id,
        points=[NormalizedPoint(**p.model_dump()) for p in payload.points],
        laps=[NormalizedLap(**lap.model_dump()) for lap in payload.laps],
        moving_time_s=payload.moving_time_s,
        distance_m=payload.distance_m,
        elevation_gain_m=payload.elevation_gain_m,
        elevation_loss_m=payload.elevation_loss_m,
        avg_hr=payload.avg_hr,
        max_hr=payload.max_hr,
        avg_power_w=payload.avg_power_w,
        max_power_w=payload.max_power_w,
        avg_cadence=payload.avg_cadence,
        calories=payload.calories,
        avg_temperature_c=payload.avg_temperature_c,
        title=payload.title,
    )
    r = import_activity(db, current_user.id, norm)
    return UploadItemResult(
        activity_id=r.activity_id,
        duplicate=r.duplicate,
        sport=r.sport,
        distance_m=r.distance_m,
        points_stored=r.points_stored,
    )


@router.get("", response_model=list[ActivitySummary])
def list_activities(
    current_user: CurrentUser,
    db: DbSession,
    limit: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    sport: str | None = None,
    days: Annotated[int | None, Query(ge=1, le=365)] = None,
) -> list[Activity]:
    stmt = (
        select(Activity)
        .where(Activity.user_id == current_user.id, Activity.deleted_at.is_(None))
        .order_by(Activity.start_time.desc())
        .limit(limit)
        .offset(offset)
    )
    if sport:
        stmt = stmt.where(Activity.sport == sport)
    if days:
        since = date.today() - timedelta(days=days)
        stmt = stmt.where(Activity.start_time >= since)
    return list(db.execute(stmt).scalars())


@router.get("/{activity_id}", response_model=ActivityDetail)
def get_activity(activity_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> Activity:
    activity = db.execute(
        select(Activity).where(
            Activity.id == activity_id,
            Activity.user_id == current_user.id,
            Activity.deleted_at.is_(None),
        )
    ).scalar_one_or_none()
    if activity is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Atividade nao encontrada")
    return activity


@router.get("/{activity_id}/splits", response_model=list[SplitOut])
def get_splits(
    activity_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
    split_m: Annotated[float, Query(ge=100, le=42195)] = 1000.0,
) -> list[SplitOut]:
    activity = _load_activity(db, activity_id, current_user.id)
    points = [
        PointLike(elapsed_time_s=p.elapsed_time_s, distance_m=_f(p.distance_m), altitude_m=_f(p.altitude_m), hr=p.hr)
        for p in activity.points
    ]
    return [SplitOut(**asdict(s)) for s in compute_splits(points, split_m)]


@router.get("/{activity_id}/zones", response_model=list[ZoneBucketOut])
def get_zones(activity_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> list[ZoneBucketOut]:
    activity = _load_activity(db, activity_id, current_user.id)
    profile = current_user.profile
    if profile and profile.hr_zones:
        zones = profile.hr_zones
    elif profile and profile.max_hr:
        zones = default_hr_zones(profile.max_hr)
    else:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Configure max_hr (ou zonas) no perfil para calcular zonas de FC",
        )
    points = [PointLike(elapsed_time_s=p.elapsed_time_s, hr=p.hr) for p in activity.points]
    return [ZoneBucketOut(**asdict(z)) for z in hr_zone_distribution(points, zones)]


def _load_activity(db: DbSession, activity_id: uuid.UUID, user_id: uuid.UUID) -> Activity:
    activity = db.execute(
        select(Activity).where(
            Activity.id == activity_id,
            Activity.user_id == user_id,
            Activity.deleted_at.is_(None),
        )
    ).scalar_one_or_none()
    if activity is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Atividade nao encontrada")
    return activity


def _f(v) -> float | None:
    return float(v) if v is not None else None


def _derived_hash(file_hash: str, index: int) -> str:
    return hashlib.sha256(f"{file_hash}:{index}".encode()).hexdigest()


def _persist_raw(user_id: uuid.UUID, filename: str, content: bytes) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
    user_dir = settings.data_path / "uploads" / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)
    path = user_dir / f"{file_sha256(content)[:16]}.{ext}"
    path.write_bytes(content)
    return str(path)
