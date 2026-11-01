// Área 14 — Integrações e bastidores: serviços de fora, scripts e rotas da API sem tela.
KACTUS_MAPA.areas.push({
  id: "bastidores",
  n: 14,
  titulo: "Integrações e bastidores",
  resumo:
    "O que roda por trás das telas: o banco Neon, os modelos de IA (Anthropic e Gemini), os mapas (Stadia ou OpenStreetMap), o Tailscale, os avisos por push, os scripts de linha de comando (criar usuário, dados de teste, recálculos, sincronizar Garmin) e as rotas da API que nenhuma tela chama.",
  rotas: [],
  arquivos: [
    "apps/api/kactus_api/main.py",
    "apps/api/kactus_api/config.py",
    "apps/api/kactus_api/db.py",
    "apps/api/kactus_api/scripts/",
    "apps/api/kactus_api/services/garmin_sync.py",
    "apps/api/kactus_api/services/push.py",
    "apps/web/public/sw.js",
    "apps/web/lib/mapTiles.ts",
  ],
  diagramas: [
    {
      titulo: "Peças do sistema",
      mermaid: `
flowchart LR
  subgraph PC["PC do Murilo"]
    WEB["Site Next.js<br/>:3003"]:::tela
    API["API FastAPI<br/>:8000"]:::tela
    CTRL["Kactus Controle<br/>:3010"]:::tela
    DISK[("Pasta data<br/>arquivos originais e logs")]:::ext
  end
  IPH("iPhone"):::acao -->|Tailscale :443| WEB
  IPH -->|Tailscale :8443| CTRL
  WEB -->|/api proxy| API
  CTRL -->|liga, vigia| WEB
  CTRL -->|liga, vigia| API
  API --> NEON[("Neon Postgres<br/>nuvem")]:::ext
  API --> DISK
  API --> ANT{{"Anthropic<br/>se houver chave"}}:::ia
  API --> GEM{{"Gemini grátis"}}:::ia
  API -->|"a cada 10 min · ao importar recorde"| PUSHS["Serviço de push<br/>Apple, Google, Mozilla"]:::ext
  PUSHS --> IPH
  WEB --> TILES["Stadia Maps ou<br/>OpenStreetMap"]:::ext
  CLI("Linha de comando"):::acao --> SCR[["seed_user · seed_fake_activities<br/>backfills · sync_garmin · import_files"]]:::calc
  CTRL -->|relógio no USB| SCR
  SCR --> NEON
  SCR -->|"chave pessoal oficial · .FIT original"| GAR["Garmin Connect<br/>API pessoal"]:::ext
`,
    },
  ],
  inventario: [
    { tipo: "integração", nome: "Banco Neon", acao: "Postgres na nuvem; testes usam uma branch separada.", onde: "apps/api/kactus_api/config.py:21", no: "NEON" },
    { tipo: "integração", nome: "Anthropic", acao: "Usado primeiro quando ANTHROPIC_API_KEY existe.", onde: "apps/api/kactus_api/ai/coach_service.py:692", no: "ANT" },
    { tipo: "integração", nome: "Gemini", acao: "GEMINI_MODEL aceita uma lista em ordem de preferência; free tier.", onde: "apps/api/kactus_api/ai/coach_service.py:729", no: "GEM" },
    { tipo: "integração", nome: "Mapas", acao: "Stadia (tema escuro) com NEXT_PUBLIC_STADIA_API_KEY; sem chave, OpenStreetMap escurecido por filtro.", onde: "apps/web/lib/mapTiles.ts:9", no: "TILES" },
    { tipo: "integração", nome: "Avisos por push", acao: "Dentro da API: a cada 10 min confere o treino planejado de hoje (a partir das 7h) e 3+ dias sem treinar (a partir das 18h); ao importar, avisa recorde de treino com até 2 dias. push_log garante um aviso só por dia, por sequência sem treino e por treino. Chaves VAPID geradas na primeira vez em data/push/vapid.pem (fora do Git). Inscrição que responde 404/410, ou falha 5 vezes, é apagada. Os testes desligam com PUSH_SCHEDULER=false.", onde: "apps/api/kactus_api/services/push.py:193", no: "PUSHS" },
    { tipo: "integração", nome: "Service worker", acao: "Além da tela Kactus desligado, mostra a notificação (título, texto, ícone) e, ao tocar, abre ou traz para frente o Kactus na página do aviso.", onde: "apps/web/public/sw.js:50" },
    { tipo: "integração", nome: "Tailscale", acao: "Publica o site (443), o Controle (8443) e as Finanças (10000) só dentro da rede pessoal.", onde: "apps/controle/kactus_controle/tailscale.py:20" },
    { tipo: "integração", nome: "Pasta data", acao: "Guarda os arquivos originais enviados e os logs.", onde: "apps/api/kactus_api/config.py:39", no: "DISK" },
    { tipo: "integração", nome: "Garmin Connect (linha de comando)", acao: "sync_garmin usa a API pessoal oficial do Garmin: a chave criada pelo usuário em connect.garmin.com/app/settings/personalApiToken (GARMIN_PERSONAL_API_KEY no .env) vira um token de 24 h guardado em ~/.config/garmin. Lista as atividades do período, baixa o .FIT original e importa como o upload (dedup por arquivo, id do Garmin e horário). --conferir N baixa N treinos e compara os campos do Garmin com o mesmo treino já salvo, sem gravar. Um 429 para o lote. Sem --email usa a INITIAL_USER_EMAIL; com --json imprime o resumo para o Kactus Controle, que roda o sync a cada 3 h se ligado.", msg: "Falta a chave pessoal do Garmin · O Garmin recusou a chave pessoal · O Garmin respondeu 429", onde: "apps/api/kactus_api/scripts/sync_garmin.py:40", no: "GAR" },
    { tipo: "integração", nome: "seed_user", acao: "Cria a conta inicial pelas variáveis INITIAL_USER_EMAIL e INITIAL_USER_PASSWORD.", onde: "apps/api/kactus_api/scripts/seed_user.py:15", no: "SCR" },
    { tipo: "integração", nome: "import_files", acao: "Importa arquivos direto no banco, sem a API; usado pelo Kactus Controle com os .fit do relógio no USB. --email ou INITIAL_USER_EMAIL; --json devolve importadas, duplicadas, erros e ids.", onde: "apps/api/kactus_api/scripts/import_files.py:34" },
    { tipo: "integração", nome: "backup", acao: "Grava todos os dados num .json.gz e guarda as últimas N cópias (padrão 8); usado pelo Kactus Controle toda semana.", onde: "apps/api/kactus_api/scripts/backup.py" },
    { tipo: "integração", nome: "seed_fake_activities", acao: "Gera atividades falsas para teste.", onde: "apps/api/kactus_api/scripts/seed_fake_activities.py:101" },
    { tipo: "integração", nome: "backfill_derived · backfill_garmin_fields · backfill_moving_time", acao: "Recalculam campos em atividades antigas; todos têm --dry-run e --email.", onde: "apps/api/kactus_api/scripts/backfill_derived.py:47" },
    { tipo: "API", nome: "Saúde da API", acao: "Usada pelo Controle para saber se a API está no ar.", api: "GET /health", onde: "apps/api/kactus_api/main.py:97" },
    { tipo: "API", nome: "Importar atividade já normalizada", acao: "Porta para integrações (Strava, Garmin via MCP); só os testes chamam.", api: "POST /activities/import-normalized", onde: "apps/api/kactus_api/routers/activities.py:161" },
    { tipo: "API", nome: "Fatos calculados da Duni", acao: "Janelas 7/14/28 dias, tendência, fadiga, sessões parecidas; sem tela.", api: "GET /coach/analysis", onde: "apps/api/kactus_api/routers/coach.py:429" },
    { tipo: "API", nome: "Mudar ou editar um treino planejado", acao: "Status (feito/pulado) sem tela; e a edição à mão do Calendário (título, esporte, tipo, km, tempo, intensidade, ritmo, FC, descrição, observações), só em treino não feito de hoje em diante.", api: "PATCH /coach/plan/{id}", msg: "Treino nao encontrado · Status invalido · not_editable", onde: "apps/api/kactus_api/routers/coach.py:387" },
    { tipo: "erro", nome: "Erro interno", acao: "Qualquer exceção não tratada vira 500 com um corpo padrão.", msg: "Erro interno. Tente novamente.", onde: "apps/api/kactus_api/main.py:88" },
    { tipo: "permissão", nome: "CORS da API", acao: "Só localhost:3000 e :3003 por padrão.", onde: "apps/api/kactus_api/config.py:35" },
  ],
});
