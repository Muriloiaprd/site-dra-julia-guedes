// Área 13 — Cálculos: do arquivo do relógio até prontidão, risco e previsões.
KACTUS_MAPA.areas.push({
  id: "calculos",
  n: 13,
  titulo: "Cálculos",
  resumo:
    "Quase tudo que o Kactus mostra sai de fórmulas no servidor, sem IA. Do arquivo vêm o tempo em movimento, o pace, o GAP e a deriva. Cada treino vira uma carga (TSS), e a carga diária gera condicionamento (CTL), cansaço (ATL), disposição (TSB) e salto de carga (ACWR). Disso saem a recomendação de hoje, o risco de lesão e a faixa segura de km. Os recordes alimentam as previsões de prova. A prontidão do dashboard é calculada no navegador.",
  rotas: [],
  arquivos: [
    "apps/api/kactus_api/parsers/base.py",
    "apps/api/kactus_api/metrics/derived.py",
    "apps/api/kactus_api/metrics/garmin.py",
    "apps/api/kactus_api/metrics/basic.py",
    "apps/api/kactus_api/metrics/load.py",
    "apps/api/kactus_api/metrics/records.py",
    "apps/api/kactus_api/metrics/predictions.py",
    "apps/api/kactus_api/metrics/summary.py",
    "apps/web/lib/athlete.ts",
  ],
  diagramas: [
    {
      titulo: "Cadeia de cálculos",
      mermaid: `
flowchart TD
  FILE[/"Pontos do arquivo<br/>tempo, GPS, distância, FC, cadência, potência"/]:::api
  FILE --> MOV[["Tempo em movimento<br/>sem pausas de 30 s nem trechos parados"]]:::calc
  FILE --> CAD[["Cadência por perna × 2<br/>esportes de passada"]]:::calc
  MOV --> PACE[["Pace e velocidade médios"]]:::calc
  FILE --> GAP[["GAP: custo de Minetti pela inclinação<br/>janela 50 m, suavização 30 m, limite 30%"]]:::calc
  FILE --> DRIFT[["Deriva cardíaca<br/>corrida contínua de 30+ min"]]:::calc
  FILE --> WALK[["Tempo andando<br/>cadência abaixo de 140 ppm"]]:::calc
  FILE --> SPL[["Splits por km e zonas de FC"]]:::calc
  FILE --> BEST[["Melhores esforços<br/>1, 5, 10, 21, 42 km · 100, 400 m nado<br/>potência 5, 20, 60 min"]]:::calc
  BEST --> REC[("Recordes pessoais")]:::ext
  MOV --> TSS[["TSS do treino"]]:::calc
  TSS --> DAY[["Carga do dia"]]:::calc
  DAY --> CTL[["CTL · média exponencial 42 dias"]]:::calc
  DAY --> ATL[["ATL · média exponencial 7 dias"]]:::calc
  CTL --> TSB[["TSB = CTL − ATL"]]:::calc
  ATL --> TSB
  DAY --> ACWR[["ACWR = média 7 d ÷ média 28 d<br/>vazio se a média 28 d for menor que 10"]]:::calc
  TSB --> HOJE{"Recomendação de hoje"}:::decisao
  ACWR --> HOJE
  CTL --> HOJE
  TSB --> RISK{"Risco de lesão · 14 dias"}:::decisao
  ACWR --> RISK
  DAY --> SAFE[["Faixa segura de km<br/>0,8 a 1,3 × carga média de 28 dias"]]:::calc
  TSB --> READY[["Prontidão no dashboard"]]:::calc
  ACWR --> READY
  REC --> PRED[["Previsões de prova<br/>Riegel + VDOT"]]:::calc
`,
    },
    {
      titulo: "Recomendação de hoje",
      mermaid: `
flowchart TD
  M{"Há métrica de hoje?"}:::decisao -->|não| U["Sem dados"]:::estado
  M -->|sim| C{"CTL menor que 10?"}:::decisao
  C -->|sim| R1["Retomada gradual"]:::ok
  C -->|não| A{"ACWR maior que 1,5<br/>ou TSB menor que −30?"}:::decisao
  A -->|sim| R2["Descanso"]:::erro
  A -->|não| T1{"TSB maior que 5?"}:::decisao
  T1 -->|sim| R3["Pode treinar forte"]:::ok
  T1 -->|não| T2{"TSB de −10 a 5?"}:::decisao
  T2 -->|sim| R4["Treino moderado"]:::estado
  T2 -->|não| R5["Treino leve"]:::estado
`,
    },
  ],
  inventario: [
    { tipo: "cálculo", nome: "Tempo em movimento", acao: "Soma os intervalos em que havia movimento: ignora buracos de mais de 30 s parado e trechos abaixo da velocidade mínima do esporte. Vazio para natação, força ou arquivo sem velocidade, distância e GPS.", onde: "apps/api/kactus_api/parsers/base.py:119", no: "MOV" },
    { tipo: "cálculo", nome: "Cadência por perna", acao: "O FIT grava passos de uma perna; em esportes de passada o valor é dobrado (resumo, voltas e pontos).", onde: "apps/api/kactus_api/metrics/derived.py:36", no: "CAD" },
    { tipo: "cálculo", nome: "Pace ajustado (GAP)", acao: "Converte o ritmo para o equivalente no plano pelo custo energético de Minetti; inclinação em janela de 50 m, altitude suavizada em 30 m, limitada a ±30%.", onde: "apps/api/kactus_api/metrics/derived.py:113", no: "GAP" },
    { tipo: "cálculo", nome: "Deriva cardíaca", acao: "Eficiência (ritmo/FC) da 2ª metade contra a 1ª; só em corrida contínua de 30+ min, pulando os 5 primeiros.", onde: "apps/api/kactus_api/metrics/derived.py:125", no: "DRIFT" },
    { tipo: "cálculo", nome: "Tempo andando", acao: "Na corrida, trechos com cadência abaixo de 140 passos/min e velocidade acima de 0,5 m/s.", onde: "apps/api/kactus_api/metrics/garmin.py:51", no: "WALK" },
    { tipo: "cálculo", nome: "Splits e zonas de FC", acao: "Splits a cada 1000 m com pace, GAP, FC e subida. Zonas: manuais do perfil, Karvonen (com FC de repouso) ou % da máxima.", onde: "apps/api/kactus_api/metrics/basic.py:46", no: "SPL" },
    { tipo: "cálculo", nome: "Recordes", acao: "Melhores janelas de 1, 5, 10, 21,1 e 42,2 km na corrida; 100 e 400 m na natação; potência de 5, 20 e 60 min e pico; maiores longão, pedal e nado; FC máxima. Recalculados ao excluir ou restaurar.", onde: "apps/api/kactus_api/metrics/records.py:37", no: "BEST,REC" },
    { tipo: "cálculo", nome: "TSS", acao: "Bike com potência e FTP: TSS de Coggan. Com FC e FC máxima: horas × (FC/FCmáx)² × 100. Senão: 50 por hora. Sempre sobre o tempo em movimento.", onde: "apps/api/kactus_api/metrics/load.py:43", no: "TSS" },
    { tipo: "cálculo", nome: "Carga diária, CTL, ATL, TSB", acao: "Soma do TSS por dia; médias exponenciais de 42 e 7 dias; TSB é a diferença. Recalculado da data do treino em diante.", onde: "apps/api/kactus_api/metrics/load.py:70", no: "DAY,CTL,ATL,TSB" },
    { tipo: "cálculo", nome: "ACWR", acao: "Média dos últimos 7 dias ÷ média dos últimos 28; vazio se a média de 28 dias for menor que 10.", onde: "apps/api/kactus_api/metrics/load.py:175", no: "ACWR" },
    { tipo: "cálculo", nome: "Recomendação de hoje", acao: "Retomada gradual, Descanso, Pode treinar forte, Treino moderado ou Treino leve, pela ordem do diagrama.", onde: "apps/api/kactus_api/metrics/predictions.py:160", no: "HOJE,M,C,A,T1,T2,R1,R2,R3,R4,R5,U" },
    { tipo: "cálculo", nome: "Risco de lesão (servidor)", acao: "Alto se ACWR > 1,5 ou TSB < −30 em 3+ dos últimos 14; moderado se a carga da semana passou 30% da anterior (com base mínima).", onde: "apps/api/kactus_api/metrics/predictions.py:90", no: "RISK" },
    { tipo: "cálculo", nome: "Risco de lesão (dashboard)", acao: "No navegador, só pelo ACWR do último dia: > 1,5 Alto, > 1,3 Atenção, 0,8–1,3 Zona ideal, < 0,8 Subcarga.", onde: "apps/web/lib/athlete.ts:196" },
    { tipo: "cálculo", nome: "Faixa segura de km", acao: "Km de corrida nos próximos 7 dias que mantém a carga entre 0,8 e 1,3 × a média de 28 dias, descontando os outros esportes. Sem base: 'Volte aos poucos'.", onde: "apps/api/kactus_api/metrics/summary.py:108", no: "SAFE" },
    { tipo: "cálculo", nome: "Meta semanal × faixa segura", acao: "Km de corrida de segunda até hoje contra a meta; a meta é comparada com a faixa segura dos próximos 7 dias (dentro, acima, abaixo ou sem faixa).", onde: "apps/api/kactus_api/metrics/summary.py:85" },
    { tipo: "cálculo", nome: "Ritmo × calor", acao: "Corrida e trilha (sem esteira) de 3 km+ com temperatura, 365 dias; ritmo e FC por faixa ponderados pelos km; comparação entre a faixa mais fria e a mais quente com 3+ corridas cada.", onde: "apps/api/kactus_api/metrics/heat.py:35" },
    { tipo: "cálculo", nome: "Resumo do mês", acao: "Dia local de cada treino; por esporte pela categoria da análise (corrida com pace de caminhada conta como caminhada); variação em % contra o mês anterior.", onde: "apps/api/kactus_api/metrics/month.py:58" },
    { tipo: "cálculo", nome: "Prontidão", acao: "72 + 1,1 × TSB, menos (ACWR − 1,3) × 80 se passar de 1,3; entre 8 e 98.", onde: "apps/web/lib/athlete.ts:116", no: "READY" },
    { tipo: "cálculo", nome: "Previsões de prova", acao: "Se já existe recorde na distância, usa ele (confiança 100%); senão projeta pelo Riegel (T2 = T1 × (D2/D1)^1,06) e mostra o VDOT de Jack Daniels.", onde: "apps/api/kactus_api/metrics/predictions.py:47", no: "PRED" },
    { tipo: "cálculo", nome: "Simulador", acao: "Projeta CTL, ATL e TSB repetindo um TSS diário fixo.", onde: "apps/api/kactus_api/metrics/predictions.py:138" },
    { tipo: "cálculo", nome: "Carga interna (sRPE)", acao: "Esforço do check-in × minutos em movimento.", onde: "apps/api/kactus_api/routers/activities.py:370" },
    { tipo: "cálculo", nome: "Minutos de intensidade", acao: "Z2–Z3 contam 1×, Z4–Z5 contam 2× (no painel do relógio).", onde: "apps/web/components/activity/WatchPanel.tsx:57" },
  ],
});
