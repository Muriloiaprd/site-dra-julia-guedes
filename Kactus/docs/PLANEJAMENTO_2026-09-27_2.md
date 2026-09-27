# Kactus — Planejamento: nome, Duni mais simples, dados do Garmin, Carga e equipamentos (2026-09-27, _2)

**Criado em**: 2026-09-27
**Status**: ABERTO. Fases 0 a 4 concluídas (ver "Registro de execução" no fim).
**Relacionados**: [`BACKLOG.md`](./BACKLOG.md) · [`ESTADO_DO_PROJETO.md`](./ESTADO_DO_PROJETO.md) · [`PLANEJAMENTO_2026-09-27.md`](./PLANEJAMENTO_2026-09-27.md)

## Como retomar
1. Ler este documento inteiro e o "Registro de execução".
2. Conferir no código se algo mudou desde a data acima.
3. Seguir pela próxima fase pendente (o usuário aprovou o plano inteiro em 2026-09-27).

Segundo plano do dia (o primeiro é [`PLANEJAMENTO_2026-09-27.md`](./PLANEJAMENTO_2026-09-27.md), fechado). Cada fase termina em commit, `git push` (origin) e sincronização do espelho `kactus` via commit-ponte.

## Contexto
O usuário pediu seis coisas depois de fechar o plano anterior de hoje:
1. O que falta no backlog (respondido no chat, sem fase).
2. Uma varredura do nome antigo "Ondilow" no site (ele viu na aba da Duni).
3. Textos da Duni mais curtos, claros e fáceis de ler.
4. Conferir se o arquivo exportado do Garmin traz tudo o que o Garmin Connect mostra.
5. Tornar a aba Carga útil.
6. Recomendar os melhores equipamentos por esporte.
7. Ideias de melhoria na última fase.

Decisões do usuário (AskUserQuestion):
- **Resumo antigo:** apagar.
- **Duni:** textos curtos + detalhes recolhidos.
- **Equipamentos:** catálogo pesquisado e personalizado pelo uso.
- **Carga:** refazer em linguagem simples, com modo avançado recolhido.

## O que a investigação mostrou

**Backlog** (`docs/BACKLOG.md`): o que sobra aberto é pouco e está parado de propósito.
- **Item 14:** perfil incompleto. Falta trocar senha, excluir conta e exportar dados. Unidades km/mi foram descartadas.
- **Item 16:** acessibilidade. Falta o contraste AA nos rótulos pequenos e a navegação por teclado nos gráficos.
- **Item 17:** sync do Garmin. O script está pronto, mas o login está bloqueado por limite de IP.
- **Itens 12 e 13:** PWA e deploy, descartados ou adiados pelo usuário.

**"Ondilow":**
- **Código:** o código do site está limpo. Só restam referências de propósito: a migração do `ondilow_token` e o `resolve_upload_path`.
- **Resumo antigo:** o que aparece na aba é **um resumo antigo salvo no banco**.
  - É o `coach_interactions` `99c89454-711a-445b-9b5b-ffed8cb7e8cb`, de 21/09, da conta principal, com `kind=analysis`.
  - Começa com "treinador virtual do Ondilow" e fala de triathlon (persona v1).
  - O `GET /coach/analyze` devolve esse texto como "último resumo".
- **Outras ocorrências no banco:** só `activities.file_path`, com 596 caminhos internos em `...\Ondilow\...`. Não aparecem na tela.
- **Nome do banco e do role no Neon:** continuam `ondilow` de propósito (memória do rebrand), então não mexer.
- **Equipamentos:** a página tem textos sem acento: "Tenis", "Relogio", "Distancia inicial".

**Duni** (`app/coach/page.tsx`, `components/coach/WeeklyPlanPanel.tsx`, `ai/coach_service.py`):
- **Página:** empilha muita coisa, nesta ordem:
  - hero;
  - 4 cartões com siglas (TSB, ACWR);
  - o resumo em markdown;
  - o plano da semana, que tem:
    - resumo, status e semana anterior;
    - 4 listas de avaliação e a próxima semana;
    - uma **tabela de 8 colunas** e os **mesmos treinos de novo em cartões**;
    - 4 listas de critérios e as 4 semanas seguintes;
  - o chat;
  - um painel "Plano ativo" (duplicado);
  - as memórias.
