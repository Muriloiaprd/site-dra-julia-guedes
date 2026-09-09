# Ondilow

Plataforma pessoal de analise de treino (corrida + ciclismo + natacao) com metricas de carga (CTL/ATL/TSB/ACWR), previsoes e gerador visual proprio.

Custo mensal: R$ 0. Uso pessoal. Sem cartao de credito.

## Stack

- Backend: FastAPI (Python 3.12) + SQLAlchemy 2.0 + Alembic
- Frontend: Next.js 14 (App Router) + Tailwind + shadcn/ui
- Banco: Postgres 16 (Docker em dev, Neon em prod pessoal)
- Auth: Argon2id + JWT

## Pre-requisitos

- Python 3.12+
- Node 20+
- Docker Desktop (para Postgres local)
- `uv` (Python) e `pnpm` (JS) instalados globalmente

## Bootstrap (primeira vez)

```bash
cp .env.example .env
```

Gerar `JWT_SECRET_KEY` e `FERNET_KEY`:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Cole os valores no `.env`.

Subir Postgres local:

```bash
docker compose up -d
```

Instalar dependencias e rodar migrations:

```bash
cd apps/api
uv sync
uv run alembic upgrade head
uv run python -m ondilow_api.scripts.seed_user
```

Subir a API:

```bash
uv run uvicorn ondilow_api.main:app --reload
```

Em outro terminal, subir o frontend:

```bash
cd apps/web
pnpm install
pnpm dev
```

Abrir http://localhost:3000

## Estrutura

Ver plano detalhado em `../../.claude/plans/quero-que-analise-minha-unified-wolf.md`.
