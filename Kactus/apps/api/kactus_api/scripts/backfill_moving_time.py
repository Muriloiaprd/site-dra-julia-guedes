"""Recalcula o tempo em movimento das atividades ja importadas.

Ate 2026-09-27 so o FIT trazia tempo em movimento, e mesmo ele era o
`total_timer_time` (so desconta as pausas do relogio); GPX e TCX ficavam com o
tempo decorrido. Este script relê o arquivo original de cada atividade (os
pontos gravados no banco sao reduzidos) e recalcula, pela mesma regra do import
(`resolve_moving_time`):

- `moving_time_s`, `avg_pace_s_per_km` e `avg_speed_kmh`;
- as metricas derivadas (a deriva cardiaca depende de movimento / total);
- no fim, a carga diaria (TSS/CTL/ATL) de cada usuario afetado.

Atividade sem arquivo (import via JSON) usa os pontos do banco.

Seguro de rodar de novo: so grava o que mudou.

Rodar (da pasta apps/api):
    uv run python -m kactus_api.scripts.backfill_moving_time --dry-run
    uv run python -m kactus_api.scripts.backfill_moving_time
Use --email para limitar a um usuario.
"""

import argparse
from collections import Counter

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from kactus_api.db import SessionLocal
from kactus_api.metrics.load import update_daily_metrics
from kactus_api.models import Activity, User
from kactus_api.parsers import (
    NormalizedActivity,
    NormalizedPoint,
    ParserError,
    UnsupportedFormatError,
    parse_file,
)
from kactus_api.services.derived_metrics import apply_derived_metrics
from kactus_api.services.import_service import avg_pace_s_per_km, avg_speed_kmh, resolve_moving_time
from kactus_api.services.uploads import resolve_upload_path


def _from_file(activity: Activity) -> NormalizedActivity | None:
    path = resolve_upload_path(activity.file_path)
    if path is None:
        return None
    try:
        parsed = parse_file(path.name, path.read_bytes())
    except (ParserError, UnsupportedFormatError, OSError):
        return None
    return parsed[0] if len(parsed) == 1 else None


def _from_db(activity: Activity) -> NormalizedActivity:
    return NormalizedActivity(
        sport=activity.sport,
        start_time=activity.start_time,
        duration_s=activity.duration_s,
        source=activity.source,
        moving_time_s=None,
        points=[
            NormalizedPoint(
                elapsed_time_s=p.elapsed_time_s,
                lat=float(p.lat) if p.lat is not None else None,
                lon=float(p.lon) if p.lon is not None else None,
                distance_m=float(p.distance_m) if p.distance_m is not None else None,
                speed_ms=float(p.speed_ms) if p.speed_ms is not None else None,
            )
            for p in activity.points
        ],
    )


def _hms(seconds: int) -> str:
    return f"{seconds // 3600}h{seconds % 3600 // 60:02d}m"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="calcula e mostra o resumo, sem gravar nada")
    ap.add_argument("--email", help="so as atividades deste usuario")
    args = ap.parse_args()

    stats: Counter[str] = Counter()
    before_total = after_total = 0
    earliest_by_user: dict = {}

    with SessionLocal() as db:
        stmt = select(Activity.id).where(Activity.deleted_at.is_(None))
        if args.email:
            stmt = stmt.join(User, User.id == Activity.user_id).where(User.email == args.email)
        ids = db.execute(stmt.order_by(Activity.start_time)).scalars().all()
        print(f"{len(ids)} atividade(s) para conferir{' (dry-run)' if args.dry_run else ''}")

        for n, activity_id in enumerate(ids, 1):
            activity = db.execute(
                select(Activity)
                .where(Activity.id == activity_id)
                .options(selectinload(Activity.points), selectinload(Activity.laps))
            ).scalar_one()

            norm = _from_file(activity)
            if norm is None:
                stats["sem arquivo: pontos do banco"] += 1
                norm = _from_db(activity)
            # o sport do banco vale (pode ter sido reclassificado depois do import)
            norm.sport = activity.sport
            resolve_moving_time(norm)

            old = activity.moving_time_s
            new = norm.moving_time_s
            before_total += old or activity.duration_s
            after_total += new or activity.duration_s
            if new is None or new == old:
                stats["sem mudanca"] += 1
                db.expunge_all()
                continue

            stats["tempo em movimento atualizado"] += 1
            if old is None:
                stats["  (antes nao tinha)"] += 1
            activity.moving_time_s = new
            activity.avg_pace_s_per_km = avg_pace_s_per_km(activity.sport, activity.distance_m, new)
            activity.avg_speed_kmh = avg_speed_kmh(activity.distance_m, new)
            apply_derived_metrics(activity)

            day = activity.start_time.date()
            prev = earliest_by_user.get(activity.user_id)
            earliest_by_user[activity.user_id] = day if prev is None or day < prev else prev

            if args.dry_run:
                db.rollback()
            else:
                db.commit()
            db.expunge_all()
            if n % 50 == 0:
                print(f"  {n}/{len(ids)}")

        if not args.dry_run:
            for user_id, day in earliest_by_user.items():
                update_daily_metrics(db, user_id, from_date=day)

    for key, count in stats.items():
        print(f"{key}: {count}")
    print(f"tempo somado: {_hms(before_total)} -> {_hms(after_total)} (paradas descontadas: {_hms(before_total - after_total)})")
    if earliest_by_user and not args.dry_run:
        print(f"carga diaria recalculada para {len(earliest_by_user)} usuario(s)")


if __name__ == "__main__":
    main()
