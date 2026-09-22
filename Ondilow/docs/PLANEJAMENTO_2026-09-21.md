# Ondilow — Planejamento da Duni, a treinadora de IA (2026-09-21)

**Criado em**: 2026-09-21
**Status**: Aguardando aprovação. Fase 0 concluída ao criar este documento.
**Relacionados**: [`BACKLOG.md`](./BACKLOG.md) · [`ESTADO_DO_PROJETO.md`](./ESTADO_DO_PROJETO.md) · [`PLANEJAMENTO_2026-09-18.md`](./PLANEJAMENTO_2026-09-18.md) (fechado em 2026-09-19)

## Como retomar
Quando o usuário pedir para retomar este planejamento:
1. Ler este documento inteiro, **incluindo o Anexo A** (o prompt do usuário, que é a especificação da treinadora).
2. Conferir no código se algo mudou desde a data acima (commits novos, itens já resolvidos).
3. Apresentar um resumo com análise: o que continua válido, o que mudou e por qual fase seguir.
4. Só executar depois da confirmação do usuário, fase por fase.

Cada fase termina em commit local **e** push para o GitHub.

---

## Contexto

O treinador de IA existe desde 2026-09-11 (commit `4902f27`). Ele passa a ser **a Duni**, uma treinadora especialista em corrida de rua, fisiologia, biomecânica e periodização. O usuário mandou um prompt completo com o comportamento esperado (Anexo A) e pediu que ele fosse conferido contra o que o Ondilow realmente tem. As divergências estão na seção "Onde eu discordo do prompt".

Decisões do usuário (2026-09-21):

- **Provedor**: Gemini no free tier (chave do Google AI Studio, sem cartão), pela regra de custo zero.
- **Tom**: técnico direto e exigente, mas com **linguagem acessível**, conforme o próprio prompt: sem jargão, e quando usar PSE ou GAP explicar na prática.
- **Escopo**: memória e objetivos, análise pós-treino e plano mais flexível, agora guiados pelo prompt do Anexo A. O "chat melhor" (streaming, várias conversas) ficou fora.

## O que a investigação mostrou

Conferido no código e no banco (conta principal) em 2026-09-21:

1. **O treinador nunca funcionou.** O `.env` não tem `GEMINI_API_KEY` nem `ANTHROPIC_API_KEY`, então todas as chamadas caem em `not_configured`. O prompt e o formato do plano nunca foram exercitados contra um modelo real.
2. **Bug de cadência.** Na corrida, a cadência média salva vai de 40 a 90 (média **80,6**). O FIT da Garmin grava passadas por minuto **de uma perna só**, então o valor real é o dobro (~161 ppm). A página da atividade mostra "80 spm", o que está errado. Com o valor atual, a Duni diria que a cadência está absurdamente baixa. Precisa ser corrigido **antes** de a Duni ler cadência.
3. **Dados que o prompt pede e que o Ondilow não tem:**

   | Pedido no prompt | Situação |
   |---|---|
   | PSE/RPE, sRPE, sensação, dor relatada | **Não existe.** Nenhum campo, e o parser do FIT não lê. |
   | Sono, HRV, Training Readiness, tempo de recuperação | **Não existe.** Viria só do Garmin Connect, que está bloqueado por rate limit (ver memória do sync). |
   | Tipo de terreno | **Não existe.** Só elevação e pontos de altitude. |
   | Academia, Pilates, caminhada | **Não dá para distinguir.** O enum de esportes não tem esses tipos: as 12 atividades desse tipo caem em `other`, sem título. |
   | GAP (ritmo ajustado à inclinação) | **Não existe, mas dá para calcular** a partir de altitude e distância dos pontos. Seria uma estimativa. |
   | Deriva cardíaca | **Não existe, mas dá para calcular** comparando pace e FC da primeira metade com a segunda. |
   | Splits por km | **Parcial.** 208 atividades têm voltas, todas do tipo `auto` (em geral 1 km no Garmin). Não há ritmo por volta calculado. |
   | Zonas de FC | **Parcial.** A conta principal tem FC máx 190 e de repouso 48, mas nenhuma zona salva. Dá para derivar pelo método de Karvonen. |
   | FC, cadência, elevação, distância, duração | **Existe.** 192 das 272 corridas têm FC (as mais antigas são GPX sem FC). |

4. **O histórico recente está quase vazio.** Nas últimas 10 semanas há de 1 a 3 corridas por semana (4–11 km), nada entre 17/08 e 07/09, e a última atividade é de 09/09. Se o usuário correu e não importou, a Duni vai concluir "destreinado". Ela precisa dizer **até que data** tem dados e avisar quando há um buraco suspeito.
5. **A Anthropic fica de fora** (custo zero). O caminho dela em `call_llm()` fica inerte sem chave. O modelo padrão `gemini-2.0-flash` provavelmente foi aposentado: confirmar no AI Studio no dia.
6. **O free tier tem limite de uso** e, no free tier, **o Google pode usar o conteúdo enviado** para melhorar os produtos dele. O contexto não leva GPS, mas as memórias (lesões, dor, rotina) iriam junto. O usuário precisa saber antes da Fase 5.

## Onde eu discordo do prompt (e o que o plano faz no lugar)

