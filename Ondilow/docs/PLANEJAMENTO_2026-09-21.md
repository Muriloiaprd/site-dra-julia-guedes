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

## Fase 1 — Duni acordada (Gemini funcionando)

- **O usuário gera a chave** em aistudio.google.com/apikey (sem cartão) e coloca `GEMINI_API_KEY=` no `Ondilow/.env`. Claude não cria conta nem cola a chave.
- Confirmar o modelo Flash atual do free tier e atualizar `gemini_model` em `config.py` e no `.env.example`.
- `_call_gemini`: um 429 / `RESOURCE_EXHAUSTED` vira `CoachUnavailableError("quota_exceeded")`, com mensagem clara no front. Sem retry.
- Front: o texto de `not_configured` passa a falar só do Gemini.
- Teste real do chat, do relatório e do plano de 7 dias na conta de teste.

**Pronto quando:** as três ações funcionam ao vivo.

## Fase 2 — Dados corretos e derivados

**Objetivo:** dar à Duni números em que ela possa confiar.

- **Cadência**: dobrar na importação quando for corrida e o valor vier por perna (no ponto, na volta e no resumo). Migration de dados para as corridas já salvas, com critério e contagem conferidos antes de rodar, **testada primeiro na branch Neon `test`**. A página da atividade passa a mostrar "ppm" correto.
- **Novos tipos de atividade**: `walk`, `strength` (academia) e `pilates` no enum, via migration. O usuário reclassifica as 12 atividades `other` pelo formulário de edição, que já existe.
- **GAP estimado** por atividade e por volta, calculado a partir de altitude e distância, com uma curva publicada de custo por inclinação. Sempre chamado de "estimado".
- **Deriva cardíaca** (pace:FC da 1ª metade contra a 2ª) nas corridas com FC e mais de 30 minutos.
- **Ritmo por volta** a partir de duração e distância.
- **Zonas de FC** derivadas por Karvonen quando o perfil não tiver zonas salvas.
- Testes unitários de cada cálculo, com casos de subida, descida e terreno plano para o GAP.

**Pronto quando:** a página da atividade mostra a cadência correta e o GAP, e as 3 corridas de referência conferidas à mão batem.

## Fase 3 — Check-in pós-treino

**Objetivo:** carga interna e sinais subjetivos.

- Migration: colunas em `activities` para `rpe` (0–10), `pain_level` (0–10), `pain_location` (texto curto), `feeling` (ex.: pernas pesadas, bem, cansado) e `notes`.
- **sRPE** = PSE × minutos, calculado.
- **Interface**: formulário curto na página da atividade e um atalho logo depois de importar. Cada nível de PSE tem a explicação ao lado ("3 = leve, dá para conversar"). É **opcional**, e a Duni lida com a falta dele.
- Opcional, a decidir na execução: sono da noite anterior (1–5) informado à mão, **não** simulado.

**Pronto quando:** o check-in é salvo e aparece na atividade.

## Fase 4 — Motor de análise (Python, sem IA)

**Objetivo:** calcular os fatos que o prompt pede. A Duni só interpreta.

Um módulo `ondilow_api/ai/athlete_analysis.py` que devolve um JSON com:

- **Janelas de 7, 14 e 28 dias e tendência de 6–8 semanas**: km, tempo, número de sessões, longão, distribuição de intensidade por zona de FC, sRPE total e carga complementar (bike, academia, Pilates, caminhada).
- **Sinais de fadiga**, cada um marcado como `isolado` ou `tendência`: FC mais alta em ritmo fácil do que a linha de base, eficiência (ritmo por FC) caindo, deriva cardíaca anormal, cadência fora do habitual, PSE subindo em treinos fáceis, salto brusco de carga e soma de corrida com complementares.
- **Sessões equivalentes**: pares de treinos parecidos (distância ±10%, elevação parecida) com a comparação de ritmo, FC e GAP, como no exemplo da seção 16.
- **Cadência habitual por faixa de ritmo** (seção 9).
- **Lacunas**: até que data há dados, buracos acima de 7 dias e quais campos estão ausentes.
- Testes com séries montadas (fadiga real, sinal isolado, dado faltando).

**Pronto quando:** o JSON da conta de teste é revisado à mão e bate com os números das páginas do app.

## Fase 5 — Memória e objetivos

> **Antes de começar:** confirmar com o usuário o ponto 6 da investigação (dados de lesão e dor vão para o Google no free tier).

- Migration: tabela `athlete_memories` com `kind` (`objetivo` | `prova` | `lesao` | `disponibilidade` | `preferencia` | `outro`), `content`, `event_date`, `active` e `source` (`manual` | `duni`).
- CRUD em `/coach/memories` e o painel "O que a Duni sabe de você" em `/coach`.
- **A Duni sugere, o atleta confirma**: o chat devolve `{reply, memory_suggestions[]}`, e nada é salvo sem um clique.
- O **objetivo** é o que o prompt chama de "objetivo informado". Sem objetivo cadastrado, a Duni pergunta antes de montar a semana. A prova é uma memória com data, sem a periodização completa por prova-alvo, que foi descartada em 2026-09-15.

## Fase 6 — Persona da Duni

- Nome e gênero na interface ("Duni, sua treinadora") na página `/coach`, no `CoachCard`, na sidebar e nos textos. Rotas e API não mudam.
- **Novo `SYSTEM_PROMPT` baseado no Anexo A**, com os ajustes da seção de discordâncias. Tom direto e exigente, linguagem simples, e segurança acima da cobrança. `coach_prompt_version` = `v2`.
- **Aderência** no contexto (planejados, feitos e pulados em 4 semanas), para ela cobrar com dado real.
- O contexto passa a ser o JSON da Fase 4, as memórias e as atividades recentes.

## Fase 7 — Plano da semana

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

- Verificação ao vivo de tudo junto na conta de teste.
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
