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

### Fase 0 — Este documento

### Fase 1 — Equipamentos dentro de Atividades
- O conteúdo da tela de Equipamentos vira o componente `components/equipment/EquipmentSection.tsx`.
- Atividades ganha as sub-abas **Histórico** e **Equipamentos** (`/activities?aba=equipamentos`); Comparar, Lixeira e Importar só aparecem em Histórico.
- `/equipment` redireciona para a sub-aba; o item Equipamentos sai do menu.

### Fase 2 — Importar dentro do Perfil
- O conteúdo da tela Importar vira `components/profile/ImportSection.tsx`, no Perfil (âncora `#importar`), com atalho no cabeçalho.
- `/import` redireciona para `/profile#importar`; todos os links "Importar" do site passam a apontar para lá.
- O item Importar sai do menu (o grupo "Gestão" deixa de existir).

### Fase 3 — API: plano por intervalo de datas
- `GET /coach/plan` aceita `start` e `end` (opcionais) para o calendário ler meses passados e futuros; sem eles continua igual.
- Teste na branch Neon `test`.

### Fase 4 — Aba Calendário de treinos (`/calendar`)
- Mês inteiro com o treino planejado de cada dia (com a situação) e as atividades feitas; setas de mês, "Hoje", totais do mês e painel do dia.
- No celular, lista por semana.
- Recebe da Duni: gerar plano da semana, gerar plano do objetivo, Plano do objetivo, Planejado × feito, Plano da semana e semana livre.
- Menu: "Calendário" logo depois de Atividades; no celular entra na barra de baixo no lugar de Desempenho (que vai para "Mais").

### Fase 5 — Duni sem plano + links do Dashboard
- A página da Duni perde os blocos de plano e os dois botões de gerar plano; o indicador "Treinos planejados" vira link para o Calendário.
- Dashboard com o mesmo conteúdo; o alerta "Treino de hoje" e o card da Duni levam ao Calendário.

### Fase 6 — Verificação final e no ar
- Build do site, testes da API, conferência em preview e prints do celular (390 px).
- Reiniciar no Kactus Controle; republicar o fluxograma.

## Para verificar depois (com o Murilo)
Itens que o código e os testes cobrem, mas que só dá para confirmar com a conta real ou o iPhone. Ir riscando conforme for conferido.
