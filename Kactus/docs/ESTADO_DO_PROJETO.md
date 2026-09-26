# Kactus — Estado do Projeto

**Última atualização deste doc**: 2026-09-26 (rebrand Ondilow → Kactus — ver a última sessão abaixo)
**Nome**: o projeto se chamava **Ondilow** até 2026-09-26; os documentos anteriores a essa data (planejamentos, resumos) mantêm o nome antigo de propósito.
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
- Página de detalhe da atividade: mapa Leaflet, gráficos Recharts (elevação, pace/FC, zonas), splits table
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

### ✅ Sprint 6 — Gerador Visual (commit `3eb7b80`) — SUBSTITUÍDO em 2026-09-15
- `rendering/` com Pillow + `staticmap` (mapa OSM local, sem API paga): card 1080×1080, story 1080×1920, overlay em foto enviada
- `routers/exports.py`: `GET /activities/{id}/export?template=card|story`, `POST /activities/{id}/export/photo`
- Cache de PNG em `apps/api/data/exports/`
- **Removido inteiro em 2026-09-15**: o backend em Pillow (`rendering/`, `routers/exports.py`, dependências `pillow`/`staticmap`) foi apagado e substituído pelo gerador de Stories em Canvas no navegador (`apps/web/lib/story/`), ver `PLANEJAMENTO_ATIVIDADES.md`, Fase 3.

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
- **Export "sticker" transparente** (estilo Strava): novo módulo `rendering/sticker.py` desenha a rota do GPS do zero (projeção equiretangular + supersampling pra anti-aliasing, sem depender de tiles OSM) num PNG com canal alfa de verdade. Três layouts (`route`/`stats`/`full`) via `GET /activities/{id}/export?template=sticker&layout=...`. Botão "🏷️ Sticker" na tela de atividade (só o layout `full` está exposto na UI por ora — os outros dois já funcionam no backend, falta seletor). **Removido em 2026-09-15** — a projeção da rota foi portada para TypeScript (`apps/web/lib/story/engine.ts::projectRoute`) e reaproveitada no gerador de Stories novo, que roda inteiro no navegador.
- **Treinador de IA** (`/coach`): novo pacote `kactus_api/ai/coach_service.py` monta contexto real do atleta (perfil, métricas de carga, recordes, atividades recentes — nada recalculado, tudo reaproveitado de `metrics/predictions.py`) e chama a API da Anthropic (SDK oficial, cache de prompt no system prompt, structured outputs via `messages.parse()` pra gerar plano de treino), com fallback automático pro Gemini em caso de cota/erro. Três funcionalidades: chat livre, relatório de análise, geração de plano de treino (padrão 7 dias). Novas tabelas `planned_workouts` e `coach_interactions` (migration 008). O card "Próximos Treinos" do dashboard agora consome `GET /coach/plan` em vez do mock antigo. Reconciliação automática de aderência: `GET /coach/plan` casa treinos planejados com atividades importadas na mesma data/esporte (marca `done` + linka `activity_id`), ou marca `skipped` se o dia já passou sem atividade correspondente; `PATCH /coach/plan/{id}` permite override manual.
  - **Pendente de você**: colar `ANTHROPIC_API_KEY` (console.anthropic.com) e `GEMINI_API_KEY` (aistudio.google.com/apikey) no `.env` — sem isso, `/coach/*` responde `{"error": "not_configured"}`. Essa é a única feature do projeto que quebra a regra de custo zero (ver seção "Custo" abaixo).
- **Testes novos**: ~~`tests/test_sticker.py` (renderização RGBA/alpha)~~ (removido junto com o `rendering/`, ver Sprint 6 acima) e `tests/test_coach_service.py` (validação de plano, agrupamento de esporte) — pure functions, sem fixture de banco (suite continua sem testes de rota HTTP, ver `BACKLOG.md` item 8).

