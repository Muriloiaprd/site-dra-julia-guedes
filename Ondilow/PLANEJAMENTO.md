# Ondilow — Planejamento de Execução

**Criado em**: 2026-09-15
**Status**: aguardando revisão do usuário. Nada deste documento foi executado ainda.
**Relacionados**: [`BACKLOG.md`](./BACKLOG.md) (backlog priorizado) · [`ESTADO_DO_PROJETO.md`](./ESTADO_DO_PROJETO.md) (estado atual)

## Como retomar
Quando o usuário pedir para retomar o planejamento:
1. Ler este documento inteiro.
2. Conferir no código se algo mudou desde a data acima (commits novos, itens já resolvidos).
3. Apresentar um resumo com análise: o que continua válido, o que mudou e por qual fase começar.
4. Só executar depois da confirmação do usuário, fase por fase.

O documento tem duas partes:
- **Parte A**: plano aprovado para executar (itens 1 a 11 do backlog, em 9 fases).
- **Parte B**: APIs anotadas **só para avaliar depois** se vale a pena. Não são compromisso.

---

# PARTE A — Plano de execução (backlog P0 + P1)

## Contexto
Numa revisão do site rodando (dashboard, atividades, carga, previsões, coach, equipamentos, perfil e import), cruzada com o `BACKLOG.md`, saíram 20 melhorias possíveis. O usuário escolheu fechar primeiro o escopo **P0 + P1 (itens 1 a 11)**:
- correções de confiança: erros engolidos, tratamento de erro, rate limit;
- completude: editar/excluir atividade, equipamento com km real, testes, CI;
- duas features de produto: meta/prova-alvo e sync com Strava.

**Decisões de arquitetura já confirmadas com o usuário:**
- **Strava por OAuth direto no próprio backend** (não MCP). O usuário conecta uma vez no `/profile` e depois usa o botão "Sincronizar agora". Não depende de sessão do Claude aberta.
- **Testes com banco usam uma branch `test` no projeto Neon** (`wispy-mountain-04630520`). O schema usa ENUM e `gen_random_uuid()` do Postgres, que o SQLite não suporta. O custo continua R$ 0.

## Ordem das fases

| Fase | Itens | Por quê |
|---|---|---|
| 1 | 1 (logs) + 9 (handler global) + 2 (profile.tsx) | Tudo é tratamento de erro. O item 1 cria o logger que o 9 usa, e o 2 aplica no front o padrão que o 9 formaliza no back |
| 2 | 3 (rate limit no login) | Mexe em `main.py`, então fica para depois da Fase 1 |
| 3 | 8 (confirmar chamadas duplicadas) | Verificação rápida, sem dependências |
| 4 | 4 (editar/excluir atividade) | — |
| 5 | 5 (equipamento com km real) | Reaproveita o `PATCH /activities/{id}` da Fase 4 |
| 6 | 6 (infra de testes) | Testa primeiro os endpoints novos das Fases 4 e 5 |
| 7 | 7 (CI) | Depende do `pytest` da Fase 6 rodando |
| 8 | 10 (meta/prova-alvo) | Independente, mas aproveita a infra de testes |
| 9 | 11 (Strava OAuth) | É o item maior e mais arriscado, então fica por último |

Cada fase pode ser entregue sozinha: dá para parar depois de qualquer uma sem deixar o app quebrado.

---

## FASE 1 — Erros e observabilidade (itens 1, 9 e 2)

**Logger reutilizável (item 1).** O `structlog` já é configurado em `apps/api/ondilow_api/logging_setup.py`, mas nenhum código de negócio o usa. Criar `ondilow_api/logger.py` com `get_logger(name)` e usar em três pontos:
- `rendering/composer.py:114-117,170-173`: logar `activity_date_parse_failed` antes do fallback `date_str = ""`.
- `rendering/fonts.py:18-21`: `log.debug("font_load_failed")`.
- `rendering/static_map.py:24-48`: `log.warning("route_map_render_failed")`.

