// Área 16 — Calendário de treinos: o planejado e o feito por dia, e a aba Plano.
KACTUS_MAPA.areas.push({
  id: "calendario",
  n: 16,
  titulo: "Calendário de treinos",
  resumo:
    "A aba onde se confere os treinos, com ← Voltar no topo e duas abas: Calendário e Plano. Calendário: o mês inteiro na largura da tela, com o treino planejado de cada dia (do plano da semana ou do plano do objetivo) e as atividades feitas. Cada treino mostra a situação: cumprido, perdido, hoje, planejado ou descanso. No celular cada dia mostra pontinhos (situação do planejado e cor do esporte). Tocar num dia abre uma gaveta com o detalhe (pela direita no computador, por baixo no celular). Plano: gerar o plano da semana e o do objetivo, o Plano do objetivo, o Planejado × feito e o Plano da semana (que saíram da página da Duni). O plano só aparece aqui e no resumo do Dashboard.",
  rotas: ["/calendar", "/calendar?aba=plano"],
  arquivos: [
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
      titulo: "Mês, gaveta do dia e situação de cada treino",
      mermaid: `
flowchart TD
  IN("Abre Calendário"):::acao --> ME[/"GET /auth/me"/]:::api
  ME -->|sem sessão| LOGIN["/login"]:::tela
  ME -->|ok| ACT[/"GET /activities · páginas de 500<br/>até acabar"/]:::api
  ME --> PL[/"GET /coach/plan?start=1º dia&end=último dia"/]:::api
  IN --> VOLTA("← Voltar"):::acao --> ANT{"Tem tela anterior?"}:::decisao
  ANT -->|sim| PREV["Tela de onde veio"]:::tela
  ANT -->|não| DASH["/dashboard"]:::tela
  IN --> ABA{"Aba"}:::decisao
  ABA -->|Calendário| CAL
  ABA -->|Plano ?aba=plano| P["Plano de treino"]:::tela
  ACT --> CAL["Mês: Feito · Plano · Cumpriu<br/>+ grade de 7 colunas na tela toda"]:::tela
  PL --> CAL
  ACT -->|erro| ERR["Não consegui carregar tudo"]:::erro
  PL -->|erro| ERR
  CAL --> NAV("‹ › ou Hoje"):::acao --> PL
  CAL --> SIT{"Situação do treino"}:::decisao
  SIT -->|status done| OK["✓ Cumprido"]:::ok
  SIT -->|status skipped ou já passou| PERD["✕ Perdido"]:::erro
  SIT -->|é hoje| HOJE["● Hoje"]:::estado
  SIT -->|futuro| PLAN["○ Planejado"]:::estado
  SIT -->|descanso ou folga| DESC["· Descanso"]:::estado
  CAL --> DIA("Tocar no dia · setas + Enter"):::acao --> DET["Gaveta do dia: treino planejado<br/>+ atividades feitas"]:::tela
  DET -->|✕, Esc ou tocar fora| CAL
  DET --> VER("Ver o treino feito → · atividade"):::acao --> ATV["/activities/id"]:::tela
`,
    },
    {
      titulo: "Aba Plano: gerar e acompanhar",
      mermaid: `
flowchart TD
  P2["Aba Plano"]:::tela --> GS("Gerar plano da semana"):::acao --> GSA[/"POST /coach/plan/generate"/]:::api
  GSA --> IA1{{"Duni monta os 7 dias"}}:::ia --> OK1["Plano da semana pronto: N treinos"]:::ok
  P2 --> GO("Gerar plano do objetivo"):::acao --> GOA[/"POST /coach/goal-plan/generate"/]:::api
  GOA --> IA2{{"Duni monta até a prova"}}:::ia --> OK2["Plano até a prova pronto: N treinos"]:::ok
  GSA -->|erro| E["Erro da Duni (título + explicação)"]:::erro
  GOA -->|erro| E
  OK1 --> REC[["Busca o mês de novo"]]:::calc --> CALN["Aba Calendário atualizada"]:::tela
  OK2 --> REC
  P2 --> GPP["Plano do objetivo (área 10)"]:::tela
  P2 --> ADH["Planejado × feito 14 dias (área 10)"]:::tela
  P2 --> WP["Plano da semana · semana livre (área 10)"]:::tela
  WP -->|editar, trocar, usar a semana livre| REC
`,
    },
  ],
  inventario: [
    { tipo: "tela", nome: "Calendário de treinos", acao: "Cabeçalho 'Treinos · Calendário de treinos'. Item do menu logo depois de Atividades; no celular, na barra de baixo.", msg: "O que a Duni planejou e o que você fez, dia a dia.", onde: "apps/web/app/calendar/page.tsx:58", no: "IN" },
    { tipo: "botão", nome: "← Voltar", acao: "Volta para a tela anterior; aberto direto (sem tela anterior), vai ao Dashboard. Existe porque no iPhone, como app, não há o voltar do navegador.", onde: "apps/web/components/ui/BackButton.tsx:13", no: "VOLTA,ANT,PREV,DASH" },
    { tipo: "aba", nome: "Calendário · Plano", acao: "Ficam na URL (?aba=plano), então o link direto e o voltar do navegador funcionam. As duas ficam montadas: trocar não perde o mês nem um plano sendo gerado. Os botões 'Montar o plano' / 'Ver o plano até a prova' do Dashboard e 'Ver o plano de treino' da Duni abrem direto na aba Plano.", onde: "apps/web/app/calendar/page.tsx:207", no: "ABA" },
    { tipo: "API", nome: "Atividades", acao: "Busca todas, de 500 em 500, para andar por qualquer mês.", api: "GET /activities?limit=500&offset=N", onde: "apps/web/app/calendar/page.tsx:36", no: "ACT" },
    { tipo: "API", nome: "Planejado do mês", acao: "Do 1º ao último dia do mês visível; busca de novo ao trocar de mês ou quando um plano muda.", api: "GET /coach/plan?start=…&end=…", onde: "apps/web/app/calendar/page.tsx:113", no: "PL" },
    { tipo: "erro", nome: "Não consegui carregar tudo", msg: "Verifique a conexão ou se a API está rodando. O calendário pode estar incompleto.", onde: "apps/web/app/calendar/page.tsx:210", no: "ERR" },
    { tipo: "card", nome: "Feito · Plano · Cumpriu", acao: "Km e treinos feitos no mês, km e treinos planejados (sem descanso) e quantos dos que já passaram foram cumpridos.", onde: "apps/web/components/calendar/TrainingCalendar.tsx:110" },
    { tipo: "botão", nome: "‹ Mês anterior · Próximo mês › · Hoje", acao: "Anda um mês; Hoje aparece fora do mês atual e volta para ele.", onde: "apps/web/components/calendar/TrainingCalendar.tsx:159", no: "NAV" },
    { tipo: "seção", nome: "Grade do mês", acao: "Segunda a domingo, na largura da tela. No computador e tablet, cada dia mostra até dois treinos planejados com a situação e até duas atividades com a cor do esporte e os km ('+N' se tiver mais). No celular, pontinhos: o do planejado com a cor da situação (cheio se cumprido) e o da atividade com a cor do esporte.", onde: "apps/web/components/calendar/TrainingCalendar.tsx:186", no: "CAL" },
    { tipo: "cálculo", nome: "Situação do treino", acao: "Descanso ou folga → Descanso; status done → Cumprido; skipped ou data passada → Perdido; hoje → Hoje; futuro → Planejado. O servidor marca o passado ao listar (reconcile_plan).", onde: "apps/web/components/calendar/TrainingCalendar.tsx:27", no: "SIT,OK,PERD,HOJE,PLAN,DESC" },
    { tipo: "regra", nome: "Teclado", acao: "Um Tab entra na grade; setas andam pelos dias, Home e End vão ao primeiro e ao último, Enter abre a gaveta.", onde: "apps/web/components/calendar/TrainingCalendar.tsx:135", no: "DIA" },
    { tipo: "modal", nome: "Gaveta do dia", acao: "Abre ao tocar num dia: pela direita no computador, por baixo no celular. Treino planejado: de qual plano veio, situação, esporte, intensidade, km e tempo, ritmo e FC, objetivo; atividades do dia com hora, km, tempo, ritmo e FC. Prende o foco; fecha no ✕, no Esc ou tocando fora, e o foco volta ao dia.", onde: "apps/web/components/calendar/TrainingCalendar.tsx:265", no: "DET" },
    { tipo: "link", nome: "Ver o treino feito → · atividade do dia", acao: "Abre o detalhe da atividade.", onde: "apps/web/components/calendar/TrainingCalendar.tsx:319", no: "VER,ATV" },
    { tipo: "vazio", nome: "Dia sem nada", msg: "Nada planejado para este dia. · Nada planejado nem feito neste dia.", onde: "apps/web/components/calendar/TrainingCalendar.tsx:343" },
    { tipo: "seção", nome: "Legenda", acao: "✓ Cumprido · ✕ Perdido · ● Hoje · ○ Planejado · Atividade feita.", msg: "Toque num dia para ver os detalhes.", onde: "apps/web/components/calendar/TrainingCalendar.tsx:253" },
    { tipo: "seção", nome: "Plano de treino", acao: "A aba Plano; veio da página da Duni.", msg: "A Duni monta os treinos; eles aparecem na aba Calendário e no resumo do dashboard.", onde: "apps/web/app/calendar/page.tsx:229", no: "P,P2" },
    { tipo: "botão", nome: "Gerar plano da semana", acao: "Os 7 dias a partir de hoje; ao terminar, o mês é buscado de novo.", api: "POST /coach/plan/generate", msg: "Gerando… · Plano da semana pronto: N treinos", onde: "apps/web/app/calendar/page.tsx:176", no: "GS,GSA,IA1,OK1,REC" },
    { tipo: "botão", nome: "Gerar plano do objetivo", acao: "Todos os treinos até a prova, com os dias por semana do plano atual (3 se não houver).", api: "POST /coach/goal-plan/generate", msg: "Montando… · Plano até a prova pronto: N treinos", onde: "apps/web/app/calendar/page.tsx:133", no: "GO,GOA,IA2,OK2" },
    { tipo: "carregando", nome: "Duni analisando", acao: "Quadro com os passos que a Duni lê enquanto monta o plano.", msg: "Montando o plano da semana… · Montando o plano até a prova…", onde: "apps/web/components/coach/ProcessingPanel.tsx:18" },
    { tipo: "erro", nome: "Erro ao gerar", acao: "Mesmo texto de erro da Duni (cota, chave, formato…).", onde: "apps/web/app/calendar/page.tsx:254", no: "E" },
    { tipo: "seção", nome: "Plano do objetivo · Planejado × feito · Plano da semana", acao: "Os mesmos quadros que estavam na Duni (detalhes na área 10); editar, trocar ou usar a semana livre atualiza o calendário.", onde: "apps/web/app/calendar/page.tsx:272", no: "GPP,ADH,WP,CALN" },
  ],
});
