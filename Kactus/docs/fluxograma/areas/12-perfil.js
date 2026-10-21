// Área 12 — Perfil do atleta.
KACTUS_MAPA.areas.push({
  id: "perfil",
  n: 12,
  titulo: "Perfil",
  resumo:
    "Os dados fisiológicos que alimentam zonas, carga, previsões e a Duni, em quatro abas (na URL, ?aba=…), com a foto, o nome e o e-mail sempre no topo. Dados: foto, nome, peso, sexo e a logo para os Stories. Treino: FC de repouso e máxima com as zonas (automáticas ou manuais), meta de km por semana, FTP e CSS. Dados e Treino são um formulário só, salvo pelo mesmo botão. Importar: a importação de arquivos (área 08). Conta: notificações no celular (Web Push), trocar senha, exportar todos os dados em JSON e a zona de perigo (apagar todas as atividades, excluir a conta), cada uma com uma palavra para digitar antes.",
  rotas: ["/profile", "/profile?aba=treino", "/profile?aba=importar", "/profile?aba=conta"],
  arquivos: ["apps/web/app/profile/page.tsx", "apps/web/components/profile/ImportSection.tsx", "apps/web/components/profile/NotificationsPanel.tsx", "apps/web/lib/push.ts", "apps/api/kactus_api/routers/push.py", "apps/web/lib/image.ts", "apps/api/kactus_api/routers/profile.py", "apps/api/kactus_api/routers/auth.py", "apps/api/kactus_api/routers/activities.py"],
  diagramas: [
    {
      titulo: "Salvar, senha, exportar e zona de perigo",
      mermaid: `
flowchart TD
  IN("Abre /profile"):::acao --> API[/"GET /auth/me · GET /profile"/]:::api
  API -->|sem token| LOGIN["/login"]:::tela
  API -->|há token, falhou| NET["Sessão não verificada · Tentar de novo"]:::erro
  API -->|ok| PG["Perfil do atleta<br/>foto, nome e e-mail no topo"]:::tela
  PG --> ABAS{"Aba"}:::decisao
  ABAS -->|Dados| PG
  ABAS -->|Treino| PG
  ABAS -->|Importar| IMPA["Importar atividades (área 08)"]:::tela
  ABAS -->|Conta| PG
  HASH["/profile#importar (endereço antigo)"]:::estado -.-> IMPA
  PG --> FOTO("Clicar na foto"):::acao --> RF[["Reduz para 256 px"]]:::calc
  PG --> LOGO("Enviar logo PNG"):::acao --> RL[["Reduz para 512 px"]]:::calc
  RL -->|grande demais| EL["Imagem muito grande mesmo após redimensionar"]:::erro
  PG --> ZON{"Personalizar zonas de FC?"}:::decisao
  ZON -->|não| AUTO[["Zonas automáticas<br/>Karvonen ou % da máxima"]]:::calc
  ZON -->|sim| MAN("Limites de Z1 a Z5"):::acao
  PG --> SAVE("Salvar perfil"):::acao --> PUT[/"PUT /profile"/]:::api
  PUT -->|ok| OK1["✓ Salvo com sucesso!"]:::ok
  PG --> PW("Trocar senha"):::acao --> PV{"Confirmação igual<br/>e 8+ caracteres?"}:::decisao
  PV -->|não| PE["A confirmação não bate · precisa de 8 caracteres"]:::erro
  PV -->|sim| CP[/"POST /auth/change-password"/]:::api
  CP -->|senha atual errada| PE2["Senha atual incorreta"]:::erro
  CP -->|ok| OK2["✓ Senha alterada!"]:::ok
  PG --> EXP("Exportar meus dados"):::acao --> EX[/"GET /profile/export"/]:::api --> JSON["Baixa kactus_export_id.json"]:::ok
  PG --> DZ("Limpar todas as atividades"):::acao --> W1{"Digitou EXCLUIR?"}:::decisao
  W1 -->|sim| DA[/"DELETE /activities"/]:::api --> OK3["N atividades apagadas"]:::ok
  PG --> DC("Excluir conta"):::acao --> W2{"Digitou o próprio e-mail?"}:::decisao
  W2 -->|sim| DAC[/"DELETE /auth/account"/]:::api --> OUT["Apaga tudo e sai para /login"]:::ok
`,
    },
    {
      titulo: "Notificações no celular",
      mermaid: `
flowchart TD
  NP["Notificações"]:::tela --> NC[/"GET /push/config<br/>chave, avisos ligados, aparelhos"/]:::api
  NP --> SUP{"Aparelho recebe push?"}:::decisao
  SUP -->|iPhone no Safari| IOS["Abra pelo ícone da Tela de Início<br/>Compartilhar → Adicionar à Tela de Início"]:::estado
  SUP -->|não| NS["Este navegador não recebe notificações"]:::estado
  SUP -->|sim| AT("Ativar neste aparelho"):::acao --> PERM{"Permitir notificações?"}:::decisao
  PERM -->|bloqueou| BLQ["Bloqueadas · Ajustes → Notificações → Kactus"]:::erro
  PERM -->|permitiu| SUBS[["Inscreve no serviço de push<br/>com a chave VAPID do Kactus"]]:::calc --> PS[/"POST /push/subscribe"/]:::api --> LIG["Neste aparelho: ligadas"]:::ok
  LIG --> TST("Enviar teste"):::acao --> PT[/"POST /push/test"/]:::api --> NOTI["Notificação no aparelho<br/>tocar abre a página do aviso"]:::ok
  LIG --> DES("Desativar neste aparelho"):::acao --> PU[/"POST /push/unsubscribe"/]:::api
  NP --> TIP("Treino de hoje · Recorde novo · Dias sem treinar"):::acao --> PP[/"PUT /push/prefs"/]:::api
`,
    },
  ],
  inventario: [
    { tipo: "seção", nome: "Notificações", acao: "Avisos no celular mesmo com o Kactus fechado (saem do PC: só com ele ligado). Mostra se este aparelho recebe, quantos aparelhos estão inscritos e os três avisos para ligar e desligar. No iPhone só funciona aberto pelo ícone da Tela de Início (iOS 16.4+).", api: "GET /push/config", msg: "Avisos no celular mesmo com o Kactus fechado. Saem do PC: só chegam com ele ligado e o Kactus rodando.", onde: "apps/web/components/profile/NotificationsPanel.tsx:28", no: "NP,NC,SUP,IOS,NS" },
    { tipo: "botão", nome: "Ativar neste aparelho", acao: "Pede a permissão, inscreve o aparelho no serviço de push (Apple, Google, Mozilla) com a chave pública do Kactus e guarda a inscrição.", api: "POST /push/subscribe", msg: "Pronto: este aparelho vai receber os avisos. · As notificações estão bloqueadas para o Kactus. Libere nos Ajustes do aparelho e tente de novo.", onde: "apps/web/components/profile/NotificationsPanel.tsx:60", no: "AT,PERM,BLQ,SUBS,PS,LIG" },
    { tipo: "botão", nome: "Enviar teste", acao: "Manda 'Notificações ligadas neste aparelho' para todos os aparelhos inscritos.", api: "POST /push/test", msg: "Aviso de teste enviado para N aparelho(s). · Nenhum aparelho com notificações ligadas.", onde: "apps/web/components/profile/NotificationsPanel.tsx:88", no: "TST,PT,NOTI" },
    { tipo: "botão", nome: "Desativar neste aparelho", acao: "Cancela a inscrição no aparelho e apaga do Kactus.", api: "POST /push/unsubscribe", msg: "Este aparelho não recebe mais os avisos.", onde: "apps/web/components/profile/NotificationsPanel.tsx:79", no: "DES,PU" },
    { tipo: "campo", nome: "O que avisar", acao: "Treino de hoje (a partir das 7h, o treino planejado do dia), Recorde novo (treino de até 2 dias atrás), Dias sem treinar (a partir das 18h, depois de 3 dias). Todos ligados de início.", api: "PUT /push/prefs", onde: "apps/web/components/profile/NotificationsPanel.tsx:144", no: "TIP,PP" },
    { tipo: "aba", nome: "Dados · Treino · Importar · Conta", acao: "Ficam na URL (?aba=treino, ?aba=importar, ?aba=conta; sem nada é Dados), então o link direto e o voltar do navegador funcionam. O endereço antigo /profile#importar abre a aba Importar. Trocar de aba não perde o que foi digitado.", onde: "apps/web/app/profile/page.tsx:360", no: "ABAS,HASH" },
    { tipo: "seção", nome: "Importar atividades", acao: "A aba Importar: a importação de arquivos (detalhes na área 08). Fica fora do formulário do perfil.", onde: "apps/web/app/profile/page.tsx:602", no: "IMPA" },
    { tipo: "card", nome: "Foto, nome e e-mail", acao: "Faixa no topo de todas as abas.", onde: "apps/web/app/profile/page.tsx:344" },
    { tipo: "tela", nome: "Perfil do atleta", msg: "Seus dados fisiológicos alimentam zonas, carga (TSS), previsões e a Duni.", onde: "apps/web/app/profile/page.tsx:338", no: "PG" },
    { tipo: "API", nome: "Carregar perfil", api: "GET /auth/me · GET /profile", onde: "apps/web/app/profile/page.tsx:133", no: "API" },
    { tipo: "erro", nome: "Sessão não verificada", acao: "Há token, mas a chamada falhou; botão para tentar de novo.", onde: "apps/web/app/profile/page.tsx:304", no: "NET" },
    { tipo: "campo", nome: "Foto do perfil", acao: "Clique na foto; reduzida para 256 px. Aparece no menu e no dashboard.", msg: "Selecione um arquivo de imagem · Não foi possível processar essa imagem", onde: "apps/web/app/profile/page.tsx:159", no: "FOTO,RF" },
    { tipo: "card", nome: "Zonas de FC", acao: "Aba Treino, embaixo da FC de repouso e máxima: a barra das cinco zonas e se elas são personalizadas, Karvonen (com FC de repouso) ou % da máxima.", onde: "apps/web/app/profile/page.tsx:502" },
    { tipo: "campo", nome: "Nome completo · Peso (kg) · Sexo", acao: "Aba Dados; o nome ocupa a linha toda. Sexo: Prefiro não informar, Feminino, Masculino, Outro. Data de nascimento e altura existem no banco, mas não têm campo na tela.", onde: "apps/web/app/profile/page.tsx:392" },
    { tipo: "campo", nome: "Logo para compartilhamento", acao: "PNG (de preferência transparente) reduzido para 512 px; Remover apaga.", msg: "Selecione um arquivo PNG (com fundo transparente, se quiser) · Imagem muito grande mesmo após redimensionar — tente um PNG mais simples", onde: "apps/web/app/profile/page.tsx:430", no: "LOGO,RL,EL" },
    { tipo: "campo", nome: "FC de repouso · FC máxima", acao: "Aba Treino, quadro Frequência cardíaca.", onde: "apps/web/app/profile/page.tsx:476" },
    { tipo: "campo", nome: "FTP · CSS", acao: "Aba Treino, quadro Ciclismo e natação: FTP em watts, CSS em s/100 m.", onde: "apps/web/app/profile/page.tsx:562" },
    { tipo: "campo", nome: "Meta de corrida por semana (km)", acao: "Aba Treino, quadro Meta da semana. De 0 a 400 km; vazio = sem meta. Aparece no dashboard (Visão semanal) e em Desempenho (Hoje).", api: "PUT /profile", onde: "apps/web/app/profile/page.tsx:545" },
    { tipo: "botão", nome: "Personalizar zonas de FC manualmente", acao: "Liga os campos de limite de cada zona; desligado, as zonas são automáticas.", onde: "apps/web/app/profile/page.tsx:516", no: "ZON,MAN" },
    { tipo: "cálculo", nome: "Zonas automáticas", acao: "Com FC de repouso: Karvonen (FC de reserva). Sem: % da FC máxima.", onde: "apps/web/app/profile/page.tsx:31", no: "AUTO" },
    { tipo: "botão", nome: "Salvar perfil", acao: "Embaixo das abas Dados e Treino; salva as duas juntas.", api: "PUT /profile", msg: "Salvando… · ✓ Salvo com sucesso! · Salva as abas Dados e Treino juntas.", onde: "apps/web/app/profile/page.tsx:592", no: "SAVE,PUT,OK1" },
    { tipo: "seção", nome: "Trocar senha", acao: "Senha atual, nova senha, confirmar.", onde: "apps/web/app/profile/page.tsx:611", no: "PW" },
    { tipo: "validação", nome: "Nova senha", msg: "A confirmação não bate com a nova senha · A nova senha precisa ter pelo menos 8 caracteres", onde: "apps/web/app/profile/page.tsx:235", no: "PV,PE" },
    { tipo: "botão", nome: "Trocar senha", api: "POST /auth/change-password", msg: "Trocando… · ✓ Senha alterada! · Senha atual incorreta", onde: "apps/web/app/profile/page.tsx:654", no: "CP,PE2,OK2" },
    { tipo: "botão", nome: "Exportar meus dados", acao: "Baixa kactus_export_<id>.json com usuário, perfil, equipamentos, recordes e as atividades fora da lixeira (com pontos e voltas). Também leva o que a Duni sabe e planejou (memórias, planos, treinos planejados, conversa) e a carga diária (versão 2 do arquivo).", api: "GET /profile/export", msg: "Gerando arquivo…", onde: "apps/web/app/profile/page.tsx:668", no: "EXP,EX,JSON" },
    { tipo: "seção", nome: "Zona de perigo", acao: "Fim da aba Conta. Duas ações irreversíveis, cada uma abrindo sua confirmação.", onde: "apps/web/app/profile/page.tsx:675" },
    { tipo: "validação", nome: "Digitar EXCLUIR", acao: "O botão só liga com a palavra exata.", onde: "apps/web/app/profile/page.tsx:707", no: "W1" },
    { tipo: "botão", nome: "Apagar tudo, sem volta", acao: "Apaga todas as atividades (inclusive as da lixeira), recordes e métricas diárias; login, conversa e memórias da Duni ficam.", api: "DELETE /activities", msg: "Apagando…", onde: "apps/web/app/profile/page.tsx:715", no: "DZ,DA,OK3" },
    { tipo: "validação", nome: "Digitar o e-mail", acao: "O botão de excluir conta só liga com o e-mail exato.", onde: "apps/web/app/profile/page.tsx:759", no: "W2" },
    { tipo: "botão", nome: "Excluir conta, sem volta", acao: "Apaga o usuário e tudo em cascata e sai.", api: "DELETE /auth/account", msg: "Excluindo…", onde: "apps/web/app/profile/page.tsx:767", no: "DC,DAC,OUT" },
    { tipo: "API", nome: "Atualizar perfil", api: "PUT /profile", onde: "apps/api/kactus_api/routers/profile.py:27" },
    { tipo: "API", nome: "Exportar", api: "GET /profile/export", onde: "apps/api/kactus_api/routers/profile.py:61" },
    { tipo: "API", nome: "Recordes", acao: "Usado pelo dashboard.", api: "GET /records", onde: "apps/api/kactus_api/routers/profile.py:42" },
    { tipo: "API", nome: "Apagar todas as atividades", api: "DELETE /activities", onde: "apps/api/kactus_api/routers/activities.py:239" },
  ],
});