Nenhum desses pontos muda o fallback, só passa a registrar o erro.

**Handler global de erro (item 9).** Em `main.py`, registrar um handler só para `Exception` genérica. As `HTTPException` continuam como estão, incluindo o `detail` em formato dict de `routers/coach.py`. O handler loga com `logger.exception` e devolve status 500 com `{"detail": {"error": "internal_error", "message": "Erro interno. Tente novamente."}}`.

**`profile/page.tsx` (item 2).** Nas linhas 64-71, o `.catch(() => router.push("/login"))` transforma qualquer falha de rede em "sessão expirada". Corrigir seguindo o padrão de `app/dashboard/page.tsx:47-57`, que usa `getToken()`:
- sem token: vai para `/login`;
- com token, mas `fetchMe()` falhou: `setAuthError(true)` e banner "Tentar de novo", sem redirecionar.

**Verificação:**
- `uv run pytest` continua passando.
- Um erro 500 forçado devolve o JSON padrão e aparece em `data/logs/`.
- Com token válido e API desligada, o `/profile` mostra "Tentar de novo" em vez de mandar para o login.

## FASE 2 — Rate limiting no login (item 3)

- Adicionar `slowapi` no `pyproject.toml`. Ele guarda os contadores em memória, sem infra extra.
- Criar `ondilow_api/rate_limit.py` com `limiter = Limiter(key_func=get_remote_address)`.
- Em `main.py`: `app.state.limiter`, handler de `RateLimitExceeded` e `SlowAPIMiddleware`.
- Em `routers/auth.py`, aplicar `@limiter.limit("5/minute")` só no `POST /auth/login` (a função passa a receber `request: Request`).
- Cuidado para a Fase 6: os testes precisam de `limiter.reset()` entre casos, e a fixture de login deve gerar o JWT direto.

**Verificação:** a 6ª tentativa rápida de login devolve 429.

## FASE 3 — Confirmar chamadas duplicadas no dashboard (item 8) — CONCLUÍDA, causa diferente do previsto

A hipótese do StrictMode estava errada: rodando `next build && next start` (produção, sem StrictMode) a duplicação de `/api/auth/me` e `/api/profile` continuava. Causa real: `components/Sidebar.tsx` busca `fetchMe()`/`fetchProfile()` para o avatar/nome da navegação, independente de cada página (dashboard, coach, equipment, import, metrics, predictions, profile) que busca os mesmos dados pro seu próprio uso — toda página autenticada disparava as duas chamadas em dobro. As demais chamadas do `load()` (activities, records, predictions, metrics/load, coach/plan) não duplicavam, só essas duas.

**Correção aplicada** (`apps/web/lib/api.ts`): em vez de reestruturar as ~8 páginas com um contexto compartilhado, `fetchMe()` e `fetchProfile()` passaram a cachear por um TTL curto (3s) via um `dedupe()` local — layout e page hidratam em chunks JS separados, então um simples "dedupe do que está em voo" não bastava (a primeira chamada às vezes já resolvia antes da segunda começar); o TTL cobre esse intervalo sem mudar o comportamento de cada página.

**Verificação:** confirmado no browser com API e `next start` reais — login, navegação client-side entre páginas (`/dashboard` → `/coach`) e reload direto de URL — sempre 1 chamada de cada por carregamento, nunca 2. `pytest` (33) e `tsc --noEmit` continuam passando.

## FASE 4 — Editar e excluir atividade individual (item 4) — EM ANDAMENTO, parado a pedido do usuário

**Feito (commit `d1aaa8b`):** backend completo — `ActivityUpdate`, `PATCH /activities/{id}` (recalcula PRs se `sport` mudar de grupo), `DELETE /activities/{id}` (soft delete + `update_daily_metrics` + `recompute_all_records`), `recompute_all_records()` em `metrics/records.py`. `pytest` (33) e `ruff` passam.

