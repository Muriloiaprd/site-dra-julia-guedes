"""CRUD de equipamentos (tenis, bikes, etc.)."""

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select, update

from kactus_api.deps import CurrentUser, DbSession
from kactus_api.models import Activity, Equipment
from kactus_api.schemas.equipment import EquipmentCreate, EquipmentOut, EquipmentUpdate
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
        default_sports=list(eq.default_sports or []),
        created_at=eq.created_at,
    )


def _claim_sports(db: Any, user_id: uuid.UUID, eq: Equipment) -> None:
    """Cada esporte tem um padrao so: tira os esportes de `eq` dos outros equipamentos."""
    if not eq.default_sports:
        return
    others = db.execute(
        select(Equipment).where(Equipment.user_id == user_id, Equipment.id != eq.id)
    ).scalars().all()
    for o in others:
        kept = [s for s in (o.default_sports or []) if s not in eq.default_sports]
        if kept != list(o.default_sports or []):
            o.default_sports = kept



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
        default_sports=body.default_sports,
    )
    db.add(eq)
    db.flush()
    _claim_sports(db, current_user.id, eq)
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

    data = body.model_dump(exclude_unset=True)
    if data.get("default_sports") is None:
        data.pop("default_sports", None)
    for field, val in data.items():
        setattr(eq, field, val)
    if eq.retired_at is not None:
        eq.default_sports = []  # aposentado nao entra mais em treino novo
    _claim_sports(db, current_user.id, eq)
    db.commit()
    db.refresh(eq)
    return _to_out(db, eq)


@router.post("/{equipment_id}/apply-default")
def apply_default(equipment_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> dict:
    """Liga o equipamento aos treinos antigos sem equipamento dos seus esportes padrao
    (a partir da data de compra, quando houver)."""
    eq = db.execute(
        select(Equipment).where(Equipment.id == equipment_id, Equipment.user_id == current_user.id)
    ).scalar_one_or_none()
    if not eq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipamento nao encontrado")
    if not eq.default_sports:
        return {"updated": 0}
    conds = [
        Activity.user_id == current_user.id,
        Activity.deleted_at.is_(None),
        Activity.equipment_id.is_(None),
        Activity.sport.in_(eq.default_sports),
    ]
    if eq.purchase_date:
        conds.append(func.date(Activity.start_time) >= eq.purchase_date)
    if eq.retired_at:
        conds.append(func.date(Activity.start_time) <= eq.retired_at)
    result = db.execute(update(Activity).where(*conds).values(equipment_id=eq.id))
    db.commit()
    return {"updated": result.rowcount or 0}


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
