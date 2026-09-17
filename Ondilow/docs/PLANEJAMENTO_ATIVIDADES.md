# Ondilow — Mapa/GPS + Gerador de Stories

## Contexto

O usuário relatou três problemas no mapa das atividades e pediu uma funcionalidade nova, um gerador de imagem para Stories no estilo do "Compartilhar atividade" do Garmin Connect.

**O que a investigação mostrou:**
- **Os dados de GPS estão bons.** 292 das 298 atividades reais têm GPS, com cerca de 1.000 pontos cada (consulta de leitura no Neon). O problema é de exibição, não de captura.
- **O mapa não carrega porque o CARTO passou a exigir chave de API.** Os tiles de `apps/web/lib/mapTiles.ts:8-9` agora voltam com a marca d'água "API KEY REQUIRED". A linha verde da rota continua aparecendo, porque é desenhada em vetor por cima dos tiles.
- **Ao clicar no card não aparece o percurso.** No dashboard, os cards abrem o `components/dashboard/ActivityModal.tsx`, e esse modal não tem mapa nenhum.
- **O mapa "come" o card (anexo 1).** Em `components/dashboard/LastActivity.tsx`, o bloco do título usa `-mt-6` para subir sobre o mapa. Só que os painéis do Leaflet têm z-index 400 ou mais e o container do mapa não isola esses valores, então o mapa é pintado por cima do ícone, do título e da data.

**Decisões já tomadas com o usuário:**
- Renderização no navegador com Canvas.
- Logo própria em PNG, salva no perfil.
- Os botões antigos Card/Story/Sticker são substituídos pelo gerador, e o código antigo de exportação é removido.

**Estado da execução (2026-09-15):**
- **FASE 1 — CONCLUÍDA e verificada.** Tiles trocados para Stadia Maps (sem chave em localhost, com fallback automático para OSM escurecido), isolamento de z-index dos mapas, percurso no modal do dashboard.
- **FASE 2 — CONCLUÍDA e verificada.** Logo pessoal em PNG no perfil (migration `010_athlete_profile_logo`), com validação de formato e tamanho.
- **FASE 3 — replanejada aqui.** Os 4 layouts que eu havia desenhado foram descartados: o usuário não gostou e desenhou os próprios no Canva.

**A nova base de design:** o usuário colocou **18 PNGs 1080x1920 transparentes** em `Ondilow/Imagens/Story/`, desenhados por ele no Canva. Todos usam verde/lima da marca sobre fundo transparente (89-98% do pixel é transparente), o que é exatamente o formato de overlay sobre foto.

**Primeiro passo da implementação:** copiar este plano para `Ondilow/docs/PLANEJAMENTO_ATIVIDADES.md`, seguindo a regra do `Ondilow/CLAUDE.md` de que toda documentação fica em `docs/`.

---

## Por que não usar modelos no Canva

O usuário sugeriu deixar modelos prontos no Canva e, ao abrir a atividade, mandar os dados para lá, trocando só as informações. Avaliação:

- **Custo.** A API que preenche modelos automaticamente (Autofill + Brand Templates) exige **Canva Enterprise**. A documentação do Canva diz: "your integration must act on behalf of a user who is a member of a Canva Enterprise organization". Isso quebra a regra de custo R$ 0 sem cartão do Ondilow. Além disso, baixar PNG com fundo transparente no Canva é recurso do plano Pro.
- **Fluxo lento.** O preenchimento é um job assíncrono. A foto e a imagem da rota precisam ser enviadas ao Canva, depois é preciso esperar o job, exportar e baixar. Isso leva segundos por imagem, contra cerca de 50ms no Canvas.
- **Dependências.** Exige conexão OAuth com o Canva, internet e sair do site.

**A ideia central continua valendo e entra no plano:** modelos prontos em que só muda a atividade. Cada layout é um **modelo fixo** (posições, fontes, cores e quais stats aparecem) e o gerador só injeta os dados da atividade, a foto e a logo. O "Canva" fica dentro do próprio Ondilow, de graça e instantâneo.

## Por que Canvas no navegador