**Falta para fechar a Fase 4:**
- Frontend: `lib/api.ts` (`updateActivity`/`deleteActivity`), botão de excluir em `app/activities/page.tsx` (padrão `window.confirm` de `equipment/page.tsx:135`), botões "Editar"/"Excluir" em `app/activities/[id]/page.tsx`.
- Verificação manual end-to-end (ainda não testado ao vivo): editar título persiste, excluir some da lista/dashboard, `/metrics/load` reflete a exclusão, um PR sustentado só por ela desaparece.

**Ao retomar:** completar o frontend acima, verificar ao vivo, e só então seguir para a Fase 5.

**Backend:**
- `schemas/activity.py`: novo schema `ActivityUpdate` com `title`, `description` e `sport`, todos opcionais.
- `routers/activities.py`:
  - `PATCH /activities/{id}`: reaproveita `_load_activity`. Se o `sport` mudar, chama `recompute_all_records()`.
  - `DELETE /activities/{id}`: soft delete, preenchendo `deleted_at`. Depois chama `update_daily_metrics(db, user_id, from_date=...)` e `recompute_all_records()`.
- `metrics/records.py`: novo `recompute_all_records(db, user_id)`. Apaga os PRs do usuário e reprocessa as atividades em ordem cronológica usando o `update_records()` que já existe.

**Frontend:**
- `lib/api.ts`: `updateActivity` e `deleteActivity`, no mesmo padrão de `updateEquipment` e `deleteEquipment`.
- `app/activities/page.tsx`: botão de excluir em cada linha, com `window.confirm` (mesmo padrão de `equipment/page.tsx:135`).
- `app/activities/[id]/page.tsx`: botões "Editar" (formulário inline) e "Excluir", ao lado dos botões de export.

**Verificação:**
- A edição do título persiste.
- A atividade excluída some da lista e do dashboard.
- O `/metrics/load` passa a refletir a exclusão.
- Um PR que só ela sustentava desaparece.

## FASE 5 — Equipamento com km real (item 5)

- Nova migration `009_activity_equipment.py` (`down_revision="008_coach"`): coluna `equipment_id` nullable em `activities`, com FK `ondelete=SET NULL` e índice.
- Adicionar `equipment_id` em `models/activity.py`, `ActivityUpdate` e `ActivityDetail`.
- No `PATCH`, validar que o equipamento pertence ao usuário (404 se não pertencer).
- `routers/equipment.py:16-20`: o `_total_distance` passa a somar `distance_m` das atividades não excluídas mais o `initial_distance_m`.
- Front: um `<select>` de equipamento no painel de edição da atividade.

**Verificação:**
- A soma exibida bate com um `SELECT SUM(distance_m)` manual.
- Apagar o equipamento deixa `equipment_id = NULL` nas atividades, sem quebrar nada.

## FASE 6 — Infra de testes (item 6)

**Branch Neon:** criar a branch `test` com `create_branch` no MCP do Neon. Guardar a URL em `TEST_DATABASE_URL`, num `.env.test` fora do git.

**Novo `apps/api/tests/conftest.py`:**
- `test_engine`: pula os testes de banco se `TEST_DATABASE_URL` não existir.
- Rodar `alembic upgrade head` uma vez por sessão.
- `db_session`: uma transação por teste, com rollback no final.
- `client`: `TestClient` com override de `get_db` e `DATA_DIR` temporário.
- `auth_headers`: cria o usuário via ORM e gera o JWT com `create_access_token()`.
- Fixture `autouse` com `limiter.reset()`.

**Casos prioritários:**
- Sem banco: Riegel, VDOT, `assess_injury_risk`, `training_recommendation` e `simulate_tsb`.
- Com banco:
  - `update_daily_metrics` (CTL/ATL/TSB/ACWR);
  - `update_records` e `recompute_all_records`;
  - `import_activity()` completo, incluindo dedup por hash e por proximidade;
  - rotas das Fases 4 e 5, com isolamento entre usuários (retornando 404);
  - `/auth/login`, incluindo o 429.

