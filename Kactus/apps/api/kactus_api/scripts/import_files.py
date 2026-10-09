"""Importa arquivos de treino (.fit, .gpx, .tcx, .csv, .gz) direto no banco, sem a API.

Usado pelo Kactus Controle quando o relógio é ligado no USB:
    uv run python -m kactus_api.scripts.import_files --json arquivo1.fit arquivo2.fit

A conta é a de --email ou, sem ele, a INITIAL_USER_EMAIL do .env. Duplicados
(mesmo arquivo, mesmo id do relógio ou mesmo horário) são ignorados pelo import.
Com --json imprime {"importadas", "duplicadas", "erros", "atividades"}.
"""

import argparse
import json
import sys
from pathlib import Path

from sqlalchemy import select

from kactus_api.config import settings
from kactus_api.db import SessionLocal
from kactus_api.models import User
from kactus_api.services.batch_import import import_batch


def resumo(responses: list[dict]) -> dict:
    importadas = [i for r in responses for i in r["imported"] if not i["duplicate"]]
    return {
        "importadas": len(importadas),
        "duplicadas": sum(1 for r in responses for i in r["imported"] if i["duplicate"]),
        "erros": [{"arquivo": r["filename"], "erro": r["error"]} for r in responses if r["error"]],
        "atividades": [str(i["activity_id"]) for i in importadas],
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Importa arquivos de treino direto no banco.")
    parser.add_argument("arquivos", nargs="+", type=Path)
    parser.add_argument("--email", help="conta no Kactus (padrao: INITIAL_USER_EMAIL)")
    parser.add_argument("--json", action="store_true", help="imprime o resumo em JSON")
    args = parser.parse_args(argv)

    email = args.email or settings.initial_user_email
    if not email:
        print("Informe --email (ou INITIAL_USER_EMAIL no .env).", file=sys.stderr)
        return 2

    with SessionLocal() as db:
        user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        if user is None:
            print(f"Conta nao encontrada: {email}", file=sys.stderr)
            return 2
        files = []
        for path in args.arquivos:
            try:
                files.append((path.name, path.read_bytes()))
            except OSError as e:
                files.append((path.name, b""))
                print(f"Nao consegui ler {path}: {e}", file=sys.stderr)
        out = resumo(import_batch(db, user.id, files))

    if args.json:
        print(json.dumps(out, ensure_ascii=False))
    else:
        print(f"{out['importadas']} importada(s), {out['duplicadas']} duplicada(s), {len(out['erros'])} erro(s)")
        for e in out["erros"]:
            print(f"  {e['arquivo']}: {e['erro']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
