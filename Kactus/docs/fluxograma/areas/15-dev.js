// Área 15 — Rotas de desenvolvimento (pasta app/(dev)).
KACTUS_MAPA.areas.push({
  id: "dev",
  n: 15,
  titulo: "Rotas de desenvolvimento",
  resumo:
    "Cinco páginas feitas para conferir telas sem login e sem gastar a IA: elas trocam o fetch do navegador por respostas fixas. Não aparecem no menu, mas também não são bloqueadas no modo rápido (produção).",
  rotas: ["/activities-preview", "/equipment-preview", "/coach-preview", "/story-art-probe", "/story-calibrate"],
  arquivos: [
    "apps/web/app/(dev)/activities-preview/page.tsx",
    "apps/web/app/(dev)/equipment-preview/page.tsx",
    "apps/web/app/(dev)/coach-preview/page.tsx",
    "apps/web/app/(dev)/story-art-probe/page.tsx",
    "apps/web/app/(dev)/story-calibrate/page.tsx",
  ],
  diagramas: [
    {
      titulo: "O que cada rota faz",
      mermaid: `
flowchart LR
  A["/activities-preview"]:::tela --> A1[["fetch falso: 2 atividades<br/>e 2 itens na lixeira"]]:::calc --> A2["Página de Atividades<br/>para testar a lixeira"]:::ok
  E["/equipment-preview"]:::tela --> E1[["fetch falso: 3 equipamentos<br/>e token de mentira"]]:::calc --> E2["Equipamentos para testar<br/>o tênis padrão"]:::ok
  C["/coach-preview"]:::tela --> C1[["fetch falso com plano,<br/>memórias e conversa"]]:::calc --> C2["Página da Duni sem IA"]:::ok
  P["/story-art-probe"]:::tela --> P1[["Mede as regiões transparentes<br/>das artes PNG"]]:::calc --> P2["Imprime o código de regions.ts"]:::ok
  K["/story-calibrate?id=modelo"]:::tela --> K1[["Desenha o modelo e compara<br/>com a arte pixel a pixel"]]:::calc --> K2["Branco igual · vermelho só no novo<br/>ciano só na arte"]:::ok
`,
    },
  ],
  inventario: [
    { tipo: "tela", nome: "/activities-preview", acao: "Atividades com dados de exemplo para testar excluir, restaurar e limpar a lixeira.", onde: "apps/web/app/(dev)/activities-preview/page.tsx:68", no: "A,A1,A2" },
    { tipo: "tela", nome: "/equipment-preview", acao: "Equipamentos com dados de exemplo para testar o tênis padrão por esporte e o Aplicar aos treinos antigos. Grava um token de mentira no navegador para passar pela checagem de sessão.", onde: "apps/web/app/(dev)/equipment-preview/page.tsx", no: "E,E1,E2" },
    { tipo: "tela", nome: "/coach-preview", acao: "Página da Duni com plano, memórias e conversa falsos; não chama a API nem a IA.", onde: "apps/web/app/(dev)/coach-preview/page.tsx", no: "C,C1,C2" },
    { tipo: "tela", nome: "/story-art-probe", acao: "Mede as faixas de transparência dos PNGs em public/story-art e imprime literais para lib/story/regions.ts.", onde: "apps/web/app/(dev)/story-art-probe/page.tsx", no: "P,P1,P2" },
    { tipo: "tela", nome: "/story-calibrate", acao: "?id=<modelo> compara o desenho com a arte; &color=%23RRGGBB mostra o modelo recolorido.", onde: "apps/web/app/(dev)/story-calibrate/page.tsx", no: "K,K1,K2" },
    { tipo: "permissão", nome: "Abertas em produção", acao: "Nenhuma confere NODE_ENV; no modo rápido continuam acessíveis (só com dados falsos).", onde: "apps/web/app/(dev)/" },
  ],
});