**Verificação:**
- `pytest -m "not db"` roda sem banco configurado.
- A suíte completa passa duas vezes seguidas.
- A branch `test` fica limpa depois.

## FASE 7 — CI (item 7)

Novo `.github/workflows/ci.yml`, disparado em `push` e `pull_request`, com dois jobs:
- **backend**: `uv sync --group dev`, `ruff check` e `pytest`. A suíte com banco só roda se o secret `TEST_DATABASE_URL` existir.
- **frontend**: `npm ci`, `npm run lint` e `npm run build`.

**Ação manual do usuário:** cadastrar os secrets no GitHub.

## FASE 8 — Meta/prova-alvo (item 10)

- **Migration e modelo `goals`:**
  - PK no padrão de `models/coach.py`, `user_id` com cascade e `sport` importando o `sport_enum` de `models/activity.py`.
  - Campos `race_name`, `target_distance_m`, `target_date`, `target_time_s`, `status` e `achieved_at`.
  - **Uma meta ativa por vez**, checada na aplicação (409 se já existir outra ativa).
- `schemas/goal.py`: aceitar os presets de `RACE_DISTANCES` (`metrics/predictions.py:13-18`).
- `routers/goals.py`: `GET /goals/active`, `POST /goals`, `PATCH /goals/{id}` e `POST /goals/{id}/abandon`.
- **`GoalCard.tsx`:**
  - sem meta: CTA para criar;
  - com meta: contagem regressiva e comparação com a previsão VDOT/Riegel.

**Verificação:**
- A meta criada aparece no dashboard.
- Tentar criar uma segunda meta ativa devolve 409.
- Ao abandonar, o card volta ao CTA.

## FASE 9 — Strava por OAuth direto (item 11)

**O que já existe:**
- modelo `UserIntegration`;
- `encrypt_bytes` e `decrypt_bytes` em `security.py`;
- `import_activity()`, com dedup por `(source, source_activity_id)`;
- `normalize_sport()` com os aliases do Strava;
- valor `strava_api` no enum.

**Passos:**
1. Adicionar `strava_client_id` e `strava_client_secret` no `config.py` e no `.env.example`. **Ação manual:** criar o app em strava.com/settings/api.
2. Migration para tornar `credentials_encrypted` nullable em `user_integrations`.
3. Criar `routers/integrations.py`:
   - `GET /integrations/strava/authorize-url`: monta a URL com um `state` assinado que carrega o `user_id`.
   - `GET /integrations/strava/callback`: não exige auth. Troca o `code` por tokens, grava criptografado e redireciona com 302 para `/profile?strava=connected` (ou `error`).
   - `POST /integrations/strava/sync`, `DELETE /integrations/strava` e `GET /integrations`.
   - `redirect_uri` = `http://localhost:3003/api/integrations/strava/callback`.
4. **Sync:**
   - fazer refresh do token se estiver vencido;
   - buscar `GET /athlete/activities?after=<last_sync_at>`, com paginação;
   - mapear para `NormalizedActivity`;
   - chamar `import_activity()` direto, com `recompute_metrics=False`, e rodar `update_daily_metrics()` uma vez no final;
   - atualizar o status da sincronização.
   - **Limite do MVP:** não busca os streams de GPS, para não estourar o rate limit do Strava. As atividades entram sem mapa.
5. No `/profile`, uma seção "Integrações" com Conectar, Sincronizar agora e Desconectar, e um toast lendo `?strava=`.

**Verificação:**
- O fluxo real funciona de ponta a ponta.
- Uma segunda sincronização não duplica atividades.
- Com `expires_at` forçado para o passado, o refresh acontece.
- Testes com `httpx` mockado.

## Estimativas

