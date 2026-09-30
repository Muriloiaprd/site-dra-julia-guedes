"""'Meu kit': o boneco que o atleta monta com as pecas de cada preset.

Cada preset (corrida, prova, calor, frio) guarda um dict de encaixes -> peca:
    {"torso": {"piece": "singlet", "color": "#00FF66", "equipment_id": "<uuid>" | None}, ...}
A lista de encaixes e pecas abaixo tem espelho no front (components/equipment/kitShapes.ts):
mudou aqui, muda la.
"""

import re
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from kactus_api.models import Equipment, EquipmentKit

PRESETS: dict[str, str] = {"corrida": "Corrida", "prova": "Prova", "calor": "Calor", "frio": "Chuva/frio"}

# encaixe -> (pecas possiveis, tipos de equipamento que podem ser ligados a ele)
SLOTS: dict[str, tuple[tuple[str, ...], tuple[str, ...]]] = {
    "head": (("none", "cap", "visor"), ("cap",)),
    "eyes": (("none", "sunglasses"), ("sunglasses",)),
    "torso": (("singlet", "tshirt", "longsleeve", "jacket"), ("top",)),
    "chest": (("none", "hr_strap"), ("hr_strap",)),
    "wrist": (("none", "watch"), ("watch",)),
    "hydration": (("none", "belt", "vest"), ("hydration",)),
    "waist": (("shorts", "tights"), ("bottom",)),
    "socks": (("low", "high"), ("socks",)),
    "feet": (("shoe",), ("shoe",)),
}

_COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")


def _slot(piece: str, color: str) -> dict:
    return {"piece": piece, "color": color, "equipment_id": None}


# Sugestao inicial de cada preset, antes de o atleta salvar o dele.
DEFAULTS: dict[str, dict[str, dict]] = {
    "corrida": {
        "head": _slot("none", "#FFFFFF"), "eyes": _slot("none", "#111111"), "torso": _slot("tshirt", "#2B2F36"),
        "chest": _slot("none", "#111111"), "wrist": _slot("watch", "#111111"), "hydration": _slot("none", "#111111"),
        "waist": _slot("shorts", "#111111"), "socks": _slot("low", "#FFFFFF"), "feet": _slot("shoe", "#00FF66"),
    },
    "prova": {
        "head": _slot("visor", "#FFFFFF"), "eyes": _slot("sunglasses", "#111111"), "torso": _slot("singlet", "#00FF66"),
        "chest": _slot("hr_strap", "#111111"), "wrist": _slot("watch", "#111111"), "hydration": _slot("none", "#111111"),
        "waist": _slot("shorts", "#0A0A0A"), "socks": _slot("low", "#FFFFFF"), "feet": _slot("shoe", "#C6FF00"),
    },
    "calor": {
        "head": _slot("visor", "#FFFFFF"), "eyes": _slot("sunglasses", "#111111"), "torso": _slot("singlet", "#F2F2F2"),
        "chest": _slot("none", "#111111"), "wrist": _slot("watch", "#111111"), "hydration": _slot("belt", "#1F1F1F"),
        "waist": _slot("shorts", "#1E293B"), "socks": _slot("low", "#FFFFFF"), "feet": _slot("shoe", "#00FF66"),
    },
    "frio": {
        "head": _slot("cap", "#111111"), "eyes": _slot("none", "#111111"), "torso": _slot("jacket", "#2563EB"),
        "chest": _slot("none", "#111111"), "wrist": _slot("watch", "#111111"), "hydration": _slot("none", "#111111"),
        "waist": _slot("tights", "#111111"), "socks": _slot("high", "#111111"), "feet": _slot("shoe", "#00FF66"),
    },
}


class KitError(ValueError):
    """Kit invalido (vira 422 no router)."""


def _user_equipment_types(db: Session, user_id: uuid.UUID) -> dict[str, str]:
    rows = db.execute(select(Equipment.id, Equipment.type).where(Equipment.user_id == user_id)).all()
    return {str(i): t for i, t in rows}


def validate_slots(db: Session, user_id: uuid.UUID, preset: str, slots: dict) -> dict:
    """Valida os encaixes enviados e completa os que faltam com o padrao do preset."""
    owned = _user_equipment_types(db, user_id)
    out = {k: dict(v) for k, v in DEFAULTS[preset].items()}
    for key, value in slots.items():
        if key not in SLOTS:
            raise KitError(f"encaixe desconhecido: {key}")
        pieces, types = SLOTS[key]
        piece = value.get("piece")
        color = value.get("color")
        eq_id = value.get("equipment_id")
        if piece not in pieces:
            raise KitError(f"peça inválida para {key}: {piece}")
        if not isinstance(color, str) or not _COLOR.match(color):
            raise KitError(f"cor inválida para {key}: {color}")
        if eq_id is not None:
            eq_id = str(eq_id)
            if eq_id not in owned:
                raise KitError("equipamento não encontrado")
            if owned[eq_id] not in types:
                raise KitError(f"esse equipamento não serve para o encaixe {key}")
        out[key] = {"piece": piece, "color": color.upper(), "equipment_id": eq_id}
    return out


def list_kits(db: Session, user_id: uuid.UUID) -> list[dict]:
    """Os 4 presets; os nao salvos vem com o padrao. Equipamento apagado some do encaixe."""
    saved = {k.preset: k for k in db.execute(select(EquipmentKit).where(EquipmentKit.user_id == user_id)).scalars()}
    owned = _user_equipment_types(db, user_id)
    kits = []
    for preset, label in PRESETS.items():
        row = saved.get(preset)
        slots = {k: dict(v) for k, v in DEFAULTS[preset].items()}
        if row:
            for key, value in (row.slots or {}).items():
                if key in slots:
                    slots[key] = {**value, "equipment_id": value.get("equipment_id") if value.get("equipment_id") in owned else None}
        kits.append({
            "preset": preset, "label": label, "slots": slots,
            "saved": row is not None, "updated_at": row.updated_at if row else None,
        })
    return kits


def save_kit(db: Session, user_id: uuid.UUID, preset: str, slots: dict) -> dict:
    clean = validate_slots(db, user_id, preset, slots)
    now = datetime.now(UTC)
    stmt = insert(EquipmentKit).values(user_id=user_id, preset=preset, slots=clean, updated_at=now)
    db.execute(stmt.on_conflict_do_update(constraint="uq_equipment_kits_user_preset", set_={"slots": clean, "updated_at": now}))
    db.commit()
    return next(k for k in list_kits(db, user_id) if k["preset"] == preset)
