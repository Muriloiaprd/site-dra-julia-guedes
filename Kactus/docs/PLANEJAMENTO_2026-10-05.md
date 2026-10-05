# Planejamento 2026-10-05 — Duni: plano do objetivo, plano estável e linguagem sem PSE

Pedido do Murilo em 2026-10-05, depois do redesenho da área da Duni:

1. **Sem PSE.** "PSE" não é linguagem que todo mundo entende. Treino guiado por
   **frequência cardíaca, distância, ritmo e tempo**.
2. **Plano da semana estável.** Cada clique em "Gerar plano da semana" traz um treino
   diferente. Tem que olhar o último mês do atleta e o objetivo, e não sortear.
3. **Plano do objetivo.** Um card novo, "Gerar plano do objetivo", que monta **todos os
   treinos até o dia da prova**. O objetivo do Murilo: Maratona do Rio, maio de 2027.

Decisões (respondidas pelo Murilo):

- Plano do objetivo = **todos os treinos até a prova já com data, tipo, distância, ritmo e
  FC**, organizados em fases (base → construção → pico → polimento). O **passo a passo** de
  cada treino (aquecimento, tiros, desaquecimento) é feito quando a semana chega, no
  "Gerar plano da semana", seguindo o plano do objetivo.
- **3 dias de corrida por semana** até a maratona.

## Diagnóstico (o que está no código hoje)

- `_call_gemini` não passa `temperature`: o modelo usa o padrão (~1), então o mesmo
  pedido dá respostas diferentes. Esta é a causa principal do "treino diferente a cada clique".
- O contexto da Duni (`build_context`) traz atividades detalhadas só dos últimos
  **14 dias** (`_RECENT_DETAIL_DAYS`, máx. 15). O resto do mês chega só em totais.
- Objetivo e provas existem como memórias (`athlete_memories`, kind `objetivo`/`prova`,
  com `event_date`), mas o plano semanal só é "uma semana solta": não existe estrutura de
  longo prazo.
- PSE aparece no prompt (regras, `PlanStep.pse`, `PlanWorkout.pse`), nos alvos da tela,
  nos passos e na análise completa ("Esforço médio").

## Fases

Cada fase termina com `uv run pytest` + `ruff` (arquivos tocados), `npx tsc --noEmit`,
conferência na tela (`/coach-preview`, dados de exemplo) e **commit + push** (origin e
espelho `kactus` via commit-ponte).

### Fase 1 — Linguagem sem PSE

- Prompt: a Duni guia o treino por **FC (zona + faixa em bpm, se houver FC máx/repouso no
  perfil), distância, ritmo e tempo**. Nada de "PSE" no texto nem nos campos do treino.
- Esquema da IA: sai `pse` de `PlanStep`/`PlanWorkout`; "o que priorizar" passa a ser
  ritmo, FC ou tempo.
- Tela: sai "Esforço (PSE)" dos alvos e dos passos; a análise completa troca "Esforço médio"
  por linguagem simples. Planos antigos que ainda têm PSE salvo não mostram esse campo.
- O check-in (o atleta conta como se sentiu) continua; a Duni lê, só não usa a sigla.

### Fase 2 — Plano da semana estável e com o último mês

- `temperature=0` (e `seed` fixo quando o modelo aceitar) em plano da semana, plano do
  objetivo e troca de treino. Chat e resumo ficam como estão.
- Contexto do plano: atividades detalhadas dos **últimos 28 dias** (não 14), com limite maior.
- O plano da semana passa a considerar o objetivo cadastrado (prova + data) e, quando
  existir, o plano do objetivo (Fase 4).
- Teste: o mesmo contexto gera o mesmo pedido (prompt idêntico e temperatura 0 no config).

### Fase 3 — Plano do objetivo (backend)

- Tabela nova `goal_plans` (migração 021): prova, data, distância, dias por semana, fases
  (JSON: nome, início, fim, foco), modelo, versão do prompt. `planned_workouts` ganha
  `goal_plan_id` (FK, nullable).
- **Esqueleto pelo código** (seguro e igual a cada clique): semanas de hoje até a prova,
  km por semana partindo do volume atual (média das últimas 4 semanas), subida ≤ 10% por
  semana, semana de alívio a cada 4, longão crescendo até ~32 km, polimento nas 3 últimas
  semanas, a prova no dia. 3 treinos por semana: longão + qualidade + leve.
- **A Duni preenche** (temperatura 0): tipo de cada treino, título, ritmo e zona de FC a partir
  do nível atual (previsões de prova/histórico), respeitando o esqueleto. O código valida
  (data, km dentro do esqueleto, nada forte em semana de alívio/polimento) e recusa o que
  fugir.
- `POST /coach/goal-plan/generate`, `GET /coach/goal-plan`. Sem prova com data nas
  memórias → erro claro pedindo para cadastrar.
- Gerar de novo refaz só do dia de hoje em diante; treinos feitos/pulados ficam.

### Fase 4 — A semana segue o plano do objetivo

- Com plano do objetivo ativo, "Gerar plano da semana" pega os treinos do objetivo dos
  próximos 7 dias e só **detalha** (passos, alvos). Data, tipo e distância não mudam (o
  código sobrescreve se a IA tentar).
- Sem plano do objetivo, segue como hoje.

### Fase 5 — Tela do plano do objetivo

- Terceiro botão no topo: **"Gerar plano do objetivo"**.
- Quadro novo "Plano do objetivo": prova e contagem de dias, faixa das fases (base /
  construção / pico / polimento), gráfico de km por semana com a semana atual marcada, e
  a lista de semanas (abre para ver os 3 treinos de cada uma).
- Sem prova cadastrada: o quadro explica e leva para "O que a Duni sabe de você".

### Fase 6 — Fechamento

- Teste ao vivo com a conta do Murilo (ele gera o plano do objetivo e o da semana; Claude
  não digita senha), ajustes, `docs/` atualizado e memória do projeto.
