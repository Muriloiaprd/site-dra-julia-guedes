// Área 16 — Calendário de treinos: o planejado e o feito por dia, e as abas Plano, Objetivo e Comparar.
KACTUS_MAPA.areas.push({
  id: "calendario",
  n: 16,
  titulo: "Calendário de treinos",
  resumo:
    "A aba onde se confere os treinos, dentro do menu do app (barra lateral, barra de baixo e Print Tela, como as outras abas), com ← Voltar no topo e quatro abas: Calendário, Plano, Objetivo e Comparar. Calendário: um quadro de fundo claro com o mês (ou a semana, pelo seletor Mês · Semana), em que cada treino é uma etiqueta com o ícone do esporte, o nome e os km embaixo, colorida pela situação: concluído (verde), perdido (vermelho), hoje (verde-limão) ou planejado (cinza); a atividade feita sem plano também vira etiqueta verde. Hoje fica com borda verde e um ponto. No computador, o dia escolhido aparece num painel à direita, com o detalhe e o botão Ver semana; no celular e no tablet, numa gaveta. No celular o mês mostra pontinhos e a semana vira uma lista de dias. Plano: os botões de gerar o plano da semana e o do objetivo e o topo do Plano do objetivo (prova, ritmos, alvo, dias/semana, Refazer e o que a Duni levou em conta). Objetivo: as fases (base, construção, pico, polimento), os km de cada semana e os treinos da semana tocada. Comparar: o placar dos últimos 14 dias, o Plano da semana (Do objetivo · Da semana · Objetivo × Agora) e o Planejado × feito treino a treino. O plano só aparece aqui e no resumo do Dashboard.",
  rotas: ["/calendar", "/calendar?aba=plano", "/calendar?aba=objetivo", "/calendar?aba=comparar"],
  arquivos: [
    "apps/web/app/calendar/layout.tsx",
    "apps/web/app/calendar/page.tsx",
    "apps/web/components/calendar/TrainingCalendar.tsx",
    "apps/web/components/ui/BackButton.tsx",
    "apps/web/components/coach/ProcessingPanel.tsx",
    "apps/web/components/coach/GoalPlanPanel.tsx",
    "apps/web/components/coach/AdherencePanel.tsx",
    "apps/web/components/coach/WeekPlans.tsx",
    "apps/web/lib/useFocusTrap.ts",
    "apps/web/lib/api.ts",
    "apps/api/kactus_api/routers/coach.py",
  ],
  diagramas: [
    {
      titulo: "Mês ou semana, painel do dia e situação de cada treino",
      mermaid: `
flowchart TD
  IN("Abre Calendário"):::acao --> ME[/"GET /auth/me"/]:::api
  ME -->|sem sessão| LOGIN["/login"]:::tela
  ME -->|ok| ACT[/"GET /activities · páginas de 500<br/>até acabar"/]:::api
  IN --> VOLTA("← Voltar"):::acao --> ANT{"Tem tela anterior?"}:::decisao
  ANT -->|sim| PREV["Tela de onde veio"]:::tela
  ANT -->|não| DASH["/dashboard"]:::tela
  IN --> ABA{"Aba"}:::decisao
  ABA -->|Plano ?aba=plano| P["Plano de treino"]:::tela
  ABA -->|Objetivo ?aba=objetivo| OBJ["Fases até a prova"]:::tela
  ABA -->|Comparar ?aba=comparar| CMPA["Planejado × feito"]:::tela
  ABA -->|Calendário| VIS{"Mês · Semana"}:::decisao
  VIS -->|Mês| CAL["Mês com os dias vizinhos<br/>etiquetas: ícone + nome + km"]:::tela
  VIS -->|Semana| SEM["Semana: 7 colunas com o detalhe<br/>no celular, um dia por linha"]:::tela
  CAL --> PL[/"GET /coach/plan?start=…&end=…<br/>do intervalo na tela"/]:::api
  SEM --> PL
  ACT -->|erro| ERR["Não consegui carregar tudo"]:::erro
  PL -->|erro| ERR
  CAL --> NAV("‹ › ou Hoje"):::acao --> PL
  CAL --> VIZ("Dia do mês vizinho"):::acao --> PL
  CAL --> SIT{"Situação do treino"}:::decisao
  SIT -->|status done| OK["✓ Concluído · verde"]:::ok
  SIT -->|status skipped ou já passou| PERD["✕ Perdido · vermelho"]:::erro
  SIT -->|é hoje| HOJE["● Hoje · verde-limão"]:::estado
  SIT -->|futuro| PLAN["○ Planejado · cinza"]:::estado
  SIT -->|descanso ou folga| DESC["· Descanso"]:::estado
  CAL --> DIA("Tocar no dia · setas + Enter"):::acao --> LARG{"Tela de 1024 px ou mais?"}:::decisao
  SEM --> DIA
  LARG -->|sim| LADO["Painel do dia à direita"]:::tela
  LARG -->|não| DET["Gaveta do dia"]:::tela
  LADO --> VS("Ver semana"):::acao --> SEM
  DET --> VS
  DET -->|✕, Esc ou tocar fora| CAL
  LADO --> VER("Ver o treino feito → · atividade"):::acao --> ATV["/activities/id"]:::tela
  DET --> VER
`,
    },
    {
      titulo: "Abas Plano, Objetivo e Comparar",
      mermaid: `
flowchart TD
  P2["Aba Plano"]:::tela --> GS("Gerar plano da semana"):::acao --> GSA[/"POST /coach/plan/generate"/]:::api
  GSA --> IA1{{"Duni monta os 7 dias"}}:::ia --> OK1["Plano da semana pronto: N treinos<br/>detalhe na aba Comparar"]:::ok
  P2 --> GO("Gerar plano do objetivo"):::acao --> GOA[/"POST /coach/goal-plan/generate"/]:::api
  GOA --> IA2{{"Duni monta até a prova"}}:::ia --> OK2["Plano até a prova pronto: N treinos<br/>fases na aba Objetivo"]:::ok
  GSA -->|erro| E["Erro da Duni (título + explicação)"]:::erro
  GOA -->|erro| E
  OK1 --> REC[["Busca o período de novo"]]:::calc --> CALN["Aba Calendário atualizada"]:::tela
  OK2 --> REC
  P2 --> GPP["Topo do Plano do objetivo<br/>prova, ritmos, alvo, o que a Duni levou em conta (área 10)"]:::tela
  OBJ2["Aba Objetivo"]:::tela --> TEM{"Tem plano do objetivo?"}:::decisao
  TEM -->|sim| FAS["Fases · km por semana · treinos da semana tocada (área 10)"]:::tela
  TEM -->|não| SEMP["Ainda não há plano do objetivo<br/>Ir para Plano"]:::estado
  SEMP --> P2
  CMP2["Aba Comparar"]:::tela --> ADHA[/"GET /coach/plan/adherence?days=14"/]:::api
  ADHA --> PLC["Placar: N de M cumpridos<br/>km planejados × feitos · um quadradinho por treino"]:::tela
  CMP2 --> WP["Esta semana: Plano da semana<br/>Do objetivo · Da semana · Objetivo × Agora (área 10)"]:::tela
  ADHA --> LST["Treino a treino: dia, nome, km plan. → feito, selo"]:::tela
  LST --> ABRE("Toca na linha"):::acao --> DETA["Planejado × feito + Duni + Ver treino"]:::tela
  WP -->|editar, trocar, usar a semana livre| REC
`,
    },
  ],
  inventario: [
    { tipo: "tela", nome: "Calendário de treinos", acao: "Cabeçalho 'Treinos · Calendário de treinos'. Item do menu logo depois de Atividades; no celular, na barra de baixo.", msg: "O que a Duni planejou e o que você fez, dia a dia.", onde: "apps/web/app/calendar/page.tsx:66", no: "IN" },
    { tipo: "botão", nome: "← Voltar", acao: "Volta para a tela anterior; aberto direto (sem tela anterior), vai ao Dashboard. Existe porque no iPhone, como app, não há o voltar do navegador.", onde: "apps/web/components/ui/BackButton.tsx:13", no: "VOLTA,ANT,PREV,DASH" },
    { tipo: "aba", nome: "Calendário · Plano · Objetivo · Comparar", acao: "Ficam na URL (?aba=plano|objetivo|comparar; sem nada, Calendário), então o link direto e o voltar do navegador funcionam. Todas ficam montadas: trocar não perde o mês nem um plano sendo gerado. No celular as quatro cabem numa linha (se não couberem, rolam de lado). 'Montar o plano' do Dashboard e 'Ver o plano de treino' da Duni abrem a aba Plano; 'Ver o plano até a prova' abre Objetivo; 'Ver todos no calendário' do Planejado × feito abre Comparar.", onde: "apps/web/app/calendar/page.tsx:47", no: "ABA,OBJ,CMPA" },
    { tipo: "API", nome: "Atividades", acao: "Busca todas, de 500 em 500, para andar por qualquer mês.", api: "GET /activities?limit=500&offset=N", onde: "apps/web/app/calendar/page.tsx:36", no: "ACT" },
    { tipo: "API", nome: "Planejado do intervalo", acao: "O calendário avisa o intervalo na tela (o mês com os dias vizinhos, ou a semana) e a página busca o planejado dele; busca de novo ao trocar de período ou quando um plano muda.", api: "GET /coach/plan?start=…&end=…", onde: "apps/web/app/calendar/page.tsx:121", no: "PL" },
    { tipo: "erro", nome: "Não consegui carregar tudo", msg: "Verifique a conexão ou se a API está rodando. O calendário pode estar incompleto.", onde: "apps/web/app/calendar/page.tsx:217", no: "ERR" },
    { tipo: "card", nome: "Feito · Plano · Cumpriu", acao: "Uma linha discreta abaixo do título: km e treinos feitos, km e treinos planejados (sem descanso) e quantos dos que já passaram foram cumpridos. Vale para o mês (sem os dias vizinhos) ou para a semana.", onde: "apps/web/components/calendar/TrainingCalendar.tsx:332" },
    { tipo: "botão", nome: "‹ › · Hoje", acao: "Anda um mês (vai para hoje, se for o mês atual, ou para o dia 1) ou uma semana; Hoje aparece fora do período atual e volta para ele.", onde: "apps/web/components/calendar/TrainingCalendar.tsx:350", no: "NAV" },
    { tipo: "filtro", nome: "Mês · Semana", acao: "Seletor ao lado das setas. Semana: 7 colunas altas com todos os treinos do dia e o detalhe (intensidade, ritmo, FC; na atividade, ritmo e FC); no celular, um dia por linha.", onde: "apps/web/components/calendar/TrainingCalendar.tsx:406", no: "VIS,SEM" },
    { tipo: "seção", nome: "Grade do mês", acao: "Quadro de fundo claro (o resto do app continua escuro), com os dias da semana numa faixa no topo e os dias separados por linhas finas. No computador e tablet, até duas etiquetas por dia (ícone do esporte, nome em até duas linhas e os km embaixo; '+N' se tiver mais), coloridas pela situação. A atividade ligada a um treino planejado aparece só nele; a feita sem plano vira etiqueta verde. Hoje: borda verde, número verde e um ponto no canto. No celular, pontinhos com a cor da situação (vazio se só planejado).", onde: "apps/web/components/calendar/TrainingCalendar.tsx:322", no: "CAL" },
    { tipo: "seção", nome: "Dias dos meses vizinhos", acao: "Antes do dia 1 e depois do último dia aparecem os dias do mês anterior e do seguinte, só com o número apagado, para a grade não ficar com buracos. Tocar num deles vai para aquele mês, já com o dia escolhido.", onde: "apps/web/components/calendar/TrainingCalendar.tsx:447", no: "VIZ" },
    { tipo: "cálculo", nome: "Situação do treino", acao: "Descanso ou folga → Descanso; status done → Concluído; skipped ou data passada → Perdido; hoje → Hoje; futuro → Planejado. O servidor marca o passado ao listar (reconcile_plan).", onde: "apps/web/components/calendar/TrainingCalendar.tsx:43", no: "SIT,OK,PERD,HOJE,PLAN,DESC" },
    { tipo: "regra", nome: "Teclado", acao: "Um Tab entra na grade; setas andam pelos dias (e passam para o mês ou a semana vizinha), Home e End vão ao primeiro e ao último dia do período, Enter abre o dia.", onde: "apps/web/components/calendar/TrainingCalendar.tsx:369", no: "DIA" },
    { tipo: "seção", nome: "Painel do dia (computador)", acao: "A partir de 1024 px, o dia escolhido fica num painel claro à direita da grade ('TER, 21 OUT'), sem cobrir nada: treino planejado (de qual plano veio, situação, esporte, intensidade, km e tempo, ritmo e FC, objetivo) e atividades do dia (hora, km, tempo, ritmo e FC). O ✕ esconde o painel; tocar num dia mostra de novo.", onde: "apps/web/components/calendar/TrainingCalendar.tsx:537", no: "LARG,LADO" },
    { tipo: "modal", nome: "Gaveta do dia (celular e tablet)", acao: "Abaixo de 1024 px, o mesmo detalhe abre numa gaveta clara: por baixo no celular, pela direita no tablet. Prende o foco; fecha no ✕, no Esc ou tocando fora, e o foco volta ao dia.", onde: "apps/web/components/calendar/TrainingCalendar.tsx:549", no: "DET" },
    { tipo: "botão", nome: "Ver semana", acao: "No painel e na gaveta, na visão Mês: troca para a semana do dia escolhido.", onde: "apps/web/components/calendar/TrainingCalendar.tsx:364", no: "VS" },
    { tipo: "link", nome: "Ver o treino feito → · atividade do dia", acao: "Abre o detalhe da atividade.", onde: "apps/web/components/calendar/TrainingCalendar.tsx:202", no: "VER,ATV" },
    { tipo: "vazio", nome: "Dia sem nada", acao: "Ícone de calendário no centro do painel ou da gaveta.", msg: "Nenhum treino registrado · Você não realizou nenhum treino neste dia. (no futuro: Nenhum treino planejado · Nada planejado para este dia.)", onde: "apps/web/components/calendar/TrainingCalendar.tsx:227" },
    { tipo: "seção", nome: "Legenda", acao: "Pontos: Concluído (verde) · Planejado (cinza) · Perdido (vermelho) · Hoje (verde-limão).", msg: "Toque num dia para ver os detalhes.", onde: "apps/web/components/calendar/TrainingCalendar.tsx:531" },
    { tipo: "seção", nome: "Plano de treino", acao: "A aba Plano: os dois botões de gerar, os avisos (com link para as abas Objetivo e Comparar) e o topo do Plano do objetivo.", msg: "A Duni monta os treinos; eles aparecem na aba Calendário e no resumo do dashboard.", onde: "apps/web/app/calendar/page.tsx:234", no: "P,P2,GPP" },
    { tipo: "botão", nome: "Gerar plano da semana", acao: "Os 7 dias a partir de hoje; ao terminar, o mês é buscado de novo.", api: "POST /coach/plan/generate", msg: "Gerando… · Plano da semana pronto: N treinos", onde: "apps/web/app/calendar/page.tsx:180", no: "GS,GSA,IA1,OK1,REC" },
    { tipo: "botão", nome: "Gerar plano do objetivo", acao: "Todos os treinos até a prova, com os dias por semana do plano atual (3 se não houver).", api: "POST /coach/goal-plan/generate", msg: "Montando… · Plano até a prova pronto: N treinos", onde: "apps/web/app/calendar/page.tsx:137", no: "GO,GOA,IA2,OK2" },
    { tipo: "carregando", nome: "Duni analisando", acao: "Quadro com os passos que a Duni lê enquanto monta o plano.", msg: "Montando o plano da semana… · Montando o plano até a prova…", onde: "apps/web/components/coach/ProcessingPanel.tsx:18" },
    { tipo: "erro", nome: "Erro ao gerar", acao: "Mesmo texto de erro da Duni (cota, chave, formato…).", onde: "apps/web/app/calendar/page.tsx:257", no: "E" },
    { tipo: "seção", nome: "Fases até a prova (aba Objetivo)", acao: "Base, construção, pico e polimento, o gráfico de km por semana e os treinos da semana tocada (detalhes na área 10).", onde: "apps/web/app/calendar/page.tsx:283", no: "OBJ2,TEM,FAS" },
    { tipo: "vazio", nome: "Objetivo sem plano", acao: "Botão Ir para Plano.", msg: "Ainda não há plano do objetivo · A Duni monta as fases quando você gera o plano até a prova.", onde: "apps/web/app/calendar/page.tsx:289", no: "SEMP" },
    { tipo: "card", nome: "Placar · últimos 14 dias (aba Comparar)", acao: "Quantos dos treinos planejados com desfecho foram cumpridos, km planejados × feitos e um quadradinho por treino, do mais antigo ao mais recente: verde cumpriu, amarelo fez a mais ou a menos, vermelho pulou.", api: "GET /coach/plan/adherence?days=14", msg: "Nenhum treino planejado nos últimos 14 dias.", onde: "apps/web/components/coach/AdherencePanel.tsx:192", no: "CMP2,ADHA,PLC" },
    { tipo: "seção", nome: "Esta semana (aba Comparar)", acao: "O Plano da semana com as vistas Do objetivo, Da semana e Objetivo × Agora (área 10); editar, trocar ou usar a semana livre atualiza o calendário.", onde: "apps/web/app/calendar/page.tsx:306", no: "WP,CALN" },
    { tipo: "seção", nome: "Treino a treino (aba Comparar)", acao: "Uma linha por treino: dia, nome, km planejado → feito e os selos. Tocar abre o planejado ao lado do feito, o comentário da Duni (pedido só no clique) e Ver treino.", msg: "Quando houver treino planejado nos últimos dias, ele aparece aqui com o que você fez.", onde: "apps/web/components/coach/AdherencePanel.tsx:134", no: "LST,ABRE,DETA" },
  ],
});
