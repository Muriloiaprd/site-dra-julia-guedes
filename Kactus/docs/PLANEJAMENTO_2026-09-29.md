# Kactus — Planejamento: Desempenho, menu com logo grande, cabeçalho limpo e "Meu kit" (2026-09-29)

**Criado em**: 2026-09-29
**Status**: EM ANDAMENTO. Ver "Registro de execução" no fim.
**Relacionados**: [`BACKLOG.md`](./BACKLOG.md) · [`ESTADO_DO_PROJETO.md`](./ESTADO_DO_PROJETO.md) · [`PLANEJAMENTO_2026-09-27_2.md`](./PLANEJAMENTO_2026-09-27_2.md)

## Como retomar
1. Ler este documento inteiro e o "Registro de execução".
2. Conferir no código se algo mudou desde a data acima.
3. Seguir pela próxima fase pendente (o usuário aprovou o plano inteiro em 2026-09-29).

Cada fase termina em commit, `git push` (origin) e sincronização do espelho `kactus` via commit-ponte. Custo zero sempre.

## Contexto

O usuário acha que o site está ocupando espaço demais e quer ele mais limpo. Pediu quatro coisas:
1. **Juntar as abas Carga e Previsões.**
2. **Menu lateral:** itens menores e a logo bem maior, para o destaque ficar na marca.
3. **Equipamentos:** um lugar para "montar o seu boneco" com as roupas que quiser, com fotos reais. Ele também pediu ideias.
4. **Cabeçalho do dashboard:**
   - só "Olá, Murilo" à esquerda;
   - sincronização e data à direita;
   - sem a frase "Disciplina hoje. Resultados amanhã."

Decisões do usuário (AskUserQuestion):
- **Estrutura:** página única enxuta, sem abas internas.
- **Nome:** "Desempenho", em `/performance`.
- **Logo:** a empilhada, grande.
- **Boneco:** ilustrado, mais as fotos reais das peças do próprio usuário.

## O que a investigação mostrou

**Carga e Previsões se repetem:**
- A recomendação "Hoje" vem da mesma função `training_recommendation` (`kactus_api/metrics/predictions.py`) nas duas abas: em `/metrics/summary` como `hoje` e em `/predictions/overview` como `recommendation`.
- O risco de lesão aparece nas duas, calculado de jeitos diferentes:
  - Carga usa `riskFromAcwr` no front;
  - Previsões usa `overview.risk` do backend, com regra de ACWR + TSB e motivos.
- Juntas, as duas páginas somam uns 15 blocos, com duas explicações de fórmula.

**Links para as páginas antigas:**
- alertas do dashboard (`/predictions`, `/metrics`);
- `AthleteStatus` ("Análise completa");
- `GoalCard`;
- `MOBILE_PRIMARY` da Sidebar.

**Fotos de produto:**
- As fotos oficiais das marcas têm direito autoral e não são copiadas para o site.
- O caminho seguro:
  - o usuário sobe fotos das peças dele (redimensionadas no navegador, como já é feito com o avatar);
  - o catálogo ganha um botão "Ver fotos ↗" que abre a busca de imagens.

## Fases

### Fase 0: Commit dos avisos + este documento
Os avisos de sessão ativa e de carregamento lento já estavam feitos e foram para o commit `ee1bcd0`. Depois vem este documento.

### Fase 1: Cabeçalho do dashboard
Arquivo: `components/dashboard/DashboardHeader.tsx`.
- **Esquerda:** só o `<h1>Olá, {name}</h1>`. Saem o ⚡ e a frase.
- **Direita:** um bloco de texto alinhado à direita, antes dos ícones:
  - a pílula de sincronização;
  - embaixo, a data.
- **Celular:** "Olá" e os ícones na mesma linha; sincronização e data numa linha pequena embaixo.
- **Nome:** hoje aparece "Muriloiaprd", tirado do e-mail, até o perfil chegar. Passa a mostrar um skeleton no lugar do nome enquanto o perfil carrega.

### Fase 2: Menu lateral com logo grande
Arquivos: `components/Sidebar.tsx`, `components/Logo.tsx`, `app/globals.css`.

**Logo:**
- Nova variante `stacked`, com `/brand/kactus-empilhada.png`.
- Na sidebar `lg`: cerca de 110 px, centralizada, com brilho verde mais forte atrás.
- No rail `md`: o símbolo com 40 px.

**Itens do menu:**
- Menores: fonte 0.78rem, padding menor, ícones de 17 px.
- Saem os títulos de grupo; ficam só divisores finos.

**Navegação:**
- Sai "Previsões"; "Carga" vira "Desempenho" (`/performance`).
- Mobile: `/metrics` vira `/performance`.
- Topo do celular: logo de 30 px.

### Fase 3: Página "Desempenho"
- **Rota e redirects:** nova rota `app/performance`. `/metrics` e `/predictions` redirecionam para ela via `redirects()` no `next.config.mjs`. As pastas antigas são removidas.
- **Links:** atualizados no dashboard, no `AthleteStatus` e no `GoalCard` (este vai para `/performance#provas`).

**Blocos, em ordem** (componentes em `components/performance/`):
1. **Hoje:** um painel com
   - a recomendação;
   - a faixa segura de corrida para 7 dias;
   - os últimos 7 dias × média.
2. **Forma, Risco de lesão e Condicionamento.** O risco passa a vir de `overview.risk`, a mesma fonte dos alertas do dashboard.
3. **Previsões de prova** (`#provas`): 4 cards compactos.
4. **Evolução:** um gráfico com seletor entre "Volume semanal" e "Ritmo mensal".
5. **Intensidade e efeito de treino.**
6. **Constância:** 16 semanas.
7. **Modo avançado** (um só, recolhido):
   - KPIs CTL/ATL/TSB/ACWR;
   - condicionamento × cansaço;
   - gráficos TSB e ACWR;
   - simulador de TSB;
   - todas as fórmulas.