### ✅ Sessão 2026-09-11 (parte 2) — Import em lote + limpar atividades
- **`POST /activities/upload/batch`**: vários arquivos numa requisição; o recálculo de CTL/ATL/TSB (varredura de todo o histórico) roda **uma única vez** ao final, a partir da menor data afetada — `import_activity()` ganhou `recompute_metrics=False` pra isso. Erro num arquivo fica no campo `error` do próprio item e não interrompe os demais.
- **Suporte a `.gz`** em `parsers/dispatch.py` (export em massa do Garmin entrega `.fit.gz`).
- **Frontend `/import`**: envia em lotes de 15 arquivos; se um lote falha (ex.: timeout ~30s do proxy Next → API), divide pela metade e tenta de novo até o mínimo de 2. Botão "Tentar novamente" para os que falharam e aviso `beforeunload` durante a importação.
- **`DELETE /activities`**: apaga todas as atividades do usuário + recordes + métricas diárias e devolve treinos planejados `done` sem atividade para `planned`. UI na "Zona de perigo" do `/profile`, com confirmação digitando `EXCLUIR`.

### ✅ Sessão 2026-09-11 (parte 3) — Redesign visual completo ("centro de comando do atleta")
Evolução visual de todas as telas internas mantendo identidade (preto + verde neon), rotas e funcionalidades. Nada de dado fictício: tudo que aparece deriva da API.
- **Design system centralizado**: tokens em `apps/web/tailwind.config.ts` (`brand.*`: `surfaceElevated`, `surfaceGlass`, `accentSoft`, `accentGlow`, `textSecondary`, `textTertiary`, `warning`, `info`…), variáveis `--od-*` e classes `od-*` (panel, label, btn, chip, badge, input, table, skeleton, tooltip, nav) em `app/globals.css`, espelho JS em `lib/theme.ts` (para SVG/Recharts). Fontes Inter (texto) + Poppins (métricas). Suporte a `prefers-reduced-motion`.
- **Componentes**: `components/ui/primitives.tsx` (Panel, Metric, TrendBadge, Segmented, PageHeader, ProgressBar, EmptyState, Alert…), `components/ui/charts.tsx` (RadialGauge, Sparkline, PulseLine, ChartTooltipBox), `CountUp`, `Markdown` (renderizador seguro para respostas do coach), `SportIcon`.
- **Shell responsivo** (`components/AppShell.tsx`, usado por todos os layouts): sidebar agrupada (Performance / Inteligência / Gestão) em `lg`, rail de ícones em `md`, top bar + navegação inferior com menu "Mais" no mobile.
- **Dashboard** (`components/dashboard/*`, grid Bento 12 colunas): status do atleta com gauge de prontidão, card do Treinador IA (próximo treino real do plano, "AI ANALYSIS ● ACTIVE" só quando a API responde), visão semanal (realizado/planejado/descanso/hoje), evolução do desempenho (KPIs do período como abas, % vs período anterior, linha de tendência, comparação sobreposta, clique no ponto abre a atividade), última atividade (mini-rota + ritmo + comparação com a média recente), recordes (destaque do maior longão), meta principal, calendário navegável, atividades recentes. Header com status de sincronização e sino de alertas derivados de dados reais (risco, treino de hoje, dias sem treinar, recorde novo).
- **Regra alterada conscientemente — prontidão**: `computeReadiness()` em `lib/athlete.ts` usa o TSB real (`/metrics/load`) com penalidade por ACWR > 1.3; os baldes fixos por tipo de recomendação ficaram só como fallback (BACKLOG item 2).
- **Meta Principal**: continua sem feature de metas no backend; virou CTA honesto que mostra o potencial atual real (previsões 5K–42K), sem simular progresso.
- **Mapas escuros**: tiles CARTO Dark Matter (`lib/mapTiles.ts`, grátis, só atribuição) com rota verde com glow e marcadores verde/lima, no mapa de detalhe e nas mini-rotas.
- **Páginas**: `/metrics` (status Forma/Risco/Tendência, KPIs com sparkline, régua de ACWR, gráficos com zonas, estado vazio), `/predictions` (laboratório: recomendação, risco, cards de prova com confiança, tendência mensal de pace, simulador), `/coach` (hero, insights reais, painel de processamento, relatório formatado, chat com sugestões, plano ativo), `/import` (dropzone técnica, progresso, km analisados), `/activities` (totais, filtros avançados colapsáveis, tabela no desktop / cards no mobile), `/activities/[id]` (hero, métricas secundárias, zonas em barras, splits com barra de pace, erro de export visível), `/equipment`, `/profile` (zonas de FC com as mesmas faixas do backend).
- **Verificação**: `tsc` + `next build` (13 rotas) + todas as páginas abertas no navegador com dados reais, sem erros de console, desktop e mobile.