- **A foto não sai do aparelho.** Nada é enviado nem guardado no servidor.
- **A prévia é instantânea.** Trocar de layout ou reposicionar a foto só redesenha o canvas, sem reenviar um arquivo de até 15MB para a API a cada clique.
- **Custo zero e escala de graça.** Cada usuário renderiza no próprio dispositivo, e um 1080x1920 leva cerca de 50ms.
- **No celular o compartilhamento é nativo.** Com `navigator.share({ files })` (Web Share API), a imagem vai direto para o Instagram, igual ao botão "Compartilhar" do Garmin.
- **O backend atual em Pillow não serve de base:**
  - não tem fontes empacotadas (depende de Arial do Windows);
  - a paleta é azul, não o verde neon da marca;
  - estica a foto em vez de recortar;
  - não consegue rasterizar SVG.

---

## FASE 1 — Mapa e GPS — CONCLUÍDA

**Verificado ao vivo:** a atividade do anexo 1 ("Corrida ao entardecer") passou a mostrar ruas reais, sem a marca d'água "API KEY REQUIRED". Todos os 6 mapas do dashboard carregam tiles (`leaflet-tile-loaded` = total em cada um) e o fallback OSM nunca precisou disparar. Título, data e badge do card passaram a pintar acima do mapa. O modal abre com o percurso, tanto no caminho com cache quanto no que busca sob demanda (skeleton → mapa, 8/8 tiles, 3 polilinhas do glow). `tsc --noEmit` limpo.

### 1.1 Tiles sem chave (`apps/web/lib/mapTiles.ts`)
- Trocar o CARTO pelo **Stadia Maps `alidade_smooth_dark`**: `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png`.
  - A documentação do Stadia confirma que não precisa de chave em `localhost`, e o plano grátis não pede cartão.
- **Chave opcional:** se `NEXT_PUBLIC_STADIA_API_KEY` estiver definida, anexar `?api_key=`. Isso só é necessário ao acessar fora do localhost, por exemplo pelo IP da rede no celular. Documentar em `apps/web/.env.example`.
- **Nova função `addBaseLayer(map)`**, usada nos dois mapas:
  - adiciona o Stadia;
  - no primeiro `tileerror`, troca para os tiles padrão do OSM (`tile.openstreetmap.org`) e aplica a classe `od-map-osm-dark` no container, que escurece via CSS com `invert(1) hue-rotate(180deg) brightness(.85) saturate(.3)`.
- Atualizar `TILE_ATTRIBUTION` (© Stadia Maps © OpenMapTiles © OSM) e o comentário do topo.
- Usar `addBaseLayer` em `components/ActivityMap.tsx:64` e `components/ActivityMiniMap.tsx:44`.

### 1.2 Mapa cobrindo o card
- Em `app/globals.css`, adicionar `.od-map { isolation: isolate; }`. Isso prende o z-index dos painéis do Leaflet dentro do mapa e resolve todos os mapas de uma vez.
- Em `LastActivity.tsx:68`, adicionar `z-10` no bloco de conteúdo com `-mt-6`.
- Conferir que os degradês e badges ficam acima do mapa: `LastActivity.tsx:61-65` e `RecentActivities.tsx:88-97`.

### 1.3 Percurso no modal do card
- `ActivityModal.tsx` recebe a prop nova `detail?: ActivityDetail`.
  - `app/dashboard/page.tsx` repassa `recentDetails[modalActivity.id]`, que já é buscado para as 5 atividades recentes.
  - Se não vier, o modal chama `fetchActivity(id)` ao abrir e mostra um skeleton enquanto carrega.
- Renderizar o `ActivityMap` (via `dynamic` com `ssr:false`, como em `activities/[id]/page.tsx:47`) no topo do modal, com cerca de 240px de altura. Sem GPS, o `NoGpsPlaceholder` que já existe aparece sozinho.

### 1.4 Borda do `ActivityMap`
- Exigir pelo menos 2 coordenadas antes de montar o mapa (`ActivityMap.tsx:57,83`), igual ao `ActivityMiniMap`. Com 1 ponto só, o `fitBounds` recebe um retângulo de tamanho zero.

---

## FASE 2 — Logo pessoal no perfil — CONCLUÍDA

**Verificado ao vivo:** migration `010` aplicada, PNG com transparência enviado, salvo e persistido após recarregar (a prévia mostra o xadrez em volta da arte). JPEG disfarçado e arquivo acima de 700KB devolvem 422 com mensagem clara. `pytest` (33), `ruff` e `tsc --noEmit` passam.