Sem mudança no backend.

### Fase 4: Fotos reais e peças de roupa
**Backend:**
- Migração 019: `equipment.photo_data_url`.
- Schemas com validação: só `data:image/jpeg|png;base64,`, com teto de ~300 KB.
- Catálogo: a cinta cardíaca passa ao tipo `hr_strap`.

**Frontend:**
- `lib/image.ts` com o redimensionamento, que sai do perfil. As fotos ficam com 480 px no lado maior, em JPEG.
- Campo "Foto" no formulário do equipamento.
- A foto aparece no card, no lugar do emoji.
- Novos tipos: camiseta/regata, short/legging, meia, boné/viseira, óculos, cinta cardíaca, hidratação.
- Botão "Ver fotos ↗" no catálogo.

### Fase 5: "Meu kit", o boneco para montar
**Backend** (migração 019):
- Tabela `equipment_kits`:
  - campos `user_id`, `preset`, `slots` JSONB e `updated_at`;
  - uma linha por usuário e preset.
- `GET /equipment/kits`: devolve os 4 presets (corrida, prova, calor, frio). Os que o usuário ainda não salvou vêm com um padrão sugerido.
- `PUT /equipment/kits/{preset}`. Um `equipment_id` de outro usuário dá 422.

**Frontend** (`components/equipment/KitBuilder.tsx`, no topo de Equipamentos):
- Boneco em SVG no visual neon, com encaixes:
  - cabeça (boné/viseira);
  - óculos;
  - tronco (regata/camiseta/manga longa/corta-vento);
  - cinta;
  - relógio;
  - cintura (short/legging/cinto de hidratação);
  - meias;
  - tênis.
- **Clicar num encaixe:** escolhe o estilo, a cor e o equipamento cadastrado ligado àquela peça.
- **Peça ligada a um equipamento:** mostra a foto e os km. Se for o tênis e estiver na hora de trocar, ele pisca em vermelho.
- **Presets:** Corrida, Prova, Calor e Chuva/frio. Salvam sozinhos.

### Fase 6: Documentação e fechamento
- Atualizar `ESTADO_DO_PROJETO.md`.
- Pôr as ideias no `BACKLOG.md`:
  - kit do dia pelo clima (Open-Meteo, grátis);
  - silhueta pelo campo Sexo;
  - kit no gerador de Stories;
  - checklist de véspera de prova.
- Fechar este plano e registrar na memória.

## Verificação
- **Web:** `pnpm exec tsc --noEmit` em `apps/web`.
- **API:**
  - `uv run pytest` na branch Neon **test**, nunca na main;
  - migração com `alembic upgrade head`;
  - reiniciar o preview depois de mudar o backend.
- **Navegador** (`preview_start kactus`):
  - desktop, rail `md` e celular (375 px);
  - redirects funcionando;
  - screenshots em cada fase, sem erros no console.

## Registro de execução

### Fase 0 (2026-09-29)
- Commit `ee1bcd0`: aviso de sessão ativa na landing/login e aviso de carregamento lento no dashboard.
- Este documento criado.

### Fase 1 (2026-09-29)
- `DashboardHeader`: só "Olá, {nome}" à esquerda (sem ⚡ e sem a frase); sincronização e data à direita (no celular, linha pequena sob o "Olá").
- Data com só a primeira letra maiúscula ("Terça-feira, 29 de setembro"; antes o `capitalize` deixava "29 De Setembro").
- Nome com skeleton até o perfil chegar (`profileDone` em `dashboard/page.tsx`); antes piscava "Muriloiaprd".

### Fase 2 (2026-09-29)
- `Logo` ganhou `stacked` (logo empilhada, `size` = altura). Sidebar `lg`: logo de 110 px centralizada, com brilho verde centrado atrás; rail `md`: símbolo de 40 px; topo do celular: 30 px.
- Itens do menu menores (0.78rem, padding 0.5/0.7rem, ícones 17 px, indicador ativo 18 px) e sem títulos de grupo (só divisor fino; o nome do grupo ficou no `aria-label` da lista).
- A troca Carga/Previsões → Desempenho no menu fica na Fase 3, junto com a rota nova.

### Fase 3 (2026-09-29)
- Nova aba **Desempenho** (`app/performance`), com componentes em `components/performance/`: `TodayPanel` (hoje + faixa segura + últimos 7 dias × média num painel), `StatusTiles` (forma, risco pelo `overview.risk` do backend, condicionamento), `RacePredictions` (`#provas`, cards compactos), `EvolutionChart` (Volume semanal | Ritmo mensal), `TrainingQuality`, `ConsistencyHeatmap` e `AdvancedSection` (um único modo avançado com KPIs, condicionamento × cansaço, TSB, ACWR, simulador e todas as fórmulas, com a regra de risco escrita igual à do backend).
- `app/metrics` e `app/predictions` removidos; `next.config.mjs` redireciona `/metrics` e `/predictions` para `/performance`.
- Links: alertas do dashboard e `AthleteStatus` → `/performance`; `GoalCard` → `/performance#provas`. Menu: "Desempenho" no lugar de Carga e Previsões (desktop e barra do celular).
- Conferido no navegador: redirects, todos os blocos carregando, seletor Volume/Ritmo, modo avançado (3 gráficos), simulador, âncora `#provas`, 375 px sem rolagem lateral.
