// Área 00 — Mapa geral: por onde se entra no Kactus e como as telas se ligam.
KACTUS_MAPA.areas.push({
  id: "geral",
  n: 0,
  titulo: "Mapa geral",
  resumo:
    "O Kactus roda no PC do Murilo. Abre no navegador do PC (localhost:3003) ou no iPhone pelo Tailscale, como app na Tela de Início. Quem liga e desliga o servidor é o Kactus Controle, o ícone perto do relógio. Sem sessão, tudo leva ao login; com sessão, ao dashboard. Daí saem as seis áreas do menu.",
  rotas: ["/", "/login", "/dashboard", "/activities", "/activities/[id]", "/performance", "/coach", "/equipment", "/import", "/profile"],
  arquivos: [
    "apps/web/app/layout.tsx",
    "apps/web/app/page.tsx",
    "apps/web/components/AppShell.tsx",
    "apps/web/app/manifest.ts",
    "apps/web/next.config.mjs",
    "Abrir Kactus.bat",
    "apps/controle/kactus_controle/app.py",
  ],
  diagramas: [
    {
      titulo: "Pontos de entrada e mapa das telas",
      nota: "As setas tracejadas são redirecionamentos automáticos.",
      mermaid: `
flowchart TD
  PC("Navegador do PC<br/>localhost:3003"):::acao
  IPH("iPhone<br/>Tailscale :443"):::acao
  PWA("Ícone na Tela de Início<br/>abre em /dashboard"):::acao
  CTRL["Kactus Controle<br/>ícone no relógio"]:::ext
  CTRL -->|Ligar / Abrir no PC| PC
  IPH --> SW{"Servidor no ar?"}:::decisao
  PWA --> SW
  SW -->|não| OFF["Kactus desligado<br/>desligado.html"]:::erro
  OFF -->|Ligar agora| CTRL
  SW -->|sim| ROOT
  PC --> ROOT["/ Landing"]:::tela
  ROOT -->|Começar Agora| LOGIN["/login"]:::tela
  LOGIN -->|token salvo| DASH["/dashboard"]:::tela
  ROOT -.->|já conectado| DASH
  subgraph MENU["Menu lateral ou barra inferior"]
    DASH
    ACT["/activities"]:::tela
    PERF["/performance"]:::tela
    DUNI["/coach · Duni"]:::tela
    EQ["/equipment"]:::tela
    IMP["/import"]:::tela
    PROF["/profile"]:::tela
  end
  ACT --> DET["/activities/id"]:::tela
  DASH --> DET
  DET --> STORY["Compartilhar<br/>Story"]:::tela
  IMP -->|Como foi?| DET
  MET["/metrics"]:::estado -.-> PERF
  PRED["/predictions"]:::estado -.-> PERF
  ANY["Qualquer chamada<br/>com 401"]:::erro -.-> LOGIN
`,
    },
    {
      titulo: "Percurso típico de um treino, do relógio ao Story",
      mermaid: `
flowchart LR
  W["Treino no relógio Garmin"]:::ext --> EXP("Exportar .fit<br/>do Garmin Connect"):::acao
  EXP --> UP("Arrastar em /import"):::acao
  UP --> API1[/"POST /activities/upload/batch"/]:::api
  API1 --> CALC[["Tempo em movimento, pace,<br/>GAP, TSS, recordes, carga"]]:::calc
  CALC --> CK("Como foi? → check-in"):::acao
  CK --> COM{{"Pedir comentário<br/>da Duni"}}:::ia
  COM --> ST("Compartilhar → Story<br/>imagem ou vídeo"):::acao
  CALC --> PAINEL["Dashboard e Desempenho<br/>atualizados"]:::tela
  PAINEL --> PLAN{{"Duni: plano da semana<br/>e plano do objetivo"}}:::ia
  PLAN --> REC[["Treino feito casa com<br/>o planejado do dia"]]:::calc
`,
    },
  ],
  inventario: [
    { tipo: "tela", nome: "Landing", acao: "Página pública de apresentação. Com sessão válida, mostra o aviso 'Você já está conectado'.", onde: "apps/web/app/LandingPage.tsx:6", no: "ROOT" },
    { tipo: "tela", nome: "Login", acao: "E-mail e senha. Salva o token e vai ao dashboard.", onde: "apps/web/app/login/page.tsx:8", no: "LOGIN" },
    { tipo: "tela", nome: "Dashboard", acao: "Centro de comando: prontidão, Duni, semana, evolução, recordes, calendário.", onde: "apps/web/app/dashboard/page.tsx:32", no: "DASH" },
    { tipo: "tela", nome: "Atividades", acao: "Lista com filtros, exclusão e lixeira.", onde: "apps/web/app/activities/page.tsx:57", no: "ACT" },
    { tipo: "tela", nome: "Detalhe da atividade", acao: "Métricas, check-in, comentário da Duni, mapa, gráficos, splits, Story.", onde: "apps/web/app/activities/[id]/page.tsx:88", no: "DET" },
    { tipo: "tela", nome: "Desempenho", acao: "Hoje, forma, risco, previsões, evolução e modo avançado.", onde: "apps/web/app/performance/page.tsx:24", no: "PERF" },
    { tipo: "tela", nome: "Duni", acao: "Resumo, planos, chat e memórias.", onde: "apps/web/app/coach/page.tsx:189", no: "DUNI" },
    { tipo: "tela", nome: "Equipamentos", acao: "Tênis e acessórios, alertas de troca e recomendados.", onde: "apps/web/app/equipment/page.tsx:56", no: "EQ" },
    { tipo: "tela", nome: "Importar", acao: "Arrastar arquivos do relógio.", onde: "apps/web/app/import/page.tsx:23", no: "IMP" },
    { tipo: "tela", nome: "Perfil", acao: "Dados, zonas, senha, exportar e zona de perigo.", onde: "apps/web/app/profile/page.tsx:52", no: "PROF" },
    { tipo: "modal", nome: "Compartilhar (Story)", acao: "Gerador de Story aberto do detalhe da atividade.", onde: "apps/web/components/share/StoryGenerator.tsx:53", no: "STORY" },
    { tipo: "tela", nome: "Kactus desligado", acao: "Página de reserva servida pelo service worker quando o servidor não responde.", onde: "apps/web/public/desligado.html", no: "OFF" },
    { tipo: "integração", nome: "Redirecionamento /metrics e /predictions", acao: "As antigas abas Carga e Previsões viraram Desempenho; o Next redireciona.", onde: "apps/web/next.config.mjs:16", no: "MET,PRED" },
    { tipo: "integração", nome: "Proxy /api → API", acao: "Todo /api/* do site vai para a FastAPI em localhost:8000, com tempo limite de 240 s (por causa da Duni).", api: "/api/:path* → http://localhost:8000/:path*", onde: "apps/web/next.config.mjs:24" },
    { tipo: "permissão", nome: "401 manda para o login", acao: "Qualquer resposta 401 apaga o token e leva a /login.", msg: "Sessão expirada", onde: "apps/web/lib/api.ts:273", no: "ANY" },
    { tipo: "tela", nome: "App na Tela de Início (PWA)", acao: "Manifest com nome Kactus, abre em /dashboard, modo standalone, retrato.", onde: "apps/web/app/manifest.ts:4", no: "PWA" },
    { tipo: "carregando", nome: "Acordando o servidor", acao: "Faixa no topo quando uma chamada passa de 3 s.", msg: "Acordando o servidor… pode levar alguns segundos.", onde: "apps/web/components/WakingBanner.tsx:6" },
    { tipo: "link", nome: "Pular para o conteúdo", acao: "Link de acessibilidade no topo de toda tela interna.", onde: "apps/web/components/AppShell.tsx:8" },
  ],
});