**Backend:**
- Migration `010_athlete_profile_logo.py` (`down_revision="009_activity_equipment"`), no mesmo padrão da `007_athlete_profile_avatar`: coluna `logo_data_url` do tipo Text, nullable.
- `models/user.py`: adicionar o campo no mesmo lugar do `avatar_data_url`.
- `schemas/profile.py`: adicionar o campo na entrada e na saída.
  - Validar que começa com `data:image/png;base64,`.
  - Validar tamanho de até ~700KB. O avatar hoje não tem limite nenhum.
- `routers/profile.py` não muda, porque o `PUT /profile` já grava o schema inteiro.

**Frontend (`app/profile/page.tsx`):**
- Nova seção "Logo para compartilhamento": upload de PNG, prévia sobre fundo xadrez e botão "Remover".
- Novo helper `resizeLogoToPngDataUrl(file, max=512)`, derivado de `resizeImageToDataUrl` (L18):
  - mantém a proporção, sem recorte quadrado;
  - gera **PNG** para preservar a transparência (o avatar gera JPEG).
- Adicionar `logo_data_url` na interface `Profile` em `lib/api.ts`.

---

## FASE 3 — Gerador de Stories (Canvas), a partir dos modelos do usuário — CÓDIGO CONCLUÍDO, verificado ao vivo

**Implementado:** `apps/web/lib/story/` (engine, metrics, icons, 5 layouts) e `components/share/StoryGenerator.tsx`, substituindo os botões antigos em `activities/[id]/page.tsx`. Backend antigo (`rendering/`, `routers/exports.py`, deps `pillow`/`staticmap`) removido. `pytest` (30, os 3 do sticker saíram junto), `ruff` e `tsc --noEmit` passam.

**Verificado ao vivo** (conta `teste@teste.com`):
- Os 5 modelos renderizam com dados reais de uma atividade de 5.02km (rota, distância, tempo, pace, FC) e da logo já cadastrada no perfil.
- **Rota muda por atividade**: testado numa segunda atividade (ciclismo, 45km, rota bem diferente) — o traçado desenhado é outro, prova que não é uma imagem fixa.
- **Rótulo por esporte**: na atividade de ciclismo, `avg_speed_kmh` gerou "14.1 km/h" em vez de pace — confirma que o branch de velocidade (`isBikeSport`) disparou.
- **Cor por esporte**: o mesmo teste também mudou a cor de verde para lima (`sportColor('bike')`).
- **Upload de foto + cover-fit**: testado injetando um arquivo via `input.files` — a foto preenche o quadro 9:16 sem distorcer.
- **Arrastar pra reposicionar**: confirmado via `PointerEvent` sintético (o `left_click_drag` do ttool de automação só dispara mouse events, não pointer events, então não é um jeito válido de testar isso — mas o handler real do componente responde certo a pointer events genuínos).
- **Zoom**: slider testado, imagem visivelmente mais próxima.
- **Fundo transparente**: confirmado por pixel via `getImageData` — cantos com alpha 0, conteúdo (rota/texto/logo) com alpha 255.
- Sem erros novos no console em nenhum teste.

- **Atividade sem GPS**: testado numa atividade `sport=other` sem pontos — só "Ícones à esquerda" e "Desafio" aparecem no carrossel; os 3 modelos com `requiresRoute` somem da lista, como esperado.
- **Salvar**: clicado de verdade, sem erro (o diálogo de download do SO em si não é visível pra automação, mas `canvas.toBlob` + o `<a download>` disparam sem exceção).
- **Copiar**: o navegador de teste nega permissão de clipboard (`navigator.clipboard.write` → "Write permission denied") — o app trata o erro corretamente e mostra a mensagem em vez de travar ou falhar silenciosamente.
- **Compartilhar**: `navigator.canShare` não existe nesse navegador — cai no fallback pra `handleSave()`, que roda e limpa o erro anterior. Comportamento correto para navegadores sem Web Share API (a maioria dos desktops).

**Ainda não testado ao vivo** (só é alcançável num celular real): o fluxo completo do `navigator.share` abrindo a folha de compartilhar nativa, e o caso de arquivo de foto não decodificável (ex. HEIC no Chrome desktop).

### 3.0 Os 18 modelos: o que foi analisado e o que entra

Todos os 18 são 1080x1920 RGBA com fundo realmente transparente. A análise mostrou que **não são 18 designs distintos — são 5 famílias com variações incrementais** (o usuário exportou camadas do mesmo arquivo Canva):