- **Resumos gerados:** o resumo v3 tem ~2.000 a 2.700 caracteres em 6 seções. O antigo tem 3.778.
- **Resumo (`generate_analysis`):** hoje é markdown livre. O plano (`WeeklyPlanLLM`) é estruturado, mas não tem limite de tamanho nos campos.
- **Aprendizado de 2026-09-23:** o `flash-lite` segue regras que estão no `SYSTEM_PROMPT` e na `Field(description=...)`, e ignora regra que vem só no fim da mensagem.

**Arquivo do Garmin** (conferido no `8d321baf20356c00.fit`, que é a corrida do print: 5,01 km, 27:59):
- **Formato:** é FIT de um único relógio (`garmin`, produto 4432). Os 422 `.gz` também são FIT desse relógio.
- **Presença dos campos numa amostra de 43 arquivos:** dinâmica de corrida em 41, efeito de treino em 43, temperatura em 43, autoavaliação em 41, suor em 43, FC de recuperação em 14.

| Dado do print | No arquivo? | Onde | Kactus hoje |
|---|---|---|---|
| Distância, FC média/máx, potência média/máx, calorias totais, subida/descida | sim | session | lê |
| Tempo (27:59) / transcorrido (29:12) | sim | `total_timer_time` / `total_elapsed_time` | lê |
| Tempo em movimento (27:54) | **não** | — | calculado pelo Kactus (Fase 2 do plano anterior) |
| Melhor ritmo (4:31) | sim | `enhanced_max_speed` | **não** (a coluna `max_speed_kmh` existe e está vazia) |
| Potência normalizada | sim | `normalized_power` | **não** (a coluna existe e está vazia) |
| Elevação mín/máx (173/184) | sim | lap + altitude dos pontos | **não** (as colunas existem e estão vazias) |
| Temperatura média/mín/máx (28,6/27/31) | sim | session + campo 150 + pontos | **não** (`avg_temperature_c` está vazio) |
| Efeito aeróbico 3,9 / anaeróbico 0,0 | sim | `total_training_effect` / `total_anaerobic_training_effect` | **não** |
| Principal benefício (VO2 Max) | sim | campo 188 (valor 5) | **não**; o mapa de códigos precisa ser confirmado |
| Calorias em repouso (40) / ativas (343) | sim | campo 196 (ativas = total − repouso) | **não** |
| Perda de suor estimada (466 ml) | sim | campo 178 | **não** |
| FC de recuperação (37 bpm) | às vezes | campo 202 | **não** |
| Cadência, passada, oscilação, proporção vertical, contato com o solo | sim | session e **por ponto** | só a cadência |
| Autoavaliação (Muito fraco, 10/10) | sim | campos 192 (sensação 0–100) e 193 (esforço 0–100) | **não** |
| Minutos de intensidade (1/26/53) | **não** | — | dá para estimar pelas zonas de FC |
| Corrida × caminhada (27:50 / 0:09) | **não** | — | dá para estimar pela cadência e pela velocidade |
| Body Battery (−8), "dados sobre o vento" | **não identificado** | — | fica de fora |

- **Limitação do `fitparse`:** ele não conhece os campos mais novos, que aparecem como `unknown_N`. A leitura tem que ser por número do campo (`field.def_num`).

**Carga** (`app/metrics/page.tsx`):
- **Linguagem:** a página é toda técnica: CTL, ATL, TSB, ACWR, TSS, "Coggan".
- **Falta um "e daí":** nada diz o que fazer hoje, nem quanto dá para correr com segurança.
- **Siglas no dashboard:** o `components/dashboard/AthleteStatus.tsx` também mostra TSB e ACWR crus.
- **Dados já prontos:**
  - `athlete_analysis.build_analysis` já calcula volume em janelas de 7, 14 e 28 dias, tendência de 8 semanas e intensidade leve, moderada e forte em 28 dias.
  - `predictions.training_recommendation` já dá uma recomendação.

