# Planejamento 2026-10-05 (2) — Cards da semana do objetivo vazios

Pedido do Murilo: "O plano da semana do objetivo não está sendo preenchido nos cards de
segunda a domingo. Faça um planejamento para preencher isso, fazendo."

## Diagnóstico (dados reais, só leitura)

- Os treinos da semana existem: ter 06/10 Fartlek curto, qui 08/10 Rodagem leve, sáb 10/10
  Longão de base (plano do objetivo ativo `c1c11211…`).
- O quadro da semana (`GET /coach/plan/week`) mostra só os treinos com
  `weekly_plan_id` = plano principal da semana (`bb861b1c…`, das 19:07).
- Às 19:32 e 19:33 o plano do objetivo foi refeito pela tela. `generate_goal_plan` apaga
  os planejados de hoje em diante e cria os novos **sem `weekly_plan_id`** e **sem passo a
  passo**. Resultado: o plano principal ficou sem nenhum treino ligado → sete cards de
  "Descanso".
- O mesmo acontece se existir plano do objetivo e ainda não houver plano da semana: o quadro
  mostra só o convite para gerar, sem os treinos que já estão na agenda.

## Fases

Cada fase: `uv run pytest` + `ruff` nos arquivos tocados, `npx tsc --noEmit`, conferência em
`/coach-preview` e commit + push (origin e espelho `kactus`).

### Fase 1 — A semana vem pela data, não só pelo vínculo (API)

- `GET /coach/plan/week`: com plano principal, devolve **todos** os treinos da janela
  (início–fim do plano) pela data, e liga ao plano os planejados que estavam soltos.
- Sem plano principal, mas com plano do objetivo: devolve `plan: null` e os treinos dos
  próximos 7 dias, para o quadro mostrar a semana do objetivo mesmo antes de detalhar.
- `generate_goal_plan` já liga os treinos novos da janela da semana atual ao plano
  principal (o quadro não esvazia ao refazer o objetivo).
- Testes: refazer o objetivo depois do plano da semana mantém os cards; objetivo sem plano
  da semana devolve os treinos da semana.

### Fase 2 — Tela: quadro do objetivo sem passo a passo e "Detalhar a semana"

- O quadro funciona sem o plano principal (cabeçalho com as datas e o resumo em números; o
  status e a análise completa só aparecem quando a semana foi detalhada).
- Faixa "Estes treinos ainda não têm o passo a passo" com o botão **Detalhar a semana**
  quando algum treino da janela não tem passos.
- Treino sem passos mostra ritmo, FC e o km a km pelo alvo do treino (já funciona).

### Fase 3 — Corrigir a semana do Murilo

- Detalhar a semana atual (mesmo caminho do botão) para os cards voltarem com o passo a
  passo, e conferir os dados.
