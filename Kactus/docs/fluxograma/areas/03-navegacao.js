// Área 03 — Navegação: menu lateral, trilho de ícones, barra inferior e a folha "Mais".
KACTUS_MAPA.areas.push({
  id: "navegacao",
  n: 3,
  titulo: "Navegação",
  resumo:
    "O mesmo menu muda de forma com a largura da tela. No computador é uma barra lateral com rótulos; no tablet, um trilho só com ícones; no celular, uma barra no topo (logo e foto) e uma barra inferior com Início, Atividades, Calendário, Duni e Mais. A folha 'Mais' traz Desempenho, Perfil e Sair. Embaixo de Sair (no computador e na folha 'Mais') fica o 'Print Tela', bem pequeno, que gera uma imagem PNG da aba aberta inteira. Equipamentos e Importar não estão mais no menu: viraram a sub-aba de Atividades e uma seção do Perfil.",
  rotas: ["todas as telas internas"],
  arquivos: ["apps/web/components/Sidebar.tsx", "apps/web/components/AppShell.tsx", "apps/web/components/PrintTela.tsx", "apps/web/components/Logo.tsx", "apps/web/lib/useFocusTrap.ts"],
  diagramas: [
    {
      titulo: "Menu por tamanho de tela",
      mermaid: `
flowchart TD
  W{"Largura da tela"}:::decisao
  W -->|1024 px ou mais| LG["Barra lateral completa<br/>logo grande + rótulos + selo IA"]:::tela
  W -->|768 a 1023 px| MD["Trilho de ícones<br/>rótulo só no title"]:::tela
  W -->|menos de 768 px| SM["Barra no topo + barra inferior"]:::tela
  subgraph G["Grupos do menu"]
    P1["Performance<br/>Dashboard · Atividades · Calendário · Desempenho"]:::estado
    P2["Inteligência<br/>Duni · treinadora"]:::estado
    P4["Rodapé<br/>Perfil + Sair + Print Tela"]:::estado
  end
  LG --> G
  MD --> G
  SM --> BI["Início · Atividades · Calendário · Duni · Mais"]:::tela
  BI --> MAIS("Mais"):::acao
  MAIS --> FOLHA["Folha: Desempenho · Perfil · Sair · Print Tela"]:::tela
  FOLHA -->|toque fora, Esc ou trocar de página| FECHA(["Fecha"]):::estado
  P4 --> PT("Print Tela"):::acao
  FOLHA --> PT
  PT --> CAP["Imagem PNG da aba aberta inteira<br/>só o conteúdo, sem o menu, em 2x"]:::estado
  CAP -->|computador| BX(["Baixa para Downloads"]):::estado
  CAP -->|celular| SV("Aviso Print pronto · Salvar imagem"):::acao
  SV --> SH(["Compartilhar do iPhone<br/>salvar em Fotos"]):::estado
`,
    },
  ],
  inventario: [
    { tipo: "menu", nome: "Barra lateral (computador)", acao: "Logo leva ao Dashboard; dois grupos separados por um traço fino.", onde: "apps/web/components/Sidebar.tsx:114", no: "LG" },
    { tipo: "menu", nome: "Trilho de ícones (tablet)", acao: "Mesma barra, 76 px, só ícones; o selo IA vira um ponto pulsando.", onde: "apps/web/components/Sidebar.tsx:115", no: "MD" },
    { tipo: "link", nome: "Dashboard", acao: "No celular aparece como 'Início'.", onde: "apps/web/components/Sidebar.tsx:36" },
    { tipo: "link", nome: "Atividades", onde: "apps/web/components/Sidebar.tsx:37" },
    { tipo: "link", nome: "Calendário", acao: "Calendário de treinos (área 16). No celular fica na barra de baixo, no lugar de Desempenho.", onde: "apps/web/components/Sidebar.tsx:38" },
    { tipo: "link", nome: "Desempenho", acao: "No celular fica na folha Mais.", onde: "apps/web/components/Sidebar.tsx:39" },
    { tipo: "link", nome: "Duni · treinadora", acao: "Ícone: o cacto rainha (a cara da Duni), parado, com o selo 'IA' pulsando. No celular: 'Duni'.", onde: "apps/web/components/Sidebar.tsx:44" },
    { tipo: "link", nome: "Perfil (com foto)", acao: "Mostra a foto do perfil ou a inicial do e-mail, o nome e 'Perfil do atleta'.", api: "GET /profile", onde: "apps/web/components/Sidebar.tsx:162", no: "P4" },
    { tipo: "botão", nome: "Sair", acao: "Apaga o token e vai para /login.", onde: "apps/web/components/Sidebar.tsx:174" },
    { tipo: "botão", nome: "Print Tela", acao: "Texto bem pequeno embaixo de Sair (barra lateral e folha 'Mais'). Gera um PNG da aba aberta inteira, de cima até embaixo, sem o menu, em 2x (abas muito longas reduzem para caber no limite do iPhone). Nome: kactus_<aba>_<data>.png. No computador baixa direto e avisa 'Print salvo'; no celular mostra 'Print pronto · Salvar imagem', que abre o Compartilhar (o Safari só deixa compartilhar logo após um toque).", onde: "apps/web/components/PrintTela.tsx:44", no: "PT,CAP,BX,SV,SH" },
    { tipo: "seção", nome: "Barra no topo (celular)", acao: "Logo (vai ao Dashboard) e foto (vai ao Perfil); respeita o entalhe do iPhone.", onde: "apps/web/components/Sidebar.tsx:193", no: "SM" },
    { tipo: "menu", nome: "Barra inferior (celular)", acao: "Quatro atalhos (Início, Atividades, Calendário, Duni) + Mais; o item ativo ganha um traço verde no topo.", onde: "apps/web/components/Sidebar.tsx:211", no: "BI" },
    { tipo: "botão", nome: "Mais", acao: "Abre a folha; fica verde quando a página atual está dentro dela.", onde: "apps/web/components/Sidebar.tsx:236", no: "MAIS" },
    { tipo: "regra", nome: "Acessibilidade", acao: "Foco visível (contorno verde) em tudo que recebe Tab; textos apagados com contraste AA (cinzas #929292 e #8C8C8C, conferidos com auditoria automática no dashboard, Desempenho e Duni); gráficos com accessibilityLayer (as setas movem o tooltip); calendário com setas.", onde: "apps/web/app/globals.css:148" },
    { tipo: "modal", nome: "Folha 'Mais opções de navegação'", acao: "Prende o foco do teclado; fecha com toque fora, Esc ou ao trocar de página.", onde: "apps/web/components/Sidebar.tsx:253", no: "FOLHA,FECHA" },
    { tipo: "cálculo", nome: "Item ativo", acao: "Ativo quando a rota é igual ou começa com o endereço do item (ex.: /activities/123 acende Atividades).", onde: "apps/web/components/Sidebar.tsx:53" },
    { tipo: "carregando", nome: "Nome e foto", acao: "Até o perfil chegar, mostra a inicial do e-mail.", onde: "apps/web/components/Sidebar.tsx:90" },
  ],
});