**Equipamentos** (`app/equipment/page.tsx`, `routers/equipment.py`):
- **O que já existe:** tipos tênis, bicicleta, roupa de nado, wetsuit, relógio e outro. O km real vem das atividades.
- **Conta principal:** 275 corridas (2.193 km), 14 pedais, 6 caminhadas e 3 treinos de força. O único equipamento cadastrado é um Nike Vaporfly 3.

---

## Fases

### Fase 0: Documento
Criar `Kactus/docs/PLANEJAMENTO_2026-09-27_2.md` com este plano. Commit, push e espelho.

### Fase 1: Varredura do nome "Ondilow"
- **Resumo antigo:** apagar o `coach_interactions` `99c89454-…` (decisão do usuário). Antes, confirmar por SELECT que é o único com "ondilow" no `content`.
- **Caminhos internos:** `UPDATE activities SET file_path = replace(file_path, '\Ondilow\', '\Kactus\')`.
  - Afeta 596 linhas. Rodar antes com contagem e mostrar antes e depois.
  - O `services/uploads.resolve_upload_path` continua cobrindo os dois casos.
- **Varredura do banco:** reusar o script de busca em toda coluna de texto, JSON e array, esperando 0 ocorrências.
- **Varredura do site no navegador,** nas duas contas (JWT em `kactus_token`):
  - Páginas: landing, login, dashboard, atividades, detalhe, Duni, carga, previsões, equipamentos, importar e perfil.
  - Em cada uma: buscar "ondilow" no `document.title`, no `innerText`, em `alt`/`aria-label` e no `manifest`.
- **Equipamentos:** acentuar "Tênis", "Relógio" e "Distância inicial".

### Fase 2: Duni com textos curtos e detalhes recolhidos
**API** (`ai/coach_service.py`, `settings.coach_prompt_version` → `v4`):
- **`SYSTEM_PROMPT`:** ganha uma seção **ESCRITA**, com estas regras:
  - frases curtas;
  - no máximo 3 itens por lista;
  - só os números que mudam a decisão;
  - sem siglas cruas: TSB → "disposição", ACWR → "salto de carga", sRPE/CTL/VDOT → explicar ou não usar;
  - chat com ~100 palavras, a não ser que o atleta peça detalhe.
- **Resumo em JSON:** o resumo vira saída estruturada `AnalysisLLM`, com estes campos:
  - `status`;
  - `status_frase` (1 frase);
  - `semana` (1 frase com km, tempo e treinos);
  - `pontos` (até 3 itens `{tipo: bom|atencao|risco, texto}`);
  - `acoes` (até 3);
  - `pergunta` (opcional, ex.: objetivo ou atividade que faltou importar).
- **Limites no schema:** os limites vão na `Field(description=...)`.
- **Resumo salvo:** fica em `content` como JSON.
  - `GET/POST /coach/analyze` passam a devolver `summary` (objeto).
  - Um resumo antigo em markdown continua indo em `report`, que é o fallback.
- **`WeeklyPlanLLM`:** ganha limites por `Field(description=...)`:
  - `resumo` com até 2 frases;
  - `status_justificativa` com 1 frase;
  - listas com até 2 itens curtos;
  - `objetivo`, `motivo` e `observacoes` com 1 frase cada.
- **Comentário pós-treino** (`_ACTIVITY_INSTRUCTION`): até ~120 palavras, em 3 blocos: "Como foi", "O que chamou atenção" e "Próximo passo".

**Web:**
- **`/coach`:**
  - O hero fica com 1 frase.
  - Os 4 cartões usam linguagem simples: "Descansado / cansaço alto", com a sigla só no `title`.
  - O resumo vira um cartão com:
    - o selo de status e a frase;
    - até 3 pontos com ícone;
    - a lista "O que fazer";
    - a pergunta com o botão "Responder no chat", que preenche o input.
  - Um resumo antigo continua renderizado por `<Markdown>`.
- **Painel "Plano ativo":** sai (era duplicado) e o chat fica com a largura toda.
  - Ordem final: resumo → plano da semana → conversa → memórias.
- **`WeeklyPlanPanel`:**
  - **Topo:** status + resumo + **próximo treino em destaque** + **lista dos 7 dias** (1 linha por dia: dia, título, volume, intensidade). Essa lista substitui a tabela de 8 colunas e os cartões repetidos.
  - **Cada dia:** abre os passos, os alvos e as ações "Pedir outro treino" e "Mudar de dia".
  - **"Ver análise completa":** recolhido, com avaliação, semana anterior, "Quando mudar o treino" (os critérios) e as 4 semanas seguintes.
