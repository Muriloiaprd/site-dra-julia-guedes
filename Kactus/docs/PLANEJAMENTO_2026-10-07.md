# Planejamento 2026-10-07 — Kactus no iPhone

Pedido do Murilo: "Quero que monte um planejamento para virar também o Kactus para aplicativo, onde eu consiga acessar pelo meu celular. Quero acessar ele do meu iPhone."

## Contexto

O Murilo quer usar o Kactus no iPhone como se fosse um app. Hoje o Kactus só roda no PC (`pnpm dev`: site na 3003 e API na 8000, banco no Neon), e só abre em `localhost`.

Decisões tomadas com ele nesta conversa:

- **Hospedagem:** continua rodando no **PC de casa**. O iPhone acessa pelo **Tailscale**, uma rede privada grátis e sem cartão que funciona em casa ou no 4G. Nada fica exposto na internet. Não haverá deploy público: a Fase 7 de 2026-09-18 continua adiada.
- **Prioridades no iPhone:** (1) ver painel e treinos, (2) gerar e salvar Stories, (3) subir treino e foto pelo celular. A Duni funciona, mas não é foco.
- **"App":** é um **atalho na Tela de Início** (PWA), que abre em tela cheia, sem a barra do Safari. Um app na App Store custaria US$ 99/ano e quebraria a regra de custo R$ 0, então está fora.
- **Versão enxuta (escolha final do Murilo):** o iPhone acessa **quando o PC estiver ligado**.
  - **Sem PC 24h:** deixar o PC ligado o tempo todo gastaria luz (~R$ 30–50/mês, estimativa) e fugiria do custo R$ 0.
  - O valor principal no iPhone são Stories direto na galeria/Instagram e foto tirada no celular. Painel e treinos continuam melhores no PC.
- O Kactus **abre sozinho** quando o Murilo entra no Windows (não gasta nada a mais).
- **O ícone do iPhone abre no Painel** (`/dashboard`).
- **Mapa:** o Murilo quer igual ao do PC. Como isso não acontece sozinho (ver Fase 4), a decisão fica para depois de ver no iPhone.

Fatos levantados que moldam o plano:

- **Só a porta 3003 precisa ser alcançada.** O Next já repassa `/api` para 127.0.0.1:8000 (`apps/web/next.config.mjs:19-22`), e o front chama tudo em caminho relativo (`lib/api.ts:263`). Não é preciso mexer em CORS nem na API.
- **HTTPS é obrigatório.** `navigator.share` (salvar o Story na galeria e mandar para o Instagram) e a área de transferência só funcionam em HTTPS. O `tailscale serve` entrega HTTPS com certificado válido em `https://<pc>.<tailnet>.ts.net`.
- **Hoje o PC (desktop) suspende depois de 1 minuto parado** (`powercfg`: STANDBYIDLE = 60 s na tomada). Com o PC suspenso, o iPhone perde o acesso. A Fase 2 sugere aumentar esse tempo, sem chegar a "Nunca".
- **Não há nada de PWA hoje.** Faltam manifest, `appleWebApp` e `viewportFit: "cover"`, por isso `env(safe-area-inset-*)` vale 0. Os ícones `app/icon.png` (256) e `app/apple-icon.png` (180) já existem.
- **Campos de texto com 14px** (`globals.css:468`, `.od-input`) fazem o Safari dar zoom ao tocar.
- **Stories:**
  - São gerados **no aparelho**: Canvas + MediaRecorder (`components/share/StoryGenerator.tsx`), sem nenhum peso no servidor.
  - O PNG só chama `share` depois de `await toBlob()` (L326-330). O Safari pode bloquear com `NotAllowedError`.
  - `layerCache` (`lib/story/art.ts:98`) não tem limite. No iOS, estourar a memória aparece como canvas em branco.
- **Upload:**
  - `accept=".fit,.gpx,.tcx,.csv,.gz"` (`app/import/page.tsx:11,189`) costuma deixar `.fit` acinzentado no seletor do iOS.
  - As fotos já são reduzidas para JPEG no navegador (`lib/image.ts`). O Safari lê HEIC, então deve funcionar; falta confirmar no aparelho.
- **Mapa:** o Stadia só é grátis sem chave em `localhost`. Pelo endereço `.ts.net` ele falha e cai sozinho no OSM escurecido (`lib/mapTiles.ts`). Funciona, só fica com outro visual.
- **Login:** o token fica em `localStorage`. O app da Tela de Início tem armazenamento separado do Safari, então é preciso entrar uma vez dentro dele. O JWT dura 7 dias.
- **Sem service worker**, mantendo a decisão de 2026-09-18: com token em `localStorage`, ele serviria páginas velhas sem sintoma claro.

## Regras de execução (valem para todas as fases)

