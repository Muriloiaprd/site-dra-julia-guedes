# Planejamento 2026-10-20 — menu enxuto + aba Calendário de treinos

Pedido do Murilo:
1. **Equipamentos** dentro de **Atividades** (não faz sentido uma aba só para equipamentos).
2. **Importar** dentro do **Perfil** (não é mais aba do app).
3. Nova aba **Calendário de treinos**: o mês com o **planejado + o feito**; é ali que ele confere os treinos.
4. O plano de treino aparece **só em dois lugares**: a aba Calendário e o resumo do Dashboard. O Dashboard **fica como está**; tudo o que é plano sai da página da Duni e vai para o Calendário.

Decisões tomadas com ele:
- Calendário mostra planejado + feito (cumprido / perdido / planejado), com o detalhe do dia ao clicar.
- Os quadros e botões de plano da Duni (gerar plano da semana, plano do objetivo, planejado × feito, semana livre) mudam para o Calendário; a Duni fica com resumo, indicadores, chat e memória.
- Equipamentos viram a sub-aba "Equipamentos" de Atividades (a outra é "Histórico").

Regras deste plano:
- Custo R$ 0, sem cartão.
- Uma fase de cada vez; cada fase termina com testes, commit e push (origin + espelho `kactus`).
- Toda fase que muda o funcionamento atualiza o fluxograma (`docs/fluxograma`) no mesmo commit e republica o Artifact.
- O Kactus no modo rápido só pega o código novo depois de **Reiniciar** no Kactus Controle.

## Fases

### Fase 0 — Este documento ✅ (`ea38f5f`)

### Fase 1 — Equipamentos dentro de Atividades ✅ (`d6d7963`)
- O conteúdo da tela de Equipamentos vira o componente `components/equipment/EquipmentSection.tsx`.
- Atividades ganha as sub-abas **Histórico** e **Equipamentos** (`/activities?aba=equipamentos`); Comparar, Lixeira e Importar só aparecem em Histórico.
- `/equipment` redireciona para a sub-aba; o item Equipamentos sai do menu.

### Fase 2 — Importar dentro do Perfil ✅ (`b7d28b6`)
- O conteúdo da tela Importar vira `components/profile/ImportSection.tsx`, no Perfil (âncora `#importar`), com atalho no cabeçalho.
- `/import` redireciona para `/profile#importar`; todos os links "Importar" do site passam a apontar para lá.
- O item Importar sai do menu (o grupo "Gestão" deixa de existir).

### Fase 3 — API: plano por intervalo de datas ✅ (`9858c37`)
- `GET /coach/plan` aceita `start` e `end` (opcionais) para o calendário ler meses passados e futuros; sem eles continua igual.
- Teste na branch Neon `test`.

### Fase 4 — Aba Calendário de treinos (`/calendar`) ✅ (`0d716ae`)
- Mês inteiro com o treino planejado de cada dia (com a situação) e as atividades feitas; setas de mês, "Hoje", totais do mês e painel do dia.
- No celular, lista por semana.
- Recebe da Duni: gerar plano da semana, gerar plano do objetivo, Plano do objetivo, Planejado × feito, Plano da semana e semana livre.
- Menu: "Calendário" logo depois de Atividades; no celular entra na barra de baixo no lugar de Desempenho (que vai para "Mais").

### Fase 5 — Duni sem plano + links do Dashboard ✅ (`217a1a6`)
- A página da Duni perde os blocos de plano e os dois botões de gerar plano; o indicador "Treinos planejados" vira link para o Calendário.
- Dashboard com o mesmo conteúdo; o alerta "Treino de hoje" e o card da Duni levam ao Calendário.

### Fase 6 — Verificação final e no ar ✅
- Build do site, testes da API, conferência em preview e prints do celular (390 px).
- Reiniciar no Kactus Controle; republicar o fluxograma.
- Feito em 2026-10-20: `next build` sem erro; 303 testes da API passando (branch Neon `test`); conferido nas páginas de exemplo `/activities-preview`, `/import-preview`, `/calendar-preview`, `/coach-preview` e `/dashboard-preview` (inclusive a 375 px); Kactus reiniciado pelo Controle, `/calendar` respondendo no PC e pelo Tailscale, `/equipment` e `/import` redirecionando; fluxograma republicado (versão 22, nova área 16).
- Páginas de teste novas: `/import-preview` e `/calendar-preview`. As respostas falsas da Duni viraram `app/(dev)/coach-preview/mock.ts`, usado pelas duas.

## Para verificar depois (com o Murilo)
Itens que o código e os testes cobrem, mas que só dá para confirmar com a conta real ou o iPhone. Ir riscando conforme for conferido.
- [ ] **Fase 1:** em Atividades, abrir a sub-aba Equipamentos com a conta real e conferir os tênis, cadastrar/editar/aposentar (testado só com dados de exemplo).
- [ ] **Fase 2:** em Perfil, rolar até "Importar atividades" (ou tocar em "Importar atividades ↓") e importar um .fit de verdade; no iPhone, o botão "+ Importar" de Atividades deve levar direto à seção.
- [ ] **Fase 4:** abrir o Calendário com a conta real: os treinos dos últimos meses aparecem como cumpridos/perdidos, o plano do objetivo aparece nos meses até a Maratona do Rio, e o detalhe do dia abre. Gerar o plano da semana por ali e ver o calendário atualizar.
- [ ] **Fase 4:** no iPhone, a barra de baixo agora é Início · Atividades · Calendário · Duni · Mais (Desempenho foi para "Mais"). Dizer se prefere outra ordem.
- [ ] **Fase 5:** a página da Duni sem os quadros do plano: conferir se ficou do jeito que queria (resumo, indicadores, chat e memórias).