| Família | Arquivos | Observação |
|---|---|---|
| Rota + faixa de 3 colunas | 5, 6, 7, 8, 11 | Mesma base; variam por ter rota, listras diagonais ou bandeiras de chegada |
| Coluna de ícones | 1, 3, 12, 15 | Variam lado (direita/esquerda), tamanho e estilo (linha/sólido) |
| Rota + ícones | 2, 13 | 2 tem a rota pequena demais |
| Texto e valores | 14, 16, 17 | 14 só rótulos; 16 e 17 já com números impressos |
| Elementos soltos | 9, 10, 18 | Mão apontando, tênis, e o 18 está vazio (`bbox=None`) |

**Os 5 escolhidos** (decisão do usuário), um por estilo:

| # | Nome interno | Composição medida no PNG |
|---|---|---|
| **13** | `rota-icones` | Rota grande à esquerda (x 76-700, y 582-1446) + coluna de 4 ícones à direita (x ~585-690) + logo com risco diagonal embaixo (y 1577-1752) |
| **3** | `icones-esquerda` | 4 ícones empilhados à esquerda (x ~190-360), espaçados ~290px nas faixas y 449-601, 724-891, 1013-1169, 1309-1440 + logo em y 1559-1705 |
| **7** | `rota-faixa` | Listras diagonais no topo e na base + rota no centro + logo + faixa de 3 colunas (divisórias em x ~400 e ~707, linha horizontal em y ~1700) |
| **16** | `desafio` | Listras chunky no topo direito + título gigante em 2 linhas (y ~1270-1470) + 3 valores em linha (y ~1530-1600) + logo em badge preto + xadrez na base |
| **17** | `stats-direita` | 3 blocos rótulo+valor alinhados à direita (x 453-986, y 124-960) + rota na base (y ~1020-1560) + logo centralizado. Texto branco com sombra dura deslocada |

**Descartados e por quê:** 18 (vazio), 9 e 10 (elementos soltos, não são layouts), 15 (ícones quase invisíveis, parece erro de opacidade), 2 (rota ocupa só 1/4 da tela), 4 (ícones minúsculos no canto), 6/8/11 (esqueletos sem conteúdo — são subsets do 5/7), 5 (é o 7 sem as listras), 12 (ícones sólidos destoam do resto), 14 (só a camada de rótulos).

### 3.1 Decisões de arquitetura (confirmadas com o usuário)

- **Recriar em código, não compor PNG.** Os 18 PNGs viram **referência visual**, não asset de runtime. Motivo prático: a rota e os números estão chapados na arte (13, 7, 17 têm a rota de uma corrida real do usuário; 16 e 17 têm "5.39 km", "16:10" impressos), e esses dois precisam ser dinâmicos.
- **Rótulos adaptam ao esporte.** "Ritmo médio" vira "Velocidade média" em ciclismo; campo sem dado é omitido em vez de mostrar traço.
- **Poppins**, a fonte do site, também nos números.
- **Duas exceções à regra "tudo em código", ambas justificadas:**
  - **Logo**: continua sendo imagem, vinda de `profile.logo_data_url` (já implementado na Fase 2). É arte com gradiente e brilho — redesenhar em Canvas ficaria pior que o original. Sem logo cadastrada, desenha o wordmark "Ondilow" em texto.
  - **Ícones** (pin, cronômetro, velocímetro, montanha, corredor): recriados como **SVG/Path2D**, usando a arte dele como referência. Vetor em vez de recorte do PNG porque precisam trocar de cor e de forma conforme o esporte, o que um recorte não permite.

### 3.2 Motor (`apps/web/lib/story/`)

**`engine.ts`** — primitivas puras, sem conhecer layout:
- `loadStoryFonts()`: FontFace API carregando Poppins (700/900) auto-hospedada em `apps/web/public/fonts/` (OFL, gratuita). Hoje o Poppins é declarado em `globals.css:41` e `tailwind.config.ts:50` mas nunca carregado nas páginas internas.
- `drawCoverImage(ctx, img, { offsetX, offsetY, zoom })`: recorte "cover" 9:16 sem distorcer.
- `projectRoute(points, box)`: **porta para TypeScript o `render_route_polyline` de `apps/api/ondilow_api/rendering/sticker.py`** (projeção equirretangular com correção de cosseno da latitude e margem de 8%). Portar **antes** de apagar o arquivo Python.
- `drawRoute(ctx, coords, style)`: linha com glow em camadas e pontos de início/fim, no visual de `addGlowRoute` (`lib/mapTiles.ts:14`) e do traçado que ele desenhou.
- `drawScrim(ctx, region, strength)`: gradiente escuro atrás das zonas de texto. **É o ponto mais crítico de legibilidade**: a arte dele é toda lima claro sem nenhum escurecimento, então sobre foto clara (céu, parede branca) o texto desaparece. O modelo 17 resolveu com sombra dura — vale como referência.
- `textWithShadow(...)`, `drawDiagonalStripes(...)`, `drawCheckerboard(...)`, `drawDividers(...)`: primitivas de forma extraídas dos modelos 7 e 16.

