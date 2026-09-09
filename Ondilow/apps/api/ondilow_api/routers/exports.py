"""Exportacao de atividades como imagem (card/story/overlay)."""

import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select

from ondilow_api.config import settings
from ondilow_api.deps import CurrentUser, DbSession
from ondilow_api.models import Activity
from ondilow_api.models.activity import ActivityPoint
from ondilow_api.rendering.composer import render_card, render_photo_overlay, render_story

router = APIRouter(prefix="/activities", tags=["exports"])

_TEMPLATES = {"card", "story"}
_MAX_PHOTO_MB = 15


def _get_activity(db, activity_id: uuid.UUID, user_id: uuid.UUID) -> Activity:
    act = db.execute(
        select(Activity).where(
            Activity.id == activity_id,
            Activity.user_id == user_id,
            Activity.deleted_at.is_(None),
        )
    ).scalar_one_or_none()
    if not act:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Atividade nao encontrada")
    return act


def _activity_dict(act: Activity) -> dict:
    return {
        "sport": act.sport,
        "title": act.title,
        "start_time": act.start_time.isoformat() if act.start_time else None,
        "duration_s": int(act.duration_s) if act.duration_s else 0,
        "distance_m": float(act.distance_m) if act.distance_m else None,
        "elevation_gain_m": float(act.elevation_gain_m) if act.elevation_gain_m else None,
        "avg_hr": int(act.avg_hr) if act.avg_hr else None,
        "avg_pace_s_per_km": float(act.avg_pace_s_per_km) if act.avg_pace_s_per_km else None,
        "avg_speed_kmh": float(act.avg_speed_kmh) if act.avg_speed_kmh else None,
    }


def _get_gps_points(db, act: Activity) -> list[tuple[float, float]]:
    pts = db.execute(
        select(ActivityPoint.lat, ActivityPoint.lon)
        .where(
            ActivityPoint.activity_id == act.id,
            ActivityPoint.lat.is_not(None),
            ActivityPoint.lon.is_not(None),
        )
        .order_by(ActivityPoint.elapsed_time_s.asc())
    ).all()
    return [(float(r.lat), float(r.lon)) for r in pts]


def _cache_path(activity_id: uuid.UUID, template: str) -> Path:
    return settings.data_path / "exports" / f"{activity_id}_{template}.png"


@router.get("/{activity_id}/export")
def export_activity(
    activity_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
    template: str = Query(default="card", pattern="^(card|story)$"),
) -> Response:
    act = _get_activity(db, activity_id, current_user.id)
    cache = _cache_path(activity_id, template)

    # Usa cache se existir e atividade nao foi modificada
    if cache.exists() and cache.stat().st_mtime >= act.updated_at.timestamp():
        return Response(content=cache.read_bytes(), media_type="image/png")

    act_dict = _activity_dict(act)
    points = _get_gps_points(db, act)

    if template == "story":
        png = render_story(act_dict, points)
    else:
        png = render_card(act_dict, points)

    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_bytes(png)
    return Response(content=png, media_type="image/png")


@router.post("/{activity_id}/export/photo")
async def export_photo_overlay(
    activity_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
    photo: UploadFile = File(...),
) -> Response:
    if not photo.content_type or not photo.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Arquivo deve ser uma imagem")

    photo_bytes = await photo.read()
    if len(photo_bytes) > _MAX_PHOTO_MB * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Foto deve ter menos de {_MAX_PHOTO_MB}MB")

    act = _get_activity(db, activity_id, current_user.id)
    act_dict = _activity_dict(act)
    png = render_photo_overlay(photo_bytes, act_dict)

    return Response(content=png, media_type="image/png")