1. **"Analise TODAS as atividades" → quem faz a conta é o código, a Duni interpreta.** Mandar 298 atividades cruas ao modelo gasta a cota e piora a análise, porque modelos erram soma e média. O Python calcula as janelas de 7/14/28 dias e 6–8 semanas, os sinais de fadiga e as sessões equivalentes (Fase 4), e a Duni recebe esses fatos já prontos, mais o detalhe das atividades recentes. O espírito do prompt ("não olhe só a última semana") é mantido.
2. **Regras que dependem de sono, HRV e Readiness (seções 3 e 11) ficam inativas.** Sem Garmin, esses dados não existem. O prompt já diz "quando disponível", e a Duni vai declarar a ausência (seção 18). Não vou simular esses dados.
3. **Para ter carga interna de verdade, proponho um check-in rápido pós-treino** (Fase 3): PSE 0–10, dor (onde e quanto) e sensação. É o que tira a parte "PSE/sRPE/dor" do prompt do papel. Sem isso, a carga interna é só FC.
4. **Plano de 7 dias, não de 14 ou 28.** O próprio prompt diz que o plano não é imutável e que se deve montar "a próxima semana" depois de analisar. Um plano diário de 28 dias contradiz isso. Troco o seletor 7/14/28 por **semana a semana**, com uma visão opcional das próximas 4 semanas só em volume e foco, sem treinos diários.
5. **O formato longo da seção 18 vale para o plano semanal, não para o chat.** No chat a Duni responde curto, com a mesma persona e as mesmas regras de segurança. O relatório completo (status, carga, avaliação, tabela, treinos, critérios) sai no "Gerar plano da semana".
6. **Status 🟢🟡🟠🔴 contra a "Prontidão" do dashboard.** O dashboard já mostra uma prontidão calculada só com TSB/ACWR. Se a Duni disser 🟠 e o dashboard 85%, o app se contradiz. O status da Duni fica salvo com o plano e aparece como "Status da Duni", com data, e o card de prontidão ganha uma nota quando os dois divergirem.
7. **Foco em corrida, não mais triathlon.** O prompt é de corrida de rua e o prompt atual é de triathlon. Ciclismo, academia e Pilates entram como **carga complementar**, não como treino a prescrever. As 14 pedaladas e as 12 atividades `other` continuam contando na carga.
8. **Concordo sem ressalva** com: não usar a regra fixa de 10%, não usar 180 ppm como regra, não diagnosticar, priorizar a percepção de esforço nos treinos fáceis e não aumentar volume e intensidade ao mesmo tempo. Tudo isso vai no prompt.

---

## Fase 0 — Documento — CONCLUÍDA

Este arquivo.

## Fase 1 — Duni acordada (Gemini funcionando) — CONCLUÍDA

**Verificado ao vivo em 2026-09-21** (conta principal: a sessão aberta no navegador era dela, e Claude não digita senha para trocar de conta). Pela interface: chat em 5,1s, relatório em 7,2s e plano de 7 dias em 9,2s, com 7 treinos válidos pelo `response_schema`. 16 testes em `test_coach_service.py`; `tsc` limpo.

O que a execução mudou em relação ao plano:

- **`gemini-2.0-flash` não existe mais** e `gemini-2.5-flash` responde 404 para chaves novas. O free tier estava congestionado: `3.7-flash`, `3.6-flash`, `3.8-flash` e `flash-latest` deram 503, e `3.5-flash` levou 45s para responder "ok" e depois deu 504. O **`gemini-3.5-flash-lite` respondeu o chat real (7,5 mil tokens de entrada) em 2,7s**. `GEMINI_MODEL` virou uma **lista em ordem de preferência** (`gemini-3.5-flash-lite,gemini-3.5-flash`), e o próximo modelo só entra em 500/503/504 ou timeout.
- **Bug achado: o proxy do Next cortava em 30s** (`proxyTimeout` padrão do rewrite). Com o free tier levando 30–45s, a Duni daria erro sempre. `next.config.mjs` subiu para 240s.
- **Orçamento de tempo total de 200s** para a chamada inteira (somando os modelos), abaixo dos 240s do proxy. Um timeout por modelo deixava a soma estourar o proxy, que foi o que aconteceu no primeiro teste ao vivo. Um timeout do httpx antes virava "Erro 500"; agora vira `llm_timeout`.
- Erros mapeados: `quota_exceeded` (429, sem retry, sem modelo reserva), `invalid_key`, `model_not_found`, `llm_unavailable`, `llm_timeout`, cada um com mensagem própria no front.

Achados para as próximas fases (não corrigidos aqui):

- A resposta do chat supôs "descanso de propósito" e não viu o buraco de dados de 17/08 a 07/09 → **Fase 4** (lacunas).
- O relatório afirmou "no passado houve muita tendência a volumes longos sem polarização" sem nenhum dado de distribuição de intensidade no contexto → **Fases 4 e 6** (fatos calculados e proibição explícita).
- **O card de risco diz "ACWR 4.00 · Risco alto" e "Carga muito alta — priorize recuperação" com TSB +6,7.** O ACWR explode quando a carga crônica é quase zero (uma corrida de 0,7 km depois de 3 semanas paradas). É inconsistência antiga do dashboard, mas a Duni vai ler esse número → tratar na **Fase 4** (ACWR só é confiável com carga crônica mínima).
- O plano gerado ainda é de triathlon (bike e "other"), o esperado até a **Fase 6**. Os 7 treinos ficaram salvos na conta principal (22–28/09).