**`metrics.ts`** — resolve rótulo e valor por esporte, reaproveitando `distanceParts`, `formatDuration`, `formatPaceShort`, `sportLabel` e `isBikeSport` de `lib/utils.ts`, e seguindo o padrão pace-vs-velocidade que já existe em `components/dashboard/LastActivity.tsx:85-87`. Devolve só as métricas com dado disponível.

**`icons.ts`** — os 5 ícones como `Path2D`, coloríveis.

**`layouts/`** — um arquivo por modelo (`rotaIcones.ts`, `iconesEsquerda.ts`, `rotaFaixa.ts`, `desafio.ts`, `statsDireita.ts`), cada um exportando `StoryLayout { id, label, draw(ctx, data, assets) }`. As medidas ficam como constantes em coordenadas 1080x1920 — extraídas dos PNGs, tabela da seção 3.0 — então ajuste visual futuro mexe só em números.

- **Fundo transparente:** toggle global, pula o `drawCoverImage` e o PNG sai com canal alfa (equivale ao "TRANSPARENTE" do Garmin).
- **Sem foto:** fundo escuro da marca (`#0A0A0A` com brilho verde suave).

### Interface (`apps/web/components/share/StoryGenerator.tsx`)
- Modal em tela cheia no celular, inspirado no anexo 2:
  - prévia do canvas escalada por CSS;
  - carrossel de miniaturas dos layouts com indicador de pontos;
  - botão "Escolher foto" (`<input type="file" accept="image/*">`);
  - arrastar para reposicionar a foto e slider de zoom;
  - toggle "Fundo transparente".
- Três ações, como no Garmin:
  - **Compartilhar:** `navigator.canShare({ files })` e `navigator.share`. Quando não houver suporte, baixa o arquivo.
  - **Salvar:** `canvas.toBlob` e download de `ondilow_story_<id>.png`.
  - **Copiar:** `navigator.clipboard.write` com `ClipboardItem` de `image/png`, quando o navegador suportar.
- **Erro de decodificação** (ex.: HEIC no Chrome desktop): mostrar "Formato não suportado, use JPG ou PNG".
- **Dados:** a página `activities/[id]` já tem `activity` (pontos e stats) e `splits`. O logo vem de `fetchProfile()`, que já tem cache via `dedupe()`.

### Troca na página da atividade (`app/activities/[id]/page.tsx`)
- Remover `handleExport`, os estados `exporting`/`exportError` e os botões Card/Story/Sticker (L151-177, L257-278).
- Colocar no lugar um botão único "Compartilhar", que abre o `StoryGenerator`.

### Remoção do export antigo no backend
Nada no frontend continuará chamando isso, e o motor de rota já terá sido portado para TypeScript.
- Apagar `routers/exports.py`, incluindo o `POST /export/photo`, que o front nunca usou.
- Tirar o `include_router` e o import em `main.py:19,55`, e remover `"exports"` da criação de pastas em `main.py:31`.
- Apagar o pacote `ondilow_api/rendering/` inteiro (`composer.py`, `fonts.py`, `static_map.py`, `sticker.py`) e `tests/test_sticker.py`.
  - Os logs da Fase 1 nesses arquivos somem junto; `logger.py` continua existindo.
- Rodar `uv remove staticmap`.
- Conferir se `pillow` ainda é usado em outro lugar antes de removê-lo. Se houver dúvida, manter.
- Atualizar `docs/ESTADO_DO_PROJETO.md` (menções ao export e ao sticker, ~L46).

---

## FASE 4 — Arte do Canva como camada (reverte a decisão da §3.1) — CONCLUÍDA

