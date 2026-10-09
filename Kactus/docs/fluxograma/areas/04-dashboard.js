// Área 04 — Dashboard ("centro de comando").
KACTUS_MAPA.areas.push({
  id: "dashboard",
  n: 4,
  titulo: "Dashboard",
  resumo:
    "Primeira tela depois do login. Carrega em etapas: primeiro confere a sessão, depois busca 500 atividades do último ano e os recordes, e em paralelo as previsões, a carga dos últimos 60 dias e os planos da Duni. Os cartões respondem a três perguntas: como estou, o que fiz e o que fazer. Clicar num treino abre um resumo rápido (modal) com link para a página completa.",
  rotas: ["/dashboard"],
  arquivos: [
    "apps/web/app/dashboard/page.tsx",
    "apps/web/components/dashboard/DashboardHeader.tsx",
    "apps/web/components/dashboard/AthleteStatus.tsx",
    "apps/web/components/dashboard/CoachCard.tsx",
    "apps/web/components/dashboard/WeekStrip.tsx",
    "apps/web/components/dashboard/PerformanceChart.tsx",
    "apps/web/components/dashboard/LastActivity.tsx",
    "apps/web/components/dashboard/Records.tsx",
    "apps/web/components/dashboard/GoalCard.tsx",
    "apps/web/components/dashboard/MonthCalendar.tsx",
    "apps/web/components/dashboard/RecentActivities.tsx",
    "apps/web/components/dashboard/ActivityModal.tsx",
    "apps/web/lib/athlete.ts",
  ],
  diagramas: [
    {
      titulo: "Carregamento e estados",
      mermaid: `
flowchart TD
  IN("Abre /dashboard"):::acao --> ME[/"GET /auth/me<br/>GET /profile"/]:::api
  ME -->|sem token| LOGIN["/login"]:::tela
  ME -->|há token, falhou| NET["Não foi possível verificar sua sessão<br/>Tentar de novo"]:::erro
  ME -->|ok| WAIT(["Carregando centro de comando…"]):::estado
  WAIT -->|passou de 2 s| SLOW(["Na primeira abertura do dia<br/>pode levar alguns segundos"]):::estado
  ME --> ACTS[/"GET /activities · 500 do último ano<br/>GET /records"/]:::api
  ME --> PAR[/"GET /predictions/overview<br/>GET /metrics/load?days=60<br/>GET /coach/plan?days_ahead=35<br/>GET /coach/plan/week · goal-plan · memories"/]:::api
  ACTS -->|falhou| ERR["Não foi possível carregar suas atividades<br/>Tentar de novo"]:::erro
  ACTS -->|ok| CARDS["Cartões montados"]:::ok
  ACTS --> DET5[/"GET /activities/id<br/>das 5 mais recentes, para os mapas"/]:::api
  PAR --> CARDS
  CARDS --> ALERT[["Alertas do sino"]]:::calc
`,
    },
    {
      titulo: "Cartões e para onde cada um leva",
      mermaid: `
flowchart LR
  H["Cabeçalho<br/>Olá, nome · sincronização · data"]:::tela
  H --> SINO("Sino de alertas"):::acao
  SINO --> AL{"Qual alerta"}:::decisao
  AL -->|risco| PERF["/performance"]:::tela
  AL -->|treino de hoje| DUNI["/coach"]:::tela
  AL -->|sem treinos há 7+ dias| IMP["/import"]:::tela
  AL -->|novo recorde| DET["/activities/id"]:::tela
  H --> ENG("Engrenagem e foto"):::acao --> PROF["/profile"]:::tela
  ST["Status do atleta<br/>prontidão e 4 indicadores"]:::tela -->|Análise completa| PERF
  ST -->|Status da Duni| DUNI
  CC["Duni · sua treinadora<br/>próximo treino"]:::tela -->|Ver treino ou Falar com a Duni| DUNI
  WK["Visão semanal<br/>7 dias"]:::tela -->|Atividades| ACTL["/activities"]:::tela
  ADH["Planejado × feito<br/>últimos 3 dias"]:::tela -->|Ver todos na Duni| DUNI
  EV["Evolução do desempenho<br/>gráfico"]:::tela -->|clique num ponto| MOD
  LA["Última atividade"]:::tela -->|clique| MOD
  LA -->|📤 Story| STY["Gerador de Story<br/>do último treino"]:::tela
  CAL["Calendário"]:::tela -->|dia com treino| MOD
  RC["Atividades recentes"]:::tela -->|clique| MOD
  RC -->|Ver todas| ACTL
  REC["Recordes pessoais"]:::tela -->|clique| DET
  GOAL["Próxima prova"]:::tela -->|Ver o plano até a prova| DUNI
  MOD["Modal da atividade"]:::tela -->|Ver página completa| DET
`,
    },
  ],
  inventario: [
    { tipo: "carregando", nome: "Carregando centro de comando", acao: "Até /auth/me responder. Passados 2 s, explica a espera.", msg: "Carregando centro de comando… · Na primeira abertura do dia pode levar alguns segundos — o servidor está acordando.", onde: "apps/web/app/dashboard/page.tsx:163", no: "WAIT,SLOW" },
    { tipo: "erro", nome: "Sessão não verificada", acao: "Há token, mas /auth/me não respondeu.", msg: "Não foi possível verificar sua sessão — verifique sua conexão. · Tentar de novo", onde: "apps/web/app/dashboard/page.tsx:156", no: "NET" },
    { tipo: "API", nome: "Atividades e recordes", acao: "Até 500 atividades dos últimos 365 dias e todos os recordes.", api: "GET /activities?limit=500&offset=0&days=365 · GET /records", onde: "apps/web/app/dashboard/page.tsx:71", no: "ACTS" },
    { tipo: "API", nome: "Previsões, carga e planos", acao: "Em paralelo, falhas ignoradas.", api: "GET /predictions/overview · GET /metrics/load?days=60 · GET /coach/plan?days_ahead=35 · GET /coach/plan/week", onde: "apps/web/app/dashboard/page.tsx:83", no: "PAR" },
    { tipo: "API", nome: "Detalhe das 5 recentes", acao: "Busca os pontos de GPS para desenhar os minimapas.", api: "GET /activities/{id}", onde: "apps/web/app/dashboard/page.tsx:93", no: "DET5" },
    { tipo: "carregando", nome: "Carregando seus dados", acao: "Aviso quando as atividades demoram mais de 2 s.", msg: "Carregando seus dados… Na primeira abertura do dia pode levar alguns segundos. O painel se completa sozinho.", onde: "apps/web/app/dashboard/page.tsx:187" },
    { tipo: "erro", nome: "Atividades não carregaram", acao: "Mostra o painel mesmo assim e oferece tentar de novo.", msg: "Não foi possível carregar suas atividades · Verifique sua conexão ou se a API está rodando.", onde: "apps/web/app/dashboard/page.tsx:195", no: "ERR" },
    { tipo: "seção", nome: "Cabeçalho", acao: "'Olá, primeiro nome' (esqueleto até o perfil chegar), estado da sincronização e data por extenso.", msg: "Sincronizando dados… · Falha na sincronização · Dados sincronizados · última atividade há N dias", onde: "apps/web/components/dashboard/DashboardHeader.tsx:298", no: "H" },
    { tipo: "botão", nome: "Sino de alertas", acao: "Abre o painel 'Alertas do sistema'; o número fica amarelo se houver alerta urgente. Fecha com clique fora ou Esc.", msg: "Tudo em ordem. Nenhum alerta no momento.", onde: "apps/web/components/dashboard/DashboardHeader.tsx:330", no: "SINO" },
    { tipo: "cálculo", nome: "Regras dos alertas", acao: "1) risco alto → 'Risco de lesão elevado'; 2) risco moderado → 'Atenção à carga de treino'; 3) treino planejado hoje → 'Treino de hoje: título'; 4) última atividade há 7+ dias → 'Sem atividades há N dias'; 5) recordes dos últimos 7 dias (até 2) → 'Novo recorde: …'.", onde: "apps/web/app/dashboard/page.tsx:134", no: "ALERT,AL" },
    { tipo: "link", nome: "Engrenagem e foto", acao: "Vão ao Perfil.", onde: "apps/web/components/dashboard/DashboardHeader.tsx:374", no: "ENG" },
    { tipo: "card", nome: "Status do atleta", acao: "Medidor de prontidão (0–100%), frase do dia e quatro indicadores: Carga (horas/8 h), Recuperação, Risco de lesão (pelo ACWR) e Treinos (sessões/5).", onde: "apps/web/components/dashboard/AthleteStatus.tsx:38", no: "ST" },
    { tipo: "cálculo", nome: "Prontidão", acao: "72 + 1,1 × TSB, menos (ACWR − 1,3) × 80 se ACWR > 1,3, limitada a 8–98. Sem carga: usa a recomendação do dia (85/68/50/28).", onde: "apps/web/lib/athlete.ts:116" },
    { tipo: "cálculo", nome: "Recuperação", acao: "Pelo TSB e sua variação em 7 dias (↑ melhorando, ↓ em queda, estável). Sem métricas, estima pelas horas da semana.", onde: "apps/web/app/dashboard/page.tsx:110" },
    { tipo: "link", nome: "Status da Duni", acao: "Mostra o status salvo com o plano da semana; explica quando difere da prontidão.", msg: "A prontidão acima olha só a carga. A Duni também pesa cansaço, check-ins e tendência, por isso a leitura dela é diferente.", onde: "apps/web/components/dashboard/AthleteStatus.tsx:112" },
    { tipo: "link", nome: "Análise completa →", acao: "Vai para Desempenho.", onde: "apps/web/components/dashboard/AthleteStatus.tsx:78" },
    { tipo: "card", nome: "Duni · sua treinadora", acao: "Próximo treino planejado (distância, duração, intensidade) e a recomendação de hoje; selo AI ANALYSIS · SYNC/ACTIVE/OFFLINE.", msg: "Seu próximo treino está pronto. · Nenhum plano ativo. · A Duni está indisponível agora.", onde: "apps/web/components/dashboard/CoachCard.tsx:44", no: "CC" },
    { tipo: "botão", nome: "Ver treino / Falar com a Duni", acao: "Vai para /coach.", onde: "apps/web/components/dashboard/CoachCard.tsx:134" },
    { tipo: "card", nome: "Visão semanal", acao: "Segunda a domingo: Feito, Hoje, Planejado (Duni), Descanso ou Livre; barra = duração relativa; total de km, tempo, sessões e comparação com a semana passada até o mesmo dia.", onde: "apps/web/components/dashboard/WeekStrip.tsx:16", no: "WK" },
    { tipo: "card", nome: "Meta de corrida (Visão semanal)", acao: "Com meta no Perfil: barra com os km de corrida da semana (segunda a domingo) contra a meta; ✓ quando bate.", onde: "apps/web/components/dashboard/WeekStrip.tsx:77" },
    { tipo: "card", nome: "Planejado × feito", acao: "Os 2 treinos planejados mais recentes dos últimos 3 dias, com o feito ao lado e os selos; some sem plano. Detalhes na área Duni.", api: "GET /coach/plan/adherence?days=3", onde: "apps/web/app/dashboard/page.tsx:224", no: "ADH" },
    { tipo: "card", nome: "Evolução do desempenho", acao: "Gráfico de distância, pace ou FC média com linha de tendência.", onde: "apps/web/components/dashboard/PerformanceChart.tsx:89", no: "EV" },
    { tipo: "filtro", nome: "Período do gráfico", acao: "7D, 30D (padrão), 3M, 6M, 1A.", onde: "apps/web/components/dashboard/PerformanceChart.tsx:15" },
    { tipo: "aba", nome: "Distância · Pace médio · FC média", acao: "As três caixas de cima são também as abas da métrica, com variação contra o período anterior.", onde: "apps/web/components/dashboard/PerformanceChart.tsx:166" },
    { tipo: "botão", nome: "Comparar", acao: "Sobrepõe o período anterior em linha tracejada.", onde: "apps/web/components/dashboard/PerformanceChart.tsx:204" },
    { tipo: "vazio", nome: "Atividades insuficientes", acao: "Menos de 2 atividades no período.", msg: "Atividades insuficientes no período · Escolha um período maior ou importe mais atividades.", onde: "apps/web/components/dashboard/PerformanceChart.tsx:216" },
    { tipo: "card", nome: "Última atividade", acao: "Minimapa, distância, tempo, pace/velocidade, FC, elevação, curva do ritmo e comparação com a média das últimas 10.", onde: "apps/web/components/dashboard/LastActivity.tsx:17", no: "LA" },
    { tipo: "botão", nome: "📤 Story", acao: "No cartão Última atividade: busca detalhe, splits e zonas do treino mais recente e abre o gerador de Story direto, sem passar pela página do treino.", api: "GET /activities/{id} · /splits · /zones", msg: "Abrindo… · Não consegui abrir o Story", onde: "apps/web/app/dashboard/page.tsx", no: "STY" },
    { tipo: "vazio", nome: "Nenhuma atividade registrada", msg: "Importe seus arquivos .fit, .gpx ou .tcx para começar.", onde: "apps/web/components/dashboard/LastActivity.tsx:30" },
    { tipo: "card", nome: "Recordes pessoais", acao: "Destaque para o maior longão (ou pedal, ou nado) e grade com 4 recordes; 'Novo' se tiver menos de 30 dias.", onde: "apps/web/components/dashboard/Records.tsx:51", no: "REC" },
    { tipo: "botão", nome: "Ver todos (N) / Mostrar menos", acao: "Expande a grade de recordes.", onde: "apps/web/components/dashboard/Records.tsx:140" },
    { tipo: "vazio", nome: "Sem recordes ainda", msg: "Seus melhores esforços aparecem aqui automaticamente.", onde: "apps/web/components/dashboard/Records.tsx:73" },
    { tipo: "card", nome: "Próxima prova", acao: "Com plano do objetivo: nome, data, dias que faltam, fase e semana do plano (barra de progresso), km da semana e o alvo do plano (ritmo de prova × distância). Sem plano mas com prova cadastrada: a prova e os dias. Sem prova: convite e o potencial atual (VDOT). Embaixo, até 3 outras provas com data.", api: "GET /coach/goal-plan · GET /coach/memories", msg: "Ver o plano até a prova · Montar o plano com a Duni · Cadastrar a prova na Duni", onde: "apps/web/components/dashboard/GoalCard.tsx:25", no: "GOAL" },
    { tipo: "card", nome: "Calendário", acao: "Mês com pontos coloridos por esporte e anel para treinos planejados; navega até 11 meses para trás e 1 para frente. Teclado: o Tab para uma vez só no calendário (no dia de hoje), as setas andam pelos dias (↑↓ uma semana), Home/End vão ao primeiro e ao último dia e Enter abre o treino do dia. Cada dia tem nome completo para o leitor de tela (data, hoje, treino ou planejado).", onde: "apps/web/components/dashboard/MonthCalendar.tsx:11", no: "CAL" },
    { tipo: "botão", nome: "Mês anterior / Próximo mês", onde: "apps/web/components/dashboard/MonthCalendar.tsx:58" },
    { tipo: "card", nome: "Atividades recentes", acao: "As 5 últimas com minimapa e selo PR, Longão, 10K+ ou 5K+.", onde: "apps/web/components/dashboard/RecentActivities.tsx:34", no: "RC" },
    { tipo: "vazio", nome: "Nenhuma atividade ainda", msg: "Use Importar para adicionar seus treinos.", onde: "apps/web/components/dashboard/RecentActivities.tsx:56" },
    { tipo: "modal", nome: "Modal da atividade", acao: "Mapa, 5 métricas com variação contra a anterior e minigráfico das últimas 8, fonte e velocidade média. Fecha com ✕, clique fora ou Esc; foco preso.", api: "GET /activities/{id} (se ainda não tiver)", onde: "apps/web/components/dashboard/ActivityModal.tsx:30", no: "MOD" },
    { tipo: "link", nome: "Ver página completa da atividade →", onde: "apps/web/components/dashboard/ActivityModal.tsx:133" },
  ],
});
