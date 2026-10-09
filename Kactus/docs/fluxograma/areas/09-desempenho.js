// Área 09 — Desempenho (antigas abas Carga e Previsões).
KACTUS_MAPA.areas.push({
  id: "desempenho",
  n: 9,
  titulo: "Desempenho",
  resumo:
    "Responde 'o que fazer hoje, como o corpo está e se estou evoluindo', em linguagem simples. O técnico (CTL, ATL, TSB, ACWR, simulador e fórmulas) fica num 'Modo avançado' recolhido. Sem treinos suficientes, a página inteira vira um convite para importar.",
  rotas: ["/performance", "/performance#provas", "/metrics → /performance", "/predictions → /performance"],
  arquivos: [
    "apps/web/app/performance/page.tsx",
    "apps/web/components/performance/TodayPanel.tsx",
    "apps/web/components/performance/StatusTiles.tsx",
    "apps/web/components/performance/RacePredictions.tsx",
    "apps/web/components/performance/EvolutionChart.tsx",
    "apps/web/components/performance/TrainingQuality.tsx",
    "apps/web/components/performance/ConsistencyHeatmap.tsx",
    "apps/web/components/performance/AdvancedSection.tsx",
    "apps/api/kactus_api/routers/metrics.py",
    "apps/api/kactus_api/routers/predictions.py",
    "apps/api/kactus_api/metrics/summary.py",
    "apps/api/kactus_api/metrics/predictions.py",
  ],
  diagramas: [
    {
      titulo: "Seções e de onde vêm os dados",
      mermaid: `
flowchart TD
  IN("Abre /performance"):::acao --> APIS[/"GET /metrics/summary · GET /predictions/overview<br/>GET /metrics/heatmap?days=112 · GET /activities 500 do ano<br/>GET /metrics/load?days=90"/]:::api
  APIS --> HD{"Há carga ou CTL<br/>em algum dia?"}:::decisao
  HD -->|não| VZ["Ainda não há treinos para analisar<br/>Importar atividades →"]:::estado
  HD -->|sim| S1["Hoje + corrida nos próximos 7 dias"]:::tela
  S1 --> S2["Forma · Risco de lesão · Condicionamento"]:::tela
  S2 --> S3["Previsões de prova 5K a 42K"]:::tela
  S3 --> S4["Evolução<br/>Volume semanal ou Ritmo mensal"]:::tela
  S4 --> S5["Leve × moderado × forte · 28 dias<br/>Efeito de treino · 7 dias"]:::tela
  S5 --> S6["Constância · 16 semanas"]:::tela
  S6 --> S7("Modo avançado ▾"):::acao
  S7 --> ADV["CTL · ATL · TSB · ACWR<br/>gráficos, simulador, fórmulas"]:::tela
  ADV --> PER("Período 30d a 1a"):::acao --> RL[/"GET /metrics/load?days=N"/]:::api
  ADV --> SIM("Simular"):::acao --> PS[/"POST /predictions/simulate"/]:::api
  APIS -->|previsões ou carga falharam| ER["Erro ao carregar"]:::erro
`,
    },
  ],
  inventario: [
    { tipo: "tela", nome: "Desempenho", msg: "O que fazer hoje, como o corpo está, suas previsões de prova e a sua evolução.", onde: "apps/web/app/performance/page.tsx:63" },
    { tipo: "API", nome: "Dados da página", api: "GET /metrics/summary · GET /predictions/overview · GET /metrics/heatmap?days=112 · GET /activities?limit=500&days=365 · GET /metrics/load?days=90", onde: "apps/web/app/performance/page.tsx:42", no: "APIS" },
    { tipo: "vazio", nome: "Sem treinos para analisar", msg: "Ainda não há treinos para analisar · Importe seus treinos: com algumas semanas de histórico, esta página diz o que fazer hoje…", onde: "apps/web/app/performance/page.tsx:74", no: "HD,VZ" },
    { tipo: "erro", nome: "Erro ao carregar", msg: "Erro ao carregar as previsões · Erro ao carregar a carga", onde: "apps/web/app/performance/page.tsx:72", no: "ER" },
    { tipo: "card", nome: "Hoje", acao: "Recomendação do dia com cor e explicação (Descanso, Treino moderado, Pode treinar forte, Retomada gradual…).", api: "GET /metrics/summary", onde: "apps/web/components/performance/TodayPanel.tsx:16", no: "S1" },
    { tipo: "card", nome: "Corrida nos próximos 7 dias", acao: "Faixa segura em km; sem base mostra 'Volte aos poucos' ou 'Sem corridas recentes'. Embaixo, últimos 7 dias × média de 4 semanas.", msg: "Faixa segura pela sua carga das últimas 4 semanas.", onde: "apps/web/components/performance/TodayPanel.tsx:26" },
    { tipo: "card", nome: "Forma · Risco de lesão · Condicionamento", acao: "Três faixas coloridas; o número técnico aparece ao passar o mouse.", onde: "apps/web/components/performance/StatusTiles.tsx:22", no: "S2" },
    { tipo: "card", nome: "Previsões de prova", acao: "5K, 10K, Meia, Maratona: tempo, ritmo médio, VDOT e confiança (Tempo real, Alta confiança, Estimado).", api: "GET /predictions/overview", onde: "apps/web/components/performance/RacePredictions.tsx:32", no: "S3" },
    { tipo: "vazio", nome: "Sem recorde de corrida", msg: "Nenhum recorde de corrida encontrado · Importe atividades de corrida para gerar previsões.", onde: "apps/web/components/performance/RacePredictions.tsx:42" },
    { tipo: "aba", nome: "Volume semanal · Ritmo mensal", acao: "Volume: km de corrida, bike e caminhada + horas, 16 semanas. Ritmo: pace médio por mês das corridas de 3 km+, com tendência.", onde: "apps/web/components/performance/EvolutionChart.tsx:43", no: "S4" },
    { tipo: "vazio", nome: "Histórico insuficiente", msg: "São necessários pelo menos 2 meses com corridas de 3 km ou mais.", onde: "apps/web/components/performance/EvolutionChart.tsx:119" },
    { tipo: "card", nome: "Leve × moderado × forte · 28 dias", acao: "Tempo de corrida por intensidade pela FC.", msg: "Boa distribuição: a base está sendo feita no leve. · Pouco tempo no leve: treinos fáceis mais fáceis ajudam a evoluir sem acumular cansaço.", onde: "apps/web/components/performance/TrainingQuality.tsx:17", no: "S5" },
    { tipo: "card", nome: "Efeito de treino · 7 dias", acao: "Média aeróbica do relógio e contagem dos benefícios.", onde: "apps/web/components/performance/TrainingQuality.tsx:45" },
    { tipo: "card", nome: "Constância · últimas 16 semanas", acao: "Mapa de calor da carga por dia.", msg: "Sem treinos nas últimas 16 semanas", onde: "apps/web/components/performance/ConsistencyHeatmap.tsx:106", no: "S6" },
    { tipo: "seção", nome: "Modo avançado", acao: "Recolhido. KPIs CTL (42 dias), ATL (7 dias), TSB, ACWR com régua 0,8–1,3; gráficos Condicionamento × cansaço, Disposição (TSB), Salto de carga (ACWR).", onde: "apps/web/components/performance/AdvancedSection.tsx:201", no: "S7,ADV" },
    { tipo: "filtro", nome: "Período do modo avançado", acao: "30d, 60d, 90d (padrão), 6m, 1a.", api: "GET /metrics/load?days=N", onde: "apps/web/components/performance/AdvancedSection.tsx:16", no: "PER,RL" },
    { tipo: "campo", nome: "Simulador de forma futura", acao: "Período 7/14/21/30 dias e TSS diário (0 a 300). Mostra CTL, ATL e TSB finais e o gráfico.", api: "POST /predictions/simulate", msg: "Calculando… · Erro na simulação", onde: "apps/web/components/performance/AdvancedSection.tsx:96", no: "SIM,PS" },
    { tipo: "seção", nome: "Como tudo é calculado", acao: "Texto com as fórmulas de TSS, CTL/ATL/TSB, risco, Riegel/VDOT e simulador.", onde: "apps/web/components/performance/AdvancedSection.tsx:338" },
    { tipo: "API", nome: "Resumo em linguagem simples", acao: "Hoje, semana, média de 4 semanas, faixa segura, intensidade 28d, efeito 7d, 16 semanas.", api: "GET /metrics/summary", onde: "apps/api/kactus_api/routers/metrics.py:57" },
    { tipo: "API", nome: "Carga diária", api: "GET /metrics/load", onde: "apps/api/kactus_api/routers/metrics.py:24" },
    { tipo: "API", nome: "Mapa de calor", api: "GET /metrics/heatmap", onde: "apps/api/kactus_api/routers/metrics.py:63" },
    { tipo: "API", nome: "Visão geral de previsões", acao: "Previsões de prova, risco de lesão e recomendação de hoje.", api: "GET /predictions/overview", onde: "apps/api/kactus_api/routers/predictions.py:26" },
    { tipo: "API", nome: "Simular TSB", api: "POST /predictions/simulate", onde: "apps/api/kactus_api/routers/predictions.py:63" },
  ],
});