Texto original da fase:

- **O usuário gera a chave** em aistudio.google.com/apikey (sem cartão) e coloca `GEMINI_API_KEY=` no `Ondilow/.env`. Claude não cria conta nem cola a chave.
- Confirmar o modelo Flash atual do free tier e atualizar `gemini_model` em `config.py` e no `.env.example`.
- `_call_gemini`: um 429 / `RESOURCE_EXHAUSTED` vira `CoachUnavailableError("quota_exceeded")`, com mensagem clara no front. Sem retry.
- Front: o texto de `not_configured` passa a falar só do Gemini.
- Teste real do chat, do relatório e do plano de 7 dias na conta de teste.

**Pronto quando:** as três ações funcionam ao vivo.

## Fase 2 — Dados corretos e derivados — CONCLUÍDA

**Executado em 2026-09-21.** 124 testes na API (35 novos: `test_derived_metrics.py` e 2 de import) e `tsc` limpo. Verificado ao vivo: numa corrida de 36 km, a página mostra cadência **174 ppm** (antes "87 spm"), GAP 5:40/km, deriva −0,0% e a coluna GAP nos splits; uma caminhada aparece como "Caminhada" com 128 ppm; o perfil mostra zonas Karvonen (133/147/162/176) com o título certo.

Como ficou:

- **Cálculos puros** em `metrics/derived.py`: fator de cadência, GAP por Minetti (2002) e deriva de Friel. Aplicados por `services/derived_metrics.py`, a mesma função no import e no backfill.
- **Migrations** `011` (enum: `walk`, `strength`, `pilates`) e `012` (colunas `gap_pace_s_per_km`, `hr_decoupling_pct` e `derived_version` em `activities`; `gap_pace_s_per_km` em `activity_laps`).
- **Backfill** `scripts/backfill_derived.py`: idempotente pela `derived_version`. A cadência e a reclassificação só acontecem na 1ª passada (versão nula), e os pontos são corrigidos com um `UPDATE` SQL por atividade, não um por ponto.
- **Zonas** `resolve_hr_zones()`: salvas > Karvonen > %FCmáx. O perfil no front usa a mesma regra.

O que a execução mudou em relação ao plano:

- **Reclassificação automática, não manual.** Os arquivos originais (`.gz` em `data/uploads`) dizem o esporte. Das 12 atividades `other` da conta principal: **6 caminhadas** e **3 musculação**. O resto (2 `cardio_training` e 1 elíptico) continua `other`, porque o enum não tem tipo para isso. O usuário não precisou editar nada.
- **Caminhada também grava cadência por perna** (54–64), então a correção vale para `walk` além de corrida.
- **A média móvel na altitude entrou por causa de um teste**: ruído simétrico de ±2 m deixava o GAP 9% mais lento, porque a curva de Minetti é convexa. Com média de ±30 m, o erro caiu para menos de 1%.
- **Ensaio na branch `test` achou dois bugs antes da main**:
  1. Uma volta de 2 m em 40 s dava ritmo de 20.174 s/km e estourava `numeric(6,2)`. Agora voltas com menos de 50 m e ritmos acima de 60 min/km são ignorados.
  2. A deriva chegava a −134% em corrida com muita parada. Agora só é calculada com tempo em movimento ≥ 90% do total. Por isso `DERIVED_VERSION = 2`, e a 2ª passada na branch `test` confirmou que **reprocessar não dobra a cadência de novo**.
- **Resultado na main** (igual ao ensaio): 396 cadências dobradas (as duas contas), 556 atividades com GAP e 214 com deriva. A 2ª execução encontrou 0 pendentes. Na conta principal, a cadência média de corrida ficou em **161 ppm** (mediana dos pontos 168), a caminhada em ~119, e a deriva mediana em **2,3%** (75% abaixo de 5%).
- **"Corridas" com 80–128 ppm** são caminhadas registradas como corrida (10–12 min/km, FC baixa). O dado está certo; o rótulo é que está errado. A Fase 4 deve tratar ritmo acima de ~9 min/km como caminhada ao montar a carga.

**Limitação conhecida do GAP** (documentada, não corrigida): em terreno muito íngreme, a inclinação medida a cada 50 m pesa as rampas curtas mais do que uma média por km. No caso mais extremo do histórico (trilha de 5 km, +208/−242 m, ritmo de caminhada), o GAP saiu 9:50/km pela janela de 50 m, contra ~11:00/km numa conta à mão por km. Na corrida mediana a razão GAP/pace é **1,000**, e em todo o histórico fica entre 0,88 e 1,07. Minetti também é conhecido por exagerar o alívio da descida. Por isso a UI sempre chama de "estimativa".

Texto original da fase:

**Objetivo:** dar à Duni números em que ela possa confiar.

- **Cadência**: dobrar na importação quando for corrida e o valor vier por perna (no ponto, na volta e no resumo). Migration de dados para as corridas já salvas, com critério e contagem conferidos antes de rodar, **testada primeiro na branch Neon `test`**. A página da atividade passa a mostrar "ppm" correto.
- **Novos tipos de atividade**: `walk`, `strength` (academia) e `pilates` no enum, via migration. O usuário reclassifica as 12 atividades `other` pelo formulário de edição, que já existe.
- **GAP estimado** por atividade e por volta, calculado a partir de altitude e distância, com uma curva publicada de custo por inclinação. Sempre chamado de "estimado".
- **Deriva cardíaca** (pace:FC da 1ª metade contra a 2ª) nas corridas com FC e mais de 30 minutos.
- **Ritmo por volta** a partir de duração e distância.
- **Zonas de FC** derivadas por Karvonen quando o perfil não tiver zonas salvas.
- Testes unitários de cada cálculo, com casos de subida, descida e terreno plano para o GAP.

