# Ondilow — Estado do Projeto

**Última atualização deste doc**: 2026-09-11 (sessão de auditoria + Treinador de IA + export sticker — ver seção abaixo)
**Branch**: master
**Backlog priorizado do que falta melhorar**: ver [`BACKLOG.md`](./BACKLOG.md)

---

## Estado Atual do Projeto — Sprints 0 a 7, todas feitas

### ✅ Sprint 0 — Setup
- Monorepo: `apps/api` (FastAPI + uv) + `apps/web` (Next.js 14 + pnpm)
- Neon Postgres (projeto `wispy-mountain-04630520`, região `aws-sa-east-1`)
- Auth: Argon2id + JWT + Fernet (pra credenciais de integrações)
- Migrations: 001 (users/profile), 002 (activities)

### ✅ Sprint 1 — Import + Parsers
- Parsers: FIT (fitparse), GPX (gpxpy), TCX (ElementTree), CSV histórico
- Endpoint `POST /activities/upload` com dedup SHA-256 + proximidade temporal
- Downsample GPS: 1 ponto a cada N segundos (`GPS_DOWNSAMPLE_SECONDS`)
- Testes unitários em `apps/api/tests/` (parsers + helpers de import + métricas básicas)

### ✅ Sprint 2 — Métricas básicas + Dashboard v1
- Métricas: splits por km, zonas FC, best efforts, recordes pessoais
- Página de detalhe da atividade: mapa Leaflet (OSM), gráficos Recharts (elevação, pace/FC, zonas), splits table
- Página de perfil (max_hr, FTP, CSS, peso)

### ✅ Sprint 3 — Métricas de Carga
- Migrations: 003 (personal_records), 004 (daily_metrics)
- TSS por modalidade (bike+FTP, HR-based, fallback), CTL/ATL/TSB (EMA 42d/7d), ACWR
- Endpoint `GET /metrics/load?days=N` + página `/metrics` com gráficos e heatmap

### ✅ Sprint 4 — Previsões (commit `59a07a4`)
- `metrics/predictions.py`: fórmula de Riegel + VDOT de Jack Daniels, risco de lesão/overtraining (ACWR/TSB), recomendação diária
- `routers/predictions.py`: `GET /predictions/overview`, `POST /predictions/simulate`
- Página `/predictions`: previsões de prova, risco, simulador de TSB interativo

### ✅ Sprint 5 — Garmin Connect Sync (implementado e depois revertido)
- Commit `77a68ec` implementou sync automático via lib `garminconnect` (login/senha, sem developer account)
- Commit `f3209e5` **removeu** essa integração: "o Garmin Connect bloqueia o acesso via API não-oficial, então a sincronização automática não é viável"
- No lugar: página `/import` — upload manual de `.fit/.gpx/.tcx/.csv` (drag-and-drop, fila, dedup)
- Ficou preparado mas não usado ainda: modelo `UserIntegration` (genérico, não específico de provedor) e infraestrutura Fernet — ver Sprint 8 abaixo.

### ✅ Sprint 6 — Gerador Visual (commit `3eb7b80`)
- `rendering/` com Pillow + `staticmap` (mapa OSM local, sem API paga): card 1080×1080, story 1080×1920, overlay em foto enviada
- `routers/exports.py`: `GET /activities/{id}/export?template=card|story`, `POST /activities/{id}/export/photo`
- Cache de PNG em `apps/api/data/exports/`

### ✅ Sprint 7 — Polimento (commit `2f67d4d` + fix `de60fd4`)
- Heatmap de carga (TSS por dia/esporte), filtros de período
- Página `/equipment`: CRUD completo de equipamentos (migration 005)
- Diversos ajustes de UX

