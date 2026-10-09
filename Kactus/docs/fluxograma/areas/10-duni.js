// Área 10 — Duni, a treinadora de IA (/coach).
KACTUS_MAPA.areas.push({
  id: "duni",
  n: 10,
  titulo: "Duni (treinadora de IA)",
  resumo:
    "A Duni lê os dados calculados do Kactus (volumes, tendência, fadiga, check-ins, memórias, plano feito × pulado) e responde por um modelo de linguagem: Anthropic se houver chave, senão Gemini grátis com uma lista de modelos e um orçamento total de 200 s. Na página há três ações grandes (relatório, plano da semana, plano do objetivo), o resumo com quatro indicadores, o plano do objetivo em fases, o plano da semana com três vistas, o chat em formato de celular e o painel do que ela sabe de você. A IA só é chamada quando o atleta pede.",
  rotas: ["/coach"],
  arquivos: [
    "apps/web/app/coach/page.tsx",
    "apps/web/components/coach/SummaryBody.tsx",
    "apps/web/components/coach/GoalPlanPanel.tsx",
    "apps/web/components/coach/WeekPlans.tsx",
    "apps/web/components/coach/WeeklyPlanPanel.tsx",
    "apps/web/components/coach/WorkoutReview.tsx",
    "apps/web/components/coach/MemoryPanel.tsx",
    "apps/web/lib/coachErrors.ts",
    "apps/api/kactus_api/routers/coach.py",
    "apps/api/kactus_api/ai/coach_service.py",
    "apps/api/kactus_api/ai/goal_plan.py",
    "apps/api/kactus_api/ai/training_history.py",
    "apps/api/kactus_api/ai/athlete_analysis.py",
  ],
  diagramas: [
    {
      titulo: "Página da Duni: o que carrega e as três ações",
      mermaid: `
flowchart TD
  IN("Abre /coach"):::acao --> LD[/"GET /coach/chat/history · /coach/memories<br/>/coach/plan/week · /coach/goal-plan · /coach/plan/free<br/>/coach/analyze · /coach/plan?days_ahead=14<br/>/predictions/overview · /metrics/load?days=30"/]:::api
  LD --> REC[["reconcile_plan: casa treinos feitos<br/>e marca pulados os dias que passaram"]]:::calc
  LD --> PG["Topo: Duni, sua treinadora<br/>PRONTO · ANALISANDO · NÃO CONFIGURADO"]:::tela
  PG --> A1("Gerar relatório"):::acao
  PG --> A2("Gerar plano da semana"):::acao
  PG --> A3("Gerar plano do objetivo"):::acao
  A1 --> P1(["Analisando sua semana…<br/>5 passos animados"]):::estado --> IA1{{"POST /coach/analyze"}}:::ia
  IA1 --> RES["Resumo da Duni<br/>status, pontos, ações, pergunta"]:::ok
  RES --> RESP("Responder à pergunta"):::acao --> CHAT
  A2 --> P2(["Montando o plano da semana…"]):::estado --> IA2{{"POST /coach/plan/generate"}}:::ia
  IA2 --> OKW["Plano da semana pronto: N treinos"]:::ok
  A3 --> P3(["Montando o plano até a prova…"]):::estado --> IA3{{"POST /coach/goal-plan/generate"}}:::ia
  IA3 --> OKG["Plano até a prova pronto: N treinos"]:::ok
  IA1 -->|erro| ERR["Caixa vermelha com<br/>título e explicação do erro"]:::erro
  IA2 -->|erro| ERR
  IA3 -->|erro| ERR
  PG --> IND["Hoje · Forma · Risco de lesão ·<br/>Treinos planejados em 14 dias"]:::tela
  PG --> CHAT["Chat em moldura de celular"]:::tela
  PG --> MEM["O que a Duni sabe de você"]:::tela
`,
    },
    {
      titulo: "Plano da semana: vistas e ações em cada treino",
      mermaid: `
flowchart TD
  HG{"Existe plano do objetivo?"}:::decisao
  HG -->|não| WP["Plano da semana"]:::tela
  HG -->|sim| TAB("Do objetivo · Da semana · Comparar"):::acao
  TAB -->|Do objetivo| WP
  TAB -->|Da semana| FREE["Plano pelo estado de agora<br/>proposta, não muda a agenda"]:::tela
  TAB -->|Comparar| CMP["Objetivo × Agora<br/>dia a dia + recomendação"]:::tela
  WP -->|vazio| WV["A Duni ainda não montou o plano desta semana"]:::estado
  WP -->|treinos sem passo a passo| DET("Detalhar a semana"):::acao --> G2{{"POST /coach/plan/generate"}}:::ia
  WP --> DAY("Toca num dia"):::acao --> WD["Treino: para quê, por que agora,<br/>como fazer, km a km"]:::tela
  WD --> AN("Analisar este treino"):::acao
  WD --> RG("Pedir outro treino"):::acao
  WD --> MV("Mudar de dia"):::acao
  AN --> Q["Discorda de algo? opcional"]:::tela --> IAR{{"POST /coach/plan/id/analyze"}}:::ia
  IAR --> VER{"Veredito"}:::decisao
  VER -->|manter| OKM("Ok"):::acao
  VER -->|ajustar| TROCA("Trocar por este"):::acao --> APL[/"POST /coach/plan/id/apply-review"/]:::api
  VER -->|descanso| DESC("Descansar neste dia"):::acao --> APL
  APL --> NOTE["A Duni ajustou o plano"]:::ok
  RG --> MOT{"Motivo com 3+ letras?"}:::decisao
  MOT -->|sim| IARG{{"POST /coach/plan/id/regenerate"}}:::ia --> NOTE
  MV --> NOVO("Novo dia, de hoje em diante"):::acao --> MOVE[/"POST /coach/plan/id/move"/]:::api
  MOVE -->|409 dia ocupado| CONF["Já tem título nesse dia"]:::decisao
  CONF -->|Trocar os dois de dia| MOVE
  CONF -->|Manter os dois| MOVE
  MOVE -->|ok| NOTE
  FREE -->|vazio| GF("Gerar plano da semana"):::acao --> IAF{{"POST /coach/plan/free/generate"}}:::ia
  CMP --> USE("Usar o da semana · Usar a semana toda"):::acao --> UF[/"POST /coach/plan/free/use"/]:::api
  UF --> WP
`,
    },
    {
      titulo: "Plano do objetivo",
      mermaid: `
flowchart TD
  GP["Plano do objetivo"]:::tela --> HAS{"Já existe?"}:::decisao
  HAS -->|não| EXP["Explica e pede a prova com data<br/>em O que a Duni sabe de você"]:::estado
  EXP --> DPW("Dias/semana 3 · 4 · 5"):::acao --> GEN("Gerar plano do objetivo"):::acao
  HAS -->|sim| SHOW["Prova, data, faltam N dias, distância<br/>ritmos Leve, Limiar, Intervalo, Prova"]:::ok
  SHOW --> REDO("Refazer a partir de hoje"):::acao --> GEN
  GEN --> RACE{"Prova futura com data<br/>e distância reconhecível?"}:::decisao
  RACE -->|não| E1["Falta a prova com data"]:::erro
  RACE -->|menos de 2 semanas| E2["A prova está perto demais"]:::erro
  RACE -->|sim| HIST[["Lê 6 meses de treino<br/>último mês pesa mais; dor reduz progressão"]]:::calc
  HIST --> SK[["Esqueleto em código: semanas,<br/>fases, km, longão, alívio, VDOT"]]:::calc
  SK --> IAG{{"Duni escolhe tipo, título e objetivo<br/>temperatura 0, semente 7"}}:::ia
  IAG --> SAVE[["Salva o plano e todos os treinos<br/>de hoje até a prova"]]:::calc
  SAVE --> SHOW
  SHOW --> TL["O que a Duni levou em conta · 6 meses"]:::tela
  SHOW --> PH["Faixa de fases<br/>Base · Construção · Pico · Polimento"]:::tela
  SHOW --> WC("Barra de km por semana<br/>toque numa semana"):::acao --> WW["Treinos daquela semana"]:::tela
`,
    },
    {
      titulo: "Chat e memórias",
      mermaid: `
flowchart TD
  C0["Chat vazio"]:::estado --> SUG("4 perguntas sugeridas"):::acao
  SUG --> SEND
  TXT("Digita e Enter ou ➤"):::acao --> SEND[/"POST /coach/chat"/]:::api
  SEND --> TYP(["digitando…"]):::estado
  SEND --> CTX[["Contexto: dados calculados + memórias<br/>+ últimas mensagens"]]:::calc
  CTX --> IA{{"Resposta + sugestões do que guardar"}}:::ia
  IA --> MSG["Balão da Duni"]:::ok
  MSG --> GS{"Sugeriu memória?"}:::decisao
  GS -->|sim| GUARD("Guardar · Ignorar"):::acao
  GUARD -->|Guardar| CM[/"POST /coach/memories<br/>source = duni"/]:::api
  CLR("Limpar conversa"):::acao --> CCL{"Apagar toda a conversa?"}:::decisao
  CCL -->|Limpar| DEL[/"DELETE /coach/chat/history"/]:::api --> C0
  MEMP["O que a Duni sabe de você"]:::tela --> ADD("+ Adicionar"):::acao
  ADD --> KIND("Objetivo · Prova · Lesão/dor ·<br/>Disponibilidade · Preferência · Outro"):::acao
  KIND --> SAVEM[/"POST ou PATCH /coach/memories"/]:::api
  MEMP --> ARQ("Arquivar"):::acao --> PATCHA[/"PATCH active=false"/]:::api
  MEMP --> VARQ("Ver arquivadas"):::acao --> ARQL["Reativar · Apagar"]:::tela
  ARQL -->|Apagar, confirm do navegador| DM[/"DELETE /coach/memories/id"/]:::api
  MEMP -->|sem objetivo nem prova| AV["Aviso: sem isso a Duni monta<br/>semanas de base aeróbica"]:::estado
`,
    },
    {
      titulo: "Como a Duni chama a IA e os erros que podem voltar",
      mermaid: `
flowchart TD
  CALL[["call_llm"]]:::calc --> K{"Tem alguma chave?"}:::decisao
  K -->|nenhuma| NC["not_configured<br/>A Duni ainda não está configurada"]:::erro
  K -->|ANTHROPIC_API_KEY| ANT{{"Anthropic"}}:::ia
  ANT -->|ok| OUT["Resposta validada"]:::ok
  ANT -->|limite, chave, rede ou 5xx| GEM
  K -->|só GEMINI_API_KEY| GEM{{"Gemini: tenta cada modelo da lista<br/>orçamento total 200 s"}}:::ia
  GEM -->|ok| JSON{"JSON no formato?"}:::decisao
  JSON -->|sim| OUT
  JSON -->|não| IPR["invalid_plan_response · invalid_response"]:::erro
  GEM -->|429| QE["quota_exceeded<br/>Limite gratuito do Gemini atingido"]:::erro
  GEM -->|401 ou 403| IK["invalid_key"]:::erro
  GEM -->|404| MNF["model_not_found"]:::erro
  GEM -->|500, 503, 504 em todos| LU["llm_unavailable<br/>Gemini sobrecarregado"]:::erro
  GEM -->|tempo esgotado| LT["llm_timeout<br/>O Gemini demorou demais"]:::erro
  PRE[["Antes de chamar"]]:::calc --> ID{"2+ semanas de treinos?"}:::decisao
  ID -->|não| INS["insufficient_data<br/>Ainda não há dados suficientes"]:::erro
  ID -->|sim| CALL
`,
    },
  ],
  inventario: [
    { tipo: "API", nome: "Carregamento da página", acao: "Nove chamadas em paralelo; falhas viram estado vazio.", api: "GET /coach/chat/history · /coach/memories · /coach/plan/week · /coach/goal-plan · /coach/plan/free · /coach/analyze · /coach/plan?days_ahead=14 · /predictions/overview · /metrics/load?days=30", onde: "apps/web/app/coach/page.tsx:220", no: "LD" },
    { tipo: "cálculo", nome: "Aderência automática", acao: "Ao ler os planos, casa cada treino planejado com uma atividade do mesmo dia e esporte compatível (feito) e marca como pulado o que passou sem atividade.", onde: "apps/api/kactus_api/ai/coach_service.py:649", no: "REC" },
    { tipo: "seção", nome: "Topo da Duni", acao: "Orbe, selo PRONTO / ANALISANDO / NÃO CONFIGURADO.", msg: "Lê seus treinos de verdade e diz, sem enrolar, o que fazer.", onde: "apps/web/app/coach/page.tsx:412", no: "PG" },
    { tipo: "botão", nome: "Gerar relatório", acao: "Resumo da semana. Exige 2 semanas de dados.", api: "POST /coach/analyze", msg: "Como você está e o que fazer, em 20 segundos.", onde: "apps/web/app/coach/page.tsx:443", no: "A1,IA1" },
    { tipo: "botão", nome: "Gerar plano da semana", acao: "Os 7 dias a partir de hoje; com plano do objetivo, detalha os treinos dele.", api: "POST /coach/plan/generate", msg: "Os treinos dos próximos 7 dias, do seu jeito.", onde: "apps/web/app/coach/page.tsx:451", no: "A2,IA2" },
    { tipo: "botão", nome: "Gerar plano do objetivo", acao: "Todos os treinos até a prova, em fases.", api: "POST /coach/goal-plan/generate", msg: "Todos os treinos até a sua prova, em fases.", onde: "apps/web/app/coach/page.tsx:459", no: "A3,IA3" },
    { tipo: "carregando", nome: "Duni analisando", acao: "Painel com os 5 passos (volume, tendência, fadiga, check-ins e memórias, feito × pulado) acendendo a cada 1,4 s.", msg: "Analisando sua semana… · Montando o plano da semana… · Montando o plano até a prova…", onde: "apps/web/app/coach/page.tsx:64", no: "P1,P2,P3" },
    { tipo: "sucesso", nome: "Planos prontos", msg: "Plano até a prova pronto: N treinos · Plano da semana pronto: N treinos", onde: "apps/web/app/coach/page.tsx:480", no: "OKW,OKG" },
    { tipo: "seção", nome: "Resumo da Duni", acao: "Status da semana, pontos (bom, atenção, risco), ações e uma pergunta. Resumos antigos aparecem como texto.", msg: "A Duni ainda não fez o resumo. Peça o relatório para ela dizer como você está e o que fazer.", onde: "apps/web/app/coach/page.tsx:493", no: "RES" },
    { tipo: "botão", nome: "Responder à pergunta do resumo", acao: "Põe a pergunta como 'Respondendo:' no chat e foca a caixa.", onde: "apps/web/app/coach/page.tsx:385", no: "RESP" },
    { tipo: "card", nome: "Hoje · Forma · Risco de lesão · Treinos planejados", acao: "Indicadores calculados (sem IA) ao lado do resumo.", onde: "apps/web/app/coach/page.tsx:397", no: "IND" },
    { tipo: "seção", nome: "Plano do objetivo (vazio)", msg: "A Duni monta todos os treinos até a sua prova… Ela usa a prova com data que estiver em \"O que a Duni sabe de você\".", onde: "apps/web/components/coach/GoalPlanPanel.tsx:181", no: "EXP" },
    { tipo: "campo", nome: "Dias/semana", acao: "3, 4 ou 5 dias de corrida.", onde: "apps/web/components/coach/GoalPlanPanel.tsx:170", no: "DPW" },
    { tipo: "seção", nome: "Plano do objetivo", acao: "Nome e data da prova, dias que faltam, distância, resumo; ritmos Leve, Limiar, Intervalo e Ritmo de prova.", onde: "apps/web/components/coach/GoalPlanPanel.tsx:206", no: "GP,HAS,SHOW" },
    { tipo: "botão", nome: "Refazer a partir de hoje", acao: "Gera de novo mantendo o que já foi feito.", msg: "Refazendo…", onde: "apps/web/components/coach/GoalPlanPanel.tsx:233", no: "REDO,GEN" },
    { tipo: "seção", nome: "O que a Duni levou em conta · 6 meses", onde: "apps/web/components/coach/GoalPlanPanel.tsx:240", no: "TL" },
    { tipo: "seção", nome: "Fases e km por semana", acao: "Base, Construção, Pico, Polimento; barra mais clara = semana de alívio; tocar numa semana lista os treinos dela (pulados aparecem apagados).", onde: "apps/web/components/coach/GoalPlanPanel.tsx:257", no: "PH,WC,WW" },
    { tipo: "cálculo", nome: "Prova-alvo", acao: "A prova futura mais longa com data (empate: a mais próxima); precisa de 2+ semanas até ela.", onde: "apps/api/kactus_api/ai/coach_service.py:1600", no: "RACE" },
    { tipo: "cálculo", nome: "Histórico de 6 meses", acao: "Último mês pesa mais; dor reduz a progressão semanal.", onde: "apps/api/kactus_api/ai/training_history.py", no: "HIST" },
    { tipo: "cálculo", nome: "Esqueleto do plano", acao: "Semanas, fases, km, longão, alívio e ritmos pelo VDOT são código; a Duni só escolhe o tipo dentro das opções da fase, título e objetivo.", onde: "apps/api/kactus_api/ai/goal_plan.py", no: "SK,IAG" },
    { tipo: "IA", nome: "Plano estável", acao: "Respostas de plano usam temperatura 0 e semente 7: o mesmo contexto dá o mesmo plano.", onde: "apps/api/kactus_api/ai/coach_service.py:763" },
    { tipo: "aba", nome: "Do objetivo · Da semana · Comparar", acao: "Só aparecem quando existe plano do objetivo.", onde: "apps/web/components/coach/WeekPlans.tsx:225", no: "HG,TAB" },
    { tipo: "seção", nome: "Plano da semana", acao: "Datas por extenso, colunas por dia com barra de volume, status da semana, carga da semana anterior, avaliação, critérios de ajuste.", msg: "A Duni ainda não montou o plano desta semana. Ela analisa seu histórico, diz o status e explica cada treino.", onde: "apps/web/components/coach/WeeklyPlanPanel.tsx:639", no: "WP,WV" },
    { tipo: "botão", nome: "Detalhar a semana", acao: "Quando há treinos sem passo a passo (aquecimento, ritmos, desaquecimento).", msg: "Estes treinos ainda não têm o passo a passo… · Detalhando…", onde: "apps/web/components/coach/WeeklyPlanPanel.tsx:738", no: "DET,G2" },
    { tipo: "seção", nome: "Treino do dia", acao: "Selos Próximo treino, ✓ Feito, Pulado; Para quê, Por que agora, Como fazer, alvos (cadência, zona de FC, GAP, terreno) e divisão km a km com ritmo estimado (~).", onde: "apps/web/components/coach/WeeklyPlanPanel.tsx:406", no: "DAY,WD" },
    { tipo: "botão", nome: "Analisar este treino", acao: "A Duni confere o treino com o último mês, dor, check-ins e a fase do plano. Nada muda até aplicar.", api: "POST /coach/plan/{id}/analyze", onde: "apps/web/components/coach/WorkoutReview.tsx:22", no: "AN,Q,IAR" },
    { tipo: "campo", nome: "Discorda de algo?", acao: "Pergunta opcional de até 300 caracteres.", msg: "Ex.: \"acho leve demais\", \"a lombar está doendo\"", onde: "apps/web/components/coach/WorkoutReview.tsx:73" },
    { tipo: "IA", nome: "Veredito", acao: "Pode manter · Sugere ajustar (mostra o treino sugerido) · Sugere descansar.", onde: "apps/web/components/coach/WorkoutReview.tsx:10", no: "VER" },
    { tipo: "botão", nome: "Trocar por este · Descansar neste dia", acao: "Aplica a sugestão.", api: "POST /coach/plan/{id}/apply-review", msg: "Treino ajustado: … · Dia de descanso: …", onde: "apps/web/components/coach/WorkoutReview.tsx:141", no: "TROCA,DESC,APL" },
    { tipo: "botão", nome: "Ok · Manter o meu treino · Perguntar outra coisa", onde: "apps/web/components/coach/WorkoutReview.tsx:151", no: "OKM" },
    { tipo: "botão", nome: "Pedir outro treino", acao: "Pede o motivo (3 a 300 caracteres) e troca o treino daquele dia.", api: "POST /coach/plan/{id}/regenerate", msg: "Por quê? Ex.: \"panturrilha dura\", \"só tenho 30 min\" · A Duni está pensando…", onde: "apps/web/components/coach/WeeklyPlanPanel.tsx:154", no: "RG,MOT,IARG" },
    { tipo: "botão", nome: "Mudar de dia", acao: "Escolhe um dia de hoje em diante.", api: "POST /coach/plan/{id}/move", onde: "apps/web/components/coach/WeeklyPlanPanel.tsx:176", no: "MV,NOVO,MOVE" },
    { tipo: "validação", nome: "Dia ocupado", acao: "409 date_conflict: oferece Trocar os dois de dia, Manter os dois ou Cancelar.", msg: "Já tem \"título\" nesse dia.", onde: "apps/web/components/coach/WeeklyPlanPanel.tsx:187", no: "CONF" },
    { tipo: "erro", nome: "Edição recusada", acao: "Treino já feito ou do passado, dia que passou, troca com dia já feito.", msg: "So da para mudar treino ainda nao feito, de hoje em diante. · Nao da para mover um treino para um dia que ja passou. · O treino desse dia ja foi feito ou marcado; nao da para trocar.", onde: "apps/api/kactus_api/ai/coach_service.py:1186" },
    { tipo: "sucesso", nome: "A Duni ajustou o plano", onde: "apps/web/components/coach/WeeklyPlanPanel.tsx:743", no: "NOTE" },
    { tipo: "seção", nome: "Da semana (pelo estado de agora)", acao: "Proposta que não muda a agenda; Gerar plano da semana nesta vista monta só a proposta.", api: "POST /coach/plan/free/generate", msg: "Proposta: não muda a sua agenda. Para usar algum dia, vá em Comparar.", onde: "apps/web/components/coach/WeekPlans.tsx:243", no: "FREE,GF,IAF" },
    { tipo: "seção", nome: "Comparar · Objetivo × Agora", acao: "Totais (km, treinos, longão, fortes) e dia a dia; dias diferentes destacados; recomendação da Duni: seguir o objetivo, seguir a semana ou misturar.", onde: "apps/web/components/coach/WeekPlans.tsx:60", no: "CMP" },
    { tipo: "botão", nome: "Usar o da semana · Usar a semana toda", acao: "Leva para a agenda os dias escolhidos (ou todos de hoje em diante); feito e pulado não mudam.", api: "POST /coach/plan/free/use", onde: "apps/web/components/coach/WeekPlans.tsx:109", no: "USE,UF" },
    { tipo: "erro", nome: "Sem plano livre", msg: "Gere o plano da semana pelo estado de agora antes.", onde: "apps/api/kactus_api/ai/coach_service.py:2021" },
    { tipo: "seção", nome: "Chat em formato de celular", acao: "Barra de status, cabeçalho 'Duni · online / digitando… / não configurada', balões com hora.", onde: "apps/web/app/coach/page.tsx:555", no: "CHAT" },
    { tipo: "vazio", nome: "Chat vazio", acao: "Quatro perguntas prontas.", msg: "Pergunte sobre seus treinos, carga ou recuperação. Conte também seu objetivo e suas provas.", onde: "apps/web/app/coach/page.tsx:596", no: "C0,SUG" },
    { tipo: "campo", nome: "Mensagem", acao: "Enter ou ➤ envia. Respondendo a uma pergunta, a mensagem vai como 'Sobre \"pergunta\": resposta'.", api: "POST /coach/chat", onde: "apps/web/app/coach/page.tsx:666", no: "TXT,SEND,TYP" },
    { tipo: "IA", nome: "Resposta da Duni", acao: "Usa o contexto calculado, as memórias e as últimas mensagens; devolve sugestões do que guardar.", onde: "apps/api/kactus_api/ai/coach_service.py:846", no: "CTX,IA,MSG" },
    { tipo: "botão", nome: "Guardar · Ignorar", acao: "Sugestões de memória abaixo da resposta; somem ao recarregar se não forem guardadas.", msg: "Guardar para as próximas conversas? · ✓ Guardado", onde: "apps/web/app/coach/page.tsx:621", no: "GS,GUARD,CM" },
    { tipo: "botão", nome: "Limpar conversa", acao: "Confirmação dentro do celular; memórias e resumos ficam.", api: "DELETE /coach/chat/history", msg: "Apagar toda a conversa? O que a Duni sabe de você continua guardado.", onde: "apps/web/app/coach/page.tsx:565", no: "CLR,CCL,DEL" },
    { tipo: "seção", nome: "O que a Duni sabe de você", acao: "Memórias agrupadas por tipo, com data e quem adicionou.", msg: "Ela usa isso em toda conversa e em todo plano. Você pode editar ou arquivar quando quiser.", onde: "apps/web/components/coach/MemoryPanel.tsx:43", no: "MEMP" },
    { tipo: "aviso", nome: "Sem objetivo nem prova", msg: "Nenhum objetivo ou prova cadastrados. Sem isso, a Duni monta semanas de base aeróbica em vez de treinar para algo específico.", onde: "apps/web/components/coach/MemoryPanel.tsx:135", no: "AV" },
    { tipo: "botão", nome: "+ Adicionar / Editar", acao: "Tipo (Objetivo, Prova, Lesão/dor, Disponibilidade, Preferência, Outro), texto até 500 caracteres e data quando o tipo pede.", api: "POST /coach/memories · PATCH /coach/memories/{id}", onde: "apps/web/components/coach/MemoryPanel.tsx:127", no: "ADD,KIND,SAVEM" },
    { tipo: "botão", nome: "Arquivar", api: "PATCH /coach/memories/{id}", onde: "apps/web/components/coach/MemoryPanel.tsx:210", no: "ARQ,PATCHA" },
    { tipo: "botão", nome: "Ver arquivadas · Reativar · Apagar", acao: "Apagar usa a confirmação do navegador.", api: "GET /coach/memories?include_archived=true · DELETE /coach/memories/{id}", msg: "Apagar de vez \"texto\"?", onde: "apps/web/components/coach/MemoryPanel.tsx:222", no: "VARQ,ARQL,DM" },
    { tipo: "erro", nome: "Memória não salvou", msg: "Não consegui salvar", onde: "apps/web/components/coach/MemoryPanel.tsx:133" },
    { tipo: "IA", nome: "Ordem dos provedores", acao: "Anthropic primeiro, se houver chave; em limite, chave, rede ou erro 5xx cai para o Gemini.", onde: "apps/api/kactus_api/ai/coach_service.py:809", no: "CALL,K,ANT" },
    { tipo: "IA", nome: "Gemini com orçamento", acao: "Tenta cada modelo de GEMINI_MODEL uma vez; só passa ao próximo em 500/503/504 ou tempo esgotado; não começa outro com menos de 20 s.", onde: "apps/api/kactus_api/ai/coach_service.py:751", no: "GEM,JSON" },
    { tipo: "erro", nome: "not_configured", msg: "A Duni ainda não está configurada · Falta a chave do Gemini…", onde: "apps/web/lib/coachErrors.ts:7", no: "NC" },
    { tipo: "erro", nome: "quota_exceeded", msg: "Limite gratuito do Gemini atingido", onde: "apps/web/lib/coachErrors.ts:13", no: "QE" },
    { tipo: "erro", nome: "invalid_key", msg: "Chave do Gemini inválida", onde: "apps/web/lib/coachErrors.ts:18", no: "IK" },
    { tipo: "erro", nome: "model_not_found", msg: "Modelo do Gemini não encontrado", onde: "apps/web/lib/coachErrors.ts:20", no: "MNF" },
    { tipo: "erro", nome: "llm_unavailable", msg: "Gemini sobrecarregado", onde: "apps/web/lib/coachErrors.ts:22", no: "LU" },
    { tipo: "erro", nome: "llm_timeout", msg: "O Gemini demorou demais", onde: "apps/web/lib/coachErrors.ts:24", no: "LT" },
    { tipo: "erro", nome: "insufficient_data", acao: "Menos de 2 semanas de treinos.", msg: "Ainda não há dados suficientes · Você tem N semana(s) de atividades…", onde: "apps/web/lib/coachErrors.ts:26", no: "PRE,ID,INS" },
    { tipo: "erro", nome: "invalid_plan_response · invalid_response", acao: "Plano fora das regras (sem dia de descanso, treino sem objetivo) ou JSON inválido, inclusive no plano do objetivo.", msg: "O plano veio fora das regras e foi recusado · A resposta veio num formato inválido", onde: "apps/web/lib/coachErrors.ts:31", no: "IPR" },
    { tipo: "erro", nome: "no_goal_race · race_too_close", msg: "Falta a prova com data · A prova está perto demais", onde: "apps/web/lib/coachErrors.ts:36", no: "E1,E2" },
    { tipo: "erro", nome: "Erros de edição e do servidor", acao: "no_free_week, not_editable, past_date, not_swappable, invalid_suggestion, not_found e internal_error ganham título e explicação.", msg: "Falta o plano da semana pelo estado de agora · Esse treino não pode mais mudar · Esse dia já passou · Erro no servidor do Kactus …", onde: "apps/web/lib/coachErrors.ts:45" },
    { tipo: "API", nome: "Listar treinos planejados", acao: "Usada pelo dashboard (35 dias) e pela Duni (14 dias).", api: "GET /coach/plan", onde: "apps/api/kactus_api/routers/coach.py:316" },
    { tipo: "API", nome: "Plano do objetivo atual", api: "GET /coach/goal-plan", onde: "apps/api/kactus_api/routers/coach.py:188" },
    { tipo: "API", nome: "Semana atual", acao: "Plano da semana vigente e os treinos pela data; sem plano da semana, os 7 dias do objetivo.", api: "GET /coach/plan/week", onde: "apps/api/kactus_api/routers/coach.py:203" },
    { tipo: "API", nome: "Plano livre atual", api: "GET /coach/plan/free", onde: "apps/api/kactus_api/routers/coach.py:245" },
    { tipo: "API", nome: "Último resumo salvo", api: "GET /coach/analyze", onde: "apps/api/kactus_api/routers/coach.py:132" },
    { tipo: "API", nome: "Histórico do chat", api: "GET /coach/chat/history", onde: "apps/api/kactus_api/routers/coach.py:390" },
  ],
});
