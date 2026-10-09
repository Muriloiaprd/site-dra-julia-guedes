// Área 11 — Equipamentos.
KACTUS_MAPA.areas.push({
  id: "equipamentos",
  n: 11,
  titulo: "Equipamentos",
  resumo:
    "Cadastro de tênis, roupas, relógio, bike e outros, com foto. Só os tênis contam quilometragem: a distância inicial mais a soma dos treinos ligados a eles. Tênis com 500 km ganham um aviso e com 600 km o alerta de troca. Embaixo, sugestões de equipamento para os esportes praticados nos últimos 90 dias, com botão 'Já tenho' que abre o cadastro preenchido.",
  rotas: ["/equipment"],
  arquivos: [
    "apps/web/app/equipment/page.tsx",
    "apps/web/components/equipment/Recommendations.tsx",
    "apps/web/lib/image.ts",
    "apps/api/kactus_api/routers/equipment.py",
    "apps/api/kactus_api/services/equipment_recommendations.py",
    "apps/api/kactus_api/equipment_catalog.py",
  ],
  diagramas: [
    {
      titulo: "Cadastro, alertas e recomendados",
      mermaid: `
flowchart TD
  IN("Abre /equipment"):::acao --> API[/"GET /equipment<br/>GET /equipment/recommendations"/]:::api
  API -->|erro| E1["Erro ao carregar equipamentos"]:::erro
  API --> AL{"Tênis ativo com<br/>500 km ou mais?"}:::decisao
  AL -->|600+| TROCA["Hora de trocar o tênis"]:::erro
  AL -->|500 a 599| OLHO["De olho no tênis"]:::estado
  API --> TOT["Em uso · Distância dos tênis · Aposentados"]:::tela
  API --> LIST{"Tem equipamento?"}:::decisao
  LIST -->|não| VZ["Nenhum equipamento cadastrado<br/>Adicionar primeiro equipamento"]:::estado
  LIST -->|sim| CARDS["Cartões: foto ou ícone, tipo,<br/>km se for tênis, desde quando"]:::tela
  ADD("+ Adicionar"):::acao --> FORM["Novo equipamento"]:::tela
  CARDS --> EDIT("Editar"):::acao --> FORM2["Editar equipamento"]:::tela
  FORM --> TIPO{"Tipo é tênis?"}:::decisao
  FORM2 --> TIPO
  TIPO -->|sim| KM["Mostra Distância inicial km"]:::tela
  TIPO -->|não| SEMKM["Esconde a distância<br/>e grava 0"]:::calc
  KM --> PAD("Usar como padrão em<br/>Corrida · Trail · Esteira · Caminhada"):::acao
  PAD --> SAVE("Salvar"):::acao
  SEMKM --> SAVE
  SAVE --> POST[/"POST /equipment ou<br/>PATCH /equipment/id"/]:::api
  POST --> CLAIM[["Um padrão por esporte:<br/>tira o esporte dos outros"]]:::calc
  CARDS --> APD("Aplicar aos treinos antigos"):::acao --> APDA[/"POST /equipment/id/apply-default"/]:::api
  APDA --> APOK["Nome entrou em N treinos antigos"]:::ok
  CARDS --> RET("Aposentar"):::acao --> PR[/"PATCH retired_at = hoje"/]:::api
  CARDS --> DEL("Excluir"):::acao --> CF{"Excluir equipamento?<br/>confirm do navegador"}:::decisao
  CF -->|sim| DE[/"DELETE /equipment/id"/]:::api
  API --> RECS["Recomendados para você<br/>por esporte"]:::tela
  RECS --> PESQ("Pesquisar ↗ · Ver fotos ↗"):::acao --> GOO["Google"]:::ext
  RECS --> TENHO("Já tenho"):::acao --> FORM
`,
    },
  ],
  inventario: [
    { tipo: "tela", nome: "Equipamentos", acao: "Cabeçalho 'Gestão · Equipamentos' com + Adicionar.", msg: "Tênis, bikes e acessórios — acompanhe a quilometragem dos seus tênis.", onde: "apps/web/app/equipment/page.tsx:185" },
    { tipo: "API", nome: "Lista e recomendações", api: "GET /equipment · GET /equipment/recommendations", onde: "apps/web/app/equipment/page.tsx:71", no: "API" },
    { tipo: "erro", nome: "Erro ao carregar", msg: "Erro ao carregar equipamentos", onde: "apps/web/app/equipment/page.tsx:80", no: "E1" },
    { tipo: "aviso", nome: "De olho no tênis", acao: "Tênis ativo com 500 a 599 km.", msg: "nome está com N km: fique de olho em dor nova ou no tênis \"batendo\" duro.", onde: "apps/api/kactus_api/services/equipment_recommendations.py:49", no: "OLHO" },
    { tipo: "erro", nome: "Hora de trocar o tênis", acao: "Tênis ativo com 600 km ou mais.", msg: "nome já tem N km: o amortecimento costuma cansar entre 500 e 800 km. Hora de pensar no próximo.", onde: "apps/api/kactus_api/services/equipment_recommendations.py:46", no: "AL,TROCA" },
    { tipo: "card", nome: "Em uso · Distância dos tênis · Aposentados", acao: "A distância soma só os tênis ativos.", onde: "apps/web/app/equipment/page.tsx:196", no: "TOT" },
    { tipo: "vazio", nome: "Nenhum equipamento cadastrado", msg: "Adicione tenis, bikes e outros para rastrear quilometragem.", onde: "apps/web/app/equipment/page.tsx:330", no: "LIST,VZ" },
    { tipo: "card", nome: "Cartão do equipamento", acao: "Foto ou ícone do tipo, nome, marca e modelo, selo Aposentado, distância total (só tênis), 'desde' mês/ano, 'Padrão em …', notas.", onde: "apps/web/app/equipment/page.tsx:404", no: "CARDS" },
    { tipo: "modal", nome: "Novo / Editar equipamento", acao: "Formulário que abre no topo da página.", onde: "apps/web/app/equipment/page.tsx:215", no: "FORM,FORM2,ADD,EDIT" },
    { tipo: "campo", nome: "Nome *", acao: "Obrigatório.", msg: "Ex: Nike Vaporfly 3", onde: "apps/web/app/equipment/page.tsx:218" },
    { tipo: "campo", nome: "Tipo *", acao: "13 tipos: Tênis, Camiseta/regata, Short/legging, Meia, Boné/viseira, Óculos, Relógio, Cinta cardíaca, Hidratação, Bicicleta, Roupa de nado, Wetsuit, Outro.", onde: "apps/web/app/equipment/page.tsx:24", no: "TIPO" },
    { tipo: "campo", nome: "Marca · Modelo · Data de compra · Notas", onde: "apps/web/app/equipment/page.tsx:240" },
    { tipo: "campo", nome: "Distância inicial (km)", acao: "Só aparece para tênis; os outros tipos gravam 0.", onde: "apps/web/app/equipment/page.tsx:268", no: "KM,SEMKM" },
    { tipo: "campo", nome: "Usar como padrão em", acao: "Tênis: Corrida, Trail, Esteira, Caminhada. Bicicleta: Bike, MTB, Gravel, Bike indoor. O chip mostra quem é o padrão hoje; marcar tira do outro.", msg: "Treinos importados desses esportes entram com este item. Cada esporte tem um padrão só: marcar aqui tira do outro.", onde: "apps/web/app/equipment/page.tsx:305", no: "PAD" },
    { tipo: "cálculo", nome: "Um padrão por esporte", acao: "Ao salvar, o esporte sai dos outros equipamentos; aposentar zera os padrões do item.", onde: "apps/api/kactus_api/routers/equipment.py:46", no: "CLAIM" },
    { tipo: "botão", nome: "Aplicar aos treinos antigos", acao: "Liga o item aos treinos sem equipamento dos seus esportes, da data de compra até a aposentadoria.", api: "POST /equipment/{id}/apply-default", msg: "Nome entrou em N treinos antigos sem equipamento. · Nenhum treino antigo sem equipamento para Nome.", onde: "apps/web/app/equipment/page.tsx:165", no: "APD,APDA,APOK" },
    { tipo: "campo", nome: "Foto da peça", acao: "Reduzida para JPEG de 480 px no navegador; Remover apaga.", msg: "Uma foto sua da peça. Ela aparece no card. · Não foi possível ler essa imagem", onde: "apps/web/app/equipment/page.tsx:280" },
    { tipo: "botão", nome: "Salvar / Cancelar", api: "POST /equipment · PATCH /equipment/{id}", msg: "Salvando… · Erro ao salvar", onde: "apps/web/app/equipment/page.tsx:307", no: "SAVE,POST" },
    { tipo: "botão", nome: "Aposentar", acao: "Marca a data de hoje; o item vai para 'Aposentados (N)', que abre e fecha.", api: "PATCH /equipment/{id}", msg: "Erro ao aposentar equipamento", onde: "apps/web/app/equipment/page.tsx:446", no: "RET,PR" },
    { tipo: "botão", nome: "Excluir", acao: "Confirmação do navegador.", api: "DELETE /equipment/{id}", msg: "Excluir equipamento? Esta ação não pode ser desfeita. · Erro ao excluir (agora também quando a API recusa)", onde: "apps/web/app/equipment/page.tsx:448", no: "DEL,CF,DE" },
    { tipo: "seção", nome: "Recomendados para você", acao: "Por esporte praticado nos últimos 90 dias (ou todos, se não houver treinos); faixa Entrada, Intermediário, Topo de linha.", msg: "Pelos esportes que você fez nos últimos 90 dias.", onde: "apps/web/components/equipment/Recommendations.tsx:35", no: "RECS" },
    { tipo: "filtro", nome: "Esporte das recomendações", onde: "apps/web/components/equipment/Recommendations.tsx:47" },
    { tipo: "link", nome: "Pesquisar ↗ · Ver fotos ↗", acao: "Abre a busca do Google em nova aba.", onde: "apps/web/components/equipment/Recommendations.tsx:73", no: "PESQ,GOO" },
    { tipo: "botão", nome: "Já tenho", acao: "Abre o cadastro com marca, modelo e tipo preenchidos.", onde: "apps/web/components/equipment/Recommendations.tsx:89", no: "TENHO" },
    { tipo: "cálculo", nome: "Km do equipamento", acao: "Distância inicial + soma das atividades não excluídas ligadas a ele.", onde: "apps/api/kactus_api/routers/equipment.py:17" },
  ],
});