**O problema:** o usuário testou a Fase 3 e disse que os Stories gerados não ficaram parecidos com os
modelos dele. Comparação lado a lado confirmou: ícones esquemáticos de 5 segmentos num grid 24×24 em vez
da arte de linha detalhada com brilho; sem glow gaussiano; listras uniformes em vez de finas que engrossam;
xadrez alinhado ao eixo em vez de losangos inclinados; fontes erradas (Inter/Poppins carregando com pesos
que nunca foram baixados, caindo em fallback sintético).

**A decisão da §3.1 foi invertida:** em vez de recriar tudo em código usando os PNGs só como referência
visual, os PNGs (`apps/web/public/story-art/`) viram a própria camada de arte. Só a rota e os números —
que estão chapados na arte de exemplo — são apagados (`clearRect`) e redesenhados por cima; o resto (ícones,
logo, listras, xadrez, divisórias) é a arte original, recolorida por esporte via LUT em HSL
(`lib/story/art.ts::buildArtLayer`) que preserva luminância e alfa (o brilho e a transparência sobrevivem
intactos) e nunca tinge pixels de baixa saturação (branco/preto/cinza da sombra).

**Descoberta no caminho:** medindo os PNGs pixel a pixel (não só olhando), boa parte da arte é **branca**,
não lima — o visualizador pinta transparência de branco, então texto branco embutido na arte (números de
exemplo, rótulos) ficava invisível na inspeção visual e só apareceu ao medir as bounding boxes de alfa. Isso
mudou o diagnóstico: por exemplo o `7.png` já tinha os 3 textos da faixa inferior desenhados (não estava
vazia como parecia), e o `16.png` tem uma linha de rótulos brancos embaixo dos valores.

**Mudanças concretas em relação à §3.1/3.2:**
- `icons.ts` (os 5 ícones em `Path2D`) foi **apagado inteiro** — os ícones agora vêm da arte.
- `engine.ts` perdeu as primitivas de forma que só serviam pra redesenhar decoração
  (`drawDiagonalStripes`, `drawCheckerboard`, `drawLine`, `drawDiagonalDivider`, `drawWordmark`) — a
  decoração agora é a própria arte, mantida (não apagada) pelo `buildArtLayer`. Ganhou `fitFontSize`
  (shrink-to-fit pro título do "Desafio", que em português pode não caber nas duas linhas medidas no PNG em
  inglês) e `textWithShadow` ganhou `baseline` configurável.
- **Fontes trocadas**: não é mais Poppins nos números — o usuário confirmou que usou **Montserrat** e
  **Cambria** no Canva. Cambria é da Microsoft, sem licença de redistribuição web; a substituta métrica
  compatível livre é **Caladea** (Google Fonts), usada só no modelo "Stats à direita" (que era o único com
  visual claramente serifado). Os demais usam Montserrat 700/800/900. Poppins continua no resto do app,
  só não é mais carregada pelo `StoryGenerator`.
- **Logo:** decisão do usuário foi usar a logo que já vem embutida na arte, não a de `profile.logo_data_url`
  (Fase 2). O campo continua existindo no perfil/backend, só não é mais lido pelo `StoryGenerator`.
- **Cor por esporte mantida**, com duas regras que saíram de um erro pego na revisão do usuário (ver abaixo):
  corrida e esteira usam a **cor nativa da arte** (`ART_NATIVE_COLOR = #C6FF00`), ou seja, o recolor nem roda
  e o Story sai pixel-idêntico ao Canva; e a **região da logo nunca é tingida** em esporte nenhum
  (`noTint` em `buildArtLayer`, restaurada da arte original depois da LUT) — marca não muda de cor porque
  você foi pedalar. A cor do esporte fica no traçado da rota, nos ícones e nos detalhes lima.
  Isso vive em `storyColor()` (`lib/story/art.ts`); `sportColor()` em `lib/utils.ts` continua intocada,
  porque ela pinta os gráficos do dashboard.
- `types.ts`: `StoryLayoutData` trocou `logo: HTMLImageElement | null` por `art: HTMLImageElement`
  (a arte do layout, pré-carregada); `StoryLayout` ganhou o campo `art: string` (caminho do PNG).
- `regions.ts` (novo): as constantes de posição, medidas nos PNGs via uma ferramenta de desenvolvimento —
  `app/(dev)/story-art-probe` — que carrega cada arte num canvas e detecta bounding boxes de alfa por
  projeção linha/coluna, com um modo de recorte manual pra separar ícone de número quando os dois caem na
  mesma banda horizontal (aconteceu no `13.png`: a coluna de ícones tem números de exemplo do lado, não é
  só ícone como parecia à primeira vista).