| # | Item | Tamanho | Dificuldade |
|---|---|---|---|
| 1 | Logger e erros engolidos | P | Fácil |
| 9 | Handler global de erro | P | Fácil |
| 2 | Erro genérico no profile | P | Fácil |
| 3 | Rate limit no login | P | Fácil |
| 8 | Verificar duplicidade | P | Fácil |
| 4 | Editar/excluir atividade | M–G | Médio |
| 5 | Equipamento com km real | M | Médio |
| 6 | Infra de testes | G | Difícil |
| 7 | CI | P–M | Fácil |
| 10 | Meta/prova-alvo | M–G | Médio |
| 11 | Strava OAuth | G | Difícil |

P = horas · M = 1 a 3 dias · G = mais de 1 semana

---

# PARTE B — APIs anotadas para avaliar depois

> **Só anotação.** O usuário marcou estas APIs como interessantes, mas ainda vai decidir se vale a pena fazer. Planos grátis e termos mudam, então é preciso conferir as condições atuais antes de integrar qualquer uma. Todas respeitam a regra de custo R$ 0, sem cartão.

| API | O que traria para o Ondilow | Custo | Esforço | O que verificar antes |
|---|---|---|---|---|
| **BrasilAPI** | CEP → cidade no perfil (base para clima e rotas locais) e feriados nacionais, para o Treinador IA encaixar o longão no feriado | Grátis, sem chave | P | Estabilidade (é um projeto comunitário) e limite de requisições |
| **Open-Topo-Data** | Completar a elevação de GPX/CSV importados sem altitude, o que deixa o TSS e os gráficos mais corretos | Grátis (API pública com cota) ou self-host | P | Cota diária da API pública e qual dataset usar para o Brasil (ex. SRTM 30m) |
| **Open Food Facts** | Registrar alimentação e suplementos do treino (gel, isotônico, refeição) por nome ou código de barras | Grátis, sem chave | P-M | Cobertura de produtos brasileiros e qualidade dos dados nutricionais |
| **USDA FoodData Central** | Tabela nutricional completa (carboidrato, sódio) para comida sem código de barras. Complementa o Open Food Facts | Grátis, com chave | P-M | Os nomes são em inglês, então será preciso tradução/busca, e a chave tem limite por hora |
| **Cloudinary** | Hospedar os cards/stories exportados e gerar link público para compartilhar fora do celular | Plano grátis | P-M | Limites do plano grátis (armazenamento/banda) e se o plano exige cartão |
| **ntfy.sh** | Notificação no celular sem criar conta: "treino de hoje", recorde novo, dias sem treinar, risco de lesão alto | Grátis | P | Privacidade: os tópicos públicos são adivinháveis. Usar nome de tópico aleatório ou self-host |

### Ideias de feature que essas APIs destravam
- **Diário de nutrição do treino** (Open Food Facts + USDA): o Treinador IA passa a cruzar "o que comeu" com o desempenho no longão.
- **Alertas no celular** (ntfy.sh): reaproveita os alertas que o sino do dashboard já calcula.
- **Contexto local** (BrasilAPI): cidade do atleta para clima e rotas, e feriados no planejamento do Treinador IA.
- **Elevação confiável** (Open-Topo-Data): corrige atividades importadas sem altitude.
- **Link de compartilhamento** (Cloudinary): complementa o export de card/sticker e a Web Share API (ver abaixo).

### Outras ideias discutidas e ainda não escolhidas (referência)
- **Web Share API** (nativa do navegador, não é serviço externo): compartilhar o card direto no WhatsApp ou Instagram Stories pelo celular.
- **Mercado Livre API**: sugerir tênis quando um equipamento passar do limite de km.
- **Motor de "look" por clima**: Open-Meteo mais uma tabela de regras, usando as roupas cadastradas em `/equipment`.
- **Open-Meteo** (clima e qualidade do ar), **Sunrise-Sunset**, **OpenRouteService** (gerar rota de X km), **Telegram Bot**, **Intervals.icu/Withings** (sono e VFC), **Google Calendar**, **Web Speech API**, **Sentry**.
- **Descartadas:** Garmin (bloqueia API não oficial), COROS/Suunto (só parceiros), WhatsApp Cloud API (cobra por conversa), calendário de provas no Brasil (sem API pública).