### ✅ Sessões 2026-09-21 a 23 — Duni, a treinadora de IA
O Treinador de IA virou a **Duni**, treinadora de corrida de rua. Detalhes fase a fase em [`PLANEJAMENTO_2026-09-21.md`](./PLANEJAMENTO_2026-09-21.md) (fechado).
- **Provedor**: Gemini no free tier (`gemini-3.5-flash-lite`, com `flash` de reserva). A Anthropic só entra se houver `ANTHROPIC_API_KEY` no `.env`.
- **Dados**: cadência corrigida (dobrada), GAP e deriva cardíaca por atividade; check-in pós-treino (PSE, sensação, dor, observações).
- **Motor de análise sem IA** (`ai/athlete_analysis.py`): janelas de 7/14/28 dias, tendência de 8 semanas, sinais de fadiga, sessões equivalentes e cadência habitual. O código calcula e a Duni interpreta.
- **Memórias** (`athlete_memories`): objetivo, prova, lesão, disponibilidade e preferência. A Duni sugere no chat e o atleta confirma com um clique.
- **Persona v2**: direta e exigente, sem jargão, segurança antes da cobrança. Contexto com análise, memórias, aderência de 4 semanas e atividades recentes.
- **Plano da semana** (`weekly_plans`): status 🟢🟡🟠🔴, resumo, avaliação, tabela, treinos com passos e alvos, critérios de ajuste, validação no código, "Pedir outro treino" com motivo e "Mudar de dia".
- **Comentário pós-treino** em `/activities/[id]`, sob demanda.
- **Verificado ao vivo com o Gemini em 2026-09-23** na conta de teste: chat, memórias, resumo, plano, regerar um dia e comentário.
- **Prompt v3 (2026-09-23)**: ela não se apresenta, trata o atleta pelo campo "Sexo" do perfil (neutro sem o dado), usa o status para medir cansaço (pausa não é 🔴) e nunca diz que anotou uma memória. O último resumo reaparece ao abrir `/coach` (`GET /coach/analyze`).

### ✅ Sessão 2026-09-26 — Rebrand Ondilow → Kactus
O projeto passou a se chamar **Kactus**; funcionalidades não mudaram. Detalhes fase a fase em [`PLANEJAMENTO_2026-09-26.md`](./PLANEJAMENTO_2026-09-26.md).
- **Marca**: símbolo, wordmark e marca empilhada em `apps/web/public/brand/` (gerados de `Imagens/`), favicon `app/icon.png`/`apple-icon.png`, `components/Logo.tsx` com o wordmark como imagem (a fonte TT Lakes Neue é paga e não é embutida).
- **Stories**: 19 modelos (15 trocados + 4 novos), todas as coordenadas remedidas contra as artes; a logo fica a embutida na arte (sem camada de alta resolução). Ferramenta de dev `/story-calibrate` compara o desenho com a arte pixel a pixel.
- **Nomes internos**: pasta `Kactus/`, pacote `kactus_api`, `kactus_token` (migra o `ondilow_token` sem deslogar), docker/`.env.example` com `kactus`.

---

## Para iniciar uma sessão de trabalho

