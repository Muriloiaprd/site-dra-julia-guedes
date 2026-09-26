# Ondilow → Kactus — Planejamento do rebrand (2026-09-26)

**Criado em**: 2026-09-26
**Status**: ABERTO. Fases 0 e 1 concluídas em 2026-09-26.
**Relacionados**: [`BACKLOG.md`](./BACKLOG.md) · [`ESTADO_DO_PROJETO.md`](./ESTADO_DO_PROJETO.md)

## Como retomar
Quando o usuário pedir para retomar este planejamento:
1. Ler este documento inteiro.
2. Conferir no código se algo mudou desde a data acima (commits novos, fases já feitas).
3. Apresentar um resumo com análise: o que continua válido, o que mudou e por qual fase seguir.
4. Só executar depois da confirmação do usuário, fase por fase.

Cada fase termina em commit local **e** push para o GitHub (origin + espelho).

---

## Contexto
O site muda de nome: **Ondilow → Kactus**. Funcionalidades, cores, slogan ("Corrida Sem Limites") e layout **continuam iguais**. Mudam o nome, a logo e as artes de Story.
Decisões do usuário:
- **Escopo:** renomear **tudo**, incluindo o pacote Python, a pasta, o docker e as chaves internas.
- **Stories:** trocar os 15 modelos atuais pelas artes novas e **criar mais 4 modelos**. O gerador passa de 15 para 19.

Pela regra de planejamento por data, o primeiro passo é gravar este plano como `Ondilow/docs/PLANEJAMENTO_2026-09-26.md`. Cada fase termina em commit, `git push` (origin) e sincronização do espelho.

## O que chegou em `Ondilow/Imagens/` (analisado)
O `git status` mostra como apagados `Logo Ondilow.png`, `Somente o Icone.png` e `Story/1..18.png`. É esperado: foram substituídos pelos arquivos abaixo.

| Arquivo | Conteúdo (2000x2000, RGBA) | Uso planejado |
|---|---|---|
| `Logomarca Kactus.png` | Só o símbolo "K-cacto" (verde + branco), bbox 248,192→1773,1812 | Ícone do `Logo.tsx` e logo em alta resolução dos modelos com o símbolo K (6, 7, 8, 10, 16) |
| `Logomarca APP Kactus.png` | Símbolo dentro de um quadrado arredondado com borda, bbox 298,299→1704,1704 | Favicon (`app/icon.png`), `apple-icon.png` e, se precisar, manifest |
| `KACTUS.png` | Wordmark horizontal (símbolo pequeno + "KACTUS"), bbox 56,757→1950,1172 | Substitui `public/story-art/logo.png` (logo alta resolução dos Stories), a Sidebar desktop e o rodapé da landing |
| `KACTUS com logomarca.png` | Símbolo grande em cima + wordmark embaixo, bbox 56,203→1954,1727 | Login e hero/nav da landing (marca empilhada) |
| `1.png`, `2.png`, `3.png` | Silhuetas de corrida, bike e natação (não mudaram) | Nenhum |
| `Com fundo transparente/1..19.png` | 1080x1920 RGBA, texto branco + detalhes lima com a logo Kactus | **Fonte das artes do gerador** (o pipeline desenha sobre foto/fundo) |
| `Sem fundo transparente/1..19.png` | As mesmas 19 em RGB com fundo preto | Só referência visual para comparar o resultado do gerador |

**Mapa arte nova → modelo atual** (feito por comparação de pixels com `public/story-art/`):
1 `icones-direita`, 2 `icones-esquerda`, 3 `rota-minimal`, 4 `logo-lateral`, 5 `rota-limpa`, 6 `faixa-simples`, 7 `rota-faixa`, 8 `faixa-listras`, 12 `bandeiras`, 13 `icones-solidos`, 14 `rota-icones`, 15 `rotulos-centro`, 16 `moldura-tracejada`, 17 `desafio`, 18 `stats-direita`.
**Modelos novos:**
- 9: mão apontando + 3 métricas em serifada.
- 10: símbolo K + 3 métricas.
- 11: tênis + 3 métricas + wordmark (era o antigo 10).
- 19: rota grande + wordmark embaixo.

