// Área 06 — Detalhe da atividade.
KACTUS_MAPA.areas.push({
  id: "detalhe",
  n: 6,
  titulo: "Detalhe da atividade",
  resumo:
    "Página de um treino. No topo: esporte, data, título e as ações Compartilhar, Editar e Excluir. Depois vêm as métricas principais e secundárias, o check-in pós-treino, o comentário da Duni (só quando pedido), os dados extras do relógio, mapa, zonas de FC, gráficos de elevação, pace×FC e dinâmica de corrida, e os splits por km.",
  rotas: ["/activities/[id]", "/activities/[id]#checkin"],
  arquivos: [
    "apps/web/app/activities/[id]/page.tsx",
    "apps/web/components/activity/CheckinPanel.tsx",
    "apps/web/components/activity/DuniComment.tsx",
    "apps/web/components/activity/WatchPanel.tsx",
    "apps/web/components/ActivityMap.tsx",
    "apps/api/kactus_api/routers/activities.py",
    "apps/api/kactus_api/checkin_tags.py",
  ],
  diagramas: [
    {
      titulo: "Abertura e ações do topo",
      mermaid: `
flowchart TD
  IN("Abre /activities/id"):::acao --> API[/"GET /activities/id<br/>GET /activities/id/splits<br/>GET /activities/id/zones"/]:::api
  API --> SK(["Esqueleto"]):::estado
  API -->|atividade falhou| NF["Atividade não encontrada<br/>← Voltar ao dashboard"]:::erro
  API -->|ok| PG["Página do treino"]:::tela
  PG -->|veio de Como foi?| CK["Rola até o check-in"]:::estado
  PG --> SH("📤 Compartilhar"):::acao --> STORY["Gerador de Story"]:::tela
  PG --> ED("✏️ Editar"):::acao --> FORM["Título · Modalidade · Equipamento · Descrição"]:::tela
  FORM --> EQ[/"GET /equipment"/]:::api
  FORM --> SV("Salvar"):::acao --> PA[/"PATCH /activities/id"/]:::api
  PA -->|ok| PG
  PA -->|erro| SE["Erro ao salvar"]:::erro
  PG --> EX("🗑️ Excluir"):::acao --> CF{"Excluir esta atividade?<br/>confirm do navegador"}:::decisao
  CF -->|sim| DEL[/"DELETE /activities/id"/]:::api --> LST["/activities"]:::tela
`,
    },
    {
      titulo: "Check-in e comentário da Duni",
      mermaid: `
flowchart TD
  C0{"Já tem check-in?"}:::decisao
  C0 -->|não| CKF["Formulário aberto"]:::tela
  C0 -->|sim| RES["Resumo: esforço, carga interna,<br/>sensação, dor, etiquetas, notas"]:::tela
  RES --> EDT("Editar"):::acao --> CKF
  CKF --> W{"Relógio gravou<br/>sensação ou esforço?"}:::decisao
  W -->|sim| USE("Usar no check-in"):::acao --> CKF
  CKF --> SAVE("Salvar check-in"):::acao --> PUT[/"PUT /activities/id/checkin"/]:::api
  PUT --> SRPE[["Carga interna = esforço × minutos"]]:::calc --> RES
  PUT -->|erro| ERR["Não consegui salvar"]:::erro
  RES --> APAGA("Apagar check-in"):::acao --> PUT
  D0["Comentário da Duni"]:::tela --> G[/"GET /coach/activities/id/analyze<br/>último salvo, sem IA"/]:::api
  G --> HAS{"Já existe?"}:::decisao
  HAS -->|não| ASK("Pedir comentário"):::acao
  HAS -->|sim| SHOW["Texto + data + modelo"]:::ok
  SHOW --> AGAIN("Pedir de novo"):::acao
  ASK --> IA{{"POST /coach/activities/id/analyze<br/>lê voltas, FC, deriva, check-in, plano"}}:::ia
  AGAIN --> IA
  IA -->|ok| SHOW
  IA -->|erro| EIA["Mensagem da Duni<br/>cota, chave, modelo…"]:::erro
`,
    },
  ],
  inventario: [
    { tipo: "API", nome: "Carregar o treino", acao: "Atividade com pontos e voltas, splits de 1 km e zonas de FC, em paralelo.", api: "GET /activities/{id} · GET /activities/{id}/splits?split_m=1000 · GET /activities/{id}/zones", onde: "apps/web/app/activities/[id]/page.tsx:107", no: "API" },
    { tipo: "carregando", nome: "Esqueleto", onde: "apps/web/app/activities/[id]/page.tsx:138", no: "SK" },
    { tipo: "erro", nome: "Não encontrada", acao: "Também para atividades na lixeira.", msg: "Atividade não encontrada · ← Voltar ao dashboard", onde: "apps/web/app/activities/[id]/page.tsx:150", no: "NF" },
    { tipo: "link", nome: "Trilha Dashboard / Atividades / título", onde: "apps/web/app/activities/[id]/page.tsx:268" },
    { tipo: "seção", nome: "Topo", acao: "Esporte, data e hora, título (ou 'X km — tempo').", onde: "apps/web/app/activities/[id]/page.tsx:277", no: "PG" },
    { tipo: "botão", nome: "📤 Compartilhar", acao: "Abre o gerador de Story.", onde: "apps/web/app/activities/[id]/page.tsx:292", no: "SH" },
    { tipo: "botão", nome: "✏️ Editar", acao: "Abre o formulário no próprio topo e busca os equipamentos.", api: "GET /equipment", onde: "apps/web/app/activities/[id]/page.tsx:296", no: "ED,EQ" },
    { tipo: "campo", nome: "Título · Modalidade · Equipamento · Descrição", acao: "Modalidade com 14 opções; Equipamento com 'Nenhum'. A descrição abre sempre vazia.", onde: "apps/web/app/activities/[id]/page.tsx:310", no: "FORM" },
    { tipo: "botão", nome: "Salvar / Cancelar", api: "PATCH /activities/{id}", msg: "Salvando…", onde: "apps/web/app/activities/[id]/page.tsx:357", no: "SV,PA" },
    { tipo: "API", nome: "Editar atividade", acao: "Título, descrição, esporte e equipamento. Trocar o equipamento recalcula o km dos tênis.", api: "PATCH /activities/{id}", onde: "apps/api/kactus_api/routers/activities.py:333" },
    { tipo: "erro", nome: "Erro ao salvar", msg: "Erro ao salvar", onde: "apps/web/app/activities/[id]/page.tsx:215", no: "SE" },
    { tipo: "botão", nome: "🗑️ Excluir", acao: "Confirma e manda para a lixeira; volta para a lista.", msg: "Excluir esta atividade? Esta ação não pode ser desfeita.", onde: "apps/web/app/activities/[id]/page.tsx:221", no: "EX,CF,DEL" },
    { tipo: "card", nome: "Métricas principais", acao: "Distância, tempo em movimento (ou duração), pace médio (ou velocidade), FC média.", onde: "apps/web/app/activities/[id]/page.tsx:367" },
    { tipo: "card", nome: "Métricas secundárias", acao: "Tempo total (se houve pausa ≥ 5 s), FC máx, elevação, velocidade, pace ajustado (GAP), deriva cardíaca, cadência, potência, calorias; cada uma com dica ao passar o mouse.", onde: "apps/web/app/activities/[id]/page.tsx:241" },
    { tipo: "seção", nome: "Como foi o treino?", acao: "Check-in opcional. Aberto se ainda não houver; senão mostra o resumo com Editar.", msg: "Opcional. O relógio não sabe como você se sentiu — isso ajuda a Duni a separar cansaço de verdade de um dia ruim.", onde: "apps/web/components/activity/CheckinPanel.tsx:103", no: "C0,CKF,RES,EDT" },
    { tipo: "botão", nome: "Usar no check-in", acao: "Aparece quando o relógio gravou sensação ou esforço e ainda não há check-in.", msg: "O relógio registrou: … · Confira: o relógio grava isso quando a tela de avaliação é só confirmada.", onde: "apps/web/components/activity/CheckinPanel.tsx:169", no: "W,USE" },
    { tipo: "campo", nome: "Esforço 0 a 10", acao: "Escala de Borg CR10 com explicação de cada número.", onde: "apps/web/components/activity/CheckinPanel.tsx:182" },
    { tipo: "campo", nome: "Como o corpo respondeu", acao: "Ótimo, Bem, Normal, Cansado, Pernas pesadas, Sem energia.", onde: "apps/web/components/activity/CheckinPanel.tsx:195" },
    { tipo: "campo", nome: "Etiquetas", acao: "Grupos vindos da API (contexto do treino).", api: "GET /activities/checkin-tags", onde: "apps/web/components/activity/CheckinPanel.tsx:213" },
    { tipo: "campo", nome: "Dor 0 a 10 + local", acao: "Com dor > 0: chips de local (Pé, Tornozelo, Canela, Panturrilha, Joelho, Posterior da coxa, Frente da coxa, Quadril, Lombar) e campo livre de até 100 caracteres.", onde: "apps/web/components/activity/CheckinPanel.tsx:236" },
    { tipo: "aviso", nome: "Dor forte", acao: "Com dor ≥ 5.", msg: "Dor forte, que piora durante a corrida ou que muda seu jeito de correr: vale procurar um fisioterapeuta ou médico.", onde: "apps/web/components/activity/CheckinPanel.tsx:262" },
    { tipo: "campo", nome: "Observações", acao: "Até 2000 caracteres.", onde: "apps/web/components/activity/CheckinPanel.tsx:273" },
    { tipo: "botão", nome: "Salvar check-in / Cancelar / Apagar check-in", acao: "Apagar envia tudo vazio.", api: "PUT /activities/{id}/checkin", onde: "apps/web/components/activity/CheckinPanel.tsx:286", no: "SAVE,PUT,APAGA" },
    { tipo: "cálculo", nome: "Carga interna", acao: "Esforço × minutos em movimento (sRPE).", onde: "apps/api/kactus_api/routers/activities.py:370", no: "SRPE" },
    { tipo: "erro", nome: "Check-in não salvou", msg: "Não consegui salvar", onde: "apps/web/components/activity/CheckinPanel.tsx:162", no: "ERR" },
    { tipo: "IA", nome: "Comentário da Duni", acao: "Só chama a IA quando pedido (nunca na importação). Sem check-in, avisa que ela só vê o relógio.", api: "GET e POST /coach/activities/{id}/analyze", msg: "A Duni está lendo o treino… · Sem check-in neste treino. Preencha acima e peça de novo…", onde: "apps/web/components/activity/DuniComment.tsx:15", no: "D0,G,HAS,ASK,AGAIN,IA,SHOW" },
    { tipo: "erro", nome: "Erro da Duni", acao: "Título e explicação por código (ver área Duni).", onde: "apps/web/components/activity/DuniComment.tsx:35", no: "EIA" },
    { tipo: "seção", nome: "Mais do relógio", acao: "Efeito de treino, dinâmica de corrida, minutos de intensidade, correndo × andando, temperatura, calorias e suor, outros. Some se o treino não tiver nada disso.", onde: "apps/web/components/activity/WatchPanel.tsx:65" },
    { tipo: "seção", nome: "Rota", acao: "Mapa Leaflet com a linha do percurso.", onde: "apps/web/app/activities/[id]/page.tsx:406" },
    { tipo: "seção", nome: "Zonas de frequência cardíaca", acao: "Z1 Recuperação a Z5 VO2 máx com % e tempo; só aparece se houver tempo em alguma zona.", msg: "Calculado a partir da sua FC máxima configurada no perfil.", onde: "apps/web/app/activities/[id]/page.tsx:412" },
    { tipo: "seção", nome: "Perfil de elevação", onde: "apps/web/app/activities/[id]/page.tsx:441" },
    { tipo: "seção", nome: "Pace & frequência cardíaca", acao: "Ou velocidade, se não houver pace.", onde: "apps/web/app/activities/[id]/page.tsx:471" },
    { tipo: "aba", nome: "Dinâmica de corrida", acao: "Uma série por vez: Cadência, Passada, Oscilação, Proporção vertical, Contato com o solo. Só em corrida com 2+ séries.", onde: "apps/web/app/activities/[id]/page.tsx:516" },
    { tipo: "seção", nome: "Splits por km", acao: "Pace, GAP (corrida), tempo, FC, elevação; destaca o mais rápido.", onde: "apps/web/app/activities/[id]/page.tsx:540" },
  ],
});
