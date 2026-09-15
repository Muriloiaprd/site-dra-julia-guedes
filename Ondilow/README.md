# Ondilow

Plataforma pessoal de analise de treino (corrida + ciclismo + natacao) com metricas de carga (CTL/ATL/TSB/ACWR), previsoes, Treinador de IA e gerador visual proprio.

Custo mensal: R$ 0 (exceto a API da Anthropic do Treinador de IA, opcional). Uso pessoal. Sem cartao de credito.

Estado detalhado: [`ESTADO_DO_PROJETO.md`](./ESTADO_DO_PROJETO.md) · Pendencias: [`BACKLOG.md`](./BACKLOG.md)

## Stack

- Backend: FastAPI (Python 3.12) + SQLAlchemy 2.0 + Alembic
- Frontend: Next.js 14 (App Router) + Tailwind com design system proprio (`tailwind.config.ts`, `app/globals.css`, `lib/theme.ts`) + Recharts + Leaflet (tiles escuros CARTO)
- Banco: Neon Postgres (free tier). O `docker-compose.yml` com Postgres local ainda existe, mas nao e o fluxo usado.
- Auth: Argon2id + JWT

## Pre-requisitos

- Python 3.12+
- Node 20+
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

Cole os valores no `.env`, junto com a connection string do Neon. Para o Treinador de IA, adicione tambem `ANTHROPIC_API_KEY` e/ou `GEMINI_API_KEY`.

Instalar dependencias e rodar migrations:

```bash
cd apps/api
uv sync
uv run alembic upgrade head
uv run python -m ondilow_api.scripts.seed_user
```

Instalar dependencias do frontend e do orquestrador:

```bash
cd ..
pnpm install
```

Subir tudo com um comando so, a partir da raiz `Ondilow/`:

```bash
pnpm dev
```

Isso sobe a API (porta 8000, so em `127.0.0.1`, sem `--reload`) e o frontend (porta 3003) juntos, com `concurrently`. Abrir http://localhost:3003 — o proprio Next repassa `/api/*` para a API por baixo (`next.config.mjs`), entao so existe um endereco pra acessar.

Para rodar cada lado separado (ex.: debugar so a API), use `pnpm dev:api` ou `pnpm dev:web`.

> Se ja houver outro `next dev` rodando em `apps/web`, suba um extra com `NEXT_DIST_DIR=.next-preview` para nao corromper o cache compartilhado (ver `ESTADO_DO_PROJETO.md`).

## Estrutura

- `apps/api/ondilow_api/` — `routers/`, `parsers/`, `metrics/` (carga, recordes, previsoes), `ai/` (Treinador de IA), `rendering/` (cards/stories/sticker)
- `apps/web/app/` — paginas (dashboard, activities, metrics, predictions, coach, equipment, import, profile)
- `apps/web/components/ui/` — primitivos do design system; `components/dashboard/` — blocos do dashboard
- `apps/web/lib/` — cliente da API (`api.ts`), formatacao (`utils.ts`), interpretacao de dados do atleta (`athlete.ts`), tokens JS (`theme.ts`)
