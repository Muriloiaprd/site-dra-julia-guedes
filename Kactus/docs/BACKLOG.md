# Kactus — Backlog Priorizado

Consolidado em 2026-09-10 a partir de uma auditoria completa (histórico de commits, backend, frontend). Veja o estado geral do projeto em [`ESTADO_DO_PROJETO.md`](./ESTADO_DO_PROJETO.md). Uso do app é só local por enquanto — isso pesa na priorização (P2 concentra o que só importa se/quando isso mudar).

> **Plano de execução dos itens P0+P1 e APIs anotadas para avaliar:** ver [`PLANEJAMENTO.md`](./PLANEJAMENTO.md) (2026-09-15).

---

## P0 — corrige coisas erradas/enganosas (baixo esforço, alto valor de confiança)

1. ~~**Dashboard mostra dado falso como se fosse real — "Próximos Treinos".**~~ **Resolvido em 2026-09-11**: o array hardcoded (`i % length`) foi substituído por dados reais do Treinador de IA (`GET /coach/plan`, ver `ESTADO_DO_PROJETO.md`). **"Meta Principal"**: no redesign de 2026-09-11 virou um CTA honesto ("Defina seu próximo desafio") que mostra o potencial real atual (previsões VDOT/Riegel de 5K–42K), sem simular progresso. A feature de meta/prova-alvo em si (modelo/endpoint no backend) foi descartada por decisão do usuário em 2026-09-15, ver `PLANEJAMENTO.md`.
2. ~~**Prontidão do atleta é arbitrária.**~~ **Resolvido em 2026-09-11 (redesign)**: `computeReadiness()` em `apps/web/lib/athlete.ts` deriva do TSB real (`/metrics/load`) com penalidade por ACWR > 1.3. Os baldes fixos por tipo de recomendação ficaram só como fallback quando não há métricas de carga; sem nenhum dado, não mostra número.
3. ~~**Erro de API confundido com "sem dados".**~~ **Resolvido**: `load()` do dashboard tem estado de sincronização (`loading/ok/error`), banner com "Tentar de novo" e indicador "Falha na sincronização" no header. `profile/page.tsx` também corrigido (`PLANEJAMENTO.md`, Fase 1): sem token vai pro login, com token mas falha de rede mostra banner "Tentar de novo" sem deslogar.
4. ~~**Export de card/story falha em silêncio.**~~ **Resolvido em 2026-09-11 (redesign)**: `activities/[id]/page.tsx` mostra um alerta "Falha ao exportar" com a mensagem de erro.
5. ~~**Erros de backend engolidos sem log.**~~ **Obsoleto em 2026-09-17**: o `rendering/` inteiro (onde ficavam esses `except Exception` silenciosos) foi removido junto com a troca do export por Pillow para o gerador de Stories em Canvas (ver `PLANEJAMENTO_ATIVIDADES.md`, Fase 3).

## P1 — completude e robustez

6. ~~**Atividade não pode ser editada nem excluída.**~~ **Resolvido em 2026-09-15**: `PATCH`/`DELETE /activities/{id}` em `routers/activities.py`, com botões em `activities/page.tsx` e `activities/[id]/page.tsx`. Ver `PLANEJAMENTO.md`, Fase 4.
7. ~~**Sem rate limiting no login.**~~ **Resolvido**: `kactus_api/rate_limit.py` (`slowapi.Limiter`), integrado em `main.py` e `routers/auth.py`. Ver `PLANEJAMENTO.md`, Fase 2.
9. ~~**`/metrics` fica em branco sem atividades.**~~ **Resolvido em 2026-09-11 (redesign)**: estado vazio explicativo com CTA para importar, e estado vazio próprio no heatmap.
10. ~~**Equipamento não soma distância real.**~~ **Resolvido em 2026-09-15**: coluna `equipment_id` em `activities` (migration `009_activity_equipment`), `total_distance_m` agora soma `initial_distance_m` + `SUM(distance_m)` das atividades vinculadas não excluídas, com seletor de equipamento no formulário de edição da atividade. Ver `PLANEJAMENTO.md`, Fase 5.

## P2 — baixa prioridade agora (uso é só local, sem pressa)

