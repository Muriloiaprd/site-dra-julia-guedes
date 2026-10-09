// Área 08 — Importação: tela /import e o caminho do arquivo dentro da API.
KACTUS_MAPA.areas.push({
  id: "importacao",
  n: 8,
  titulo: "Importação",
  resumo:
    "Arrastar ou escolher arquivos .fit, .gpx, .tcx, .csv ou .gz (export em massa do Garmin). O site manda em lotes de 15; se um lote falhar, divide ao meio e tenta de novo até lotes de 2. A API lê o arquivo, descarta duplicados, reduz o GPS a um ponto a cada 3 s, calcula as métricas derivadas e os recordes e, no fim do lote, recalcula a carga. Cada treino novo ganha o atalho 'Como foi? →' para o check-in.",
  rotas: ["/import"],
  arquivos: [
    "apps/web/app/import/page.tsx",
    "apps/web/lib/api.ts",
    "apps/api/kactus_api/routers/activities.py",
    "apps/api/kactus_api/parsers/dispatch.py",
    "apps/api/kactus_api/parsers/fit.py",
    "apps/api/kactus_api/parsers/gpx.py",
    "apps/api/kactus_api/parsers/tcx.py",
    "apps/api/kactus_api/parsers/csv_parser.py",
    "apps/api/kactus_api/services/import_service.py",
    "apps/api/kactus_api/services/derived_metrics.py",
    "apps/api/kactus_api/metrics/records.py",
    "apps/api/kactus_api/metrics/load.py",
  ],
  diagramas: [
    {
      titulo: "Tela de importação",
      mermaid: `
flowchart TD
  IN["/import"]:::tela --> DROP("Arrastar ou Selecionar arquivos"):::acao
  DROP --> EXT{"Extensão .fit .gpx .tcx<br/>.csv ou .gz?"}:::decisao
  EXT -->|não| IGN["Arquivo ignorado: nome. Use fit, gpx, tcx, csv, gz."]:::erro
  EXT -->|sim| Q["Fila: Aguardando…"]:::estado
  Q --> LOTE[["Lotes de 15"]]:::calc
  LOTE --> UP[/"POST /activities/upload/batch"/]:::api
  UP -->|lote falhou e tem mais de 2| HALF[["Divide ao meio e tenta de novo"]]:::calc
  HALF --> UP
  UP -->|lote de 2 falhou| ERRQ["Erro no item<br/>mensagem da API"]:::erro
  UP -->|ok| RES{"Resultado por arquivo"}:::decisao
  RES -->|novo| NEW["Esporte · distância · Como foi? →"]:::ok
  RES -->|duplicado| DUP["Duplicada (ignorada)"]:::estado
  RES -->|sem atividade| ZERO["Nenhuma atividade encontrada no arquivo"]:::estado
  RES -->|erro do arquivo| ERRF["Arquivo vazio · maior que 50MB · formato…"]:::erro
  NEW --> CK["/activities/id<br/>direto no check-in"]:::tela
  ERRQ --> RETRY("↻ Tentar novamente (N)"):::acao --> UP
  RES --> FIM["Dados sincronizados<br/>Ver no dashboard →"]:::ok
`,
    },
    {
      titulo: "O arquivo dentro da API",
      mermaid: `
flowchart TD
  F[/"Arquivo recebido"/]:::api --> E{"Vazio ou maior<br/>que 50 MB?"}:::decisao
  E -->|sim| X1["Arquivo vazio · Arquivo maior que 50MB"]:::erro
  E -->|não| GZ{"Termina em .gz?"}:::decisao
  GZ -->|sim| UNZ[["Descompacta e lê de novo<br/>pelo nome sem .gz"]]:::calc
  GZ -->|não| P{"Extensão"}:::decisao
  UNZ --> P
  P -->|fit| PF[["Parser FIT<br/>com campos do Garmin"]]:::calc
  P -->|gpx| PG[["Parser GPX"]]:::calc
  P -->|tcx| PT[["Parser TCX"]]:::calc
  P -->|csv| PC[["Parser CSV<br/>várias atividades"]]:::calc
  P -->|outra| SN{"Reconhece pelo conteúdo?"}:::decisao
  SN -->|não| X2["Formato nao suportado"]:::erro
  SN -->|sim| PF
  PF --> DUPQ{"Duplicado?<br/>hash, id da fonte ou<br/>mesmo início ±60 s e distância ±1%"}:::decisao
  PG --> DUPQ
  PT --> DUPQ
  PC --> DUPQ
  DUPQ -->|ativo| D1["duplicate = true"]:::estado
  DUPQ -->|na lixeira| REST[["Tira da lixeira"]]:::calc
  DUPQ -->|não| CRIA[["Cria a atividade<br/>GPS a cada 3 s, voltas"]]:::calc
  CRIA --> EQP[["Equipamento padrão do esporte<br/>se houver um ativo"]]:::calc
  EQP --> DER[["Cadência por perna ×2<br/>tempo em movimento, GAP, deriva"]]:::calc
  DER --> DB[("Banco Neon<br/>activities, points, laps")]:::ext
  DB --> RECS[["Recordes desta atividade"]]:::calc
  REST --> RECS
  RECS --> LOAD[["Carga diária desde a<br/>data mais antiga do lote"]]:::calc
`,
    },
  ],
  inventario: [
    { tipo: "tela", nome: "Importar atividades", acao: "Cabeçalho 'Central de dados' com ← Dashboard.", msg: "Exporte suas atividades do Garmin Connect, Strava, Polar, COROS ou qualquer relógio/app compatível e importe os arquivos aqui.", onde: "apps/web/app/import/page.tsx:150", no: "IN" },
    { tipo: "campo", nome: "Área de arrastar", acao: "Clique, Enter ou espaço abrem o seletor; aceita vários arquivos. No iPhone o seletor não filtra (o iOS não conhece .fit) e o filtro é feito depois.", msg: "Arraste seus arquivos aqui · Solte para importar · Selecionar arquivos", onde: "apps/web/app/import/page.tsx:161", no: "DROP" },
    { tipo: "validação", nome: "Extensão aceita", acao: ".fit, .gpx, .tcx, .csv, .gz; o resto é listado como ignorado.", msg: "Arquivo ignorado: nome. Use fit, gpx, tcx, csv, gz.", onde: "apps/web/app/import/page.tsx:52", no: "EXT,IGN" },
    { tipo: "cálculo", nome: "Lotes com divisão", acao: "15 por lote; se falhar, divide ao meio até 2 por lote. Evita perder tudo num tempo esgotado.", onde: "apps/web/app/import/page.tsx:73", no: "LOTE,HALF" },
    { tipo: "API", nome: "Upload em lote", acao: "Cada arquivo responde separado: importadas, duplicadas ou erro.", api: "POST /activities/upload/batch", onde: "apps/api/kactus_api/routers/activities.py:87", no: "UP" },
    { tipo: "aviso", nome: "Não feche a página", acao: "Durante o envio a página avisa e o navegador pede confirmação para sair.", msg: "⏳ Importando — não feche nem navegue para outra página até terminar.", onde: "apps/web/app/import/page.tsx:271" },
    { tipo: "carregando", nome: "Barra de progresso", acao: "N de M arquivo(s) e porcentagem; estado 'Processando dados…'.", onde: "apps/web/app/import/page.tsx:261" },
    { tipo: "card", nome: "Importadas · Distância · Duplicadas · Erros", acao: "Contadores animados do lote; Erros mostra os pontos de GPS gravados.", onde: "apps/web/app/import/page.tsx:275" },
    { tipo: "seção", nome: "Fila de arquivos", acao: "Ícone de estado, extensão, nome e o resultado de cada um.", msg: "Aguardando… · Enviando e processando… · Nenhuma atividade encontrada no arquivo · Duplicada (ignorada)", onde: "apps/web/app/import/page.tsx:308", no: "Q,DUP,ZERO" },
    { tipo: "link", nome: "Como foi? →", acao: "Leva ao check-in do treino recém-importado.", onde: "apps/web/app/import/page.tsx:330", no: "NEW,CK" },
    { tipo: "botão", nome: "↻ Tentar novamente (N)", acao: "Reenvia só os que deram erro.", onde: "apps/web/app/import/page.tsx:250", no: "RETRY,ERRQ" },
    { tipo: "botão", nome: "Limpar lista", acao: "Tira da fila o que terminou.", onde: "apps/web/app/import/page.tsx:254" },
    { tipo: "sucesso", nome: "Concluído", acao: "Resumo e link para o dashboard.", msg: "✓ N atividade(s) · X km prontas para análise. · Ver no dashboard →", onde: "apps/web/app/import/page.tsx:298", no: "FIM" },
    { tipo: "erro", nome: "Concluído com erros", msg: "Importação concluída com erros", onde: "apps/web/app/import/page.tsx:244" },
    { tipo: "seção", nome: "Como exportar do Garmin Connect", acao: "Quatro passos; aparece com a fila vazia.", onde: "apps/web/app/import/page.tsx:348" },
    { tipo: "validação", nome: "Tamanho e arquivo vazio", msg: "Arquivo vazio · Arquivo maior que 50MB", onde: "apps/api/kactus_api/routers/activities.py:108", no: "E,X1" },
    { tipo: "cálculo", nome: "Escolha do leitor", acao: "Pela extensão; .gz é descompactado; sem extensão conhecida, tenta reconhecer FIT, GPX ou TCX pelo conteúdo.", msg: "Formato nao suportado: 'nome' · Arquivo .gz corrompido ou invalido", onde: "apps/api/kactus_api/parsers/dispatch.py:16", no: "GZ,UNZ,P,SN,X2,PF,PG,PT,PC" },
    { tipo: "cálculo", nome: "Duplicados", acao: "Mesmo hash do arquivo, mesmo id na fonte, ou início a menos de 60 s com distância até 1% diferente.", onde: "apps/api/kactus_api/services/import_service.py:142", no: "DUPQ,D1,REST" },
    { tipo: "cálculo", nome: "Gravação", acao: "GPS reduzido a um ponto a cada 3 s; resumo calculado sobre a série completa antes de reduzir; arquivo original guardado em disco.", onde: "apps/api/kactus_api/services/import_service.py:92", no: "CRIA,DB" },
    { tipo: "cálculo", nome: "Equipamento padrão", acao: "O treino novo entra com o equipamento ativo marcado como padrão do esporte (ex.: o tênis da corrida).", onde: "apps/api/kactus_api/services/import_service.py:92", no: "EQP" },
    { tipo: "cálculo", nome: "Métricas derivadas", acao: "Cadência por perna vira passos/min, GAP e deriva cardíaca da atividade e de cada volta.", onde: "apps/api/kactus_api/services/derived_metrics.py:54", no: "DER" },
    { tipo: "cálculo", nome: "Recordes e carga", acao: "Recordes desta atividade na hora; carga diária uma vez só, a partir da data mais antiga do lote.", onde: "apps/api/kactus_api/routers/activities.py:148", no: "RECS,LOAD" },
    { tipo: "API", nome: "Upload de um arquivo", acao: "Versão de um arquivo só; nenhuma tela usa hoje.", api: "POST /activities/upload", msg: "415 formato · 422 arquivo inválido", onde: "apps/api/kactus_api/routers/activities.py:42" },
  ],
});
