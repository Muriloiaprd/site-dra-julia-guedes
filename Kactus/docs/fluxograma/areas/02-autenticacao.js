// Área 02 — Autenticação e sessão.
KACTUS_MAPA.areas.push({
  id: "autenticacao",
  n: 2,
  titulo: "Autenticação e sessão",
  resumo:
    "Uma conta só, criada por script ou por variável de ambiente; não há cadastro na tela. O login devolve um JWT de 7 dias guardado no localStorage do navegador. Cada tela interna confere a sessão com /auth/me e qualquer 401 manda de volta para o login. Trocar a senha não derruba as sessões já abertas.",
  rotas: ["/", "/login"],
  arquivos: [
    "apps/web/app/LandingPage.tsx",
    "apps/web/app/login/page.tsx",
    "apps/web/components/SessionNotice.tsx",
    "apps/web/lib/api.ts",
    "apps/api/kactus_api/routers/auth.py",
    "apps/api/kactus_api/security.py",
    "apps/api/kactus_api/deps.py",
    "apps/api/kactus_api/rate_limit.py",
    "apps/api/kactus_api/config.py",
  ],
  diagramas: [
    {
      titulo: "Login",
      mermaid: `
flowchart TD
  L["/login"]:::tela --> F("Preenche e-mail e senha"):::acao
  F --> V{"Campos preenchidos<br/>e e-mail válido?"}:::decisao
  V -->|não| HV["Validação do navegador<br/>required, type=email"]:::erro
  V -->|sim| B("Entrar na Plataforma"):::acao
  B --> LOAD(["Entrando..."]):::estado
  LOAD --> API[/"POST /auth/login<br/>form-urlencoded"/]:::api
  API --> RL{"Mais de 5 tentativas<br/>por minuto neste IP?"}:::decisao
  RL -->|sim| E429["429 · limite de tentativas"]:::erro
  RL -->|não| CRED{"E-mail e senha batem?"}:::decisao
  CRED -->|não| E401["Email ou senha invalidos"]:::erro
  CRED -->|sim| ACT{"Usuário ativo?"}:::decisao
  ACT -->|não| E403["Usuario inativo"]:::erro
  ACT -->|sim| TOK[["JWT de 7 dias<br/>salvo em localStorage"]]:::calc
  TOK --> D["/dashboard"]:::ok
`,
    },
    {
      titulo: "Sessão nas telas internas",
      mermaid: `
flowchart TD
  OPEN("Abre uma tela interna"):::acao --> T{"Tem token<br/>kactus_token?"}:::decisao
  T -->|não| LOGIN["/login"]:::tela
  T -->|sim| ME[/"GET /auth/me"/]:::api
  ME -->|200| OK["Tela carrega"]:::ok
  ME -->|falhou, mas há token| NET["Não foi possível verificar sua sessão —<br/>verifique sua conexão · Tentar de novo"]:::erro
  OK --> ANY[/"Qualquer outra chamada"/]:::api
  ANY -->|401| CLR[["Apaga o token"]]:::calc
  CLR --> LOGIN
  OK --> SAIR("Sair"):::acao
  SAIR --> CLR
  LAND["Landing ou /login<br/>com sessão válida"]:::tela --> AV("Você já está conectado.<br/>Ir para o painel →"):::acao
  AV --> OK
`,
    },
  ],
  inventario: [
    { tipo: "tela", nome: "Landing", acao: "Apresentação pública com animações; todos os botões de ação levam ao login.", onde: "apps/web/app/LandingPage.tsx:74" },
    { tipo: "link", nome: "Começar Agora (menu e topo)", acao: "Vai para /login.", onde: "apps/web/app/LandingPage.tsx:90" },
    { tipo: "link", nome: "Ver Como Funciona", acao: "Rola até a seção Treinar.", onde: "apps/web/app/LandingPage.tsx:119" },
    { tipo: "link", nome: "Menu da landing", acao: "Âncoras Treinar, Evolução, Comunidade, Planos.", onde: "apps/web/app/LandingPage.tsx:85" },
    { tipo: "card", nome: "Planos Iniciante, Performance e Elite", acao: "Vitrine: Iniciante e Performance levam ao login; Elite está desativado.", msg: "Notificar Lançamento", onde: "apps/web/app/LandingPage.tsx:380" },
    { tipo: "aviso", nome: "Números de vitrine", acao: "14.823 km, 1.247 atletas, 98% e 5 anos são fixos no código, não vêm do banco.", onde: "apps/web/app/LandingPage.tsx:194" },
    { tipo: "aviso", nome: "Você já está conectado", acao: "Aparece na landing e no login quando /auth/me confirma o token.", msg: "Você já está conectado. Ir para o painel →", onde: "apps/web/components/SessionNotice.tsx:11", no: "AV" },
    { tipo: "tela", nome: "Login", acao: "Cartão com logo, título e formulário.", msg: "Bem-vindo de volta · Entre para continuar sua evolução", onde: "apps/web/app/login/page.tsx:79", no: "L" },
    { tipo: "campo", nome: "Email", acao: "Obrigatório, tipo e-mail, autocomplete.", onde: "apps/web/app/login/page.tsx:141", no: "F" },
    { tipo: "campo", nome: "Senha", acao: "Obrigatória.", onde: "apps/web/app/login/page.tsx:174" },
    { tipo: "validação", nome: "Campos obrigatórios", acao: "Feita pelo navegador (required, type=email). Não há validação própria.", onde: "apps/web/app/login/page.tsx:144", no: "V,HV" },
    { tipo: "botão", nome: "Entrar na Plataforma", acao: "Envia o login; desativa enquanto espera.", msg: "Entrando...", onde: "apps/web/app/login/page.tsx:213", no: "B,LOAD" },
    { tipo: "API", nome: "Login", acao: "Confere e-mail e senha, grava last_login_at, devolve o token.", api: "POST /auth/login", onde: "apps/api/kactus_api/routers/auth.py:18", no: "API" },
    { tipo: "permissão", nome: "Limite de tentativas", acao: "5 por minuto por IP, em memória.", onde: "apps/api/kactus_api/routers/auth.py:19", no: "RL,E429" },
    { tipo: "erro", nome: "Credenciais erradas", acao: "Mostrado na caixa vermelha do formulário.", msg: "⚠ Email ou senha invalidos", onde: "apps/api/kactus_api/routers/auth.py:27", no: "E401" },
    { tipo: "erro", nome: "Usuário inativo", acao: "403.", msg: "Usuario inativo", onde: "apps/api/kactus_api/routers/auth.py:31", no: "E403" },
    { tipo: "cálculo", nome: "Token JWT", acao: "HS256, validade de 10080 minutos (7 dias). Guardado em localStorage 'kactus_token'; migra a chave antiga 'ondilow_token'.", onde: "apps/web/lib/api.ts:7", no: "TOK" },
    { tipo: "API", nome: "Quem sou eu", acao: "Usado por quase toda tela para confirmar a sessão; respostas iguais dentro de 3 s são reaproveitadas.", api: "GET /auth/me", onde: "apps/web/lib/api.ts:302", no: "ME" },
    { tipo: "erro", nome: "Sessão não verificada", acao: "Dashboard e Perfil: há token, mas /auth/me falhou (rede).", msg: "Não foi possível verificar sua sessão — verifique sua conexão.", onde: "apps/web/app/dashboard/page.tsx:156", no: "NET" },
    { tipo: "permissão", nome: "401 em qualquer chamada", acao: "Apaga o token e redireciona.", msg: "Sessão expirada", onde: "apps/web/lib/api.ts:273", no: "CLR" },
    { tipo: "permissão", nome: "Guarda das telas", acao: "Dashboard, Importar, Desempenho, Duni, Equipamentos e Perfil chamam fetchMe e mandam para /login sem sessão. Atividades e Detalhe dependem só do 401.", onde: "apps/web/app/import/page.tsx:34" },
    { tipo: "botão", nome: "Sair", acao: "Apaga o token e vai para /login. O token não é revogado no servidor.", onde: "apps/web/components/Sidebar.tsx:103", no: "SAIR" },
    { tipo: "API", nome: "Cadastro", acao: "Só funciona com ALLOW_REGISTRATION=true; sem tela.", api: "POST /auth/register", msg: "Registro desabilitado · Email ja cadastrado", onde: "apps/api/kactus_api/routers/auth.py:40" },
    { tipo: "API", nome: "Trocar senha", acao: "Pede a senha atual. Não invalida tokens já emitidos. Tela no Perfil.", api: "POST /auth/change-password", msg: "Senha atual incorreta", onde: "apps/api/kactus_api/routers/auth.py:63" },
    { tipo: "API", nome: "Excluir conta", acao: "Apaga o usuário e tudo em cascata. Tela no Perfil.", api: "DELETE /auth/account", onde: "apps/api/kactus_api/routers/auth.py:74" },
    { tipo: "validação", nome: "Configuração fora do modo dev", acao: "A API recusa subir com JWT_SECRET_KEY padrão ou curta quando APP_ENV não é dev.", onde: "apps/api/kactus_api/config.py:55" },
  ],
});
