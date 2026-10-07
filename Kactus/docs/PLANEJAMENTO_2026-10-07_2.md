# Planejamento 2026-10-07 (2) — Painel de controle do servidor do Kactus


## Contexto

Pedido do Murilo: "um software para ativar e desativar o servidor". Hoje o Kactus roda numa janela de terminal minimizada (`Abrir Kactus.bat`).

Problemas que isso causa:

- Ninguém sabe se ele está ligado. Fechar a janela sem querer derruba tudo, e o iPhone mostra **tela branca** (foi o que aconteceu hoje).
- Não há como ligar o Kactus pelo iPhone.

Decisões do Murilo:

- **No PC:** **ícone perto do relógio** (verde, amarelo ou vermelho) **+ janelinha** com botões grandes ao clicar. Botão direito abre um menu rápido.
- **No iPhone:**
  - **Ligar/desligar** por um segundo ícone, "Kactus Controle".
  - O app do Kactus mostra **"Kactus desligado no PC — Ligar"** em vez da tela branca.
  - Tudo isso funciona com o PC ligado, mesmo com o Kactus desligado.

Restrições que continuam valendo:

- Custo R$ 0.
- Nada exposto fora da tailnet.
- O PC não fica ligado 24h. "Manter o PC acordado" vira uma opção, desligada por padrão.

## Como vai funcionar

```
PC (sempre que o Windows abre)
 └─ Kactus Controle (ícone no relógio, sem janela preta)
     ├─ liga/desliga/reinicia o servidor (modo rápido ou dev), religa se cair
     ├─ janelinha: estado, botões, endereço do iPhone, log
     └─ mini servidor 127.0.0.1:3010 ── tailscale serve :8443 ──▶ iPhone "Kactus Controle"
iPhone app Kactus (:443) ── servidor fora? ──▶ página "Kactus desligado [Ligar agora]" (chama o :8443)
```

## Fases

Cada fase termina com:

- `uv run pytest` em `apps/controle`.
- `npx tsc --noEmit` se tocar o web.
- Teste abrindo **pelo Explorer**, porque o app Claude enxerga uma cópia virtual do AppData e o resultado não seria o mesmo.
- Commit só dos arquivos da fase, com push na origin e commit-ponte no espelho `kactus`.

### Fase 0 — Documento

`docs/PLANEJAMENTO_2026-10-07_2.md` com este plano.

A lista de ideias de melhoria levantada junto com este pedido **não entra neste plano**. O Murilo quer analisá-la depois. Ela fica guardada na memória do Claude (ranqueada, sem nada decidido), para quando ele pedir.

### Fase 1 — Núcleo do controlador (sem tela)

Novo `Kactus/apps/controle/`: projeto `uv` próprio, Python 3.12. Dependências: `pystray` e `pillow`.

`servidor.py`, classe `Servidor`:

- **Ligar:**
  - **Modo rápido:** se `scripts/precisa-build.ps1` (o mesmo que o `.bat` usa) disser que precisa, roda `pnpm build:prod`; depois sobe `pnpm start:prod`.
  - **Modo dev:** sobe `pnpm dev`.
  - Se o build falhar, cai para o modo dev, como o `.bat` já faz.
  - Usa o mesmo ajuste de PATH do `.bat` (`%APPDATA%\npm`, `.local\bin`, `nodejs`) e `CREATE_NO_WINDOW`, para não abrir janela preta.
- **Desligar:** `taskkill /T /F` na árvore de processos. Se o servidor foi aberto por fora (pelo `.bat` ou pelo Claude), acha o PID dono das portas 3003 e 8000 pelo `netstat`.
- **Reiniciar.** **Religar sozinho** se cair (substitui o laço do `.bat`), mas nunca depois de um "Desligar" pedido.
- **Estado**, conferido a cada 3 s: `desligado`, `preparando` (build), `ligando`, `ligado` (3003 e `/api/health` respondem 200) ou `erro`.
- **Log** da saída do servidor em `apps/controle/logs/servidor.log`, com rotação por tamanho.
- **Testes** com comandos falsos (um `python -m http.server` no lugar do `pnpm`): ligar, desligar, religar ao cair, não religar depois de desligar, falha de build cai para dev, servidor aberto por fora.

### Fase 2 — Ícone no relógio + janelinha

`app.py`: `pystray` para o ícone e `tkinter` para a janela (já vem no Python).

- **Ícone:** a logo com um ponto colorido. Cinza = desligado, amarelo = preparando/ligando, verde = ligado, vermelho = erro.
- **Janelinha** (abre num clique; fechar só esconde):
  - Estado em texto ("Ligado há 2 h · modo rápido").
  - Botões **Ligar / Desligar / Reiniciar / Abrir no PC**.
  - Endereço do iPhone com botão **Copiar**.
  - **Ver log**, que abre no Bloco de Notas.
  - Seletor **Modo rápido / desenvolvimento**.
  - Visual escuro com o verde do Kactus.