**Pronto quando:** a página da atividade mostra a cadência correta e o GAP, e as 3 corridas de referência conferidas à mão batem.

## Fase 3 — Check-in pós-treino — CONCLUÍDA

**Executado em 2026-09-21.** 127 testes na API (6 novos em `test_checkin.py`: gravar, sRPE, local sem dor, apagar, validação e atividade de outro usuário) e `tsc` limpo.

**Verificado ao vivo** numa corrida real de 36 km, só clicando:
- PSE 6, "Pernas pesadas", dor 3 na panturrilha e uma observação, gravados.
- O resumo mostrou carga interna 1225 (6 × 204 min).
- Em "Editar" o formulário voltou preenchido.
- "Apagar check-in" deixou tudo nulo de novo, **sem resíduo** para a Duni ler depois.
- O atalho `#checkin` rola até o painel.
- No celular (375 px) os 11 botões quebram em 2 linhas, sem scroll lateral.

Como ficou:

- **Migration `013`**: `rpe`, `pain_level` (com check de 0–10 no banco), `pain_location`, `feeling`, `checkin_notes` e `checkin_at` em `activities`. As notas têm campo próprio em vez de reusar `description`, porque o formulário de edição da atividade manda `description` vazio e apagaria as notas.
- **`PUT /activities/{id}/checkin`** substitui o check-in inteiro. Tudo nulo apaga e zera `checkin_at`. Sem dor, o local da dor é descartado.
- **sRPE** (Foster) = PSE × minutos em movimento, como property do model (`Activity.srpe`), sem coluna, então nunca fica defasado.
- **Sensação**: lista fechada (`otimo`, `bem`, `normal`, `cansado`, `pernas_pesadas`, `sem_energia`), para a Fase 4 contar sem interpretar texto livre.
- **Interface** (`components/activity/CheckinPanel.tsx`), logo abaixo do resumo da atividade:
  - Escala de PSE com a explicação prática de cada nível (ex.: "5 · Moderado. Ainda conversa, mas em frases curtas").
  - Chips de sensação e de local da dor, e observações.
  - Aviso para procurar fisioterapeuta ou médico com dor ≥ 5.
- **Atalho** "Como foi? →" em cada atividade nova na tela de importação. Não testado ao vivo por exigir importar um arquivo; `tsc` cobre.

**Sono ficou de fora**, como previa o texto da fase ("a decidir"). Sono é do dia, não da atividade, e merece um lugar próprio. A Duni vai declarar sono como indisponível. Se o usuário quiser, entra depois como registro diário.

Dois detalhes de execução:
- **Âncora do atalho**: o `public/landing.css` põe `scroll-behavior: smooth` no `html`, e com a aba em segundo plano a animação nem começa. O scroll usa `behavior: "instant"` explícito.
- **Bug antigo notado, fora do escopo**: o formulário de edição da atividade abre com a descrição vazia e grava `null` ao salvar, apagando uma descrição que exista. Hoje nenhuma atividade tem descrição (vêm do FIT), então é latente.

Texto original da fase:

**Objetivo:** carga interna e sinais subjetivos.

- Migration: colunas em `activities` para `rpe` (0–10), `pain_level` (0–10), `pain_location` (texto curto), `feeling` (ex.: pernas pesadas, bem, cansado) e `notes`.
- **sRPE** = PSE × minutos, calculado.
- **Interface**: formulário curto na página da atividade e um atalho logo depois de importar. Cada nível de PSE tem a explicação ao lado ("3 = leve, dá para conversar"). É **opcional**, e a Duni lida com a falta dele.
- Opcional, a decidir na execução: sono da noite anterior (1–5) informado à mão, **não** simulado.

**Pronto quando:** o check-in é salvo e aparece na atividade.

## Fase 4 — Motor de análise (Python, sem IA) — CONCLUÍDA

**Executado em 2026-09-21.** 163 testes na API (36 novos: 35 em `test_athlete_analysis.py` e 1 de ponta a ponta de `GET /coach/analysis` em `test_checkin.py`).

Como ficou:

- **`ai/athlete_analysis.py`**: a parte pura (`analyze()`, testável sem banco) calcula; `build_analysis()` lê do banco. Roda em 0,5 s na conta principal e gera ~5 mil caracteres de JSON, pequeno para o contexto da Duni.
- O JSON traz:
  - `cobertura_de_dados` (buracos, aviso de silêncio, dados indisponíveis, cobertura de FC e check-in);
  - `janelas` 7/14/28d (corrida, caminhada e complementares separados; dias sem treino; TSS; sRPE; PSE média);
  - `tendencia_semanal` (8 semanas);
  - `distribuicao_intensidade_28d` (Z1–Z2 / Z3 / Z4–Z5 pelos pontos de FC);
  - `carga`;
  - `sinais_de_fadiga` (8 tipos, cada um `isolado` ou `tendencia` e com a evidência em números);
  - `sessoes_equivalentes` (distância ±10% e subida ±10 m/km, com veredito pela eficiência);
  - `cadencia_habitual` por faixa de ritmo;
  - `checkins_28d`.