- `StoryGenerator.tsx`: carrega a arte do layout ativo por demanda (`loadArt`, cacheada em memória) e
  pré-carrega os vizinhos em `requestIdleCallback`; mostra skeleton enquanto carrega.

**Segundo bug, pego pelo usuário ("consegue pegar a minha logo mesmo?"):** a primeira versão definia
`ART_NATIVE_COLOR = #C6FF00` (lima) mas passava `sportColor()` como alvo, e `run` é `#00FF66`. Como os dois
não batem, o recolor **rodava em toda corrida** e deslocava a matiz da arte inteira de lima (72°) pra verde
(~144°) — inclusive da logo, que perdia o gradiente lima→verde e o símbolo amarelo e virava verde chapado.
O usuário olhou e disse que aquela não era a logo dele, e sim uma que eu tinha criado. Era a dele, deformada.
Corrigido com as duas regras da decisão de cor acima. **Verificado por pixel**: numa corrida, os 13.505
pixels opacos da região da logo batem 100% com o PNG original; numa atividade `other` (que dispara o recolor
de verdade, pra cinza), a logo continua 100% idêntica enquanto o ícone testado muda em 100% dos pixels.

**Bug encontrado e corrigido durante a verificação ao vivo:** ao trocar de layout, havia uma corrida entre
dois `useEffect` — o efeito que zera e recarrega a arte, e o efeito que desenha — que podia rodar o desenho
do layout novo usando a **arte do layout anterior** (still-stale no closure), produzindo uma composição
quebrada (rota + números de um layout, ícones + texto de exemplo não apagado de outro, sobrepostos). Corrigido
amarrando a arte carregada ao `id` do layout (`{ layoutId, image }`) e só desenhando quando os dois batem —
elimina a dependência de ordem de execução dos efeitos.

**Verificado ao vivo** (conta `teste@teste.com`, atividade "17 de ago." 5.02km): os 5 modelos comparados
contra os PNGs originais — ícones/listras/xadrez/logo vindos da arte, idênticos ao Canva; rota e números
dinâmicos na posição certa; alternância de layout sem o bug de corrida; "Fundo transparente" preserva a arte
e derruba só o scrim; `tsc --noEmit` limpo; sem erros no servidor de dev.

**Terceira rodada, também pega pelo usuário ("a rota mais ícone tá saindo bugada, as letras tão estranhas"):**
três defeitos reais, todos corrigidos medindo a arte em vez de estimar.

1. **Sobra da rota de exemplo.** Pra não apagar os ícones (que ficam dentro da caixa da rota), eu tinha
   encolhido o `clearRect` da rota de x74–696 para x68–555. Resultado: o pedaço de x555 a x696 da rota de
   exemplo **continuava desenhado**, aparecendo como um traço solto no canto. Corrigido invertendo a ordem:
   apaga a caixa inteira da rota (ícones saem junto), desenha a rota nova e **redesenha os ícones por cima**
   (`mode: "keep"` numa segunda camada). Bônus: a rota voltou a ocupar toda a área que o modelo reservou.
2. **Todo texto estava com cerca de metade do tamanho.** Os tamanhos de fonte eram chute. Medindo a altura
   real do glifo na arte e dividindo pela razão altura/em da fonte carregada, os valores certos são bem
   maiores: `stats-direita` valor **173px** (estava 84), rótulo **112px** (estava 40); `icones-esquerda`
   **99px** (estava 52); `desafio` título **104px**, valor **69px**; `rota-icones` **61px** (estava 46).
   Cada slot agora guarda a baseline medida na arte, não uma conta em cima da caixa de recorte.
   *Verificado:* o texto renderizado nasce em x=717, y=622 no `rota-icones` — exatamente onde nasce o texto
   da arte, com a mesma altura de glifo.
3. **Traçado da rota fora do estilo.** O brilho era alfa empilhado (3 passadas em 4x/2x/1x a largura), que
   sobre fundo escuro vira uma faixa verde-oliva grossa, e os marcadores eram bolinhas preenchidas com um
   verde `#00FF66` fixo que destoava do lima. A arte usa traço de **9px** (medido) com brilho gaussiano e
   marcadores em **anel vazado**. `drawRoute` foi reescrito assim, e perdeu os parâmetros `startColor`/`endColor`.

