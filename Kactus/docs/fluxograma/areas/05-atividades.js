// Área 05 — Atividades: lista, filtros, exclusão e lixeira.
KACTUS_MAPA.areas.push({
  id: "atividades",
  n: 5,
  titulo: "Atividades (lista e lixeira)",
  resumo:
    "Lista de todos os treinos, 100 por vez, com busca e filtros que rodam no navegador sobre o que já foi carregado. Excluir manda o treino para a lixeira (some das contas, mas dá para restaurar). A lixeira mostra os excluídos, deixa restaurar um a um ou apagar tudo de vez.",
  rotas: ["/activities"],
  arquivos: [
    "apps/web/app/activities/page.tsx",
    "apps/web/components/activities/TrashPanel.tsx",
    "apps/web/lib/api.ts",
    "apps/api/kactus_api/routers/activities.py",
    "apps/api/kactus_api/services/import_service.py",
  ],
  diagramas: [
    {
      titulo: "Lista, filtros e exclusão",
      mermaid: `
flowchart TD
  IN("Abre /activities"):::acao --> L[/"GET /activities · 100 por vez<br/>GET /activities/trash"/]:::api
  L --> LD(["Esqueleto da tabela"]):::estado
  L -->|erro| E1["Erro ao carregar atividades"]:::erro
  L -->|ok| LIST["Totais + filtros + tabela ou cartões"]:::tela
  LIST --> F("Busca, modalidade, período,<br/>filtros avançados"):::acao
  F --> FIL[["Filtra no navegador<br/>só o que já foi carregado"]]:::calc
  FIL -->|nada| VZ["Nenhuma atividade encontrada<br/>Limpar filtros ou Importar"]:::estado
  FIL --> LIST
  LIST -->|100 vieram| MAIS("Carregar mais atividades"):::acao
  MAIS --> L2[/"GET /activities?offset=N"/]:::api --> LIST
  LIST -->|linha ou cartão| DET["/activities/id"]:::tela
  LIST --> EX("Excluir ou 🗑"):::acao
  EX --> CF{"Mover a atividade para a lixeira?<br/>confirm do navegador"}:::decisao
  CF -->|não| LIST
  CF -->|sim| DEL[/"DELETE /activities/id"/]:::api
  DEL --> SOFT[["deleted_at = agora<br/>recalcula carga e recordes"]]:::calc
  SOFT --> LIST
`,
    },
    {
      titulo: "Lixeira",
      mermaid: `
flowchart TD
  B("Lixeira (N)"):::acao --> P["Painel Lixeira"]:::tela
  P -->|vazia| V["A lixeira está vazia."]:::estado
  P --> R("Restaurar"):::acao
  R --> RA[/"POST /activities/id/restore"/]:::api
  RA -->|ok| RC[["deleted_at = vazio<br/>recalcula carga e recordes"]]:::calc
  RC --> REL["Sai da lixeira e volta à lista"]:::ok
  RA -->|404| RE["Atividade nao esta na lixeira"]:::erro
  P --> LIM("Limpar lixeira"):::acao
  LIM --> CONF["Apagar de vez N atividades, com mapa e voltas?<br/>Não dá para desfazer."]:::decisao
  CONF -->|Cancelar| P
  CONF -->|Apagar de vez| DT[/"DELETE /activities/trash"/]:::api
  DT --> HARD[["Apaga atividade + pontos + voltas<br/>treino planejado casado volta a planejado"]]:::calc
  HARD --> V
  IMP("Reimportar o mesmo arquivo"):::acao --> DUP{"Duplicado está<br/>na lixeira?"}:::decisao
  DUP -->|sim| RC
  DUP -->|não, ativo| D2["Duplicada (ignorada)"]:::estado
`,
    },
  ],
  inventario: [
    { tipo: "tela", nome: "Atividades", acao: "Cabeçalho 'Histórico · Atividades' com os botões Lixeira e + Importar.", msg: "Todos os seus treinos importados, com filtros por modalidade, período e esforço.", onde: "apps/web/app/activities/page.tsx:214", no: "LIST" },
    { tipo: "API", nome: "Lista paginada", acao: "100 por página, mais recentes primeiro, sem os excluídos.", api: "GET /activities?limit=100&offset=N", onde: "apps/web/app/activities/page.tsx:82", no: "L,L2" },
    { tipo: "carregando", nome: "Esqueleto", acao: "Seis linhas cinza enquanto carrega; os totais também.", onde: "apps/web/app/activities/page.tsx:358", no: "LD" },
    { tipo: "erro", nome: "Erro ao carregar", msg: "Erro ao carregar atividades", onde: "apps/web/app/activities/page.tsx:93", no: "E1" },
    { tipo: "card", nome: "Totais do filtro", acao: "Atividades (com '+' se há mais páginas), Distância, Tempo em movimento, Elevação. Somam só o que está carregado.", onde: "apps/web/app/activities/page.tsx:248" },
    { tipo: "campo", nome: "Buscar por nome ou modalidade", acao: "Procura no título e no nome do esporte; ✕ limpa.", onde: "apps/web/app/activities/page.tsx:270", no: "F" },
    { tipo: "filtro", nome: "Modalidade", acao: "14 chips: Corrida, Trail, Esteira, Bike, MTB, Gravel, Bike indoor, Natação, Águas abertas, Multiesporte, Caminhada, Musculação, Pilates, Outro. Vários ao mesmo tempo.", onde: "apps/web/app/activities/page.tsx:300" },
    { tipo: "filtro", nome: "Período", acao: "7 dias, 30 dias, 3 meses, 6 meses, 1 ano, Tudo (padrão), Personalizado (De … até …).", onde: "apps/web/app/activities/page.tsx:322" },
    { tipo: "filtro", nome: "Filtros avançados", acao: "Faixas mín–máx de Distância (km), Duração (min), FC média (bpm), Pace (min/km) e Elevação (m). O botão mostra quantos estão ativos.", onde: "apps/web/app/activities/page.tsx:345" },
    { tipo: "botão", nome: "✕ Limpar", acao: "Zera busca, modalidades, período e faixas.", onde: "apps/web/app/activities/page.tsx:294" },
    { tipo: "cálculo", nome: "Filtro local", acao: "Filtra no navegador; atividades de páginas ainda não carregadas não entram.", onde: "apps/web/app/activities/page.tsx:174", no: "FIL" },
    { tipo: "vazio", nome: "Nada com esses filtros", acao: "Com filtro ativo oferece Limpar filtros; sem filtro, Importar atividades →.", msg: "Nenhuma atividade encontrada com esses filtros.", onde: "apps/web/app/activities/page.tsx:362", no: "VZ" },
    { tipo: "seção", nome: "Tabela (computador)", acao: "Atividade, Data, Distância, Duração, Pace/Vel., FC, Elevação, Fonte, Excluir. Clicar na linha abre o detalhe.", onde: "apps/web/app/activities/page.tsx:372", no: "DET" },
    { tipo: "seção", nome: "Cartões (celular)", acao: "Título, data, duração, distância e ritmo; botão 🗑 ao lado.", onde: "apps/web/app/activities/page.tsx:436" },
    { tipo: "botão", nome: "Excluir", acao: "Pergunta e manda para a lixeira; some da lista e o contador da lixeira atualiza.", msg: "Mover a atividade para a lixeira? Dá para restaurar depois.", onde: "apps/web/app/activities/page.tsx:118", no: "EX,CF" },
    { tipo: "API", nome: "Excluir (lixeira)", acao: "Preenche deleted_at e recalcula carga do dia em diante e os recordes (em segundo plano).", api: "DELETE /activities/{id}", onde: "apps/api/kactus_api/routers/activities.py:393", no: "DEL,SOFT" },
    { tipo: "erro", nome: "Erro ao excluir", msg: "Erro ao excluir atividade", onde: "apps/web/app/activities/page.tsx:125" },
    { tipo: "botão", nome: "Carregar mais atividades", acao: "Aparece enquanto vierem páginas cheias de 100.", msg: "Carregando…", onde: "apps/web/app/activities/page.tsx:475", no: "MAIS" },
    { tipo: "botão", nome: "Lixeira (N)", acao: "Abre e fecha o painel da lixeira.", onde: "apps/web/app/activities/page.tsx:221", no: "B" },
    { tipo: "API", nome: "Itens da lixeira", acao: "Excluídos, o mais recente primeiro.", api: "GET /activities/trash", onde: "apps/api/kactus_api/routers/activities.py:268" },
    { tipo: "seção", nome: "Painel Lixeira", acao: "Cada item: esporte, título, data, distância, duração e 'excluída em'.", msg: "Atividades excluídas. Restaurar devolve o treino e recalcula carga e recordes.", onde: "apps/web/components/activities/TrashPanel.tsx:57", no: "P" },
    { tipo: "vazio", nome: "Lixeira vazia", msg: "A lixeira está vazia.", onde: "apps/web/components/activities/TrashPanel.tsx:97", no: "V" },
    { tipo: "botão", nome: "Restaurar", acao: "Tira da lixeira e recarrega a lista.", api: "POST /activities/{id}/restore", msg: "Restaurando…", onde: "apps/web/components/activities/TrashPanel.tsx:111", no: "R,RA,RC" },
    { tipo: "erro", nome: "Não está na lixeira", acao: "Restaurar algo que já saiu (ou de outro usuário).", msg: "Atividade nao esta na lixeira", onde: "apps/api/kactus_api/routers/activities.py:289", no: "RE" },
    { tipo: "botão", nome: "Limpar lixeira", acao: "Abre a confirmação na própria tela.", onde: "apps/web/components/activities/TrashPanel.tsx:67", no: "LIM" },
    { tipo: "validação", nome: "Confirmação de apagar de vez", acao: "Faixa vermelha com Apagar de vez e Cancelar.", msg: "Apagar de vez N atividades, com mapa e voltas? Não dá para desfazer.", onde: "apps/web/components/activities/TrashPanel.tsx:75", no: "CONF" },
    { tipo: "API", nome: "Apagar de vez", acao: "Apaga atividade, pontos e voltas; o treino planejado que estava casado volta a 'planejado'.", api: "DELETE /activities/trash", onde: "apps/api/kactus_api/routers/activities.py:299", no: "DT,HARD" },
    { tipo: "erro", nome: "Erros da lixeira", msg: "Não consegui restaurar · Não consegui limpar a lixeira", onde: "apps/web/components/activities/TrashPanel.tsx:38" },
    { tipo: "botão", nome: "Fechar", acao: "Fecha o painel.", onde: "apps/web/components/activities/TrashPanel.tsx:71" },
    { tipo: "cálculo", nome: "Reimportar tira da lixeira", acao: "Se o arquivo importado já existe na lixeira (mesmo hash, mesmo id da fonte ou mesmo início ±60 s com distância ±1%), ele volta em vez de ser 'duplicado'.", onde: "apps/api/kactus_api/services/import_service.py:48", no: "IMP,DUP" },
  ],
});
