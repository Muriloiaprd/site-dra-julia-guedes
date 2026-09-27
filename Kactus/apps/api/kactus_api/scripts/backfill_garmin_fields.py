"""Preenche nas atividades ja importadas os dados que o FIT do Garmin traz e o
Kactus so passou a ler em 2026-09-27 (migration 018):

- efeito de treino, beneficio principal, FC de recuperacao, suor, calorias em
  repouso, autoavaliacao do relogio;
- dinamica de corrida (resumo e por ponto), melhor ritmo, potencia normalizada;
- temperatura media/min/max e elevacao min/max (pelos pontos, vale para GPX e
  TCX tambem) e o tempo andando dentro das corridas (estimado);
- a cadencia media com a fracao que o FIT grava (170 -> 171).

Relê o arquivo original de cada atividade (os pontos do banco sao reduzidos).
Atividade sem arquivo fica como esta. Seguro de rodar de novo: so grava o que
mudou.

Rodar (da pasta apps/api):
    uv run python -m kactus_api.scripts.backfill_garmin_fields --dry-run
    uv run python -m kactus_api.scripts.backfill_garmin_fields
Use --email para limitar a um usuario.
"""

import argparse
from collections import Counter

from sqlalchemy import select, text

from kactus_api.db import SessionLocal
from kactus_api.metrics.derived import step_cadence_factor
from kactus_api.metrics.garmin import benefit_label
from kactus_api.models import Activity, User
from kactus_api.scripts.backfill_moving_time import _from_file
from kactus_api.services.import_service import derive_extremes, garmin_fields, point_dynamics

_POINT_COLUMNS = ("vertical_oscillation_mm", "stance_time_ms", "vertical_ratio_pct", "step_length_mm")


def _same(a, b) -> bool:
    if a is None or b is None:
        return a is b
    return abs(float(a) - float(b)) < 0.01


def _update_points(db, activity: Activity, norm) -> int:
    """Dinamica por ponto. Manda todos os pontos do arquivo que tem dinamica; o
    UPDATE so acerta os que foram gravados (os do banco sao reduzidos), entao nao
    precisa carregar os pontos do banco."""
    already = db.execute(
        text("SELECT 1 FROM activity_points WHERE activity_id = :aid AND step_length_mm IS NOT NULL LIMIT 1"),
        {"aid": activity.id},
    ).first()
    if already:
        return 0
    rows = []
    for p in norm.points:
        dyn = point_dynamics(p)
        if any(v is not None for v in dyn.values()):
            rows.append((p.elapsed_time_s, *(dyn[c] for c in _POINT_COLUMNS)))
    if not rows:
        return 0
    params = {"aid": activity.id}
    values = []
    for i, row in enumerate(rows):
        keys = [f"t{i}", *(f"c{j}_{i}" for j in range(len(_POINT_COLUMNS)))]
        params.update(dict(zip(keys, row, strict=True)))
        values.append(
            f"(CAST(:{keys[0]} AS integer), CAST(:{keys[1]} AS numeric), CAST(:{keys[2]} AS smallint), "
            f"CAST(:{keys[3]} AS numeric), CAST(:{keys[4]} AS smallint))"
        )
    result = db.execute(
        text(
            "UPDATE activity_points AS p SET "
            + ", ".join(f"{c} = v.{c}" for c in _POINT_COLUMNS)
            + " FROM (VALUES " + ", ".join(values) + ") AS v(t, " + ", ".join(_POINT_COLUMNS) + ")"
            + " WHERE p.activity_id = :aid AND p.elapsed_time_s = v.t"
        ),
        params,
    )
    return result.rowcount


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="calcula e mostra o resumo, sem gravar nada")
    ap.add_argument("--email", help="so as atividades deste usuario")
    args = ap.parse_args()

    stats: Counter[str] = Counter()
    fields_changed: Counter[str] = Counter()
    benefits: Counter[str] = Counter()
    points_updated = 0

    with SessionLocal() as db:
        stmt = select(Activity.id).where(Activity.deleted_at.is_(None), Activity.file_path.is_not(None))
        if args.email:
            stmt = stmt.join(User, User.id == Activity.user_id).where(User.email == args.email)
        ids = db.execute(stmt.order_by(Activity.start_time)).scalars().all()
        print(f"{len(ids)} atividade(s) com arquivo{' (dry-run)' if args.dry_run else ''}")

        for n, activity_id in enumerate(ids, 1):
            activity = db.execute(select(Activity).where(Activity.id == activity_id)).scalar_one()
            norm = _from_file(activity)
            if norm is None:
                stats["arquivo nao encontrado ou ilegivel"] += 1
                db.expunge_all()
                continue
            norm.sport = activity.sport  # o do banco vale (pode ter sido reclassificado)
            derive_extremes(norm)

            new = garmin_fields(norm)
            new["avg_temperature_c"] = norm.avg_temperature_c
            if norm.avg_cadence is not None and norm.source == "fit":
                factor = step_cadence_factor(activity.sport, norm.avg_cadence, [p.cadence for p in norm.points])
                new["avg_cadence"] = round(norm.avg_cadence * factor, 2)

            changed = [k for k, v in new.items() if v is not None and not _same(getattr(activity, k), v)]
            for k in changed:
                setattr(activity, k, new[k])
                fields_changed[k] += 1
            if activity.primary_benefit is not None:
                benefits[f"{activity.primary_benefit} {benefit_label(activity.primary_benefit)}"] += 1

            pts = _update_points(db, activity, norm) if norm.source == "fit" else 0
            points_updated += pts

            stats["atualizada" if changed or pts else "sem mudanca"] += 1
            if args.dry_run:
                db.rollback()
            else:
                db.commit()
            db.expunge_all()
            if n % 50 == 0:
                print(f"  {n}/{len(ids)}")

    for key, count in stats.items():
        print(f"{key}: {count}")
    print("campos preenchidos/corrigidos:")
    for key, count in fields_changed.most_common():
        print(f"  {key}: {count}")
    print(f"pontos com dinamica de corrida: {points_updated}")
    print("beneficio principal (codigo e rotulo):", dict(sorted(benefits.items())))


if __name__ == "__main__":
    main()