- **Tipos:** `lib/api.ts` ganha o tipo `CoachSummary`.

**Testes:** adaptar `tests/test_coach_service.py` e `test_coach_context.py`:
- o resumo estruturado é salvo e devolvido;
- o fallback do markdown antigo funciona;
- os limites do schema estão presentes.

### Fase 3: Dados completos do Garmin
- **Parser** (`parsers/fit.py`): um helper `_by_num(msg, n)` lê os campos por `def_num`.
  - **Da session:**
    - melhor ritmo (`enhanced_max_speed`) e potência normalizada;
    - temperatura média, máxima e mínima (campo 150);
    - efeito aeróbico e anaeróbico, e principal benefício (campo 188);
    - calorias em repouso (196), suor estimado (178) e FC de recuperação (202);
    - dinâmica: oscilação vertical, tempo de contato, proporção vertical, comprimento da passada e passadas totais;
    - autoavaliação: sensação (192) e esforço (193).
  - **Dos pontos:** oscilação vertical, tempo de contato, proporção vertical e comprimento da passada.
  - **Elevação mín/máx e temperatura média:** calculadas pelos pontos quando faltarem.
  - **Cadência:** conferir que a média usa a cadência de corrida × 2 + a fração (171, não 170).
- **Banco:** migration `018_garmin_fields`.
  - **`activities`:** colunas novas para o que não existe:
    - `training_effect_aerobic`, `training_effect_anaerobic`, `primary_benefit`;
    - `hr_recovery`, `sweat_loss_ml`, `resting_calories`;
    - `min_temperature_c`, `max_temperature_c`;
    - `avg_vertical_oscillation_mm`, `avg_stance_time_ms`, `avg_vertical_ratio_pct`, `avg_step_length_m`, `total_strides`;
    - `watch_rpe`, `watch_feel`.
  - **`activity_points`:** 4 colunas pequenas de dinâmica.
  - **Colunas que já existem e estão vazias:** `max_speed_kmh`, `normalized_power_w`, `avg_temperature_c` e `elevation_min/max_m` passam a ser preenchidas.
- **Principal benefício:** o valor 5 = VO2 Max foi confirmado pelo print.
  - No backfill, listar a distribuição dos códigos.
  - Mostrar na tela só códigos com rótulo conhecido.
  - Pedir ao usuário para conferir 2 ou 3 atividades no Garmin Connect, se aparecer código novo.
- **Autoavaliação vira check-in:** quando o relógio traz autoavaliação e o check-in está vazio:
  - `rpe = round(workout_rpe/10)`;
  - sensação: 100→ótimo, 75→bem, 50→normal, 25→cansado, 0→sem energia;
  - marcar `checkin_at`.
  - Nunca sobrescrever um check-in feito na tela.
- **Estimados pelo Kactus** (com o rótulo "estimado"):
  - **Minutos de intensidade:** pelas zonas de FC já calculadas (`metrics.hr_zone_distribution`). Moderado = Z3; alto = Z4–Z5, conta em dobro.
  - **Corrida × caminhada:** pela cadência (< ~140 ppm) e pela velocidade.
- **Web** (`app/activities/[id]/page.tsx`):
  - **Blocos novos:**
    - "Efeito de treino" (aeróbico/anaeróbico em 0–5, com uma frase do que significa, e o benefício principal);
    - "Dinâmica de corrida" (cada métrica com "o que é bom");
    - "Temperatura";
    - "Calorias e hidratação".
  - **Nos blocos existentes:** melhor ritmo e FC de recuperação.
  - **Gráfico:** o seletor ganha passada, oscilação, proporção vertical e contato com o solo.
  - **Sem dado:** um bloco sem dado não aparece.
- **Duni:** `_activity_detail` e `activity_context` recebem `efeito_treino`, `dinamica` e `temperatura` quando existirem. O `SYSTEM_PROMPT` diz que calor explica FC alta.
- **Recalcular o histórico:** `scripts/backfill_garmin_fields.py`, no padrão de `backfill_moving_time.py`.
  - Parâmetros: `--dry-run` e `--email`.
  - Relê os 427 FIT/`.gz` por `resolve_upload_path` e mostra antes e depois.
