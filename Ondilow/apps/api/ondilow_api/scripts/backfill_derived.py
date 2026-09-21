"""Preenche as metricas derivadas (GAP, deriva, ritmo e GAP por volta) das
atividades que ainda nao passaram pelo calculo, e na primeira passada de cada
uma tambem:

- reclassifica atividades 'other' relendo o arquivo original (o FIT diz se foi
  caminhada ou musculacao; antes do enum ter esses valores tudo virava 'other');
- dobra a cadencia gravada por perna (ver metrics/derived.py).

Seguro de rodar de novo: so pega atividades com derived_version nulo ou antigo,
e a reclassificacao e a cadencia so acontecem com derived_version nulo.

Rodar (da pasta apps/api):
    uv run python -m ondilow_api.scripts.backfill_derived --dry-run
    uv run python -m ondilow_api.scripts.backfill_derived
Use --email para limitar a um usuario.
"""

import argparse
import os
from collections import Counter
from pathlib import Path

from sqlalchemy import or_, select, update
from sqlalchemy.orm import selectinload

from ondilow_api.db import SessionLocal
from ondilow_api.metrics.records import recompute_all_records
from ondilow_api.models import Activity, ActivityPoint, User
from ondilow_api.parsers import ParserError, UnsupportedFormatError, parse_file
from ondilow_api.services.derived_metrics import (
    DERIVED_VERSION,
    apply_derived_metrics,
    normalize_step_cadence,
)


def _sport_from_file(path: str | None) -> str | None:
    if not path or not os.path.exists(path):
        return None
    try:
        parsed = parse_file(os.path.basename(path), Path(path).read_bytes())
    except (ParserError, UnsupportedFormatError, OSError):
        return None
    return parsed[0].sport if len(parsed) == 1 else None


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="calcula e mostra o resumo, sem gravar nada")
    ap.add_argument("--email", help="so as atividades deste usuario")
    args = ap.parse_args()

    stats: Counter[str] = Counter()
    reclassified_users = set()

    with SessionLocal() as db:
        stmt = select(Activity.id).where(
            Activity.deleted_at.is_(None),
            or_(Activity.derived_version.is_(None), Activity.derived_version < DERIVED_VERSION),
        )
        if args.email:
            stmt = stmt.join(User, User.id == Activity.user_id).where(User.email == args.email)
        ids = db.execute(stmt.order_by(Activity.start_time)).scalars().all()
        print(f"{len(ids)} atividade(s) para processar{' (dry-run)' if args.dry_run else ''}")

        for n, activity_id in enumerate(ids, 1):
            activity = db.execute(
                select(Activity)
                .where(Activity.id == activity_id)
                .options(selectinload(Activity.points), selectinload(Activity.laps))
            ).scalar_one()
            first_pass = activity.derived_version is None

            if first_pass and activity.sport == "other":
                sport = _sport_from_file(activity.file_path)
                if sport and sport != "other":
                    stats[f"reclassificada other -> {sport}"] += 1
                    activity.sport = sport
                    reclassified_users.add(activity.user_id)

            if first_pass:
                factor = normalize_step_cadence(activity, update_points=False)
                if factor != 1:
                    stats["cadencia dobrada"] += 1
                    db.execute(
                        update(ActivityPoint)
                        .where(ActivityPoint.activity_id == activity.id, ActivityPoint.cadence.is_not(None))
                        .values(cadence=ActivityPoint.cadence * factor)
                    )

            apply_derived_metrics(activity)
            if activity.gap_pace_s_per_km is not None:
                stats["com GAP"] += 1
            if activity.hr_decoupling_pct is not None:
                stats["com deriva"] += 1

            if args.dry_run:
                db.rollback()
            else:
                db.commit()
            db.expunge_all()
            if n % 25 == 0:
                print(f"  {n}/{len(ids)}")

        if not args.dry_run:
            # a modalidade entra na chave dos recordes (ex.: FC max por esporte)
            for user_id in reclassified_users:
                recompute_all_records(db, user_id)

    for key, count in sorted(stats.items()):
        print(f"{key}: {count}")
    if reclassified_users and not args.dry_run:
        print(f"recordes recalculados para {len(reclassified_users)} usuario(s)")


if __name__ == "__main__":
    main()