**O diff mostrou mais mudanças do que só a logo.** Em vários modelos o texto de exemplo mudou de lugar ou foi re-renderizado: 2, 3, 4, 13, 14, 15 e 17 e a faixa de 3 colunas (y≈1690–1746 nos modelos 5, 6, 7, 8 e 12). Por isso **todas as coordenadas de `lib/story/regions.ts` precisam ser remedidas**, não só as da logo. As caixas atuais apagariam o lugar errado.

## Fontes (informadas pelo usuário)
- **Wordmark "KACTUS"**: TT Lakes Neue Bold. É uma fonte comercial da TypeType, sem licença livre para web, e a regra de custo zero impede comprar. **Não embutimos a fonte**: o wordmark entra sempre como imagem (`kactus-wordmark.png` / `logo.png`), e em nenhum lugar "KACTUS" é escrito em texto com fonte. Por isso `Logo.tsx` e a landing usam a imagem, e não símbolo + texto.
- **Métricas dos Stories**: a maioria está em **Inter Bold**. O Inter já vem auto-hospedado em `public/fonts/Inter-Variable.woff2` (variável, cobre o peso 700), então não entra fonte nova.
  - Hoje a maior parte dos modelos desenha em Montserrat 700/800, e só o `stats-direita` usa Inter.
  - Na Fase 3, cada modelo tem a fonte comparada com a arte nova. Onde a arte usa Inter, o layout passa para `700 …px 'Inter'` e o tamanho é recalculado com a razão altura/em do Inter (medir no probe: ≈0,73 para dígitos e caixa alta, contra os ≈0,70/0,72 do Montserrat).
  - Continuam como estão os modelos que a arte mantém em outra família: serifada nos 3, 9 e 11, e condensada nos 15 e 16.
  - `loadStoryFonts` (`lib/story/engine.ts`) precisa garantir o Inter 700 carregado antes do primeiro desenho.

## Mapa do nome "Ondilow" no código (320 ocorrências, 90 arquivos)
- **Web visível**: `app/layout.tsx:5` (título), `app/LandingPage.tsx:94,124,302,474,482` (inclui o texto "ndilow" do logo em texto), `app/login/page.tsx:248`, `app/coach/page.tsx:256`, `components/dashboard/GoalCard.tsx:31,54`, `lib/athlete.ts:140`, `components/Sidebar.tsx:125,191`, `lib/coachErrors.ts:11,19`, `components/share/StoryGenerator.tsx:154,170,172`.
- **Logo do app**: `components/Logo.tsx` (SVG do anel "O" + texto "ndilow"). É usado na Sidebar e no login. A pasta `public/brand/` está vazia.
- **Web interno**: `lib/api.ts:1` (`ondilow_token`), `:182` e `WakingBanner.tsx:11-12` (`ondilow:waking`), `:799` (`ondilow_export.json`), `tailwind.config.ts:4,38`, `globals.css:53`, `package.json`, `.env.example`.
- **API**: o pacote `apps/api/ondilow_api/` é importado em todo o backend, nos testes e em `alembic/env.py`. Também aparecem em `main.py:33` ("Ondilow API"), **no prompt da Duni** (`ai/coach_service.py:74,101`), `services/garmin_sync.py:322`, `scripts/sync_garmin.py`, `config.py:21`, `pyproject.toml`, `uv.lock`, nos e-mails `@ondilow.test` e no fixture gpx.
- **Raiz/infra**: `package.json` (nome e `dev:api`), `docker-compose.yml`, `.env.example`, `README.md`, `CLAUDE.md`, `docs/ESTADO_DO_PROJETO.md` e `docs/BACKLOG.md`. Fora da pasta: `C:\Cloude Code\.claude\launch.json` (`ondilow`, `ondilow-web-isolated`), `.claude/settings.local.json`, `Ondilow/.claude/launch.json`, o remote `ondilow` e as memórias.
- **Não mexer**: os documentos históricos (`PLANEJAMENTO*.md`, `RESUMO_HOJE.md`, `SPRINT2_*`, `VIABILIDADE_*`), os uploads em `data/uploads/` e o `.env` real do Neon.