- **Ao final de cada fase:**
  - `npx tsc --noEmit` no web.
  - `uv run pytest` + `ruff`, se a fase tocar a API.
  - Conferência no navegador do app em tamanho de celular (375×812 e 390×844), usando as rotas de prévia (`/activities-preview`, `/coach-preview`) quando não houver login.
  - Commit + push: `git push` para a origin + commit-ponte para o espelho `kactus`.
- **Commits só com os arquivos da fase.** A árvore tem trabalho não commitado de outras frentes (lixeira de atividades etc.), então nunca usar `git add -A`.
- **Testar o atalho do jeito que o usuário clica:** `explorer.exe "<atalho>.lnk"`. Rodar o `.bat` daqui de dentro não reproduz o problema (pasta AppData virtual do app Claude).
- **Itens marcados "(você)" são ações do Murilo.** Inclui criar conta, instalar programas e mexer no painel do Tailscale e em configurações do Windows; o Claude não faz essas ações e só guia.

## Fases

### Fase 0 — Documento do plano

- Criar `Kactus/docs/PLANEJAMENTO_2026-10-07.md` com este conteúdo.
- Commit + push.

### Fase 1 — Tailscale: iPhone enxergando o PC

1. **(você)** Criar a conta grátis em tailscale.com, entrando com Google, Apple ou Microsoft. O plano Personal não pede cartão.
2. **(você)** Instalar o Tailscale no PC (tailscale.com/download) e no iPhone (App Store), com a mesma conta.
3. **(você)** No painel do Tailscale, em **DNS**, ligar **MagicDNS** e **HTTPS Certificates**.
4. **Claude** (com o seu OK, porque é configuração que fica salva):
   - Rodar `tailscale serve --bg http://127.0.0.1:3003`.
   - Conferir com `tailscale serve status` e anotar o endereço `https://<pc>.<tailnet>.ts.net`.
5. **(você)** No app Tailscale do iPhone, ligar **VPN sob demanda**, para conectar sozinho.
6. **Teste:**
   - Abrir o endereço no PC.
   - Abrir no iPhone com o **Wi-Fi desligado (4G)**.
   - Fazer login e abrir painel e treinos.
   - Medir quanto tempo cada tela leva para abrir pela primeira vez (o `next dev` compila cada tela no primeiro acesso).

Nesta fase não há código. Ela termina com o endereço anotado no documento do plano (commit).

### Fase 2 — Kactus abrindo sozinho com o PC

- **Suspensão (sugestão, sem PC 24h):** com 1 minuto, o PC dorme logo que você levanta, e o iPhone perde o acesso mesmo com você em casa.
  - **(você, opcional)** Configurações → Sistema → Energia → "Suspender o dispositivo após": algo como **30 min ou 1 h**, na tomada. Assim dá tempo de usar o iPhone pela casa, e o PC ainda dorme quando ninguém usa.
  - O Claude não altera configuração do Windows. Só confere com `powercfg /query` (leitura).
- **Kactus abre sozinho ao entrar no Windows (escolha do Murilo):**
  - Atalho na pasta **Inicializar** (`shell:startup`) apontando para `Abrir Kactus.bat`, janela minimizada, com um parâmetro `/inicio`.
  - Com `/inicio`, o `.bat` sobe tudo **sem abrir o navegador no PC**, para não abrir uma aba a cada boot.
  - ⚠️ A pasta Inicializar fica dentro de `%APPDATA%`, que o app Claude enxerga numa cópia virtual. O atalho tem que ser criado por um processo aberto pelo Explorer (mesma técnica usada no conserto do ícone), e a conferência também é feita pelo Explorer.
- **`Abrir Kactus.bat`:** mostrar na janela o endereço do iPhone, lido de `tailscale status --json` (`Self.DNSName`), quando o Tailscale existir.
- **`Kactus/package.json`:** `dev:web` passa a usar `-H 127.0.0.1`.
  - Hoje o `next dev` escuta em todas as interfaces, ou seja, fica exposto na rede de casa.
  - O Tailscale entra pelo 127.0.0.1, então nada se perde.
- **Teste:**
  - Abrir pelo atalho da Inicializar via `explorer.exe`: o Kactus sobe e não abre o navegador.
  - Abrir pelo ícone da área de trabalho: continua abrindo o navegador.
  - `http://localhost:3003` e o endereço `.ts.net` abrem.
  - **(você)** Reiniciar o PC, entrar no Windows e, sem clicar em nada, abrir o Kactus no iPhone.

### Fase 3 — "App" na Tela de Início (PWA sem service worker)

- **`apps/web/app/manifest.ts`** (suporte nativo do Next 14):
  - name/short_name "Kactus", `start_url: "/dashboard"`, `display: "standalone"`.
  - Fundo e tema `#0A0A0A`.
  - Ícones 192 e 512 e um maskable 512 com ~10% de margem, gerados de `Kactus/Imagens/Somente o Icone.png` em `public/icons/`.