### Pré-requisitos
Servidores configurados em `.claude/launch.json` (raiz `C:\Cloude Code`, **fora do git** — `.claude/` está no `.gitignore` da raiz):
- `kactus` (porta 3003): `pnpm -C Kactus dev`, sobe API (uvicorn na 8000, **sem `--reload`**) e frontend juntos
- `kactus-web-isolated` (porta 3004, `NEXT_DIST_DIR=.next-preview`) — usar **quando outra sessão já tem `next dev` rodando em `apps/web`**: dois servidores no mesmo `.next` corrompem o cache (erros "reading 'run'" / SyntaxError em `page.js`). O `next.config.mjs` lê `NEXT_DIST_DIR` (padrão `.next`). Efeito colateral: o Next injeta `.next-preview/types/**/*.ts` no `include` do `tsconfig.json` — reverter com `git checkout -- apps/web/tsconfig.json` antes de commitar e apagar a pasta ao terminar.

### Credenciais (NÃO commitar)
- `.env` em `C:\Cloude Code\Kactus\.env`
- Login principal: `muriloiaprd@hotmail.com` (senha no `.env`/memória)
- Login de teste: `teste@teste.com` / `teste`
- Neon project: `wispy-mountain-04630520`

---

## O que fazer a seguir

Todo o levantamento de melhorias pendentes (tratamento de erro no perfil, feature de metas, testes faltando, equipamento sem soma real, etc.) está consolidado e priorizado em **[`BACKLOG.md`](./BACKLOG.md)** — comece por ali em vez de definir novas sprints do zero.

---

## Notas Técnicas Importantes

### Como rodar:
- `pnpm dev` na raiz `Kactus/` sobe API + frontend juntos (via `concurrently`) — único comando, único endereço `http://localhost:3003`.
- API escuta só em `127.0.0.1:8000` (uso interno); frontend proxya `/api/*` → `http://localhost:8000/*` (`next.config.mjs`).
- Rodar cada lado separado: `pnpm dev:api` / `pnpm dev:web` (também na raiz `Kactus/`).
- Preview no launch.json: config `kactus` (porta 3003) sobe API + frontend juntos.

### Banco de dados:
- Neon Postgres (`wispy-mountain-04630520`)
- Migrations: `uv run alembic upgrade head` (rodar do diretório `apps/api`)
- IDs de migration: `001_initial` → `008_coach`

### Arquivos NÃO commitados:
- `.env` (credenciais reais)
- `apps/api/data/` (uploads, exports, logs)
- `.venv/`, `node_modules/`, `.next/`, `.next-*/`

### Modelos SQLAlchemy existentes:
- `User`, `AthleteProfile`, `UserIntegration` → `models/user.py`
- `Activity`, `ActivityPoint`, `ActivityLap` → `models/activity.py`
- `PersonalRecord` → `models/record.py`
- `DailyMetric` → `models/daily_metric.py`
- `Equipment` → `models/equipment.py`
- `PlannedWorkout`, `CoachInteraction` → `models/coach.py`

### Frontend — onde fica cada coisa:
- Tokens/estilos: `tailwind.config.ts`, `app/globals.css`, `lib/theme.ts` — **não usar cores inline novas; usar tokens e classes `od-*`**
- Primitivos de UI: `components/ui/`
- Dashboard: `components/dashboard/` (a página `app/dashboard/page.tsx` só orquestra dados)
- Interpretação de dados do atleta (prontidão, forma, risco, tendência, séries de pace): `lib/athlete.ts`
- Mapas: `components/ActivityMap.tsx`, `components/ActivityMiniMap.tsx`, `lib/mapTiles.ts`

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
- Tiles de mapa: CARTO Dark Matter no frontend (sem API key, só atribuição) e OSM no `staticmap` do backend (uso pessoal)
- Pillow + staticmap (100% local, sem serviço pago)
- Fontes Inter/Poppins via Google Fonts (grátis)
- MCP servers (Garmin/Strava) rodam localmente, sem custo — ver `BACKLOG.md` item 17

**Treinadora de IA (Duni)**: roda no Gemini free tier (chave do Google AI Studio, sem cartão), decisão de 2026-09-21. No free tier o Google pode usar os dados enviados, inclusive lesões e dores das memórias; o usuário foi avisado e aceitou. O código ainda aceita a API da Anthropic (paga), mas só se houver `ANTHROPIC_API_KEY` no `.env`; hoje não há. Qualquer custo novo precisa de confirmação explícita do usuário.