## Fases

### Fase 0: Documento do plano
Criar `Ondilow/docs/PLANEJAMENTO_2026-09-26.md` com todo este conteúdo. Commitar junto a troca de arquivos de `Imagens/` (apagados os antigos, adicionados os novos). Depois: push e sincronização do espelho.

### Fase 1: Textos visíveis (web + API)
- Trocar "Ondilow"/"ONDILOW" por "Kactus"/"KACTUS" em todos os pontos visíveis listados acima.
- Story: o arquivo baixado passa a ser `kactus_story_<id>.png` e o título do share passa a ser "Kactus".
- API: título do FastAPI, prompt da Duni e mensagens do Garmin sync e do script. Ajustar os testes que conferem esses textos.

### Fase 2: Identidade visual do app
- Gerar os assets a partir de `Imagens/` com um script Pillow **one-off** (roda uma vez e não fica no repo). Ele recorta cada imagem no bbox de alfa e redimensiona. Saída em `public/brand/`: `kactus-simbolo.png`, `kactus-wordmark.png` e `kactus-empilhada.png`, e em `app/icon.png` + `app/apple-icon.png` (a partir da logomarca APP).
- `components/Logo.tsx`: troca o SVG e o "ndilow" pelo `kactus-simbolo.png` + a imagem `kactus-wordmark.png`, sem texto em fonte (ver Fontes). O "corrida sem limites" continua em texto. Mantém a mesma API (`size` e `textClassName`), assim Sidebar e login não mudam. Na Sidebar recolhida continua aparecendo só o símbolo.
- `LandingPage.tsx:94,474`: troca o `logo-text` "ndilow" pela imagem do wordmark ou da marca empilhada. Ajustar `public/landing.css` se o tamanho mudar.

### Fase 3: Troca das 15 artes de Story
- Copiar `Com fundo transparente/N.png` para `public/story-art/<id>.png` seguindo o mapa acima. Os nomes dos arquivos continuam os mesmos, então `layouts/*.ts` não muda de import.
- `public/story-art/logo.png` recebe o wordmark `KACTUS.png` recortado no bbox.
- **Remedir todas as coordenadas** de `lib/story/regions.ts` com a ferramenta `app/(dev)/story-art-probe` e o método de bandas de alfa já descrito nos comentários do arquivo. Isso vale para `values`, `valueClears`, `cols`/`colClears`, `rows`/`rowClears`, `blocks`, `title`, `route`/`routePlot`, `icons`, `logo`, `logoHiRes`, `logoDisc` e `badge`. O tamanho das fontes segue a regra do cabeçalho (altura do glifo ÷ razão altura/em).
- Logo de alta resolução: nos modelos com o wordmark, `logoHiRes` passa a ser **a caixa do wordmark embutido** (a proporção agora é ≈4,56:1, não mais a do 1366x768 antigo). Nos modelos com o símbolo K (6, 7, 8 e 16) entra a variante do símbolo. Quando o recorte ficar ruim, o modelo continua com a logo embutida, como já acontece hoje no `rota-icones` (14, logo na diagonal), no `logo-lateral` (4, girada) e no `desafio` (17, badge).
- `lib/story/art.ts`: atualizar as regiões protegidas da recoloração para as posições novas da logo.

### Fase 4: 4 modelos novos
- Copiar as artes para `public/story-art/` como `mao-apontando.png` (9), `simbolo-metricas.png` (10), `tenis.png` (11) e `rota-grande.png` (19).
- Para cada uma: adicionar a região em `regions.ts`, criar o layout em `lib/story/layouts/<id>.ts` seguindo o padrão dos parecidos, e registrar em `layouts/index.ts` na ordem numérica.
  - 9 e 11 usam serifada, como o `rota-minimal`, e reaproveitam `metricText` e `SERIF` de `shared.ts`.
  - 10 é parecido com o `moldura-tracejada`, com o símbolo como ícone.
  - 19 segue o `rota-limpa` com `requiresRoute: true`, e usa `drawRoute`/`projectRoute` e `drawHiResLogo`.