- **Testes:**
  - o parser lê os campos novos de uma fixture FIT real (copiar o `8d321baf…fit` para `tests/fixtures`);
  - a autoavaliação preenche o check-in vazio e não sobrescreve;
  - o backfill em dry-run.
- **Conferir:** abrir a corrida do print e comparar campo a campo com a tabela acima.

### Fase 4: Carga em linguagem simples
- **API:** novo `GET /metrics/summary`, montado sobre `build_analysis` (`ai/athlete_analysis.py`) e `training_recommendation` (`metrics/predictions.py`). Devolve:
  - **"Hoje":** uma frase (treinar forte / leve / descansar) com o porquê;
  - **Semana atual × média das últimas 4:** km, tempo e treinos;
  - **Faixa segura para a próxima semana:** km mín–máx derivados da carga crônica. A carga aguda fica ≤ 1,3 × a crônica, convertida em km pela carga média por km das últimas 4 semanas. Sem regra fixa de %.
  - **Intensidade em 28 dias:** leve × moderado × forte;
  - **Efeito de treino:** a média da semana, vinda do Garmin (Fase 3).
- **Nomes simples** em `lib/athlete.ts`, usados em toda parte:
  - Condicionamento (CTL), Cansaço (ATL), Disposição (TSB) e Salto de carga (ACWR).
  - A sigla aparece só no tooltip.
  - Aplicar também em `components/dashboard/AthleteStatus.tsx` e nos cartões da Duni.
- **Página `/metrics`:**
  - **Topo:** cartão "Hoje" e cartão "Próxima semana: até X km com segurança".
  - **Gráficos principais:**
    - **"Volume por semana":** km e horas por esporte, em 16 semanas. Substitui o TSS como gráfico principal.
    - **"Leve × moderado × forte":** 28 dias, com a meta de "maior parte leve".
    - **"Condicionamento × cansaço":** o gráfico atual com nomes simples.
  - **Consistência:** o heatmap fica, com km/tempo no tooltip.
  - **Modo avançado** (`<details>` recolhido): TSB, ACWR, TSS e "como é calculado".
- **Testes:** o `/metrics/summary` com fixture de semanas (faixa segura, sem dados, poucos dados).

### Fase 5: Equipamentos recomendados
- **Pesquisa na web** (WebSearch/WebFetch) dos melhores modelos de 2026 à venda no Brasil, por esporte e faixa (entrada / intermediário / topo), com faixa de preço em R$ e 1 frase do porquê:
  - **Corrida:** tênis para o dia a dia, para treino rápido, de prova (placa) e de trilha; relógio GPS; cinta cardíaca.
  - **Ciclismo:** capacete, ciclocomputador e sensor de cadência/potência.
  - **Natação:** óculos, roupa de treino e wetsuit.
  - **Fontes:** reviews confiáveis (RunRepeat, DC Rainmaker, Believe in the Run e similares).
- **Catálogo:** `kactus_api/equipment_catalog.py`, no mesmo padrão de `checkin_tags.py`.
  - `CATALOG_UPDATED_AT = "2026-09"` e itens com `sport`, `category`, `tier`, `brand`, `model`, `why`, `price_brl` e `best_for`.
  - O link é de busca neutra (`google.com/search?q=…`), sem afiliado.
- **API:** `GET /equipment/recommendations`, personalizado. Por ordem:
  1. Os esportes praticados em 90 dias, pelo volume.
  2. Para a corrida, km por semana e ritmo (quem treina rápido ou tem prova vê o tênis de placa).
  3. **Alerta de troca** para tênis ativo acima de ~600 km. Hoje o Vaporfly 3 do usuário está nesse caso, se estiver acima.
  4. O que falta: sem relógio cadastrado mas com FIT importado, não sugerir relógio como compra urgente.
- **Web** (`/equipment`):
  - Seção "Recomendados para você", com abas por esporte e cartões por categoria e faixa.
  - O alerta de troca fica no topo.
  - O botão "Já tenho / adicionar" preenche o formulário com marca, modelo e tipo.
  - A data do catálogo fica visível ("atualizado em set/2026").