- **`GET /coach/analysis`** expõe o JSON (a Fase 6 vai usar como contexto).
- **Datas no fuso da atividade** (`America/Sao_Paulo`), não UTC.
- **"Corrida" acima de 9:00/km conta como caminhada**, como anotado na Fase 2. Nos últimos 90 dias foram 4, e a cobertura avisa isso.

**Correções que vieram junto:**

- **ACWR com base mínima**: `ACWR_MIN_CHRONIC_DAILY_LOAD = 10` TSS/dia (média de 28 dias). Abaixo disso o ACWR é `None`. Recalculei o histórico das duas contas: os dias com "ACWR > 1,5" caíram de 239 para 62 na conta principal. O "salto de carga >30%" do `assess_injury_risk` ganhou a mesma trava.
- **Recomendação após pausa**: sem ACWR, o card caía no TSB positivo e diria "Treino Duro — forma em alta" para quem voltou de semanas parado. Com CTL abaixo do mínimo, a recomendação agora é **"Retomada gradual"**. Verificado ao vivo em `/coach` e no dashboard, que antes diziam "Carga muito alta — priorize recuperação" e "ACWR 4.00 · Risco alto".
- **`daily_metrics` parada numa pausa**: só recalculava no import, então a última linha ficava no dia do último import (15/09) e o CTL/ATL não caíam. `build_analysis` completa até hoje antes de ler.

**Conferência à mão** (a conta principal quase sem dados recentes não exercita quase nada, então rodei também "como se hoje fosse" duas datas passadas):

- **Hoje (21/09)**: buracos de 18/08–08/09 (22 dias) e de 10/09 até hoje; aviso "pergunte antes de concluir". Os volumes semanais batem com o SQL da investigação.
- **05/06**:
  - 176 km em 28 dias, longão de 36 km, ACWR 0,98 e nenhum sinal de fadiga.
  - Achado real: **56% do tempo de corrida em Z3**, o padrão "maioria moderada" que o prompt manda evitar.
  - A sessão equivalente do longão: 36 km a 5:40 com FC 146 contra 33 km a 5:28 com FC 156, eficiência +3%.
- **20/08** (volta da pausa de junho–julho): sinal **"ritmo custando mais batimentos" como tendência** (3 corridas de 7 a 9% menos eficientes que a base) e cadência isolada de 154 ppm (habitual 171). Coerente com destreino.
- Dois bugs pegos nessa conferência:
  1. Atividades depois do "hoje" vazavam para a análise de data passada.
  2. A mensagem "sem FC" aparecia em corrida com FC, quando o motivo real era corrida curta demais para medir eficiência.

**Para as próximas fases**: as zonas de intensidade usam Karvonen (FC de repouso 48, máxima 190). Se a FC máxima do perfil não for medida de verdade, a distribuição Z1–Z2/Z3 muda bastante. Vale a Duni perguntar isso ao usuário.

Texto original da fase:

**Objetivo:** calcular os fatos que o prompt pede. A Duni só interpreta.

Um módulo `ondilow_api/ai/athlete_analysis.py` que devolve um JSON com:

- **Janelas de 7, 14 e 28 dias e tendência de 6–8 semanas**: km, tempo, número de sessões, longão, distribuição de intensidade por zona de FC, sRPE total e carga complementar (bike, academia, Pilates, caminhada).
- **Sinais de fadiga**, cada um marcado como `isolado` ou `tendência`: FC mais alta em ritmo fácil do que a linha de base, eficiência (ritmo por FC) caindo, deriva cardíaca anormal, cadência fora do habitual, PSE subindo em treinos fáceis, salto brusco de carga e soma de corrida com complementares.
- **Sessões equivalentes**: pares de treinos parecidos (distância ±10%, elevação parecida) com a comparação de ritmo, FC e GAP, como no exemplo da seção 16.
- **Cadência habitual por faixa de ritmo** (seção 9).
- **Lacunas**: até que data há dados, buracos acima de 7 dias e quais campos estão ausentes.
- Testes com séries montadas (fadiga real, sinal isolado, dado faltando).

**Pronto quando:** o JSON da conta de teste é revisado à mão e bate com os números das páginas do app.

## Fase 5 — Memória e objetivos — CONCLUÍDA (teste ao vivo pendente)

**Executado em 2026-09-21.** 170 testes na API, todos verdes (novos em `test_memories.py`). O aviso do ponto 6 (memórias vão para o Google no free tier) foi dado ao usuário antes de começar.

Como ficou:

- **Migration `014_athlete_memories`**, com CHECK em `kind` e `source` e índice `(user_id, active)`. Já aplicada na `main`.
- **CRUD** `GET/POST /coach/memories` e `PATCH/DELETE /coach/memories/{id}`. O GET esconde as arquivadas (`active=false`), a menos que se passe `?include_archived=true`.
- **Chat com saída estruturada** (`ChatReply`): `{reply, memory_suggestions[]}`, no máximo 3 sugestões. `clean_memory_suggestions` descarta as vazias, as repetidas (entre si ou com o que já está salvo) e as datas inválidas. Resposta fora do formato vira `502 invalid_response`.
- **Contexto** ganha `memorias` (datas futuras vêm com "faltam N dias", porque a IA erra conta de calendário) e `objetivo_cadastrado`. O prompt do plano manda respeitar a disponibilidade, as lesões e as provas, e diz o que fazer sem objetivo.
- **Front**: painel `components/coach/MemoryPanel.tsx` ("O que a Duni sabe de você") e sugestões com botão de confirmar embaixo da resposta da Duni.

