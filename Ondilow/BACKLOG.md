# Ondilow — Backlog Priorizado

Consolidado em 2026-09-10 a partir de uma auditoria completa (histórico de commits, backend, frontend). Veja o estado geral do projeto em [`ESTADO_DO_PROJETO.md`](./ESTADO_DO_PROJETO.md). Uso do app é só local por enquanto — isso pesa na priorização (P2 concentra o que só importa se/quando isso mudar).

---

## P0 — corrige coisas erradas/enganosas (baixo esforço, alto valor de confiança)

1. ~~**Dashboard mostra dado falso como se fosse real — "Próximos Treinos".**~~ **Resolvido em 2026-09-11**: o array hardcoded (`i % length`) foi substituído por dados reais do Treinador de IA (`GET /coach/plan`, ver `ESTADO_DO_PROJETO.md`). **"Meta Principal" continua pendente** — ainda é um CTA estático (`dashboard/page.tsx:763-776`) sem feature de meta/prova-alvo por trás. Decidir: remover a seção, rotular como "sugestão genérica" (honesto), ou construir a feature de verdade depois.
2. **Prontidão do atleta é arbitrária.** `readinessFromRec()` (`dashboard/page.tsx:87-96`) usa 4 baldes fixos (85/68/50/28) por tipo de recomendação, não deriva de CTL/ATL/TSB reais que a API já expõe em `/metrics/load`. Trocar por cálculo real.
3. **Erro de API confundido com "sem dados".** `load()` no dashboard (`dashboard/page.tsx:522-529`) não tem `.catch` — falha de rede cai no mesmo empty state de usuário novo. Pior em `profile/page.tsx` (~linhas 30-35): qualquer erro (não só 401) redireciona pra `/login`, mascarando falha de rede como sessão expirada. *(Parcialmente relacionado, já resolvido: `fetchMe()` — usado no boot de toda página — agora trata erro de rede e o dashboard mostra banner de retry em vez de travar em "Carregando" pra sempre. `load()` e o profile page em si ainda não foram tocados.)*
4. **Export de card/story falha em silêncio.** `activities/[id]/page.tsx:140-142` engole o erro (`catch { /* silencia */ }`) — usuário clica "Gerar" e nada acontece, sem explicação.
5. **Erros de backend engolidos sem log.** `rendering/composer.py:115,171`, `rendering/fonts.py:20`, `rendering/static_map.py:47` têm `except Exception` que descartam o erro. O `structlog` já está configurado (`logging_setup.py`) mas nunca é chamado em nenhum código de negócio — plugar `logger.warning(...)` nesses pontos e nos parsers.

## P1 — completude e robustez

6. **Atividade não pode ser editada nem excluída.** Falta `PATCH`/`DELETE /activities/{id}` em `routers/activities.py`. A coluna `deleted_at` já existe e já é respeitada em todas as queries de leitura — só falta o endpoint que a preenche.
7. **Sem rate limiting no login.** `/auth/login` aceita tentativas ilimitadas. Barato de adicionar (ex. `slowapi`), vale fazer mesmo em uso local, antes de qualquer exposição futura.
8. **Buracos de teste em lógica de negócio sensível.** Zero teste para `metrics/load.py` (CTL/ATL/TSB/ACWR), `metrics/records.py` (PRs), `metrics/predictions.py` (Riegel/VDOT/risco), e para `import_activity()`/dedup real (`import_service.py`) — hoje só helpers puros são testados. Falta fixture e teste de `.fit` (formato mais comum, nunca testado). Sem teste de rota HTTP nenhuma, apesar de `httpx`/`pytest-asyncio` já instalados.
9. **`/metrics` fica em branco sem atividades.** Sem estado vazio explicativo quando `data.length === 0` (heatmap simplesmente não renderiza nada).
10. **Equipamento não soma distância real.** `total_distance_m` em `routers/equipment.py:16-20` é um placeholder que só devolve `initial_distance_m` — não existe relação `activity↔equipment` pra somar de verdade.

## P2 — baixa prioridade agora (uso é só local, sem pressa)

11. **Zero responsividade mobile.** Sidebar fixa de 224px sem collapse, sem media queries em nenhum lugar, grids com `gridTemplateColumns` inline sem fallback. Só sobe de prioridade se um dia quiser acessar pelo celular.
12. **Sem PWA** (manifest, ícone, add-to-homescreen) — mesma condição do item 11.
13. **Sem deploy público.** Hoje 100% local, só o Postgres é remoto (Neon). Só relevante se decidir acessar fora de casa.
14. **Perfil incompleto.** Sem unidades (km/mi), fuso horário, zonas de FC customizáveis manualmente, exportar todos os dados, trocar senha, deletar conta.
15. **Sem CI.** Nenhum GitHub Actions rodando lint/teste/build a cada commit.
16. **Acessibilidade.** Fontes de 8-9.6px em várias legendas do dashboard, botões só-ícone sem `aria-label`, alguns tons de cinza (`#767676`) abaixo do contraste AA.
17. **Integração Garmin/Strava via MCP** (retomar a Parte 1 do plano de sync). O endpoint `import-normalized` e o enum `strava_api` já foram preparados especificamente pra isso, mas a instalação dos MCP servers (`garmin_mcp`, MCP do Strava) ainda não foi feita.

---

## ✅ Concluído

- **2026-09-11** — Bug de `.env`/`data_dir` resolvidos por CWD (login travava para sempre quando a API era iniciada de outro diretório; uploads/exports/logs se espalhavam em duas pastas diferentes). Ver `ESTADO_DO_PROJETO.md`.
- **2026-09-11** — Item 1 (parcial): "Próximos Treinos" do dashboard agora usa dados reais do Treinador de IA em vez do array fictício.
- **2026-09-11** — Export de sticker transparente (estilo Strava) — item novo, não estava nesta lista, ver `ESTADO_DO_PROJETO.md`.
- **2026-09-11** — Treinador de IA (chat, relatório, plano de treino com rastreio de aderência) — item novo, ver `ESTADO_DO_PROJETO.md`.

---

*Como usar este arquivo: puxe itens do topo (P0) pra baixo, no seu ritmo. Ao concluir um item, mova-o pra uma seção "✅ Concluído" ou remova e registre no `ESTADO_DO_PROJETO.md`.*
