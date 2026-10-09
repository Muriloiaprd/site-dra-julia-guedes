// Área 05 — Atividades: lista, filtros, exclusão e lixeira.
KACTUS_MAPA.areas.push({
  id: "atividades",
  n: 5,
  titulo: "Atividades (lista, lixeira e comparar)",
  resumo:
    "Lista de todos os treinos, 100 por vez, com busca e filtros que rodam no navegador sobre o que já foi carregado. Excluir manda o treino para a lixeira (some das contas, mas dá para restaurar). A lixeira mostra os excluídos, deixa restaurar um a um ou apagar tudo de vez. ⇄ Comparar marca dois treinos e abre os dois lado a lado.",
  rotas: ["/activities", "/activities/compare"],
  arquivos: [
    "apps/web/app/activities/page.tsx",
    "apps/web/components/activities/TrashPanel.tsx",
    "apps/web/app/activities/compare/page.tsx",
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
      titulo: "Comparar dois treinos",
      mermaid: `
flowchart TD
  CB("⇄ Comparar na lista"):::acao --> CM["Modo comparar<br/>caixinhas + barra embaixo"]:::tela
  CDT("⇄ Comparar no detalhe"):::acao --> CQ[["/activities?comparar=id<br/>já vem marcado"]]:::calc --> CM
  CM --> CK("Marcar treinos<br/>o 3º troca o mais antigo"):::acao --> CM
  CM -->|menos de 2| CW["Marque mais um treino para comparar (1/2)"]:::estado
  CM -->|Cancelar| LIST2["Lista normal"]:::tela
  CM -->|2 marcados · Comparar| CP["/activities/compare?a=…&b=…"]:::tela
  CP --> CA[/"GET /activities/a e /b<br/>GET …/splits"/]:::api
  CA -->|erro| CE["Erro ao carregar os treinos"]:::erro
  CA -->|ok| CT["Números A, B e B − A<br/>verde = B melhor"]:::tela
  CT --> CC[["Ritmo e FC por distância<br/>blocos de 50 m+, suavizados"]]:::calc --> CG["Curvas sobrepostas<br/>tooltip com A e B"]:::tela
  CT --> CS["Parciais por km lado a lado"]:::tela
  CP -->|sem a ou b| CV["Escolha dois treinos"]:::estado
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
    { tipo: "tela", nome: "Atividades", acao: "Cabeçalho 'Histórico · Atividades' com os botões Lixeira e + Importar.", msg: "Todos os seus treinos importados, com filtros por modalidade, período e esforço.", onde: "apps/web/app/activities/page.tsx:227", no: "LIST" },
    { tipo: "API", nome: "Lista paginada", acao: "100 por página, mais recentes primeiro, sem os excluídos.", api: "GET /activities?limit=100&offset=N", onde: "apps/web/app/activities/page.tsx:84", no: "L,L2" },
    { tipo: "carregando", nome: "Esqueleto", acao: "Seis linhas cinza enquanto carrega; os totais também.", onde: "apps/web/app/activities/page.tsx:379", no: "LD" },
    { tipo: "erro", nome: "Erro ao carregar", msg: "Erro ao carregar atividades", onde: "apps/web/app/activities/page.tsx:95", no: "E1" },
    { tipo: "card", nome: "Totais do filtro", acao: "Atividades (com '+' se há mais páginas), Distância, Tempo em movimento, Elevação. Somam só o que está carregado.", onde: "apps/web/app/activities/page.tsx:269" },
    { tipo: "campo", nome: "Buscar por nome ou modalidade", acao: "Procura no título e no nome do esporte; ✕ limpa.", onde: "apps/web/app/activities/page.tsx:291", no: "F" },
    { tipo: "filtro", nome: "Modalidade", acao: "14 chips: Corrida, Trail, Esteira, Bike, MTB, Gravel, Bike indoor, Natação, Águas abertas, Multiesporte, Caminhada, Musculação, Pilates, Outro. Vários ao mesmo tempo.", onde: "apps/web/app/activities/page.tsx:321" },
    { tipo: "filtro", nome: "Período", acao: "7 dias, 30 dias, 3 meses, 6 meses, 1 ano, Tudo (padrão), Personalizado (De … até …).", onde: "apps/web/app/activities/page.tsx:343" },
    { tipo: "filtro", nome: "Filtros avançados", acao: "Faixas mín–máx de Distância (km), Duração (min), FC média (bpm), Pace (min/km) e Elevação (m). O botão mostra quantos estão ativos.", onde: "apps/web/app/activities/page.tsx:366" },
    { tipo: "botão", nome: "✕ Limpar", acao: "Zera busca, modalidades, período e faixas.", onde: "apps/web/app/activities/page.tsx:315" },
    { tipo: "cálculo", nome: "Filtro local", acao: "Filtra no navegador; atividades de páginas ainda não carregadas não entram.", onde: "apps/web/app/activities/page.tsx:187", no: "FIL" },
    { tipo: "vazio", nome: "Nada com esses filtros", acao: "Com filtro ativo oferece Limpar filtros; sem filtro, Importar atividades →.", msg: "Nenhuma atividade encontrada com esses filtros.", onde: "apps/web/app/activities/page.tsx:383", no: "VZ" },
    { tipo: "seção", nome: "Tabela (computador)", acao: "Atividade, Data, Distância, Duração, Pace/Vel., FC, Elevação, Fonte, Excluir. Clicar na linha abre o detalhe.", onde: "apps/web/app/activities/page.tsx:393", no: "DET" },
    { tipo: "seção", nome: "Cartões (celular)", acao: "Título, data, duração, distância e ritmo; botão 🗑 ao lado.", onde: "apps/web/app/activities/page.tsx:475" },
    { tipo: "botão", nome: "Excluir", acao: "Pergunta e manda para a lixeira; some da lista e o contador da lixeira atualiza.", msg: "Mover a atividade para a lixeira? Dá para restaurar depois.", onde: "apps/web/app/activities/page.tsx:131", no: "EX,CF" },
    { tipo: "API", nome: "Excluir (lixeira)", acao: "Preenche deleted_at e recalcula carga do dia em diante e os recordes (em segundo plano).", api: "DELETE /activities/{id}", onde: "apps/api/kactus_api/routers/activities.py:393", no: "DEL,SOFT" },
    { tipo: "erro", nome: "Erro ao excluir", acao: "Aparece quando a API recusa; o item continua na lista.", msg: "Erro ao excluir atividade", onde: "apps/web/app/activities/page.tsx:138" },
    { tipo: "botão", nome: "Carregar mais atividades", acao: "Aparece enquanto vierem páginas cheias de 100.", msg: "Carregando…", onde: "apps/web/app/activities/page.tsx:539", no: "MAIS" },
    { tipo: "botão", nome: "⇄ Comparar", acao: "Liga e desliga o modo comparar: caixinha em cada linha (no celular o cartão inteiro marca), clique na linha marca em vez de abrir; com dois marcados, marcar outro troca o mais antigo. ?comparar=1 abre o modo; ?comparar=<id> já vem com o treino marcado.", onde: "apps/web/app/activities/page.tsx:99", no: "CB,CQ,CM,CK" },
    { tipo: "seção", nome: "Barra Comparar treinos", acao: "Fixa embaixo da lista: quantos faltam, Cancelar e Comparar (só com dois).", msg: "Marque dois treinos para comparar (0/2). · Pronto: 2 treinos marcados.", onde: "apps/web/app/activities/page.tsx:519", no: "CW,LIST2" },
    { tipo: "tela", nome: "Comparar treinos", acao: "Cartões Treino A (verde) e B (azul) com link para cada um; tabela de métricas que existem em pelo menos um (distância, tempo, ritmo ou velocidade, GAP, FC média e máxima, deriva, subida, cadência, potência, contato, temperatura, efeito aeróbico, carga, calorias) com B − A em verde quando B foi melhor.", api: "GET /activities/{id} · GET /activities/{id}/splits", msg: "Erro ao carregar os treinos", onde: "apps/web/app/activities/compare/page.tsx:92", no: "CP,CA,CE,CT" },
    { tipo: "gráfico", nome: "Curvas por distância", acao: "Ritmo (ou velocidade, se os dois forem bike) e FC dos dois treinos no mesmo eixo de km, em blocos de no mínimo 50 m suavizados; ritmo mais lento que 15 min/km some (parado).", onde: "apps/web/app/activities/compare/page.tsx:21", no: "CC,CG" },
    { tipo: "seção", nome: "Parciais por km", acao: "Ritmo (ou tempo na bike) e FC de cada km dos dois, com a diferença em segundos.", onde: "apps/web/app/activities/compare/page.tsx:196", no: "CS" },
    { tipo: "vazio", nome: "Sem os dois treinos", acao: "Abrir /activities/compare sem a e b.", msg: "Escolha dois treinos · Em Atividades, toque em ⇄ Comparar e marque os dois treinos.", onde: "apps/web/app/activities/compare/page.tsx:122", no: "CV" },
    { tipo: "botão", nome: "Lixeira (N)", acao: "Abre e fecha o painel da lixeira.", onde: "apps/web/app/activities/page.tsx:234", no: "B" },
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