- **Menu do botão direito:** os mesmos atalhos, mais as opções:
  - **Iniciar com o Windows**: cria ou remove o atalho na Inicializar.
  - **Manter o PC acordado enquanto o Kactus estiver ligado**: `SetThreadExecutionState`, **desligado por padrão**.
  - **Sair**: pergunta se desliga o servidor junto.
- **Avisos do Windows:** "Kactus ligado", "Kactus caiu, religando…" e "Preparando a versão rápida (1–2 min)".
- **Instância única:** abrir de novo só traz a janela para a frente, usando a porta 3010 como trava.
- **Preferências** (modo, manter acordado) em `apps/controle/config.json`, fora do git.
- Roda com `apps/controle/.venv/Scripts/pythonw.exe -m kactus_controle`, sem console.

### Fase 3 — Controle pelo iPhone

- **Mini servidor no próprio controlador** (`http.server` em thread), só em **127.0.0.1:3010**:
  - `GET /` serve a página "Kactus Controle" (estado + Ligar/Desligar/Reiniciar + **Abrir Kactus**), feita para celular com o visual do app, manifest próprio e ícone para a Tela de Início.
  - `GET /api/status`.
  - `POST /api/ligar|desligar|reiniciar`.
  - CORS só para a origem do app, `https://murilo.tailf0dcb1.ts.net` (Fase 4).
- **Claude (com o OK do Murilo):** `tailscale serve --bg --https=8443 http://127.0.0.1:3010`, o que publica `https://murilo.tailf0dcb1.ts.net:8443`, só na tailnet.
- **Testes:** endpoints, origem não permitida recusada, e o POST só aceito como POST.
- **(Murilo)** No iPhone, abrir o `:8443` no Safari → **Adicionar à Tela de Início** ("Kactus Controle").

### Fase 4 — "Kactus desligado" no app, no lugar da tela branca

- **`apps/web/public/sw.js`**, um service worker **mínimo**:
  - Só intercepta **navegações**: tenta a rede primeiro. Se a rede falhar ou vier 502/503/504, mostra `desligado.html`.
  - O único arquivo em cache é `desligado.html`. **Nenhuma página do app fica em cache**, então o motivo de 2026-09-18 para não ter service worker (páginas velhas) não se aplica.
- **`apps/web/public/desligado.html`:**
  - Mensagem "O Kactus está desligado no PC".
  - Botão **Ligar agora**: POST em `:8443/api/ligar`, depois acompanha `/api/status` e recarrega sozinho quando ficar verde.
  - Se nem o controle responder (PC desligado ou suspenso), mostra "O PC está desligado ou dormindo".
- **Registro** num componente cliente pequeno em `app/layout.tsx`, só em produção (`next start`), para não atrapalhar o `next dev`.
- **Verificação:**
  - No PC, com o servidor desligado, abrir `https://murilo.tailf0dcb1.ts.net` pelo `curl`/navegador. O navegador do painel bloqueia `*.ts.net`, então o teste visual é no iPhone.
  - `next build` + conferir que o `sw.js` não intercepta `/api`.

### Fase 5 — Trocar os atalhos e aposentar o terminal

- **Inicializar:** o atalho `Kactus.lnk` passa a abrir o **controlador** com `--inicio`, que liga em modo rápido sem abrir o navegador. Criado pelo próprio controlador ou via Explorer.
- **Área de trabalho:** o ícone **Kactus** abre o controlador com `--abrir`, que liga se estiver desligado e abre o navegador.
- O `Abrir Kactus.bat` continua como **reserva manual** (sem mudanças).
- **Teste real:**
  - **(Murilo)** reiniciar o PC → o ícone verde aparece sozinho → o iPhone abre.
  - Desligar pelo iPhone e ver o ícone ficar cinza no PC.
  - Ligar pela tela "Kactus desligado" do app.

### Fase 6 — Fechamento

- `ESTADO_DO_PROJETO.md`: seção "Painel de controle".
- README: como usar.
- Memória `project_ondilow_uso_local` atualizada: tela branca agora = PC dormindo, e o controle mora em `apps/controle`.

## Verificação ponta a ponta

1. Ligar o PC → o ícone do Kactus fica amarelo e depois verde, sem janela preta.
2. Clicar no ícone → a janelinha mostra "Ligado · modo rápido". Desligar → cinza. Ligar → verde de novo.
3. Matar o processo do site no Gerenciador de Tarefas → aviso "religando…" → verde.
4. iPhone: "Kactus Controle" mostra o mesmo estado; Desligar → o ícone do PC fica cinza.
5. Abrir o app Kactus com o servidor desligado → tela "Kactus desligado" → **Ligar agora** → o painel abre sozinho.
6. Com o PC suspenso, o app mostra "O PC está desligado ou dormindo" (não fica branco).


## Andamento

- **Fase 0 — feita:** este documento.
