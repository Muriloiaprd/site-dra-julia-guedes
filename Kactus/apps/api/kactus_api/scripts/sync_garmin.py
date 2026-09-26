"""Importa atividades do Garmin Connect para o Kactus.

Primeira vez (pede senha e, se a conta tiver, o codigo MFA):
    uv run python -m kactus_api.scripts.sync_garmin --email seu@email.com --garmin-login

Depois disso o token em ~/.garminconnect renova sozinho:
    uv run python -m kactus_api.scripts.sync_garmin --email seu@email.com

Ver o que seria importado, sem gravar nada:
    uv run python -m kactus_api.scripts.sync_garmin --email seu@email.com --dry-run
"""

import argparse
import sys
from datetime import date, timedelta
from getpass import getpass

from sqlalchemy import select

from kactus_api.db import SessionLocal
from kactus_api.models import User
from kactus_api.services.garmin_sync import (
    GarminSyncError,
    build_client,
    last_synced_date,
    parse_start,
    sync_activities,
)

# Margem para tras do ultimo sync: uma atividade salva com atraso no relogio
# pode ter data anterior a ultima importada. O dedup cuida da repeticao.
_OVERLAP_DAYS = 3
_DEFAULT_DAYS = 30


def main() -> int:
    parser = argparse.ArgumentParser(description="Importa atividades do Garmin Connect.")
    parser.add_argument("--email", required=True, help="e-mail da conta no Kactus")
    parser.add_argument("--garmin-email", help="e-mail do Garmin, se diferente")
    parser.add_argument("--garmin-login", action="store_true", help="forca login com senha")
    parser.add_argument("--since", help="data inicial AAAA-MM-DD (padrao: incremental)")
    parser.add_argument("--days", type=int, help=f"ultimos N dias (padrao: {_DEFAULT_DAYS})")
    parser.add_argument("--limit", type=int, help="maximo de atividades nesta rodada")
    parser.add_argument("--dry-run", action="store_true", help="so lista, nao importa")
    args = parser.parse_args()

    with SessionLocal() as db:
        user = db.execute(select(User).where(User.email == args.email)).scalar_one_or_none()
        if user is None:
            print(f"Usuario '{args.email}' nao encontrado no Kactus.", file=sys.stderr)
            return 1

        start = _resolve_start(db, user.id, args)
        print(f"Buscando atividades do Garmin desde {start.isoformat()}...")

        try:
            client = _connect(args)
        except GarminSyncError as e:
            print(f"\n{e}", file=sys.stderr)
            return 1
        except Exception as e:  # noqa: BLE001 - erro de rede/credencial vira mensagem, nao traceback
            print(f"\nFalha ao conectar no Garmin: {type(e).__name__}: {e}", file=sys.stderr)
            return 1

        report = sync_activities(
            db, user.id, client, start=start, limit=args.limit, dry_run=args.dry_run
        )

    _print_report(report, dry_run=args.dry_run)
    return 1 if report.failed else 0


def _resolve_start(db, user_id, args) -> date:
    if args.since:
        return parse_start(args.since)
    if args.days:
        return date.today() - timedelta(days=args.days)
    last = last_synced_date(db, user_id)
    if last:
        return last - timedelta(days=_OVERLAP_DAYS)
    return date.today() - timedelta(days=_DEFAULT_DAYS)


def _connect(args):
    if not args.garmin_login:
        return build_client()
    email = args.garmin_email or args.email
    password = getpass(f"Senha do Garmin ({email}): ")
    return build_client(email, password)


def _print_report(report, *, dry_run: bool) -> None:
    if not report.items:
        print("Nenhuma atividade no periodo.")
        return

    for item in report.items:
        mark = {"importada": "+", "duplicada": "=", "ignorada": ".", "erro": "!"}[item.status]
        detail = f" ({item.detail})" if item.detail else ""
        print(f"  {mark} {item.garmin_id}  {item.name}{detail}")

    verb = "seriam importadas" if dry_run else "importadas"
    print(
        f"\n{report.imported} {verb} · {report.duplicates} ja existiam · "
        f"{report.skipped} ignoradas · {report.failed} com erro"
    )
    if report.failed:
        print("Atividades com erro nao foram importadas; rode de novo para tentar outra vez.")


if __name__ == "__main__":
    raise SystemExit(main())
