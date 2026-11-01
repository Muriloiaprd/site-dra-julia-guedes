"""Importa atividades do Garmin Connect para o Kactus pela API pessoal oficial.

Antes, uma vez: crie a chave em connect.garmin.com/app/settings/personalApiToken
e cole em GARMIN_PERSONAL_API_KEY no .env. Nao ha senha nem MFA.

Conferir se o arquivo da API traz todos os campos do Garmin (baixa 3 treinos,
compara com os mesmos ja salvos no Kactus, nao grava nada):
    uv run python -m kactus_api.scripts.sync_garmin --email seu@email.com --conferir 3 --days 14

Importar (incremental a partir do ultimo treino vindo do Garmin):
    uv run python -m kactus_api.scripts.sync_garmin --email seu@email.com

Ver o que seria importado, sem gravar nada:
    uv run python -m kactus_api.scripts.sync_garmin --email seu@email.com --dry-run

Sem --email usa a INITIAL_USER_EMAIL do .env. Com --json (usado pelo Kactus Controle)
imprime uma linha {"importadas", "duplicadas", "ignoradas", "erros", "parou", "erro"}.
"""

import argparse
import json
import sys
from datetime import date, timedelta

from sqlalchemy import select

from kactus_api.config import settings
from kactus_api.db import SessionLocal
from kactus_api.models import User
from kactus_api.services.garmin_sync import (
    GarminSyncError,
    build_client,
    check_api_files,
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
    parser.add_argument("--email", help="e-mail da conta no Kactus (padrao: INITIAL_USER_EMAIL)")
    parser.add_argument("--since", help="data inicial AAAA-MM-DD (padrao: incremental)")
    parser.add_argument("--days", type=int, help=f"ultimos N dias (padrao: {_DEFAULT_DAYS})")
    parser.add_argument("--limit", type=int, help="maximo de atividades nesta rodada")
    parser.add_argument("--dry-run", action="store_true", help="so lista, nao importa")
    parser.add_argument(
        "--conferir",
        type=int,
        metavar="N",
        help="baixa N treinos e compara os campos do Garmin com os ja salvos (nao grava)",
    )
    parser.add_argument("--json", action="store_true", help="imprime o resumo em JSON (Kactus Controle)")
    args = parser.parse_args()

    email = args.email or settings.initial_user_email
    if not email:
        return _fail("Informe --email (ou INITIAL_USER_EMAIL no .env).", as_json=args.json)

    with SessionLocal() as db:
        user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        if user is None:
            return _fail(f"Usuario '{email}' nao encontrado no Kactus.", as_json=args.json)

        start = _resolve_start(db, user.id, args)
        if not args.json:
            print(f"Buscando atividades do Garmin desde {start.isoformat()}...")

        try:
            client = build_client()
            if args.conferir:
                checks = check_api_files(db, user.id, client, start=start, limit=args.conferir)
                return _print_checks(checks)
            report = sync_activities(
                db, user.id, client, start=start, limit=args.limit, dry_run=args.dry_run
            )
        except GarminSyncError as e:
            return _fail(str(e), as_json=args.json)
        except Exception as e:  # noqa: BLE001 - erro de rede vira mensagem, nao traceback
            return _fail(f"Falha ao falar com o Garmin: {type(e).__name__}: {e}", as_json=args.json)

    if args.json:
        print(json.dumps(summary(report), ensure_ascii=False))
    else:
        _print_report(report, dry_run=args.dry_run)
    return 1 if report.failed or report.stopped else 0


def summary(report) -> dict:
    """Resumo do --json (o Kactus Controle le a ultima linha que comeca com "{")."""
    return {
        "importadas": report.imported,
        "duplicadas": report.duplicates,
        "ignoradas": report.skipped,
        "erros": report.failed,
        "parou": report.stopped,
        "erro": None,
    }


def _fail(message: str, *, as_json: bool) -> int:
    if as_json:
        print(json.dumps({"erro": message}, ensure_ascii=False))
    else:
        print(f"\n{message}", file=sys.stderr)
    return 1


def _resolve_start(db, user_id, args) -> date:
    if args.since:
        return parse_start(args.since)
    if args.days:
        return date.today() - timedelta(days=args.days)
    last = last_synced_date(db, user_id)
    if last and not args.conferir:
        return last - timedelta(days=_OVERLAP_DAYS)
    return date.today() - timedelta(days=_DEFAULT_DAYS)


def _print_report(report, *, dry_run: bool) -> None:
    if not report.items and not report.stopped:
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
    if report.stopped:
        print(f"\nO lote parou no meio: {report.stopped}", file=sys.stderr)


def _print_checks(checks) -> int:
    if not checks:
        print("Nenhuma atividade no periodo.")
        return 0

    compared = [c for c in checks if c.compared]
    for c in checks:
        print(f"\n  {c.garmin_id}  {c.name}")
        if not c.compared:
            print(f"    . {c.detail}")
            continue
        if not c.missing and not c.different:
            print("    = todos os campos do Garmin bateram")
        for name in c.missing:
            print(f"    - faltou na API: {name}")
        for name, have, got in c.different:
            print(f"    ~ diferente: {name} (Kactus {have} · API {got})")

    if not compared:
        print(
            "\nNenhum treino para comparar: e preciso ter no Kactus o mesmo treino subido "
            "por arquivo (upload ou relogio no USB). Use --days para olhar mais para tras."
        )
        return 1
    if any(c.missing for c in compared):
        print("\nO arquivo da API veio sem alguns campos do Garmin.")
        return 1
    print(f"\nO arquivo da API veio completo nos {len(compared)} treino(s) comparados.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