- **`apps/web/app/layout.tsx`:**
  - `metadata.appleWebApp = { capable: true, title: "Kactus", statusBarStyle: "black-translucent" }`.
  - `viewport.viewportFit = "cover"`.
- **Áreas seguras (entalhe e barra inferior do iPhone):**
  - Barra superior do mobile (`components/Sidebar.tsx:184`) com `padding-top: env(safe-area-inset-top)`.
  - Sheet "Mais" (`Sidebar.tsx:234`) posicionado acima da barra inferior somando a área segura.
  - `components/WakingBanner.tsx:16` no topo também com a área segura.
  - Modais (`StoryGenerator.tsx:370`, `ActivityModal.tsx:86`) com `dvh` em vez de `vh`.
- **Sem zoom ao tocar em campo:** em `globals.css`, uma regra só para telas `< md` que coloca `input`, `textarea`, `select` e `.od-input` em 16px. O desktop não muda.
- **Verificação:**
  - Emulação 375/390 no navegador do app.
  - `next build` num `NEXT_DIST_DIR` separado, apagado no fim, para não corromper o `.next` do dev.
- **(você) no iPhone:**
  - Safari → Compartilhar → **Adicionar à Tela de Início**.
  - Conferir o ícone, que abre sem a barra do Safari e que o topo não fica embaixo do relógio.
  - Fazer login uma vez dentro do app.

### Fase 4 — Painel e treinos bons no iPhone

- Passada nas telas prioritárias em 375 e 390: `/dashboard`, `/activities`, `/activities/[id]`, `/performance`, `ActivityModal`.
- **Ajustes já previstos:**
  - Grades fixas de 7 colunas apertadas (`components/.../WeekStrip.tsx:72`, `MonthCalendar.tsx:54-57`).
  - Dicas que só aparecem com o mouse (`title=`) e escondem informação no toque: `WeekStrip.tsx:102`, `StatusTiles.tsx:35`, `activities/[id]/page.tsx:381`. Passam a abrir no toque, mas só onde a informação faz falta.
- **Mapa (decidir vendo no iPhone):** mesmo com o Kactus rodando no PC, as imagens do mapa são baixadas **pelo iPhone direto do Stadia**. O Stadia vê o endereço `.ts.net`, não `localhost`, e recusa sem chave. Então o mapa **não** fica igual automaticamente: cai no OSM escurecido.
  - Primeiro conferir no iPhone como ficou.
  - Se quiser idêntico ao do PC: **(você)** cria conta grátis no Stadia Maps (sem cartão) e cadastra o domínio `.ts.net`; o Claude coloca `NEXT_PUBLIC_STADIA_API_KEY` no `.env`.
  - Não usar o PC para "fingir ser localhost" para o Stadia: isso burla a regra de acesso deles.
- **Lento demais?** Se a Fase 1 mediu primeira abertura de tela muito lenta (> ~5 s), entra o "modo celular" do launcher: `next build` + `next start` num `distDir` próprio (`.next-prod`), refeito só quando o código mudou.
- **(você)** Conferir as mesmas telas no iPhone.

### Fase 5 — Stories: gerar, salvar na galeria e mandar para o Instagram

- **PNG pronto antes do toque:** o blob é preparado quando a prévia termina de desenhar. O botão "Compartilhar" chama `navigator.share` direto no toque, sem `await` antes (`StoryGenerator.tsx:322-340`). A folha do iOS oferece "Salvar Imagem" e o Instagram. O vídeo já tem o blob pronto (L240-251).
- **Copiar imagem:** usar `new ClipboardItem({"image/png": promessaDoBlob})` criado no próprio toque (exigência do Safari), em L342-349.
- **Memória:** limitar o `layerCache` (`lib/story/art.ts:98`) a poucas entradas, descartando as mais antigas, para o Safari não estourar e deixar o canvas em branco.
- **Vídeo no iPhone:**
  - A lista já prefere `video/mp4;codecs=avc1` (L17).
  - Se `captureStream`/`MediaRecorder` falhar, mostrar aviso e oferecer só a imagem.
- **Erros visíveis:** o nome e a mensagem do erro aparecem na tela quando compartilhar ou gravar falhar. Não dá para abrir o console do Safari no Windows; assim você me diz o que apareceu.
- **No iPhone:** o `<a download>` manda para o app Arquivos, não para a galeria. Por isso o caminho principal é "Compartilhar → Salvar".
- **(você) Teste:** 3 modelos com foto, 1 de vídeo, salvar na galeria e compartilhar no Instagram.

### Fase 6 — Subir treino e foto pelo iPhone