**Pendente, adiado para a Fase 9 a pedido do usuário**: verificação ao vivo no navegador (painel, confirmar uma sugestão do chat, arquivar e apagar). A sessão caiu nesse passo por erros 500/529 da API da Anthropic, sem relação com o código.

De carona: `test_analysis_endpoint_reads_checkin` (Fase 4) falhava entre 21h e meia-noite de Brasília, porque criava a atividade ao meio-dia UTC de "hoje UTC", que já é amanhã em São Paulo. Agora usa "uma hora atrás".

Texto original da fase:

> **Antes de começar:** confirmar com o usuário o ponto 6 da investigação (dados de lesão e dor vão para o Google no free tier).

- Migration: tabela `athlete_memories` com `kind` (`objetivo` | `prova` | `lesao` | `disponibilidade` | `preferencia` | `outro`), `content`, `event_date`, `active` e `source` (`manual` | `duni`).
- CRUD em `/coach/memories` e o painel "O que a Duni sabe de você" em `/coach`.
- **A Duni sugere, o atleta confirma**: o chat devolve `{reply, memory_suggestions[]}`, e nada é salvo sem um clique.
- O **objetivo** é o que o prompt chama de "objetivo informado". Sem objetivo cadastrado, a Duni pergunta antes de montar a semana. A prova é uma memória com data, sem a periodização completa por prova-alvo, que foi descartada em 2026-09-15.

## Fase 6 — Persona da Duni — CONCLUÍDA (conversa ao vivo pendente)

**Executado em 2026-09-21.** 175 testes na API (5 novos em `test_coach_context.py`).

Como ficou:

- **`SYSTEM_PROMPT` v2** (`coach_prompt_version` = `v2` no `config.py` e no `.env.example`): a Duni, treinadora de corrida de rua, no feminino. Tom direto e exigente, segurança acima da cobrança, termos técnicos explicados na prática. Traz as regras do Anexo A com os ajustes aceitos: o código calcula e ela interpreta, sono/HRV/Readiness/terreno declarados indisponíveis, foco em corrida com o resto como carga complementar, sem regra de 10% nem de 180 ppm, e o formato longo fica para o plano (Fase 7).
- **Contexto novo** (`build_context`), com ~5,9 mil caracteres na conta principal e 0,8 s:
  - `analise`: o JSON inteiro da Fase 4;
  - `memorias` e `objetivo_cadastrado`;
  - `aderencia_4_semanas`: planejados, feitos, pulados, % feito e os pulados com data. Roda `reconcile_plan` antes;
  - atividades dos últimos 14 dias (até 15), com data no fuso da atividade, ritmo, GAP, cadência, deriva, subida e check-in;
  - recordes atuais e previsões formatados (`1:50:45`);
  - `recomendacao_do_app`, para ela explicar se discordar do card do dashboard.
- **Saiu do contexto**: `daily_metrics_last_30`, `risk`, FTP e CSS (resquícios de triathlon).
- **Relatório** ("Gerar relatório") virou resumo da semana na ordem das seções 4 e 17: status, semana anterior, avaliação, aderência, próxima semana e dados que faltam.
- **Plano**: foco em corrida e dia de descanso **sem item**. Se o descanso fosse um treino, o `reconcile_plan` o marcaria como "pulado" e estragaria a aderência.
- **Interface**: sidebar "Duni · treinadora", card "Duni · sua treinadora", `/coach` com "Duni, sua treinadora", passos do "analisando" e sugestões de pergunta atualizados, e textos do perfil e da semana. Conferido no navegador sem chamar o Gemini.

**Bug corrigido de carona**: o contexto antigo mandava todo o histórico de recordes (a tabela guarda cada recorde batido) e as previsões usavam um recorde qualquer de cada distância. Agora vai o mais recente de cada tipo, a mesma regra de `routers/predictions.py`.

**Pendente para a Fase 9**: conversar com a Duni ao vivo, gerar o resumo e o plano com o prompt v2. As mensagens antigas do chat continuam no histórico com a persona v1 (triathlon).

Texto original da fase:

- Nome e gênero na interface ("Duni, sua treinadora") na página `/coach`, no `CoachCard`, na sidebar e nos textos. Rotas e API não mudam.
- **Novo `SYSTEM_PROMPT` baseado no Anexo A**, com os ajustes da seção de discordâncias. Tom direto e exigente, linguagem simples, e segurança acima da cobrança. `coach_prompt_version` = `v2`.
- **Aderência** no contexto (planejados, feitos e pulados em 4 semanas), para ela cobrar com dado real.
- O contexto passa a ser o JSON da Fase 4, as memórias e as atividades recentes.

## Fase 7 — Plano da semana — CONCLUÍDA (geração ao vivo pendente)

**Executado em 2026-09-21/22.** 185 testes na API (15 novos em `test_weekly_plan.py`; os 4 do validador antigo saíram de `test_coach_service.py`).

Como ficou:

