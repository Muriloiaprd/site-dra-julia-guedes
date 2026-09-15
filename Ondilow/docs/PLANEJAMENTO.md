# Ondilow — Planejamento de Execução

**Criado em**: 2026-09-15
**Status**: Fases 1 a 5 executadas e verificadas. Em 2026-09-15 o usuário decidiu não fazer mais as Fases 6-9 (infra de testes, CI, meta/prova-alvo, Strava OAuth) — foram removidas deste plano. Não havia dependência técnica pendente, foi só decisão de escopo.
**Relacionados**: [`BACKLOG.md`](./BACKLOG.md) (backlog priorizado) · [`ESTADO_DO_PROJETO.md`](./ESTADO_DO_PROJETO.md) (estado atual)

## Como retomar
Quando o usuário pedir para retomar o planejamento:
1. Ler este documento inteiro.
2. Conferir no código se algo mudou desde a data acima (commits novos, itens já resolvidos).
3. Apresentar um resumo com análise: o que continua válido, o que mudou e por qual fase começar.
4. Só executar depois da confirmação do usuário, fase por fase.

O documento tem duas partes:
- **Parte A**: plano executado (itens 1, 2, 3, 4, 5, 8 e 9 do backlog, em 5 fases). Os itens 6, 7, 10 e 11 (infra de testes, CI, meta/prova-alvo, Strava OAuth) foram descartados em 2026-09-15.
- **Parte B**: APIs anotadas **só para avaliar depois** se vale a pena. Não são compromisso.

---

# PARTE A — Plano de execução (backlog P0 + P1)

## Contexto
Numa revisão do site rodando (dashboard, atividades, carga, previsões, coach, equipamentos, perfil e import), cruzada com o `BACKLOG.md`, saíram 20 melhorias possíveis. O usuário escolheu fechar primeiro o escopo **P0 + P1**, e em 2026-09-15 decidiu não fazer mais os itens 6, 7, 10 e 11 (infra de testes, CI, meta/prova-alvo, Strava OAuth).

## Ordem das fases

| Fase | Itens | Por quê |
|---|---|---|
| 1 | 1 (logs) + 9 (handler global) + 2 (profile.tsx) | Tudo é tratamento de erro. O item 1 cria o logger que o 9 usa, e o 2 aplica no front o padrão que o 9 formaliza no back |
| 2 | 3 (rate limit no login) | Mexe em `main.py`, então fica para depois da Fase 1 |
| 3 | 8 (confirmar chamadas duplicadas) | Verificação rápida, sem dependências |
| 4 | 4 (editar/excluir atividade) | — |
| 5 | 5 (equipamento com km real) | Reaproveita o `PATCH /activities/{id}` da Fase 4 |

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

**Verificação:** a 6ª tentativa rápida de login devolve 429.

## FASE 3 — Confirmar chamadas duplicadas no dashboard (item 8) — CONCLUÍDA, causa diferente do previsto

A hipótese do StrictMode estava errada: rodando `next build && next start` (produção, sem StrictMode) a duplicação de `/api/auth/me` e `/api/profile` continuava. Causa real: `components/Sidebar.tsx` busca `fetchMe()`/`fetchProfile()` para o avatar/nome da navegação, independente de cada página (dashboard, coach, equipment, import, metrics, predictions, profile) que busca os mesmos dados pro seu próprio uso — toda página autenticada disparava as duas chamadas em dobro. As demais chamadas do `load()` (activities, records, predictions, metrics/load, coach/plan) não duplicavam, só essas duas.

**Correção aplicada** (`apps/web/lib/api.ts`): em vez de reestruturar as ~8 páginas com um contexto compartilhado, `fetchMe()` e `fetchProfile()` passaram a cachear por um TTL curto (3s) via um `dedupe()` local — layout e page hidratam em chunks JS separados, então um simples "dedupe do que está em voo" não bastava (a primeira chamada às vezes já resolvia antes da segunda começar); o TTL cobre esse intervalo sem mudar o comportamento de cada página.

**Verificação:** confirmado no browser com API e `next start` reais — login, navegação client-side entre páginas (`/dashboard` → `/coach`) e reload direto de URL — sempre 1 chamada de cada por carregamento, nunca 2. `pytest` (33) e `tsc --noEmit` continuam passando.

## FASE 4 — Editar e excluir atividade individual (item 4) — CONCLUÍDA

**Backend** (commit `d1aaa8b`): `ActivityUpdate`, `PATCH /activities/{id}` (recalcula PRs se `sport` mudar de grupo), `DELETE /activities/{id}` (soft delete + `update_daily_metrics` + `recompute_all_records`).

**Frontend + fix de performance real** (commit `0459cac`): `updateActivity`/`deleteActivity` em `lib/api.ts`, botão de excluir em `app/activities/page.tsx` (desktop e mobile), botões "Editar"/"Excluir" em `app/activities/[id]/page.tsx`. Na verificação ao vivo (não só no papel) apareceu um bug real: com ~100 atividades no histórico, trocar a modalidade de uma atividade levava 57s e às vezes estourava em 500 — `recompute_all_records()` fazia até 7 `SELECT`s ao Neon por atividade. Corrigido mantendo o "melhor atual" em memória em vez de consultar o banco a cada atividade: 57s → 8.6s.

**Verificado ao vivo** com API e `next start` reais, numa atividade descartável criada só pro teste (sem tocar atividades reais do usuário): editar título/modalidade persiste, excluir soma-se e some da listagem. `pytest` (33), `ruff` e `tsc --noEmit` passam.

**Ao retomar:** seguir para a Fase 5 (equipamento com km real).

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

## FASE 5 — Equipamento com km real (item 5) — CONCLUÍDA

Migration `009_activity_equipment.py`: coluna `equipment_id` nullable em `activities`, FK `ondelete=SET NULL` + índice. `equipment_id` adicionado em `models/activity.py`, `ActivityUpdate` e `ActivityDetail`. No `PATCH /activities/{id}`, valida que o equipamento pertence ao usuário (404 se não). `routers/equipment.py`: `_total_distance` soma `initial_distance_m` + `SUM(distance_m)` das atividades vinculadas não excluídas. Front: `<select>` de equipamento no painel de edição de `activities/[id]/page.tsx`.

**Verificado ao vivo** (conta `teste@teste.com`, API e `next dev` reais): criado equipamento descartável "Tenis de teste", vinculado a uma atividade real de 5.02km via edição — a página de Equipamentos passou a mostrar 5.0km de distância acumulada, sem erros no console. `pytest` (33), `ruff` (nos arquivos tocados) e `tsc --noEmit` passam.

**Decisão do usuário em 2026-09-15:** não fazer mais as Fases 6-9 (infra de testes, CI, meta/prova-alvo, Strava OAuth). Removidas deste plano — não havia dependência técnica pendente.

## Estimativas (itens executados)

| # | Item | Tamanho | Dificuldade |
|---|---|---|---|
| 1 | Logger e erros engolidos | P | Fácil |
| 9 | Handler global de erro | P | Fácil |
| 2 | Erro genérico no profile | P | Fácil |
| 3 | Rate limit no login | P | Fácil |
| 8 | Verificar duplicidade | P | Fácil |
| 4 | Editar/excluir atividade | M–G | Médio |
| 5 | Equipamento com km real | M | Médio |

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
