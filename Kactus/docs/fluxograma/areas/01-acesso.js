// Área 01 — Acesso e servidor: Kactus Controle, Tailscale, modo rápido e a tela "Kactus desligado".
KACTUS_MAPA.areas.push({
  id: "acesso",
  n: 1,
  titulo: "Acesso e servidor",
  resumo:
    "O Kactus Controle é um programa em Python com ícone perto do relógio e uma janelinha. Também importa sozinho os treinos do relógio Garmin ligado no USB. Ele liga o site (porta 3003) e a API (porta 8000), vigia os dois e religa se caírem. No modo rápido o site roda o build de produção, bem mais leve no iPhone; no modo desenvolvimento mostra mudanças de código na hora. O iPhone entra pelo Tailscale. Se o servidor estiver fora do ar, o service worker mostra a tela 'Kactus desligado', que fala com o Controle na porta 8443 para ligar e, se o aparelho já abriu o dashboard antes, mostra o último painel visto com a faixa 'Sem conexão com o PC'.",
  rotas: ["/desligado.html", "Controle :3010 (PC)", "Controle :8443 (iPhone)"],
  arquivos: [
    "apps/controle/kactus_controle/app.py",
    "apps/controle/kactus_controle/servidor.py",
    "apps/controle/kactus_controle/janela.py",
    "apps/controle/kactus_controle/web.py",
    "apps/controle/kactus_controle/pagina.html",
    "apps/controle/kactus_controle/tailscale.py",
    "apps/controle/kactus_controle/sistema.py",
    "apps/controle/kactus_controle/config.py",
    "apps/controle/kactus_controle/relogio.py",
    "apps/controle/kactus_controle/backup.py",
    "apps/controle/kactus_controle/relogio.ps1",
    "apps/web/public/sw.js",
    "apps/web/public/desligado.html",
    "apps/web/lib/offlineSnapshot.ts",
    "apps/web/components/RegistrarSW.tsx",
    "Abrir Kactus.bat",
    "scripts/precisa-build.ps1",
  ],
  diagramas: [
    {
      titulo: "Estados do servidor no Kactus Controle",
      mermaid: `
flowchart TD
  OFF(["Desligado"]):::estado
  OFF -->|Ligar · menu, janela, iPhone| MODO{"Modo escolhido"}:::decisao
  MODO -->|rápido| BUILD{"Código do site mudou?<br/>precisa-build.ps1"}:::decisao
  BUILD -->|sim| PREP(["Preparando<br/>next build · 1–2 min"]):::estado
  BUILD -->|não| LIG
  PREP -->|build falhou| DEV
  PREP --> LIG
  MODO -->|desenvolvimento| DEV("next dev + uvicorn"):::acao
  DEV --> LIG(["Ligando…"]):::estado
  LIG --> CHK{"3003 e /health<br/>respondem?"}:::decisao
  CHK -->|sim| ON["Ligado<br/>aviso: já dá para abrir no iPhone"]:::ok
  CHK -->|não, tempo esgotado| ERR["Com erro"]:::erro
  ON --> VIG[["Vigia a cada poucos segundos"]]:::calc
  VIG -->|processo caiu| CAIU["O Kactus caiu. Religando…"]:::erro
  CAIU --> LIG
  CAIU -->|caiu demais| BLOQ["Para de religar<br/>até um novo Ligar"]:::erro
  ON -->|Desligar| OFF
  ON -->|Reiniciar| LIG
  ERR -->|Ligar| MODO
`,
    },
    {
      titulo: "iPhone abre o Kactus",
      mermaid: `
flowchart TD
  TOQ("Toca no ícone Kactus<br/>na Tela de Início"):::acao --> TS{"Tailscale ligado<br/>no iPhone e no PC?"}:::decisao
  TS -->|não| NADA["Página não abre<br/>sem rede para o PC"]:::erro
  TS -->|sim| SW[["Service worker<br/>intercepta a navegação"]]:::calc
  SW --> REDE{"Resposta do servidor"}:::decisao
  REDE -->|200| APP["Kactus abre<br/>/dashboard"]:::ok
  REDE -->|falha de rede, 502, 503, 504| DESL["Kactus desligado"]:::tela
  DESL --> ST[/"GET :8443/api/status"/]:::api
  ST -->|sem resposta| PCOFF["O PC está desligado ou dormindo"]:::erro
  ST -->|ligado| RELOAD("Recarrega e abre"):::acao
  ST -->|ligando ou preparando| ACOMP["Ligando o Kactus…<br/>confere a cada 2 s"]:::estado
  ST -->|desligado ou erro| BTN("Ligar agora"):::acao
  BTN --> LIGAR[/"POST :8443/api/ligar"/]:::api
  LIGAR --> ACOMP
  ACOMP --> ST
  DESL --> TENTA("Tentar de novo<br/>recarrega a página"):::acao
  DESL --> SNAP{"O aparelho guardou<br/>um último painel?"}:::decisao
  SNAP -->|sim| ULT["Sem conexão com o PC · dados de 09/10 às 14:32<br/>Hoje · Esta semana · Próxima prova<br/>Próximos treinos · Últimos treinos · Recordes"]:::tela
  SNAP -->|não| SOD["Só o estado do PC e os botões"]:::estado
`,
    },
    {
      titulo: "Tailscale vigiado pelo Controle",
      mermaid: `
flowchart LR
  CHK[["tailscale status --json<br/>tailscale serve status --json"]]:::calc --> A{"BackendState = Running?"}:::decisao
  A -->|não| P["Tailscale parado —<br/>iPhone sem acesso"]:::erro
  A -->|sim| B{"Portas 443 e 8443<br/>publicadas?"}:::decisao
  B -->|não| SE["Endereço do iPhone<br/>desligado no Tailscale"]:::erro
  B -->|sim| OK["iPhone com acesso"]:::ok
  P --> CONS("Consertar"):::acao
  SE --> CONS
  CONS -->|parado| ABRE["Abre o app do Tailscale"]:::ext
  CONS -->|sem endereço| SERVE["tailscale serve --bg<br/>refaz 443 e 8443"]:::ext
`,
    },
    {
      titulo: "Relógio no USB",
      mermaid: `
flowchart TD
  USB("Liga o Garmin no USB"):::acao --> RVIG[["Vigia a cada 15 s<br/>se a opção estiver ligada"]]:::calc
  RVIG --> TIPO{"Como o Windows mostra?"}:::decisao
  TIPO -->|pendrive com letra| UNI[["Lê E:/GARMIN/Activity"]]:::calc
  TIPO -->|dispositivo MTP| MTP[["relogio.ps1 pelo Shell do Windows"]]:::ext
  UNI --> NOVOS{"Arquivo .fit<br/>ainda não visto?"}:::decisao
  MTP --> NOVOS
  NOVOS -->|não| RVIG
  NOVOS -->|sim| COP[["Copia para relogio_chegada"]]:::calc
  COP --> IMP[/"uv run … scripts.import_files --json"/]:::api
  IMP -->|ok| AV["Aviso no Windows:<br/>N treinos novos do relógio no Kactus"]:::ok
  IMP -->|erro| RERR["Não consegui importar do relógio: …<br/>tenta de novo na próxima"]:::erro
  AV --> VIS[["Guarda em relogio_vistos.json"]]:::calc
  AGORA("Importar agora · janela ou menu"):::acao --> FORCA[["Reimporta tudo o que está no relógio<br/>o import ignora duplicados"]]:::calc --> COP
`,
    },
    {
      titulo: "Backup semanal",
      mermaid: `
flowchart TD
  BINI(["2 min depois de abrir o Controle,<br/>depois de hora em hora"]):::estado --> BVENC{"Passou uma semana<br/>do último backup?"}:::decisao
  BVENC -->|não| BINI
  BVENC -->|sim| BRUN[/"uv run … scripts.backup --json"/]:::api
  BAGORA("Fazer backup agora · janela ou menu"):::acao --> BRUN
  BRUN --> BGZ[["Exporta tudo em .json.gz<br/>guarda as últimas 8 cópias"]]:::calc
  BGZ --> BOK["Backup do Kactus salvo (X MB)"]:::ok
  BRUN -->|erro| BERR["Não consegui fazer o backup do Kactus: …<br/>tenta de novo na próxima hora"]:::erro
  BOK --> BPASTA("Abrir pasta de backups<br/>Documentos/Kactus backups"):::acao
`,
    },
  ],
  inventario: [
    { tipo: "menu", nome: "Ícone no relógio", acao: "Menu com Abrir o painel, Ligar, Desligar, Reiniciar, Abrir no PC, Copiar endereço do iPhone, modo, Iniciar com o Windows, Manter o PC acordado, Importar do relógio no USB, Importar do relógio agora, Fazer backup agora, Abrir pasta de backups, Ver log e Sair.", onde: "apps/controle/kactus_controle/app.py:265" },
    { tipo: "botão", nome: "Ligar", acao: "Sobe API e site no modo escolhido. Só fica ativo com o servidor desligado ou com erro.", onde: "apps/controle/kactus_controle/app.py:273", no: "MODO" },
    { tipo: "botão", nome: "Desligar", acao: "Mata os processos nas portas 3003 e 8000 e os .bat que os lançaram.", onde: "apps/controle/kactus_controle/servidor.py:221" },
    { tipo: "botão", nome: "Reiniciar", acao: "Desliga e liga de novo. Necessário no modo rápido para pegar código novo.", onde: "apps/controle/kactus_controle/servidor.py:243" },
    { tipo: "botão", nome: "Abrir no PC", acao: "Abre localhost:3003 no navegador do PC. Só com o servidor ligado.", onde: "apps/controle/kactus_controle/app.py:203" },
    { tipo: "botão", nome: "Copiar endereço do iPhone", acao: "Copia https://<pc>.<tailnet>.ts.net. Só aparece se o Tailscale existir.", msg: "Copiado!", onde: "apps/controle/kactus_controle/janela.py:239" },
    { tipo: "filtro", nome: "Modo rápido × desenvolvimento", acao: "Rápido = next build + next start em .next-prod. Desenvolvimento = next dev. Trocar com o servidor ligado pede reinício.", onde: "apps/controle/kactus_controle/app.py:217" },
    { tipo: "campo", nome: "Iniciar com o Windows", acao: "Cria ou apaga o atalho Kactus.lnk na pasta Inicializar com --inicio (liga sem abrir navegador).", onde: "apps/controle/kactus_controle/sistema.py:86" },
    { tipo: "campo", nome: "Manter o PC acordado", acao: "Enquanto ligado, impede o Windows de dormir.", onde: "apps/controle/kactus_controle/sistema.py:98" },
    { tipo: "botão", nome: "Ver log", acao: "Abre o arquivo de log do servidor.", onde: "apps/controle/kactus_controle/app.py:211" },
    { tipo: "seção", nome: "Relógio no USB", acao: "Na janela: o último resultado, o botão Importar agora e a opção Importar sozinho ao ligar no USB.", msg: "Ligue o Garmin no USB: os treinos novos entram sozinhos.", onde: "apps/controle/kactus_controle/janela.py:167", no: "USB" },
    { tipo: "campo", nome: "Importar sozinho ao ligar no USB", acao: "Liga e desliga o vigia (também no menu do ícone). Salvo em config.json; vem ligado.", onde: "apps/controle/kactus_controle/janela.py:180", no: "RVIG" },
    { tipo: "integração", nome: "Relógio como pendrive", acao: "Procura GARMIN/Activity em todas as letras de unidade e pega os .fit.", onde: "apps/controle/kactus_controle/relogio.py:49", no: "UNI,TIPO" },
    { tipo: "integração", nome: "Relógio como dispositivo (MTP)", acao: "Forerunner e Fenix atuais não ganham letra: o relogio.ps1 navega pelo Shell do Windows até GARMIN\\Activity, lista e copia.", onde: "apps/controle/kactus_controle/relogio.py:92", no: "MTP" },
    { tipo: "cálculo", nome: "Só os novos", acao: "Guarda dispositivo + nome de cada arquivo já importado em relogio_vistos.json; copia só os novos para relogio_chegada e apaga a cópia no fim.", onde: "apps/controle/kactus_controle/relogio.py:189", no: "NOVOS,COP,VIS" },
    { tipo: "API", nome: "Importação direto no banco", acao: "O Controle roda o script da API com os arquivos; a conta é a INITIAL_USER_EMAIL do .env. Mesmo caminho da tela Importar (duplicados ignorados, carga recalculada uma vez).", api: "uv run python -m kactus_api.scripts.import_files --json", onde: "apps/controle/kactus_controle/relogio.py:116", no: "IMP" },
    { tipo: "sucesso", nome: "Treinos do relógio importados", acao: "Aviso no Windows e na janela, com a hora.", msg: "N treinos novos do relógio no Kactus · N já estavam lá · N com erro", onde: "apps/controle/kactus_controle/app.py:209", no: "AV" },
    { tipo: "erro", nome: "Falha ao importar do relógio", acao: "Nada é marcado como visto: tenta de novo na próxima conferência.", msg: "Não consegui importar do relógio: …", onde: "apps/controle/kactus_controle/relogio.py:189", no: "RERR" },
    { tipo: "seção", nome: "Backup semanal", acao: "Na janela: quando foi o último backup (clique abre a pasta) e o botão Fazer agora.", msg: "Ainda sem backup: o primeiro sai alguns minutos depois de abrir o Controle. · Último: dd/mm às HH:MM", onde: "apps/controle/kactus_controle/janela.py:189", no: "BINI" },
    { tipo: "cálculo", nome: "Quando fazer o backup", acao: "2 min depois de abrir o Controle e depois de hora em hora: se passou uma semana do último (salvo em config.json), roda.", onde: "apps/controle/kactus_controle/backup.py:43", no: "BVENC" },
    { tipo: "integração", nome: "Script de backup", acao: "Exporta tudo (o mesmo do Exportar meus dados) em kactus_backup_AAAA-MM-DD_HHMMSS.json.gz e apaga as cópias além das 8 mais novas. Com os dados reais: ~8 MB e ~25 s.", api: "uv run python -m kactus_api.scripts.backup --pasta … --json", onde: "apps/controle/kactus_controle/backup.py:22", no: "BRUN,BGZ" },
    { tipo: "botão", nome: "Fazer backup agora", acao: "Na janela e no menu do ícone.", msg: "Fazendo o backup… (cerca de meio minuto)", onde: "apps/controle/kactus_controle/app.py:233", no: "BAGORA" },
    { tipo: "sucesso", nome: "Backup salvo", msg: "Backup do Kactus salvo (X MB)", onde: "apps/controle/kactus_controle/backup.py:38", no: "BOK" },
    { tipo: "erro", nome: "Backup falhou", msg: "Não consegui fazer o backup do Kactus: …", onde: "apps/controle/kactus_controle/backup.py", no: "BERR" },
    { tipo: "botão", nome: "Abrir pasta de backups", acao: "Abre Documentos/Kactus backups no Explorer.", onde: "apps/controle/kactus_controle/app.py", no: "BPASTA" },
    { tipo: "botão", nome: "Importar agora", acao: "Na janela e no menu: confere o USB na hora e reimporta tudo o que está no relógio.", msg: "Procurando o relógio no USB… · Nenhum relógio com treinos encontrado no USB.", onde: "apps/controle/kactus_controle/app.py:205", no: "AGORA,FORCA" },
    { tipo: "modal", nome: "Sair do Controle", acao: "Pergunta se desliga o servidor também.", msg: "Desligar o servidor do Kactus também? Sim: desliga tudo. Não: o Kactus continua no ar, sem o controle.", onde: "apps/controle/kactus_controle/app.py:242" },
    { tipo: "carregando", nome: "Preparando", acao: "Build da versão rápida quando o código do site mudou.", msg: "Preparando a versão rápida do site (1–2 min)…", onde: "apps/controle/kactus_controle/app.py:35", no: "PREP" },
    { tipo: "carregando", nome: "Ligando", acao: "Espera o site e a API responderem.", onde: "apps/controle/kactus_controle/servidor.py:315", no: "LIG" },
    { tipo: "sucesso", nome: "Ligado", acao: "Os dois responderam: aviso no Windows.", msg: "Kactus ligado. Já dá para abrir no iPhone.", onde: "apps/controle/kactus_controle/app.py:33", no: "ON" },
    { tipo: "erro", nome: "O Kactus caiu", acao: "O vigia viu o processo morrer e religa sozinho; se cair demais, para até um novo Ligar.", msg: "O Kactus caiu. Religando…", onde: "apps/controle/kactus_controle/servidor.py:394", no: "CAIU,BLOQ" },
    { tipo: "cálculo", nome: "Vigia", acao: "Confere processo e portas; se um servidor de fora cair, o Controle assume.", onde: "apps/controle/kactus_controle/servidor.py:354", no: "VIG" },
    { tipo: "API", nome: "Página do Controle para o iPhone", acao: "Mesmo painel da janela, servido pelo Controle e publicado pelo Tailscale.", api: "GET / · GET /api/status · POST /api/ligar|desligar|reiniciar|…", onde: "apps/controle/kactus_controle/web.py:90" },
    { tipo: "permissão", nome: "Origem permitida (CORS)", acao: "Só o próprio Controle (PC e iPhone) e o app do Kactus podem chamar a API do Controle.", onde: "apps/controle/kactus_controle/web.py:28" },
    { tipo: "aviso", nome: "Tailscale parado", acao: "Detectado pelo status do Tailscale; botão Consertar abre o app.", msg: "Tailscale parado — iPhone sem acesso", onde: "apps/controle/kactus_controle/tailscale.py:40", no: "P" },
    { tipo: "aviso", nome: "Endereço do iPhone desligado", acao: "Portas 443 ou 8443 sumiram do serve; Consertar refaz.", msg: "Endereço do iPhone desligado no Tailscale", onde: "apps/controle/kactus_controle/tailscale.py:47", no: "SE" },
    { tipo: "botão", nome: "Consertar (Tailscale)", acao: "Abre o app do Tailscale ou roda tailscale serve --bg de novo.", msg: "Refiz os endereços do iPhone no Tailscale", onde: "apps/controle/kactus_controle/tailscale.py:71", no: "CONS" },
    { tipo: "integração", nome: "Service worker", acao: "Só intercepta navegação. Falha de rede ou 502/503/504 → desligado.html. Não guarda páginas do app.", onde: "apps/web/public/sw.js:30", no: "SW" },
    { tipo: "integração", nome: "Registro do service worker", acao: "Só fora do next dev (produção).", onde: "apps/web/components/RegistrarSW.tsx:6" },
    { tipo: "tela", nome: "Kactus desligado", acao: "Mostra o estado do PC e do servidor e deixa ligar pelo iPhone.", msg: "O Kactus está desligado", onde: "apps/web/public/desligado.html", no: "DESL" },
    { tipo: "seção", nome: "Último painel (sem conexão)", acao: "O dashboard grava no aparelho (localStorage kactus_ultimo_painel) um resumo pronto a cada carregamento: recomendação de hoje, treino de hoje, semana (treinos, km com a meta, tempo), próxima prova, próximos 3 treinos planejados, últimos 5 treinos e recordes de 30 dias. A tela desligado.html mostra esse resumo com a faixa amarela com data e hora; os botões de ligar continuam no alto. Sair da conta ou excluir a conta apaga o resumo.", msg: "Sem conexão com o PC · dados de DD/MM às HH:MM", onde: "apps/web/public/desligado.html:126", no: "SNAP,ULT,SOD" },
    { tipo: "erro", nome: "PC desligado ou dormindo", acao: "O Controle não respondeu.", msg: "Ligue ou acorde o PC e toque em Tentar de novo.", onde: "apps/web/public/desligado.html", no: "PCOFF" },
    { tipo: "botão", nome: "Ligar agora", acao: "Pede ao Controle para ligar e acompanha a cada 2 s.", api: "POST :8443/api/ligar", msg: "Pode levar até 2 minutos quando o código mudou.", onde: "apps/web/public/desligado.html", no: "BTN" },
    { tipo: "botão", nome: "Tentar de novo", acao: "Recarrega a página.", onde: "apps/web/public/desligado.html", no: "TENTA" },
    { tipo: "integração", nome: "Abrir Kactus.bat", acao: "Lançador antigo: garante pnpm, mostra o endereço do iPhone, sobe API e site; com /inicio usa modo rápido sem abrir navegador.", onde: "Abrir Kactus.bat:1" },
    { tipo: "cálculo", nome: "Precisa de build?", acao: "Compara o código do site com o último build para decidir se refaz o .next-prod.", onde: "scripts/precisa-build.ps1", no: "BUILD" },
  ],
});