- **Testes:** a personalização (esporte sem atividade não aparece, o alerta de km, a ordem por volume).

### Fase 6: Ideias e fechamento
- **Documento:** atualizar `docs/ESTADO_DO_PROJETO.md` com a sessão e a migration 018, e as memórias (projeto, Duni e gerador, se couber).
- **Ideias:** uma seção **"Ideias"** no plano e no `BACKLOG.md`, com 8 a 12 ideias priorizadas por valor × esforço, todas de custo zero e no uso local. O usuário escolhe; nada executado sem pedido.
  - **Candidatas:**
    - comparar treinos equivalentes lado a lado;
    - metas de volume semanal com barra de progresso;
    - alertas de "treino feito × planejado" no dia seguinte;
    - resumo mensal automático;
    - importação por pasta vigiada;
    - "recordes pessoais por estação/temperatura";
    - exportar/backup dos dados;
    - trocar senha e excluir conta (backlog 14).
- **Fechar o planejamento.**

---

## Verificação
- **API:** `uv run pytest` na branch Neon `test`. Ruff sem erro novo (a base tem 25 avisos antigos). `alembic upgrade head` no banco principal depois dos testes.
- **Web:** `pnpm exec tsc --noEmit`, depois `preview_start kactus`, logado com JWT (`create_access_token`) em `kactus_token`. A API sobe sem reload: reiniciar o preview depois de mudar o backend.
- **Nome:** o script do banco e a varredura do navegador, com 0 ocorrências.
- **Duni:** gerar resumo, plano e comentário na conta de teste com o Gemini de verdade.
  - Medir os tamanhos: o resumo < ~700 caracteres.
  - Conferir a página com o essencial acima da dobra e os detalhes recolhidos.
- **Garmin:** a corrida do print com cada valor batendo (efeito 3,9/0,0, suor 466 ml, passada 1,04 m, oscilação 8,8 cm, contato 260 ms, proporção 8,5 %, temperatura 28,6/27/31, melhor ritmo 4:31). Backfill em dry-run e depois de verdade.
- **Carga:** a faixa segura coerente com o histórico da conta principal. Nenhuma sigla no texto principal do dashboard, da Duni e da Carga.
- **Equipamentos:** as recomendações aparecem só para esportes praticados. O alerta do tênis bate com o km real. "Adicionar" preenche o formulário.

---

## Registro de execução

### Fase 0 (2026-09-27)
- Documento criado.

