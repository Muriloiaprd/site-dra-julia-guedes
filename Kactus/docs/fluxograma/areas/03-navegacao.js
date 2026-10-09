// Área 03 — Navegação: menu lateral, trilho de ícones, barra inferior e a folha "Mais".
KACTUS_MAPA.areas.push({
  id: "navegacao",
  n: 3,
  titulo: "Navegação",
  resumo:
    "O mesmo menu muda de forma com a largura da tela. No computador é uma barra lateral com rótulos; no tablet, um trilho só com ícones; no celular, uma barra no topo (logo e foto) e uma barra inferior com Início, Atividades, Duni, Desempenho e Mais. A folha 'Mais' traz Equipamentos, Importar, Perfil e Sair.",
  rotas: ["todas as telas internas"],
  arquivos: ["apps/web/components/Sidebar.tsx", "apps/web/components/AppShell.tsx", "apps/web/components/Logo.tsx", "apps/web/lib/useFocusTrap.ts"],
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
    P1["Performance<br/>Dashboard · Atividades · Desempenho"]:::estado
    P2["Inteligência<br/>Duni · treinadora"]:::estado
    P3["Gestão<br/>Equipamentos · Importar"]:::estado
    P4["Rodapé<br/>Perfil + Sair"]:::estado
  end
  LG --> G
  MD --> G
  SM --> BI["Início · Atividades · Duni · Desempenho · Mais"]:::tela
  BI --> MAIS("Mais"):::acao
  MAIS --> FOLHA["Folha: Equipamentos · Importar · Perfil · Sair"]:::tela
  FOLHA -->|toque fora, Esc ou trocar de página| FECHA(["Fecha"]):::estado
`,
    },
  ],
  inventario: [
    { tipo: "menu", nome: "Barra lateral (computador)", acao: "Logo leva ao Dashboard; três grupos separados por um traço fino.", onde: "apps/web/components/Sidebar.tsx:113", no: "LG" },
    { tipo: "menu", nome: "Trilho de ícones (tablet)", acao: "Mesma barra, 76 px, só ícones; o selo IA vira um ponto pulsando.", onde: "apps/web/components/Sidebar.tsx:114", no: "MD" },
    { tipo: "link", nome: "Dashboard", acao: "No celular aparece como 'Início'.", onde: "apps/web/components/Sidebar.tsx:34" },
    { tipo: "link", nome: "Atividades", onde: "apps/web/components/Sidebar.tsx:35" },
    { tipo: "link", nome: "Desempenho", onde: "apps/web/components/Sidebar.tsx:36" },
    { tipo: "link", nome: "Duni · treinadora", acao: "Com selo 'IA' pulsando. No celular: 'Duni'.", onde: "apps/web/components/Sidebar.tsx:41" },
    { tipo: "link", nome: "Equipamentos", onde: "apps/web/components/Sidebar.tsx:46" },
    { tipo: "link", nome: "Importar", onde: "apps/web/components/Sidebar.tsx:47" },
    { tipo: "link", nome: "Perfil (com foto)", acao: "Mostra a foto do perfil ou a inicial do e-mail, o nome e 'Perfil do atleta'.", api: "GET /profile", onde: "apps/web/components/Sidebar.tsx:160", no: "P4" },
    { tipo: "botão", nome: "Sair", acao: "Apaga o token e vai para /login.", onde: "apps/web/components/Sidebar.tsx:172" },
    { tipo: "seção", nome: "Barra no topo (celular)", acao: "Logo (vai ao Dashboard) e foto (vai ao Perfil); respeita o entalhe do iPhone.", onde: "apps/web/components/Sidebar.tsx:184", no: "SM" },
    { tipo: "menu", nome: "Barra inferior (celular)", acao: "Quatro atalhos + Mais; o item ativo ganha um traço verde no topo.", onde: "apps/web/components/Sidebar.tsx:199", no: "BI" },
    { tipo: "botão", nome: "Mais", acao: "Abre a folha; fica verde quando a página atual está dentro dela.", onde: "apps/web/components/Sidebar.tsx:226", no: "MAIS" },
    { tipo: "regra", nome: "Acessibilidade", acao: "Foco visível (contorno verde) em tudo que recebe Tab; textos apagados com contraste AA (cinzas #929292 e #8C8C8C, conferidos com auditoria automática no dashboard, Desempenho e Duni); gráficos com accessibilityLayer (as setas movem o tooltip); calendário com setas.", onde: "apps/web/app/globals.css:148" },
    { tipo: "modal", nome: "Folha 'Mais opções de navegação'", acao: "Prende o foco do teclado; fecha com toque fora, Esc ou ao trocar de página.", onde: "apps/web/components/Sidebar.tsx:240", no: "FOLHA,FECHA" },
    { tipo: "cálculo", nome: "Item ativo", acao: "Ativo quando a rota é igual ou começa com o endereço do item (ex.: /activities/123 acende Atividades).", onde: "apps/web/components/Sidebar.tsx:56" },
    { tipo: "carregando", nome: "Nome e foto", acao: "Até o perfil chegar, mostra a inicial do e-mail.", onde: "apps/web/components/Sidebar.tsx:92" },
  ],
});