- **Importar** (`app/import/page.tsx`): em aparelho de toque, o seletor não restringe por extensão, para o iOS não acinzentar o `.fit`. O filtro por extensão que já existe no código (L44-48) continua barrando o resto com mensagem clara. No desktop o `accept` fica como está.
- **Fotos** (perfil, equipamento, foto do Story): confirmar com uma foto real do iPhone (HEIC) que `lib/image.ts` converte para JPEG. Se não converter, decodificar com `createImageBitmap` antes de desenhar.
- **(você) Teste no 4G:**
  - Um `.fit` salvo no app Arquivos.
  - Uma foto de equipamento.
  - Uma foto de fundo de Story.

### Fase 7 — Fechamento

- **`docs/ESTADO_DO_PROJETO.md`:** nova seção "Kactus no iPhone", com endereço, como instalar na Tela de Início, o que precisa estar ligado e limites.
- **`docs/BACKLOG.md`:**
  - Item 12 (PWA) resolvido.
  - Item 13 (deploy) continua em aberto, com nota: o acesso de fora de casa foi resolvido pelo Tailscale, sem deploy.
- **`README.md`:** passo curto "Usar no iPhone".
- **Memória:** atualizar `project_ondilow_uso_local` (agora tem acesso pelo iPhone via Tailscale) e registrar o plano fechado.

## Limites que ficam (combinados)

- O iPhone só acessa **com o PC ligado (não suspenso) e com você logado no Windows**. O Kactus abre sozinho no login.
- PC desligado ou suspenso: o app mostra erro de conexão. Isso é esperado na versão enxuta.
- Não há como "acordar" o PC pelo iPhone neste plano.
- O iPhone precisa estar com o Tailscale conectado. Com a "VPN sob demanda" isso é automático.
- Funciona só com internet. Não haverá modo offline (sem service worker).
- Sem notificações push.
- O Garmin continua bloqueado pelo rate limit (assunto separado).

## Verificação ponta a ponta (fim do plano)

1. Desligar e ligar o PC e entrar no Windows. O Kactus tem que subir sozinho, minimizado e sem abrir o navegador.
2. iPhone no **4G**, abrir o ícone Kactus da Tela de Início. Ele deve abrir em tela cheia, já logado (7 dias de sessão), e mostrar o painel.
3. Abrir um treino com mapa e conferir a tela Desempenho.
4. Gerar um Story com foto e um em vídeo, salvar os dois na galeria e compartilhar um no Instagram.
5. Subir um `.fit` e uma foto de equipamento.
6. Com o PC suspenso, o iPhone mostra erro de conexão (esperado). Ao acordar o PC, volta a funcionar sem reabrir nada.

## Andamento

- **Fase 0 — feita:** este documento.
- **Fase 1 — feita no PC:** Tailscale no PC (`murilo`) e no iPhone (`iphone-15-pro-max`); Serve ligado pelo Murilo no painel; `tailscale serve --bg http://127.0.0.1:3003` → **https://murilo.tailf0dcb1.ts.net** (só na tailnet). Certificado válido; site, manifest e `/api/health` respondem 200 (o 1º acesso levou 28 s, emissão do certificado). Falta o teste no iPhone em 4G.
- **Fase 2 — código feito** (`404ab95`):
  - `/inicio` no `.bat`, endereço do iPhone na janela e `next dev` só em 127.0.0.1.
  - Atalho criado na pasta Inicializar real (`%APPDATA%\...\Startup\Kactus.lnk`, feito via Explorer).
  - Testado via `explorer.exe`: sobe sem abrir o navegador e escuta só em 127.0.0.1.
  - Falta reiniciar o PC e testar no iPhone.
- **Fase 3 — código feito** (`dc8a78c`):
  - Manifest e ícones gerados de `Imagens/Logomarca Kactus.png` (o "Somente o Icone.png" citado em 2026-09-18 não existe mais). O `apple-icon` antigo, com moldura e cantos claros, foi trocado.
  - `appleWebApp`, `viewport-fit=cover`, áreas seguras e campos com 16px no celular.
  - Conferido: tags no HTML, CSS válido em 390×844 e `next build` com 18 rotas mais o manifest.
  - Falta o teste no iPhone.
- **Fase 5 — código feito** (`acb9f16`): PNG pronto antes do toque, `ClipboardItem` com promessa, LRU de 6 camadas só em tela de toque (no PC fica sem limite, senão as miniaturas refazem tudo a cada arraste da foto), erros com nome. Falta o teste no iPhone.
- **Fase 6 — código feito** (`61553bc`):
  - O seletor não filtra no celular e o app avisa quais arquivos foram ignorados.
  - Fotos sem mudança: `lib/image.ts` já desenha a imagem num canvas e sai em JPEG, e o Safari lê HEIC.
  - Falta o teste no iPhone.