### Fase 1 (2026-09-27)
- Apagado o resumo antigo da Duni (`coach_interactions` 99c89454, 21/09, conta principal) — era o único registro com "ondilow" no conteúdo.
- `activities.file_path`: 596 caminhos `\Ondilow\` → `\Kactus\` (com `position()`: o `LIKE` do Postgres trata `\` como escape). Depois disso, os 600 caminhos gravados apontam para arquivos que existem.
- Varredura do banco (toda coluna de texto, JSON e array): 0 ocorrências. Varredura no navegador, 11 páginas × 2 contas (título, texto e HTML, via iframe): 0 ocorrências.
- Equipamentos: "Tênis", "Relógio", "Distância inicial".

### Fase 2 (2026-09-27)
- Prompt v4: seção ESCRITA no `SYSTEM_PROMPT` (frases curtas, até 3 itens, sem siglas, chat ~100 palavras). Resumo virou `AnalysisLLM` (status, frase, semana, até 3 pontos, até 3 ações, pergunta), salvo como JSON; `GET/POST /coach/analyze` devolvem `summary` (resumo antigo em markdown continua em `report`). Plano com limites por `Field(description)` e listas cortadas em 3; comentário pós-treino em ~120 palavras e 3 blocos.
- Teste ao vivo (Gemini flash-lite, conta de teste): resumo com ~600 caracteres (antes 2.000–3.800); plano com 1 frase por campo e 1–2 itens por lista.
- Web: `SummaryCard` (status, "O que eu vi", "O que fazer", pergunta com "Responder no chat"); cartões do topo em linguagem simples (`hint` em `formFromTsb`/`riskFromAcwr`/`ctlTrend`); painel "Plano ativo" removido; plano da semana virou lista dos 7 dias (próximo treino destacado e aberto), com "Ver análise completa" recolhido.
- Achado: o chat usava `scrollIntoView`, que rolava a página inteira até o chat ao abrir a aba (o resumo ficava fora da tela). Agora rola só a caixa do chat.
- `training_recommendation` e `assess_injury_risk` sem siglas no texto (CTL/TSB/ACWR).
- 211 testes passando (3 novos).

### Fase 3 (2026-09-27)
- Parser FIT lê por número de campo o que o `fitparse` não conhece (150 temp. mínima, 178 suor, 188 benefício, 192/193 autoavaliação, 196 calorias em repouso, 202 FC de recuperação), mais melhor ritmo, potência normalizada, efeito de treino, dinâmica de corrida (resumo e por ponto) e a cadência com a fração (171, não 170). Elevação mín/máx e temperatura saem dos pontos (média 28,6 °C como no Garmin, não os 29 inteiros do resumo). Tempo andando estimado pela cadência (< 140 ppm).
- Migration `018_garmin_fields` (16 colunas em `activities`, 4 em `activity_points`), aplicada no banco principal. Rótulos do benefício em `metrics/garmin.py` (0 nenhum … 5 VO2 máx … 7 sprint), conferidos contra 70 arquivos.
- **Desvio do plano:** a autoavaliação do relógio **não** vira check-in sozinha. Em ~40% dos arquivos ela é "Muito fraco + 10/10" até em treino leve (resposta padrão quando a tela é só confirmada). Fica guardada (`watch_feel`/`watch_rpe`) e o check-in mostra "O relógio registrou … [Usar no check-in]", com aviso quando é esse par.
- Web: painel "Mais do relógio" no detalhe (efeito de treino, dinâmica com "o que é bom", intensidade estimada pelas zonas, corrida × caminhada, temperatura, calorias e suor, melhor ritmo, FC de recuperação) e gráfico "Dinâmica de corrida" com seletor. Duni recebe efeito de treino, dinâmica, temperatura e suor no comentário do treino.
- Sem FIT real no repositório (tem nome, peso e rota do atleta): testes com mensagens simuladas.
- Backfill `scripts/backfill_garmin_fields.py`: a primeira versão carregava todos os pontos de cada atividade e levaria horas; a versão final manda os pontos do arquivo num `UPDATE … FROM (VALUES …)` e só o banco casa pelo `elapsed_time_s`. Rodado nas duas contas: 600 atividades, 425 com efeito de treino, 386 com dinâmica de corrida, 408.281 pontos com dinâmica, 176 com FC de recuperação. Benefícios: 0 (6), 1 (46), 2 (70), 3 (122), 4 (132), 5 (39), 6 (4), 7 (6) — todos com rótulo.
- Conferido no navegador com a corrida do print (5,01 km, 26/09): efeito 3,9/0,0 VO2 máx, cadência 171, passada 1,04 m, oscilação 8,8 cm, proporção 8,5%, contato 260 ms, suor 466 ml, 40/343 kcal, FC de recuperação 37, melhor ritmo 4:31, elevação 173/184, temperatura 27/31 (média 28,7 × 28,6 do Garmin), minutos de intensidade 53 (igual ao Garmin). Tempo andando estimado 20 s × 9 s do Garmin.

### Fase 4 (2026-09-27)
- `GET /metrics/summary` (`metrics/summary.py`): recomendação de hoje, últimos 7 dias × média semanal do mês anterior, faixa segura de km de corrida nos próximos 7 dias (carga entre 0,8× e 1,3× a média de 4 semanas, descontando os outros esportes; sem faixa quando a base é baixa), intensidade de 28 dias, efeito de treino de 7 dias e volume de 16 semanas.
- Página `/metrics` refeita: "Hoje" e "Corrida nos próximos 7 dias" no topo, Forma / Risco de lesão / Condicionamento com frase simples, últimos 7 dias × média, volume por semana, leve × moderado × forte, efeito de treino, condicionamento × cansaço e constância; siglas e gráficos técnicos no "Modo avançado". Dashboard (`AthleteStatus`) sem TSB/ACWR no texto (siglas só no `title`).