- **Migration `015_weekly_plans`**, já aplicada na `main`:
  - tabela `weekly_plans` com `status` (verde/amarelo/laranja/vermelho, com CHECK), `status_reason`, `report` (JSONB), `model_used` e `prompt_version`;
  - em `planned_workouts`, as colunas `weekly_plan_id`, `objective` (finalidade fisiológica), `reason` (por que nesta semana), `steps` e `targets` (JSONB).
- **Saída estruturada** (`WeeklyPlanLLM`): status + justificativa, resumo, avaliação (positivos, fadiga, riscos, evolução), próxima semana, treinos com todos os campos da seção 6 (passos de aquecimento/principal/desaquecimento; ritmo, GAP, zona, PSE, cadência, terreno, métrica prioritária) e critérios de ajuste. Os campos não têm valor padrão, porque o schema vai para o Gemini. Conferi que o SDK 2.23 converte o schema.
- **A carga da semana anterior é calculada pelo código** (`previous_week_load`, a partir da janela de 7 dias da análise), não pelo modelo.
- **A semana** são os 7 dias a partir de amanhã. O prompt recebe cada dia com o nome ("quarta 2026-09-23") por causa das memórias de disponibilidade.
- **Validação no código** (`validate_weekly_plan`): descarta treino com data inválida, fora da semana ou repetida. Recusa o plano inteiro (502, nada salvo, motivo mostrado na tela) quando falta dia de descanso, há treino forte com status vermelho ou falta objetivo ou motivo em algum treino. O "1–2 dias de descanso" virou **no mínimo 1**: quem treina 3 vezes por semana tem 4 dias sem treino, e isso não é erro.
- **Endpoints**:
  - `POST /coach/plan/generate` (sem parâmetro de dias; devolve `{plan, workouts}`);
  - `GET /coach/plan/week`: o plano que ainda não terminou;
  - `POST /coach/plan/{id}/regenerate` com o motivo. A Duni devolve um treino novo para o mesmo dia (a data vinda do modelo é ignorada) ou decide por descanso e apaga o treino;
  - `POST /coach/plan/{id}/move` com `on_conflict` = `error` (409 com o treino em conflito), `swap` (troca os dois de dia) ou `keep_both`.
  - Só dá para editar treino `planned` de hoje em diante.
- **Interface** (`components/coach/WeeklyPlanPanel.tsx`, em `/coach`), na ordem da seção 18:
  - status da Duni e justificativa, resumo, semana anterior, avaliação e próxima semana;
  - a tabela `Dia | Treino | Distância | Ritmo/GAP | FC | PSE | Cadência | Objetivo`, com os dias de descanso;
  - um card expansível por treino, com "Pedir outro treino" e "Mudar de dia";
  - os critérios de ajuste e a direção das 4 semanas seguintes (recolhida).
- **Dashboard**: o card de prontidão ganhou "Status da Duni · data" e uma nota quando os dois divergem. A régua: prontidão ≥60/40–59/<40 contra verde/amarelo, laranja e vermelho. Assim 75% com laranja avisa, e 75% com amarelo ou 30% com laranja não.
- O botão "Gerar plano (7 dias)" virou "Gerar plano da semana". Não havia seletor de 7/14/28 dias para trocar.

**Verificado no navegador sem gastar cota**: inseri um plano `[TESTE]` na conta principal, conferi resumo, tabela, card aberto, o aviso de conflito ao mover e o status no dashboard, e apaguei o plano de teste (3 treinos e 1 plano; nada com `[TESTE]` sobrou). Para isso encerrei o servidor de dev da sessão anterior, que rodava sem `--reload` e não tinha as rotas novas.

**De carona**: o teste de check-in da Fase 4 falhava perto da meia-noite nos dois sentidos. Agora cria a atividade ao meio-dia de hoje no horário de São Paulo.

**Pendente para a Fase 9**:
- gerar um plano de verdade com o Gemini (o schema é grande para o `flash-lite`; se ele errar o formato com frequência, simplificar);
- regerar um dia ao vivo.
- Os 7 treinos da v1 (22–28/09) continuam na conta principal e somem quando o primeiro plano novo for gerado. O aviso de conflito do teste pegou um deles.

Texto original da fase:

- **Saída estruturada** num único JSON: `status` (🟢🟡🟠🔴 + justificativa com dados), `carga_semana_anterior`, `avaliacao` (pontos positivos, fadiga, riscos, evolução), `proxima_semana` (km, sessões, estímulo, objetivo), `treinos[]` com todos os campos da seção 6 (aquecimento, bloco principal e desaquecimento como passos; ritmo, GAP, zona, PSE, cadência, recuperação, terreno, qual métrica priorizar) e `criterios_ajuste` (manter, reduzir, acelerar, interromper).
- Migrations: `steps` e os campos novos em `planned_workouts`, e uma tabela `weekly_plans` para o status e o relatório.
- **Validação no código**: 1–2 dias de descanso por semana, datas dentro da semana, sem treino intenso quando o status é 🔴, e um motivo para cada treino.
- **Interface** na ordem da seção 18: resumo, tabela, cards de cada treino (expansíveis) e critérios de ajuste.
- **Regerar um dia** com motivo ("panturrilha dura") e **mover um treino** (avisa se houver conflito de data).
- Visão opcional das 4 semanas seguintes só em volume e foco.

## Fase 8 — Análise pós-treino

