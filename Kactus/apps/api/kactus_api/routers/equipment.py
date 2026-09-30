"""CRUD de equipamentos (tenis, bikes, etc.)."""

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from kactus_api.deps import CurrentUser, DbSession
from kactus_api.models import Activity, Equipment
from kactus_api.schemas.equipment import EquipmentCreate, EquipmentOut, EquipmentUpdate, KitOut, KitUpdate
from kactus_api.services.equipment_kits import PRESETS, KitError, list_kits, save_kit
from kactus_api.services.equipment_recommendations import recommendations

router = APIRouter(prefix="/equipment", tags=["equipment"])


def _total_distance(db: Any, eq: Equipment) -> float:
    """Soma initial_distance_m com a distancia de todas as atividades vinculadas."""
    activities_sum = db.execute(
        select(func.coalesce(func.sum(Activity.distance_m), 0)).where(
            Activity.equipment_id == eq.id,
            Activity.deleted_at.is_(None),
        )
    ).scalar_one()
    return float(eq.initial_distance_m or 0) + float(activities_sum)


def _to_out(db: Any, eq: Equipment) -> EquipmentOut:
    return EquipmentOut(
        id=eq.id,
        name=eq.name,
        type=eq.type,
        brand=eq.brand,
        model=eq.model,
        purchase_date=eq.purchase_date,
        retired_at=eq.retired_at,
        initial_distance_m=float(eq.initial_distance_m or 0),
        total_distance_m=_total_distance(db, eq),
        notes=eq.notes,
        photo_data_url=eq.photo_data_url,
        created_at=eq.created_at,
    )


@router.get("", response_model=list[EquipmentOut])
def list_equipment(current_user: CurrentUser, db: DbSession) -> list[EquipmentOut]:
    rows = db.execute(
        select(Equipment)
        .where(Equipment.user_id == current_user.id)
        .order_by(Equipment.created_at.desc())
    ).scalars().all()
    return [_to_out(db, r) for r in rows]


@router.get("/recommendations")
def get_recommendations(current_user: CurrentUser, db: DbSession) -> dict:
    """Equipamentos recomendados para os esportes que o atleta pratica."""
    return recommendations(db, current_user.id)


@router.get("/kits", response_model=list[KitOut])
def get_kits(current_user: CurrentUser, db: DbSession) -> list[dict]:
    """Os 4 presets do "Meu kit" (os nao salvos vem com uma sugestao)."""
    return list_kits(db, current_user.id)


@router.put("/kits/{preset}", response_model=KitOut)
def put_kit(preset: str, body: KitUpdate, current_user: CurrentUser, db: DbSession) -> dict:
    if preset not in PRESETS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preset nao encontrado")
    slots = {k: v.model_dump(mode="json") for k, v in body.slots.items()}
    try:
        return save_kit(db, current_user.id, preset, slots)
    except KitError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e


@router.post("", response_model=EquipmentOut, status_code=status.HTTP_201_CREATED)
def create_equipment(
    body: EquipmentCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> EquipmentOut:
    eq = Equipment(
        user_id=current_user.id,
        name=body.name,
        type=body.type,
        brand=body.brand,
        model=body.model,
        purchase_date=body.purchase_date,
        initial_distance_m=body.initial_distance_m,
        notes=body.notes,
        photo_data_url=body.photo_data_url,
    )
    db.add(eq)
    db.commit()
    db.refresh(eq)
    return _to_out(db, eq)


@router.patch("/{equipment_id}", response_model=EquipmentOut)
def update_equipment(
    equipment_id: uuid.UUID,
    body: EquipmentUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> EquipmentOut:
    eq = db.execute(
        select(Equipment).where(
            Equipment.id == equipment_id,
            Equipment.user_id == current_user.id,
        )
    ).scalar_one_or_none()
    if not eq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipamento nao encontrado")

    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(eq, field, val)
    db.commit()
    db.refresh(eq)
    return _to_out(db, eq)


@router.delete("/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_equipment(
    equipment_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> None:
    eq = db.execute(
        select(Equipment).where(
            Equipment.id == equipment_id,
            Equipment.user_id == current_user.id,
        )
    ).scalar_one_or_none()
    if not eq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipamento nao encontrado")
    db.delete(eq)
    db.commit()
