"""Backup de todos os dados do Kactus num arquivo .json.gz (o mesmo conteúdo do
"Exportar meus dados", com a Duni e a carga diaria).

Usado pelo Kactus Controle uma vez por semana:
    uv run python -m kactus_api.scripts.backup --pasta "C:/Users/voce/Documents/Kactus backups" --json

Guarda as ultimas --manter copias (padrao 8) e apaga as mais antigas.
"""

import argparse
import gzip
import json
import sys
from datetime import datetime
from pathlib import Path

from sqlalchemy import select

from kactus_api.config import settings
from kactus_api.db import SessionLocal
from kactus_api.models import User
from kactus_api.services.export import build_export

PREFIXO = "kactus_backup_"


def gravar(dados: dict, pasta: Path, manter: int, agora: datetime | None = None) -> dict:
    """Grava o backup e apaga os antigos. Devolve {arquivo, tamanho, apagados}."""
    pasta.mkdir(parents=True, exist_ok=True)
    agora = agora or datetime.now()
    arquivo = pasta / f"{PREFIXO}{agora:%Y-%m-%d_%H%M%S}.json.gz"
    with gzip.open(arquivo, "wt", encoding="utf-8") as f:
        json.dump(dados, f, ensure_ascii=False)
    antigos = sorted(pasta.glob(f"{PREFIXO}*.json.gz"))[:-manter] if manter > 0 else []
    for a in antigos:
        a.unlink(missing_ok=True)
    return {"arquivo": str(arquivo), "tamanho": arquivo.stat().st_size, "apagados": len(antigos)}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Backup dos dados do Kactus em .json.gz.")
    parser.add_argument("--pasta", required=True, type=Path)
    parser.add_argument("--email", help="conta no Kactus (padrao: INITIAL_USER_EMAIL)")
    parser.add_argument("--manter", type=int, default=8, help="quantas copias guardar (padrao 8)")
    parser.add_argument("--json", action="store_true", help="imprime o resultado em JSON")
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
        dados = build_export(db, user)
    out = gravar(dados, args.pasta, args.manter)
    print(json.dumps(out, ensure_ascii=False) if args.json else f"Backup salvo em {out['arquivo']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