11. ~~**Zero responsividade mobile.**~~ **Resolvido em 2026-09-11 (redesign)**: `components/AppShell.tsx` — sidebar completa em `lg`, rail compacto em `md`, top bar + navegação inferior (com menu "Mais") no mobile; grids Bento colapsam em coluna.
12. **Sem PWA** (manifest, ícone, add-to-homescreen) — mesma condição do item 11.
13. **Sem deploy público.** Hoje 100% local, só o Postgres é remoto (Neon). Só relevante se decidir acessar fora de casa.
14. **Perfil incompleto.** Sem unidades (km/mi), fuso horário, zonas de FC customizáveis manualmente, exportar todos os dados, trocar senha, deletar conta.
16. **Acessibilidade.** *Parcial no redesign:* botões só-ícone ganharam `aria-label`, textos auxiliares subiram de 8–9px para ≥ 9.6px (a maioria 11–13px), tons de cinza passaram a tokens (`textTertiary` #6E6E6E, `muted` #888) e há suporte a `prefers-reduced-motion`. Falta uma passada de contraste AA nos rótulos de 9.6px e navegação por teclado nos gráficos.
17. ~~**Integração Garmin: script de sync local**~~ — **FEITO em 2026-09-19** (`uv run python -m kactus_api.scripts.sync_garmin`, 17 testes). Falta só o usuário rodar `--garmin-login` uma vez. Contexto original: Investigado em 2026-09-19, ver `VIABILIDADE_GARMIN_STRAVA_2026-09-19.md`: o endpoint `import-normalized` foi validado (9 testes) e serve o caminho Strava, mas para o Garmin o melhor é baixar o `.FIT` original e reusar o parser existente. Escopo de ~1 dia definido no relatório; exige um login interativo único do usuário (senha + MFA). **MCP de Garmin foi avaliado e descartado** para import: move a série de GPS pelo contexto. Strava segue descartado (OAuth).

### Duni: achados do teste ao vivo de 2026-09-23 (todos resolvidos no mesmo dia)

18. ~~**O resumo some ao recarregar.**~~ **Resolvido**: `GET /coach/analyze` devolve o último resumo salvo sem chamar a IA, e `/coach` o carrega ao abrir.
19. ~~**Números da "Próxima semana" ficam velhos depois de "Pedir outro treino".**~~ **Resolvido**: km e sessões saem dos treinos salvos, não do relatório gerado.
20. ~~**Status do resumo e do plano divergem.**~~ **Resolvido** (prompt v3): o status mede cansaço, não forma, e pausa ou pouco treino dá 🟢 ou 🟡, nunca 🔴. Conferido ao vivo: o mesmo atleta que antes recebia 🔴 agora recebe 🟡, com a justificativa certa.
21. ~~**A Duni diz "Anotei" antes de o atleta clicar em Guardar.**~~ **Resolvido**: a regra está no prompt do sistema e na descrição do campo `reply` do schema. Só a instrução no fim da mensagem, o `flash-lite` ignorava. Conferido ao vivo.
22. ~~**Gênero do atleta.**~~ **Resolvido**: campo "Sexo" no perfil (opcional). Vira `perfil.tratamento` (feminino, masculino ou neutro) no contexto; sem o dado, texto neutro, a não ser que o atleta use um gênero ao falar de si.
23. ~~**Aviso "Nenhum objetivo cadastrado" com uma prova salva.**~~ **Resolvido**: uma prova que ainda não passou conta como objetivo (`has_goal` na API, a mesma regra no painel).

**Descartados por decisão do usuário em 2026-09-15** (ver `PLANEJAMENTO.md`): infra de testes (buracos de teste em `metrics/load.py`, `metrics/records.py`, `metrics/predictions.py`, `import_service.py`), CI (GitHub Actions), feature de meta/prova-alvo, Strava OAuth direto. Não são pendências — foi escolha de escopo, não voltar a sugerir.

## Ideias (levantadas em 2026-09-27, nada prometido)

Todas de custo zero e para uso local. Ordem = valor × esforço (as primeiras rendem mais por menos trabalho). O usuário escolhe; nada é executado sem pedido.

1. **Importar sozinho pela pasta do relógio.** O relógio Garmin ligado no USB tem a pasta `GARMIN/Activity` com os `.FIT`. Um botão (ou script agendado) que lê essa pasta e importa só o que é novo contorna o sync do Garmin bloqueado (item 17). *Esforço baixo.*
2. **Tênis padrão por esporte.** Hoje cada corrida precisa ser ligada ao tênis na mão; com um "tênis padrão da corrida", toda importação já soma o km e o alerta de troca da Fase 5 fica sempre certo. *Esforço baixo.*
3. **"Planejado × feito" no dia seguinte.** Um cartão no dashboard: "Ontem era rodagem leve de 6 km; você fez 8 km em ritmo moderado", com um toque para pedir o comentário da Duni. *Esforço baixo.*
4. **Evolução da dinâmica de corrida.** Gráfico mensal de cadência, contato com o solo, oscilação e passada no mesmo ritmo (os dados chegaram na Fase 3). Mostra se a técnica melhora com o tempo. *Esforço médio.*
5. **Ritmo × calor.** Com a temperatura de 425 treinos, mostrar quanto o calor custa no seu ritmo e na FC ("acima de 27 °C você corre ~12 s/km mais devagar com a mesma FC") e usar isso na previsão de prova e na Duni. *Esforço médio.*
6. **Metas de volume semanal.** Meta de km/semana com barra de progresso, sugerida pela faixa segura da aba Carga. *Esforço baixo.*
7. **Resumo do mês.** Um cartão por mês com km, horas, recordes, efeito de treino médio e uma frase da Duni; dá para virar Story. *Esforço médio.*
8. **Comparar dois treinos lado a lado.** Mesmo percurso ou mesma distância: ritmo, FC, deriva e dinâmica, km a km. *Esforço médio.*
9. **Calendário de provas com contagem regressiva.** As provas já salvas nas memórias da Duni viram um calendário com "faltam N semanas" e a fase do treino (base, específico, polimento). *Esforço médio.*
10. **Backup e conta.** Exportar tudo (JSON/CSV + arquivos originais), trocar senha e excluir conta (item 14). *Esforço médio.*
11. **Acessibilidade.** A passada de contraste AA e o teclado nos gráficos (item 16). *Esforço médio.*

## Ideias de imagens para compartilhar (levantadas em 2026-09-29, nada prometido)

O usuário escolheu 6 modelos na primeira leva (feitos). Estas ficaram para depois:

1. **Capa de revista.** Sua foto de capa com o masthead KACTUS, manchetes geradas dos dados ("34 KM SEM DESCULPAS"), edição nº = número do treino no ano. *Esforço médio.*
2. **Frase da Duni.** O comentário da Duni sobre o treino vira um cartão de citação grande, assinado "Duni, treinadora IA". Mostra o diferencial de IA. *Esforço baixo.*
3. **Feed 4:5.** Os modelos de código em 1080×1350 para post e carrossel (os 6 novos já são desenhados em código, então a adaptação é de layout, não de arte). *Esforço médio.*
4. **Vídeo animado.** Story de 6–8 s gravado do próprio canvas (`canvas.captureStream` + `MediaRecorder`): rota se desenhando, números subindo, barras crescendo. Custo zero. *Esforço alto.*

---

## ✅ Concluído

- **2026-09-27**: nome Ondilow varrido do banco e do site, Duni com textos curtos e resumo estruturado, dados completos do FIT do Garmin, aba Carga em linguagem simples, equipamentos recomendados. Ver [`PLANEJAMENTO_2026-09-27_2.md`](./PLANEJAMENTO_2026-09-27_2.md).
- **2026-09-23**: Duni, a treinadora de IA (dados derivados, check-in, motor de análise, memórias, persona v2, plano da semana, comentário pós-treino), verificada ao vivo com o Gemini. Ver [`PLANEJAMENTO_2026-09-21.md`](./PLANEJAMENTO_2026-09-21.md).
- **2026-09-15** — Equipamento com km real: `equipment_id` em `activities`, soma real de distância por equipamento, seletor no formulário de edição da atividade (ver `PLANEJAMENTO.md`, Fase 5).
- **2026-09-15** — Editar e excluir atividade individual (`PATCH`/`DELETE /activities/{id}`), incluindo um fix de performance real em `recompute_all_records()` (ver `PLANEJAMENTO.md`, Fase 4).
- **2026-09-15** — `Sidebar.tsx` e cada página (dashboard, coach, equipment, import, metrics, predictions, profile) buscavam `fetchMe()`/`fetchProfile()` de forma independente, dobrando essas duas chamadas em todo carregamento. Corrigido com um cache de TTL curto em `apps/web/lib/api.ts` (ver `PLANEJAMENTO.md`, Fase 3).
- **2026-09-11** — Redesign visual completo (design system em `tailwind.config.ts` + `app/globals.css` + `lib/theme.ts`, componentes em `components/ui/`, dashboard "centro de comando" em `components/dashboard/`, mapas com tiles escuros CARTO, todas as páginas internas). Resolveu os itens 2, 4, 9, 11 e partes do 1, 3 e 16 acima.
- **2026-09-11** — Bug de `.env`/`data_dir` resolvidos por CWD (login travava para sempre quando a API era iniciada de outro diretório; uploads/exports/logs se espalhavam em duas pastas diferentes). Ver `ESTADO_DO_PROJETO.md`.
- **2026-09-11** — Item 1 (parcial): "Próximos Treinos" do dashboard agora usa dados reais do Treinador de IA em vez do array fictício.
- **2026-09-11** — Export de sticker transparente (estilo Strava) — item novo, não estava nesta lista, ver `ESTADO_DO_PROJETO.md`.
- **2026-09-11** — Treinador de IA (chat, relatório, plano de treino com rastreio de aderência) — item novo, ver `ESTADO_DO_PROJETO.md`.

---

*Como usar este arquivo: puxe itens do topo (P0) pra baixo, no seu ritmo. Ao concluir um item, mova-o pra uma seção "✅ Concluído" ou remova e registre no `ESTADO_DO_PROJETO.md`.*