- `POST/GET /coach/activities/{id}/analyze`, salvo em `coach_interactions` com `activity_id` (migration). Sob demanda, **nunca no import** (import em lote queimaria a cota).
- O contexto junta a atividade, as voltas com ritmo e GAP, a deriva, o check-in, o treino planejado do dia (planejado contra feito) e as sessões equivalentes.
- Bloco "Comentário da Duni" em `/activities/[id]`. De carona, fazer a verificação ao vivo dessa página, pendente desde o plano de 18/09.

## Fase 9 — Fechamento

- Verificação ao vivo de tudo junto na conta de teste, **incluindo as memórias da Fase 5, a conversa com o prompt v2 da Fase 6 e gerar/regerar o plano da Fase 7** (adiadas de lá).
- Atualizar `ESTADO_DO_PROJETO.md` e `BACKLOG.md`, e fechar este documento.

---

## Fora do escopo

- Streaming, várias conversas e a Duni em outras páginas.
- Sono, HRV e Readiness automáticos (dependem do Garmin, que está bloqueado).
- Análise automática no import.
- Periodização completa por prova-alvo.
- Provedores pagos.

---

## Anexo A — Prompt do usuário (especificação da Duni), recebido em 2026-09-21

Resumo fiel das 18 seções, para referência na execução. Os ajustes estão na seção "Onde eu discordo do prompt".

1. **Análise obrigatória do histórico** antes de prescrever: todas as atividades (data, tipo, distância, duração, ritmo, splits, GAP, FC média e máxima, cadência, elevação, terreno, atividades complementares, PSE, sensação, dor, sono, HRV, Readiness, carga, recuperação). Comparar 7, 14 e 28 dias e a tendência de 6–8 semanas, para ver como o atleta **responde** ao treino.
2. **Carga**: combinar carga interna (FC, PSE, sRPE, fadiga) e externa (distância, duração, ritmo, GAP, elevação, sessões). Nunca uma métrica isolada. Sem regra fixa de % de aumento.
3. **Fadiga**: ritmo mais lento com a mesma FC, FC alta em ritmo fácil, PSE subindo, queda de desempenho, deriva cardíaca, cadência incomum, pernas pesadas, sono, HRV, Readiness, dor, salto de carga, acúmulo com complementares. Não diagnosticar; dor persistente → avaliação profissional.
4. **Status**: 🟢 recuperado, 🟡 atenção, 🟠 fadiga acumulada, 🔴 recuperação prioritária. Explicar os dados que levaram ao status, sem usá-lo como diagnóstico.
5. **Decisão da semana** só depois da análise: volume, sessões, distribuição, longão, limiar, intervalados, fácil, descanso, complementar. Cada sessão com finalidade fisiológica. Não pôr intensidade só porque há prova.
6. **Estrutura do treino**: data, tipo, objetivo, distância, duração, aquecimento, bloco principal, desaquecimento, ritmo, GAP, zona de FC, PSE, cadência, recuperação entre intervalos, terreno e observações. Dizer qual métrica prioriza quando houver conflito.
7. **Ritmo, FC e PSE combinados.** Fácil → esforço e percepção. Qualidade → ritmo/GAP + FC + PSE. Longão → controle fisiológico. Na subida, não cobrar o pace absoluto.
8. **GAP** em terreno ondulado: não forçar o ritmo na subida nem acelerar na descida para compensar. Manter o estímulo, não o pace.
9. **Cadência**: não usar 180 como regra. Partir da cadência habitual por ritmo, mudar só com justificativa e sem mudanças bruscas.
10. **Descanso**: 1–2 dias por semana, total ou ativo muito leve. Uma atividade com carga relevante não conta como descanso.
11. **Autorregulação**: FC alta + PSE alta + ritmo baixo → aliviar. Dor aumentando → parar ou modificar. Sono ruim isolado com desempenho normal → manter. Sono + HRV + PSE + desempenho piorando juntos → reduzir. Diferenciar sinal isolado de tendência.
12. **Semana regenerativa**: reduzir primeiro a intensidade, depois o volume e depois a densidade. Não aplicar automaticamente só porque a semana foi pesada.
13. **Distribuição de intensidade**: evitar a maioria dos treinos em intensidade moderada.
14. **Progressão** por volume, longão, especificidade, qualidade e controle de ritmo. Não subir volume, intensidade e densidade juntos. Recuperação após carga alta.
15. **Longão** com objetivo claro (aeróbico, muscular, específico, progressivo, regenerativo, simulação), com distância, duração, ritmo/GAP, FC, PSE, hidratação e carboidrato. Sem quilometragem gratuita.
16. **Desempenho**: comparar sessões equivalentes ("10 km a X com FC Y antes, agora Z com FC W") e dizer se há melhora, estabilidade, regressão, eficiência ou custo maior.
17. **Resumo da semana**: status, carga da semana anterior (km, tempo, treinos, longão, intensidade, complementar), avaliação (positivos, fadiga, riscos, evolução) e próxima semana (km, sessões, estímulo, objetivo).
18. **Formato**: resumo → tabela `| Dia | Treino | Distância | Ritmo/GAP | FC | PSE | Cadência | Objetivo |` → explicação de cada treino → "CRITÉRIOS PARA AJUSTAR O TREINO" (manter, reduzir, acelerar, interromper). Nunca inventar dados e declarar o que falta. **Linguagem direta, prática e acessível**: explicar PSE e GAP na prática (ex.: "PSE 3/10 = leve, dá para conversar sem perder o fôlego").