### ✅ Sessão 2026-09-10 — Redesign de identidade visual (16 commits, não documentado até agora)
Trabalho concentrado num único dia, sem sprint numerada formal: identidade visual Ondilow (logo, cores, sidebar), landing page como tela inicial, e um redesign completo do dashboard ("centro de controle do atleta" — status do atleta, prontidão, carga semanal, recuperação, visão semanal, evolução de desempenho, calendário mensal, atividades recentes com rota GPS real). Commits principais: `210d8dd`, `8f1fdff`, `85211fe`, `236682c`, `0672d74`, e mais 11 ajustes de estilo sucessivos até `31834b4`.

### ✅ Sessão 2026-09-10 (parte 2) — Listagem de atividades + preparação de import via MCP
- Nova página `/activities`: listagem completa com resumo (total/distância/tempo), filtros combináveis (tipo, período, distância, duração, FC, pace, elevação), paginação
- Item "Atividades" adicionado à sidebar (o link "Ver calendário →" do dashboard, que já apontava pra lá, passou a funcionar)
- Backend: novo endpoint `POST /activities/import-normalized` — aceita atividade já estruturada em JSON (sem arquivo bruto), pensado para alimentar o pipeline de import a partir de dados buscados via MCP (Garmin/Strava)
- Migration 006: novo valor `strava_api` no enum `activity_source`, aliases de sport do Strava em `parsers/sports.py`
- **Ainda pendente**: instalar/configurar os MCP servers (`garmin_mcp`, MCP do Strava) — ver item 17 do `BACKLOG.md`

### ✅ Sessão 2026-09-11 — Auditoria de bugs + Treinador de IA + export sticker
- **Bugs corrigidos**: (1) `config.py` resolvia `.env` relativo ao CWD do processo — login (e qualquer request que tocasse o banco) travava para sempre quando a API era iniciada de um diretório diferente; corrigido ancorando via `Path(__file__)`. (2) Mesmo padrão em `data_dir`/`data_path` — uploads/exports/logs se espalhavam em duas pastas diferentes; ancorado do mesmo jeito. (3) `fetchMe()` sem `try/catch` podia travar o dashboard em "Carregando..." pra sempre numa falha de rede; agora trata o erro e o dashboard mostra banner com "Tentar de novo". (4) `cors_origins` default corrigido pra incluir a porta 3003.
- **Export "sticker" transparente** (estilo Strava): novo módulo `rendering/sticker.py` desenha a rota do GPS do zero (projeção equiretangular + supersampling pra anti-aliasing, sem depender de tiles OSM) num PNG com canal alfa de verdade. Três layouts (`route`/`stats`/`full`) via `GET /activities/{id}/export?template=sticker&layout=...`. Botão "🏷️ Sticker" na tela de atividade (só o layout `full` está exposto na UI por ora — os outros dois já funcionam no backend, falta seletor).
- **Treinador de IA** (`/coach`): novo pacote `ondilow_api/ai/coach_service.py` monta contexto real do atleta (perfil, métricas de carga, recordes, atividades recentes — nada recalculado, tudo reaproveitado de `metrics/predictions.py`) e chama a API da Anthropic (SDK oficial, cache de prompt no system prompt, structured outputs via `messages.parse()` pra gerar plano de treino), com fallback automático pro Gemini em caso de cota/erro. Três funcionalidades: chat livre, relatório de análise, geração de plano de treino (padrão 7 dias). Novas tabelas `planned_workouts` e `coach_interactions` (migration 008). O card "Próximos Treinos" do dashboard agora consome `GET /coach/plan` em vez do mock antigo. Reconciliação automática de aderência: `GET /coach/plan` casa treinos planejados com atividades importadas na mesma data/esporte (marca `done` + linka `activity_id`), ou marca `skipped` se o dia já passou sem atividade correspondente; `PATCH /coach/plan/{id}` permite override manual.
  - **Pendente de você**: colar `ANTHROPIC_API_KEY` (console.anthropic.com) e `GEMINI_API_KEY` (aistudio.google.com/apikey) no `.env` — sem isso, `/coach/*` responde `{"error": "not_configured"}`. Essa é a única feature do projeto que quebra a regra de custo zero (ver seção "Custo" abaixo).