Junto disso, o texto ganhou **shrink-to-fit por coluna**: no `rota-faixa` os três valores se encostavam
("5.02 km27m58s5:34 /km"), porque a arte reserva só ~200px por coluna e as divisórias ficam em x=398 e x=706.

**Logo em alta resolução:** o arquivo original do usuário (`Imagens/Logo Ondilow.png`, 1366x768) entrou como
`public/story-art/logo.png` e é desenhado por cima da logo embutida na arte, que é bem menor (ex.: 522px de
largura no `rota-icones`) e mais macia. O alinhamento não é chutado: mede-se a bounding box do texto branco
"dilow" na arte e no arquivo, e daí saem escala e deslocamento. A logo antiga é **apagada antes** de desenhar
a nova, senão sobra fantasma da de baixo. Aplicado em `icones-esquerda`, `rota-faixa` e `stats-direita`, onde
as escalas em X e Y batem (divergência ≤1,1%).
**Dois layouts ficam de fora, de propósito:** o `desafio` usa a variante monocromática da logo dentro de um
badge preto (o arquivo colorido não serve), e no `rota-icones` a logo está fundida com o risco diagonal lima
e tem um brilho branco em volta do texto — não dá pra apagá-la sem cortar o risco, e as medições de escala
discordam entre si (0,32 pelo disco do "O" contra 0,26 pelo texto). Esses dois seguem com a logo da arte.

**Ainda pendente (vira a Fase 5, ajuste fino):**
- Levar a logo de alta resolução também pro `rota-icones`: exigiria separar o risco diagonal da logo na arte
  (recortar o risco como asset próprio, ou pedir ao usuário um export do Canva só com a logo nessa posição).
- Testar em mais atividades com formato de rota bem diferente (retas, voltas fechadas) pra garantir que o
  traçado dinâmico nunca ultrapassa a caixa reservada. Até agora só foi testado numa corrida quase reta.
- Não testado em celular real (`navigator.share`) nem com foto HEIC.

---

## FASE 5 — Ajuste fino com o usuário (depois do gerador rodando)

Os 5 modelos saem de uma medição do PNG, então a primeira versão vai ficar próxima mas não idêntica ao Canva. Esta fase existe para fechar a diferença:
- Comparar lado a lado cada modelo gerado com o PNG original e corrigir as constantes de posição/tamanho.
- Calibrar o scrim de cada modelo sobre fotos claras e escuras.
- Só então avaliar se vale adicionar os modelos das outras famílias (11 com bandeiras, 12 com ícones sólidos), agora que o registro de layouts está pronto e cada novo modelo é só um arquivo a mais.

---

## Verificação

**Fases 1 e 2:** concluídas e verificadas — ver as notas em cada seção acima.

**Fase 3** (preview `ondilow` do `.claude/launch.json`, conta `teste@teste.com`, que já tem a logo de teste cadastrada):
- Abrir o gerador numa atividade com GPS, escolher uma foto de teste e passar pelos 5 modelos, com screenshot de cada um.
- **Comparação com o original:** cada screenshot ao lado do PNG correspondente em `Imagens/Story/`, conferindo posição dos ícones, da rota e do logo.
- **Rota dinâmica:** abrir dois modelos numa atividade e depois em outra, confirmando que o traçado muda junto (é o erro mais provável desta fase — desenhar a rota fora da área prevista ou com a projeção invertida).
- **Rótulo por esporte:** numa atividade de corrida aparece "Ritmo médio"; forçando uma de ciclismo, "Velocidade média"; atividade sem FC não mostra o campo.
- **Legibilidade:** o mesmo modelo sobre foto muito clara e sobre foto escura, confirmando que o scrim segura o contraste nos dois.
- **Transparente:** `javascript_tool` confirma `getImageData` com alfa 0 nos cantos e maior que 0 nos textos.
- "Salvar" gera PNG 1080x1920; sem suporte a `navigator.share`, cai no download.
- Sem logo no perfil, aparece o wordmark de texto e o link para o perfil.
- Arquivo não decodificável (HEIC no desktop) mostra a mensagem de erro.
- `uv run pytest`, `uv run ruff check ondilow_api` e `npx tsc --noEmit` passam após a remoção do export antigo.
- `grep` por `rendering`, `exports` e `staticmap` fica limpo, fora `uv.lock`, que é regenerado.

**Fase 4:** os screenshots lado a lado voltam a ser a régua, agora com o usuário apontando o que ainda está diferente.
