// Área 07 — Compartilhar: gerador de Story (imagem 1080×1920 e vídeo).
KACTUS_MAPA.areas.push({
  id: "stories",
  n: 7,
  titulo: "Compartilhar (Stories)",
  resumo:
    "O botão Compartilhar do treino abre um gerador de Story no próprio navegador, sem servidor. São 25 modelos: 6 desenhados com os dados do treino e 19 artes da marca Kactus. Cada modelo só aparece se o treino tiver o que ele precisa (rota, FC, splits, subida). Três modelos viram vídeo. Dá para pôr foto de fundo, deixar o fundo transparente e salvar, copiar ou compartilhar.",
  rotas: ["/activities/[id] → Compartilhar"],
  arquivos: [
    "apps/web/components/share/StoryGenerator.tsx",
    "apps/web/components/share/ModelGallery.tsx",
    "apps/web/components/share/useStoryThumbs.ts",
    "apps/web/lib/story/layouts/index.ts",
    "apps/web/lib/story/layouts/*.ts",
    "apps/web/lib/story/engine.ts",
    "apps/web/lib/story/art.ts",
    "apps/web/lib/story/metrics.ts",
    "apps/web/public/story-art/",
  ],
  diagramas: [
    {
      titulo: "Do botão à imagem ou vídeo",
      mermaid: `
flowchart TD
  BT("📤 Compartilhar"):::acao --> MOD["Modal Compartilhar"]:::tela
  MOD --> PRF[/"GET /profile<br/>nome e zonas de FC"/]:::api
  MOD --> AV[["Quais modelos cabem<br/>neste treino"]]:::calc
  AV --> GR["Grupos: Viram vídeo · Feitos com seus dados · Artes Kactus"]:::tela
  GR --> NAV("Setas ‹ ›, teclado,<br/>arrastar para o lado, trilho"):::acao
  GR --> ALL("Ver todos"):::acao --> GAL["Galeria de modelos"]:::tela
  GAL -->|escolhe| GR
  MOD --> FOTO("Escolher foto"):::acao
  FOTO --> FT{"É imagem?"}:::decisao
  FT -->|não| FE["Formato não suportado, use JPG ou PNG"]:::erro
  FT -->|sim| AJ("Arrastar e zoom 1× a 2,5×"):::acao
  MOD --> TR("Fundo transparente"):::acao
  MOD --> PNG[["Desenha no canvas<br/>e prepara o PNG em 300 ms"]]:::calc
  PNG --> SH("Compartilhar"):::acao
  PNG --> SV("Salvar"):::acao
  PNG --> CP("Copiar"):::acao
  SH --> CAN{"navigator.share<br/>aceita arquivo?"}:::decisao
  CAN -->|sim| SHEET["Folha de compartilhar do iPhone<br/>Instagram, Salvar imagem"]:::ok
  CAN -->|não| SV
  SV --> DL["Baixa kactus_story_id.png<br/>no iPhone vai para Arquivos"]:::ok
  CP --> CL{"Navegador copia imagem?"}:::decisao
  CL -->|sim| OKC["Copiado!"]:::ok
  CL -->|não| CE["Copiar não é suportado neste navegador"]:::erro
  GR -->|modelo vira vídeo| REC("🎬 Gravar vídeo"):::acao
  REC --> MR{"MediaRecorder grava<br/>MP4 ou WebM?"}:::decisao
  MR -->|não| VE["Este navegador não grava o vídeo do Story; use a imagem"]:::erro
  MR -->|sim| GRAV(["Gravando… N%<br/>5,5 s desenhando + 2 s parado"]):::estado
  GRAV --> VID["Vídeo pronto<br/>Compartilhar vídeo · Salvar"]:::ok
`,
    },
    {
      titulo: "Quando cada modelo aparece",
      mermaid: `
flowchart LR
  T["Treino"]:::tela
  T --> V{"Tem o dado?"}:::decisao
  V -->|FC média e 60+ pontos com FC| B1["Batimento 🎬"]:::ok
  V -->|2+ splits válidos| B2["Parciais 🎬"]:::ok
  V -->|30+ pontos de rota com ritmo| B3["Rota pelo ritmo 🎬"]:::ok
  V -->|subida de 20 m e 30+ pontos com altitude| B4["Montanha"]:::ok
  V -->|1+ split válido| B5["Recibo"]:::ok
  V -->|500 m ou mais| B6["Bilhete de embarque"]:::ok
  V -->|rota com GPS| B7["Minimalista · Rota limpa · Rota + faixa<br/>Rota + ícones · Stats à direita · Rota grande"]:::ok
  V -->|sempre| B8["Ícones à direita · Ícones à esquerda · Logo lateral<br/>Só a faixa · Faixa + listras · Mão · Símbolo · Tênis<br/>Bandeiras · Ícones sólidos · Centralizado · Moldura · Desafio"]:::ok
`,
    },
  ],
  inventario: [
    { tipo: "modal", nome: "Compartilhar", acao: "Prévia 1080×1920 em até 280 px de largura; fecha com ✕, clique fora ou Esc. Trava a rolagem da página.", onde: "apps/web/components/share/StoryGenerator.tsx:408", no: "MOD" },
    { tipo: "API", nome: "Perfil para o Story", acao: "Nome (passageiro do Bilhete) e zonas de FC (cores do Batimento).", api: "GET /profile", onde: "apps/web/components/share/StoryGenerator.tsx:88", no: "PRF" },
    { tipo: "cálculo", nome: "Modelos disponíveis", acao: "Filtra os 25 pela rota (requiresRoute) e pela regra de cada modelo de dados.", onde: "apps/web/lib/story/layouts/index.ts:58", no: "AV,V" },
    { tipo: "seção", nome: "Grupos do carrossel", acao: "🎬 Viram vídeo · Feitos com seus dados · Artes Kactus, nessa ordem.", onde: "apps/web/components/share/StoryGenerator.tsx:103", no: "GR" },
    { tipo: "botão", nome: "‹ Modelo anterior · Próximo modelo ›", acao: "Também pelas setas do teclado e arrastando a prévia para o lado (quando não há foto).", onde: "apps/web/components/share/StoryGenerator.tsx:465", no: "NAV" },
    { tipo: "botão", nome: "Ver todos", acao: "Abre a galeria com miniaturas de todos os modelos.", onde: "apps/web/components/share/StoryGenerator.tsx:492", no: "ALL" },
    { tipo: "modal", nome: "Galeria 'Modelos'", acao: "Grade por grupo; ‹ volta para a prévia; Esc fecha a galeria.", onde: "apps/web/components/share/StoryGenerator.tsx:436", no: "GAL" },
    { tipo: "seção", nome: "Trilho de miniaturas", acao: "Miniaturas desenhadas em segundo plano (no celular guarda só 6 de cada vez).", onde: "apps/web/components/share/useStoryThumbs.ts" },
    { tipo: "campo", nome: "Escolher foto / Trocar foto", acao: "Qualquer imagem do aparelho vira fundo.", onde: "apps/web/components/share/StoryGenerator.tsx:505", no: "FOTO,FT" },
    { tipo: "erro", nome: "Foto inválida", msg: "Formato não suportado, use JPG ou PNG", onde: "apps/web/components/share/StoryGenerator.tsx:301", no: "FE" },
    { tipo: "campo", nome: "Arrastar a foto + Zoom", acao: "Arrastar reposiciona; o controle deslizante vai de 1× a 2,5×.", msg: "Arraste a foto pra reposicionar", onde: "apps/web/components/share/StoryGenerator.tsx:519", no: "AJ" },
    { tipo: "botão", nome: "Fundo transparente", acao: "Tira o fundo (prévia em xadrez). O vídeo sempre sai com fundo.", onde: "apps/web/components/share/StoryGenerator.tsx:509", no: "TR" },
    { tipo: "cálculo", nome: "PNG pronto antes do toque", acao: "Gera o PNG 300 ms depois da última mudança, porque o Safari do iPhone só abre o compartilhar se nada for esperado no toque.", onde: "apps/web/components/share/StoryGenerator.tsx:193", no: "PNG" },
    { tipo: "botão", nome: "Compartilhar", acao: "Abre a folha de compartilhar; sem suporte, baixa o arquivo.", msg: "Não foi possível compartilhar a imagem", onde: "apps/web/components/share/StoryGenerator.tsx:364", no: "SH,CAN,SHEET" },
    { tipo: "botão", nome: "Salvar", acao: "Baixa kactus_story_<id>.png. No iPhone vai para o app Arquivos.", msg: "Não foi possível salvar a imagem", onde: "apps/web/components/share/StoryGenerator.tsx:352", no: "SV,DL" },
    { tipo: "botão", nome: "Copiar", acao: "Copia a imagem para a área de transferência.", msg: "Copiado! · Copiar não é suportado neste navegador", onde: "apps/web/components/share/StoryGenerator.tsx:392", no: "CP,CL,OKC,CE" },
    { tipo: "aviso", nome: "Dica no celular", msg: "Para a galeria: Compartilhar → Salvar imagem/vídeo. \"Salvar\" guarda no app Arquivos.", onde: "apps/web/components/share/StoryGenerator.tsx:571" },
    { tipo: "botão", nome: "🎬 Gravar vídeo", acao: "Só nos modelos que se animam. Grava o canvas a 30 fps, MP4 se o navegador deixar, senão WebM.", msg: "Gravando… N%", onde: "apps/web/components/share/StoryGenerator.tsx:207", no: "REC,MR,GRAV" },
    { tipo: "erro", nome: "Vídeo não suportado ou vazio", msg: "Este navegador não grava o vídeo do Story; use a imagem · O vídeo saiu vazio; tente de novo ou use a imagem", onde: "apps/web/components/share/StoryGenerator.tsx:220", no: "VE" },
    { tipo: "sucesso", nome: "Vídeo pronto", acao: "Prévia em loop com duração (7,5 s), formato e tamanho; Compartilhar vídeo e Salvar.", onde: "apps/web/components/share/StoryGenerator.tsx:544", no: "VID" },
    { tipo: "erro", nome: "Aparelho bloqueou", acao: "O nome do erro aparece na tela porque o iPhone não tem console.", msg: "O aparelho bloqueou a ação; toque de novo. (NotAllowedError)", onde: "apps/web/components/share/StoryGenerator.tsx:26" },
    { tipo: "card", nome: "Batimento 🎬", acao: "Curva de FC colorida pelas zonas. Precisa de FC média e 60+ pontos com FC.", onde: "apps/web/lib/story/layouts/batimento.ts:62", no: "B1" },
    { tipo: "card", nome: "Parciais 🎬", acao: "Barras por km. Precisa de 2+ splits válidos.", onde: "apps/web/lib/story/layouts/parciais.ts:19", no: "B2" },
    { tipo: "card", nome: "Rota pelo ritmo 🎬", acao: "Percurso colorido pelo ritmo. Precisa de 30+ pontos de rota com velocidade ou distância.", onde: "apps/web/lib/story/layouts/rotaRitmo.ts:113", no: "B3" },
    { tipo: "card", nome: "Montanha", acao: "Perfil de subida. Precisa de 20 m de subida e 30+ pontos com altitude e distância.", onde: "apps/web/lib/story/layouts/montanha.ts:15", no: "B4" },
    { tipo: "card", nome: "Recibo", acao: "Cada km como item de nota fiscal. Precisa de 1+ split.", onde: "apps/web/lib/story/layouts/recibo.ts:47", no: "B5" },
    { tipo: "card", nome: "Bilhete de embarque", acao: "Precisa de 500 m ou mais.", onde: "apps/web/lib/story/layouts/bilhete.ts:33", no: "B6" },
    { tipo: "card", nome: "Artes com rota (6)", acao: "Minimalista, Rota limpa, Rota + faixa, Rota + ícones, Stats à direita, Rota grande. Só com GPS.", onde: "apps/web/lib/story/layouts/index.ts:29", no: "B7" },
    { tipo: "card", nome: "Artes sempre disponíveis (13)", acao: "Ícones à direita, Ícones à esquerda, Logo lateral, Só a faixa, Faixa + listras, Mão, Símbolo, Tênis, Bandeiras, Ícones sólidos, Centralizado, Moldura, Desafio.", onde: "apps/web/lib/story/layouts/index.ts:29", no: "B8" },
    { tipo: "cálculo", nome: "Cor por esporte", acao: "A arte é recolorida conforme o esporte do treino.", onde: "apps/web/lib/story/art.ts" },
  ],
});