- Atualizar o comentário de `layouts/index.ts` (agora são 19 modelos, sem nenhum de fora).

### Fase 5: Nomes internos
- `git mv apps/api/ondilow_api apps/api/kactus_api`, depois trocar os imports (backend, testes, `alembic/env.py`, `dev:api`), atualizar `pyproject.toml` (`kactus-api`) e rodar `uv lock`.
- Web: `kactus-web` e `kactus` nos `package.json`, `kactus:waking`, `kactus_export.json`, chave tailwind `kactus` e comentários.
- Token `kactus_token` com migração silenciosa em `lib/api.ts`: se existir `ondilow_token`, o valor é copiado e a chave antiga removida. Ninguém é deslogado.
- `docker-compose.yml`, `.env.example` e o default de `config.py` passam para `kactus`. Os e-mails de teste viram `@kactus.test` e o gpx vira `Kactus-test`.

### Fase 6: Pasta `Ondilow/` → `Kactus/`
- Parar os dev servers. `git mv Ondilow Kactus`. Apagar `.venv`, `.next` e `.next-preview` (guardam caminhos absolutos), depois `uv sync` e `pnpm install`.
- Atualizar os dois `launch.json` (`kactus` e `kactus-web-isolated`, com `-C Kactus`) e os caminhos em `settings.local.json`.
- Atualizar `README.md`, `CLAUDE.md`, `ESTADO_DO_PROJETO.md` e `BACKLOG.md`. Trocar as screenshots de `docs/screenshots/` pelas do app já com a marca Kactus.

### Fase 7: Espelho Git e GitHub
- Depois do rename, `git subtree push --prefix=Kactus` **não é fast-forward**. A saída **sem force-push** é um commit-ponte:
  `git push ondilow $(git commit-tree HEAD:Kactus -p ondilow/master -m "rebrand: Ondilow → Kactus"):master`
  Esse comando passa a ser a sincronização padrão, e a memória de topologia git (monorepo + espelho) é atualizada com ele.
- **Opcional, com confirmação na hora**: renomear o repo no GitHub para `Kactus` (`gh repo rename`, com redirect automático), o remote `ondilow` para `kactus`, e o nome de exibição do projeto Neon.

### Fase 8: Varredura final e memórias
- `grep -ri "ondilow\|ndilow"` em `Kactus/` (sem node_modules, .venv e .next) só pode retornar documentos históricos.
- Atualizar as memórias do projeto: caminhos, nome, gerador com 19 modelos e o novo comando do espelho.

## Verificação
- **API**: `uv run pytest` usando a branch Neon `test` e depois `uvicorn kactus_api.main:app`. Conferir que `/docs` mostra "Kactus API".
- **Web**: `pnpm -C Kactus/apps/web build` e `preview_start kactus`. Conferir a landing, o login, o dashboard, a Sidebar aberta e recolhida, o coach, o título da aba e o favicon.
- **Stories (19 modelos)**: numa atividade com GPS, gerar cada modelo **com e sem fundo transparente** e comparar lado a lado com `Imagens/Sem fundo transparente/N.png`. O texto novo precisa cobrir exatamente o de exemplo, sem sobra de texto antigo nem logo Ondilow. Testar também uma atividade **sem GPS** (os modelos com rota somem) e uma de **ciclismo** (recoloração e "Velocidade").
- **Login**: com o `ondilow_token` antigo no navegador, recarregar e confirmar que a sessão continua.
- **Duni**: uma mensagem no coach, conferindo que ela se apresenta como do Kactus.
- **Git**: árvore limpa após cada fase e o push do espelho aceito como fast-forward.
