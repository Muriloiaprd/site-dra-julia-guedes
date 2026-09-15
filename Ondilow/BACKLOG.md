# Ondilow — Backlog Priorizado

Consolidado em 2026-09-10 a partir de uma auditoria completa (histórico de commits, backend, frontend). Veja o estado geral do projeto em [`ESTADO_DO_PROJETO.md`](./ESTADO_DO_PROJETO.md). Uso do app é só local por enquanto — isso pesa na priorização (P2 concentra o que só importa se/quando isso mudar).

> **Plano de execução dos itens P0+P1 e APIs anotadas para avaliar:** ver [`PLANEJAMENTO.md`](./PLANEJAMENTO.md) (2026-09-15).

---

## P0 — corrige coisas erradas/enganosas (baixo esforço, alto valor de confiança)

1. ~~**Dashboard mostra dado falso como se fosse real — "Próximos Treinos".**~~ **Resolvido em 2026-09-11**: o array hardcoded (`i % length`) foi substituído por dados reais do Treinador de IA (`GET /coach/plan`, ver `ESTADO_DO_PROJETO.md`). **"Meta Principal"**: no redesign de 2026-09-11 virou um CTA honesto ("Defina seu próximo desafio") que mostra o potencial real atual (previsões VDOT/Riegel de 5K–42K), sem simular progresso. **A feature de meta/prova-alvo em si continua pendente** (sem modelo/endpoint no backend).
2. ~~**Prontidão do atleta é arbitrária.**~~ **Resolvido em 2026-09-11 (redesign)**: `computeReadiness()` em `apps/web/lib/athlete.ts` deriva do TSB real (`/metrics/load`) com penalidade por ACWR > 1.3. Os baldes fixos por tipo de recomendação ficaram só como fallback quando não há métricas de carga; sem nenhum dado, não mostra número.
3. **Erro de API confundido com "sem dados".** ~~Dashboard~~ **resolvido no redesign**: `load()` agora tem estado de sincronização (`loading/ok/error`), banner com "Tentar de novo" e indicador "Falha na sincronização" no header. **Pendente:** `profile/page.tsx` — qualquer erro (não só 401) ainda redireciona pra `/login`, mascarando falha de rede como sessão expirada.
4. ~~**Export de card/story falha em silêncio.**~~ **Resolvido em 2026-09-11 (redesign)**: `activities/[id]/page.tsx` mostra um alerta "Falha ao exportar" com a mensagem de erro.
5. **Erros de backend engolidos sem log.** `rendering/composer.py:115,171`, `rendering/fonts.py:20`, `rendering/static_map.py:47` têm `except Exception` que descartam o erro. O `structlog` já está configurado (`logging_setup.py`) mas nunca é chamado em nenhum código de negócio — plugar `logger.warning(...)` nesses pontos e nos parsers.

## P1 — completude e robustez

6. **Atividade não pode ser editada nem excluída.** Falta `PATCH`/`DELETE /activities/{id}` em `routers/activities.py`. A coluna `deleted_at` já existe e já é respeitada em todas as queries de leitura — só falta o endpoint que a preenche.
7. **Sem rate limiting no login.** `/auth/login` aceita tentativas ilimitadas. Barato de adicionar (ex. `slowapi`), vale fazer mesmo em uso local, antes de qualquer exposição futura.
8. **Buracos de teste em lógica de negócio sensível.** Zero teste para `metrics/load.py` (CTL/ATL/TSB/ACWR), `metrics/records.py` (PRs), `metrics/predictions.py` (Riegel/VDOT/risco), e para `import_activity()`/dedup real (`import_service.py`) — hoje só helpers puros são testados. Falta fixture e teste de `.fit` (formato mais comum, nunca testado). Sem teste de rota HTTP nenhuma, apesar de `httpx`/`pytest-asyncio` já instalados.
9. ~~**`/metrics` fica em branco sem atividades.**~~ **Resolvido em 2026-09-11 (redesign)**: estado vazio explicativo com CTA para importar, e estado vazio próprio no heatmap.
10. **Equipamento não soma distância real.** `total_distance_m` em `routers/equipment.py:16-20` é um placeholder que só devolve `initial_distance_m` — não existe relação `activity↔equipment` pra somar de verdade.

## P2 — baixa prioridade agora (uso é só local, sem pressa)

11. ~~**Zero responsividade mobile.**~~ **Resolvido em 2026-09-11 (redesign)**: `components/AppShell.tsx` — sidebar completa em `lg`, rail compacto em `md`, top bar + navegação inferior (com menu "Mais") no mobile; grids Bento colapsam em coluna.
12. **Sem PWA** (manifest, ícone, add-to-homescreen) — mesma condição do item 11.
13. **Sem deploy público.** Hoje 100% local, só o Postgres é remoto (Neon). Só relevante se decidir acessar fora de casa.
14. **Perfil incompleto.** Sem unidades (km/mi), fuso horário, zonas de FC customizáveis manualmente, exportar todos os dados, trocar senha, deletar conta.
15. **Sem CI.** Nenhum GitHub Actions rodando lint/teste/build a cada commit. (Também não há config de ESLint em `apps/web` — `next lint` abriria o assistente interativo.)
16. **Acessibilidade.** *Parcial no redesign:* botões só-ícone ganharam `aria-label`, textos auxiliares subiram de 8–9px para ≥ 9.6px (a maioria 11–13px), tons de cinza passaram a tokens (`textTertiary` #6E6E6E, `muted` #888) e há suporte a `prefers-reduced-motion`. Falta uma passada de contraste AA nos rótulos de 9.6px e navegação por teclado nos gráficos.
17. **Integração Garmin/Strava via MCP** (retomar a Parte 1 do plano de sync). O endpoint `import-normalized` e o enum `strava_api` já foram preparados especificamente pra isso, mas a instalação dos MCP servers (`garmin_mcp`, MCP do Strava) ainda não foi feita.

---

## ✅ Concluído

- **2026-09-15** — `Sidebar.tsx` e cada página (dashboard, coach, equipment, import, metrics, predictions, profile) buscavam `fetchMe()`/`fetchProfile()` de forma independente, dobrando essas duas chamadas em todo carregamento. Corrigido com um cache de TTL curto em `apps/web/lib/api.ts` (ver `PLANEJAMENTO.md`, Fase 3).
- **2026-09-11** — Redesign visual completo (design system em `tailwind.config.ts` + `app/globals.css` + `lib/theme.ts`, componentes em `components/ui/`, dashboard "centro de comando" em `components/dashboard/`, mapas com tiles escuros CARTO, todas as páginas internas). Resolveu os itens 2, 4, 9, 11 e partes do 1, 3 e 16 acima.
- **2026-09-11** — Bug de `.env`/`data_dir` resolvidos por CWD (login travava para sempre quando a API era iniciada de outro diretório; uploads/exports/logs se espalhavam em duas pastas diferentes). Ver `ESTADO_DO_PROJETO.md`.
- **2026-09-11** — Item 1 (parcial): "Próximos Treinos" do dashboard agora usa dados reais do Treinador de IA em vez do array fictício.
- **2026-09-11** — Export de sticker transparente (estilo Strava) — item novo, não estava nesta lista, ver `ESTADO_DO_PROJETO.md`.
- **2026-09-11** — Treinador de IA (chat, relatório, plano de treino com rastreio de aderência) — item novo, ver `ESTADO_DO_PROJETO.md`.

---

*Como usar este arquivo: puxe itens do topo (P0) pra baixo, no seu ritmo. Ao concluir um item, mova-o pra uma seção "✅ Concluído" ou remova e registre no `ESTADO_DO_PROJETO.md`.*