- **Testes novos**: `tests/test_sticker.py` (renderização RGBA/alpha) e `tests/test_coach_service.py` (validação de plano, agrupamento de esporte) — pure functions, sem fixture de banco (suite continua sem testes de rota HTTP, ver `BACKLOG.md` item 8).
- **Redesign visual do layout** (Sports Performance + SaaS Premium + Dark Futuristic + Bento Grid, mantendo a paleta atual): planejado como fase final, deliberadamente não iniciado — só depois que tudo acima estiver estável.

---

## Para iniciar uma sessão de trabalho

### Pré-requisitos
Servidores já configurados em `.claude/launch.json` (raiz `C:\Cloude Code`): `ondilow-api` (porta 8000, uvicorn a partir do `.venv` — **não usar `--reload`**, foi fonte de bug antes por rodar com Python do sistema) e `ondilow-web` (porta 3003, `pnpm dev`, com `autoPort` habilitado).

### Credenciais (NÃO commitar)
- `.env` em `C:\Cloude Code\Ondilow\.env`
- Login principal: `muriloiaprd@hotmail.com` (senha no `.env`/memória)
- Login de teste: `teste@teste.com` / `teste`
- Neon project: `wispy-mountain-04630520`

---

## O que fazer a seguir

Todo o levantamento de melhorias pendentes (bugs de tratamento de erro, dados mockados no dashboard, testes faltando, responsividade mobile, etc.) está consolidado e priorizado em **[`BACKLOG.md`](./BACKLOG.md)** — comece por ali em vez de definir novas sprints do zero.

---

## Notas Técnicas Importantes

### API sempre em:
- `http://localhost:8000`
- Frontend proxy: `next.config.mjs` rewrite `/api/*` → `http://localhost:8000/*`

### Banco de dados:
- Neon Postgres (`wispy-mountain-04630520`)
- Migrations: `uv run alembic upgrade head` (rodar do diretório `apps/api`)
- IDs de migration: `001_initial` → `008_coach`

### Arquivos NÃO commitados:
- `.env` (credenciais reais)
- `apps/api/data/` (uploads, exports, logs)
- `.venv/`, `node_modules/`, `.next/`

### Modelos SQLAlchemy existentes:
- `User`, `AthleteProfile`, `UserIntegration` → `models/user.py`
- `Activity`, `ActivityPoint`, `ActivityLap` → `models/activity.py`
- `PersonalRecord` → `models/record.py`
- `DailyMetric` → `models/daily_metric.py`
- `Equipment` → `models/equipment.py`
- `PlannedWorkout`, `CoachInteraction` → `models/coach.py`

### Dependências Python instaladas:
```toml
fastapi, uvicorn, sqlalchemy, alembic, pydantic-settings
fitparse, gpxpy, python-multipart
argon2-cffi, cryptography (Fernet), python-jose
structlog, psycopg[binary]
Pillow, staticmap
anthropic, google-genai
```

### Dependências Frontend instaladas:
```json
next@14.2.33, react@18, tailwindcss@3
recharts@2.13.0, react-leaflet@4.2.1, leaflet@1.9.4
@types/leaflet
```

---

## Custo: R$ 0 (regra absoluta, com uma exceção explícita)
Nenhuma decisão pode exigir cartão de crédito. Tudo no free tier:
- Neon (500MB, 191h compute/mês)
- OSM tiles (uso pessoal, sem API key)
- Pillow + staticmap (100% local, sem serviço pago)
- MCP servers (Garmin/Strava) rodam localmente, sem custo — ver `BACKLOG.md` item 17

**Exceção combinada com o usuário**: o Treinador de IA usa a API da Anthropic (Claude) como provedor principal — isso tem custo real e o usuário decidiu pagar por essa feature especificamente. Fallback pro Gemini free tier se a chamada à Anthropic falhar por cota. Nenhuma outra parte do projeto deve seguir esse precedente sem confirmação explícita.
