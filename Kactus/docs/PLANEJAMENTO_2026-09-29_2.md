# Kactus — Planejamento: 6 modelos novos de imagem para compartilhar a atividade (2026-09-29, _2)

**Criado em**: 2026-09-29
**Status**: EM ANDAMENTO. Ver "Registro de execução" no fim.
**Relacionados**: [`PLANEJAMENTO_2026-09-29.md`](./PLANEJAMENTO_2026-09-29.md) · [`PLANEJAMENTO_2026-09-26.md`](./PLANEJAMENTO_2026-09-26.md) (as 19 artes do gerador) · [`BACKLOG.md`](./BACKLOG.md)

## Como retomar
1. Ler este documento inteiro e o "Registro de execução".
2. Conferir no código se algo mudou desde a data acima.
3. Seguir pela próxima fase pendente (o usuário aprovou o plano inteiro em 2026-09-29).

## Contexto

Você quer mais imagens para compartilhar cada treino.

**O que já existe:** o gerador de Stories (`components/share/StoryGenerator.tsx`), aberto pela página da atividade, com **19 modelos**.
- Todos seguem a mesma linha: métricas em branco com ícones lima e a rota, sobre uma arte PNG do Canva em fundo transparente, para pôr por cima de uma foto.

**O diferencial:** modelos em que **o próprio dado do treino vira a arte**. São desenhados 100% em código, sem arte do Canva, e nenhum app de corrida entrega isso.
- **Estratégia:** cada Story leva a marca KACTUS e é diferente de tudo no feed. É isso que faz as pessoas perguntarem "que app é esse?".

**Suas escolhas:**
- **Dados como arte:** Batimento, Parciais brutalistas, Montanha, Rota pelo ritmo.
- **Formatos que viralizam:** Recibo, Bilhete de embarque.
- **Formato de saída:** só **Story 9:16** (1080×1920, PNG).
- **Ficam no BACKLOG** como ideias: Capa de revista, Frase da Duni, Feed 4:5, Vídeo animado.

**Regras que valem:**
- **Custo zero:** tudo no navegador, sem API externa e sem geocodificação.
- **Planejamento:** documento novo `Kactus/docs/PLANEJAMENTO_2026-09-29_2.md` (segundo do dia).
- **Commits:** cada fase termina em commit, push para `origin` e espelho `kactus` pelo commit-ponte.

---

## Os 6 conceitos (raciocínio e técnica)

| Modelo | O que é | Técnica visual | Objetivo |
|---|---|---|---|
| **Batimento** | A curva de FC do treino inteiro, como eletrocardiograma, colorida pelas zonas. Por cima, a FC média gigante; embaixo, uma faixa de tempo em cada zona | Minimalismo radical + tipografia enorme (Montserrat 900) + linha neon | Autoridade: "treino de verdade", fisiológico |
| **Parciais brutalistas** | Uma barra por km (mais alta = mais rápido). O km mais rápido fica estourado na cor do esporte, com o ritmo gigante ("KM MAIS RÁPIDO 4:32") | Brutalismo: grid cru, números enormes, contraste duro | Mostra evolução e gera comentários ("e o km 12?") |
| **Montanha** | O perfil de altimetria como uma cordilheira em 3 camadas (profundidade falsa), crista com brilho, marcador no cume e "+412 m" no topo | Ilustração cinematográfica em camadas com gradiente | Aspiracional, forte para trilha e subida |
| **Rota pelo ritmo** | A rota com gradiente de velocidade (lento → lima → rápido), marcadores de km, anéis de largada/chegada e legenda com o ritmo | Mapa de calor estilo telemetria de F1, neon | Impacto imediato no feed |
| **Recibo** | Cupom fiscal num papel creme com borda serrilhada, levemente girado: cada km é um item, TOTAL, TEMPO, RITMO, CALORIAS, código de barras feito das parciais, "VOLTE SEMPRE" | Anti-estética: objeto do dia a dia, fonte monoespaçada | Humor, o que mais se compartilha e reposta |
| **Bilhete de embarque** | Cartão de embarque: "KM 0 → KM 38", passageiro (seu primeiro nome), data, embarque/chegada (horário real), portão = ritmo, assento = FC, classe = tipo do treino ("Longão", "Rodagem"), canhoto picotado com código de barras e mini rota | Premium, parece um objeto real | Vira série ("meus voos da semana") |

**Regras comuns aos 6:**
- A cor vem do esporte (`storyColor`: lima na corrida).
- A marca KACTUS usa `/brand/kactus-wordmark.png` sem tingir.
- Continuam valendo o **fundo transparente** e a **sua foto** de fundo. No Recibo e no Bilhete, o papel ou cartão fica por cima da foto.

---

## Fase 0 — Documento
Criar `Kactus/docs/PLANEJAMENTO_2026-09-29_2.md` com este plano. Commit, push e espelho.

## Fase 1 — Base para modelos desenhados em código

**`lib/story/types.ts`:**
- `StoryLayout.art` passa a ser opcional.
- Novo campo `available?(data) => boolean`, que substitui o uso de `requiresRoute` nos modelos novos. O `requiresRoute` antigo continua funcionando.
- `StoryLayoutData` ganha três campos:
  - `splits: Split[]`;
  - `hrZones: HrZones | null`;
  - `athleteName: string | null`.

**`components/share/StoryGenerator.tsx`:**
- Novas props `splits` e `zones`, que já existem na página `app/activities/[id]/page.tsx` (linhas 93 e 112).
- Busca `fetchProfile()` (já deduplicado) para as zonas de FC e o primeiro nome.
- Só carrega a arte se `layout.art` existir; desenha sem esperar arte nos modelos novos.
- `availableLayouts` recebe os dados e esconde o modelo que não faz sentido (ex.: Batimento sem FC).

**`lib/story/draw.ts` (novo):** utilitários dos modelos novos, reaproveitando `engine.ts` (`drawCoverImage`, `projectRoute`, `STORY_W/H`, `loadStoryFonts`):
- desenhar a marca;
- ajustar texto na largura;
- suavizar séries (média móvel);
- converter parciais em código de barras;
- desenhar o fundo (foto, transparente ou escuro).

**`lib/story/layouts/index.ts`:** os 6 novos entram **no começo** do carrossel, antes das 19 artes, com o selo "novo" no chip.

## Fase 2 — Batimento e Parciais brutalistas

**`layouts/batimento.ts`:**
- **Quando aparece:** só com 60 pontos ou mais com FC.
- **Curva:** média móvel de ~15 s, cada trecho colorido pela zona do perfil. Sem zonas no perfil, usa o % da FC máxima observada.
- **Faixa de zonas embaixo:** usa `zones`.

**`layouts/parciais.ts`:**
- **Quando aparece:** com 2 ou mais km completos (a parcial final abaixo de 500 m é descartada).
- **Barras:** altura ∝ 1/ritmo.
- **Treino longo:** acima de 30 km, barras finas com rótulo a cada 5 km.
- **Bike:** mostra km/h e "KM MAIS RÁPIDO 38,2 km/h".

## Fase 3 — Montanha e Rota pelo ritmo

**`layouts/montanha.ts`:**
- **Quando aparece:** com subida acumulada de 20 m ou mais e pontos com altitude.
- **Desenho:** perfil suavizado por distância. As camadas de trás são o mesmo perfil deslocado e esmaecido.
- **Cume:** marcador com `elevation_max_m`.

**`layouts/rotaRitmo.ts`:**
- **Quando aparece:** com rota GPS e velocidade (ou distância/tempo) nos pontos.
- **Gradiente:** velocidade suavizada → cor, com cortes nos percentis 10/90 para um pico isolado não achatar o resto.
- **Marcadores de km:** a cada km.
- **Legenda:** traz os ritmos reais das pontas.

## Fase 4 — Recibo e Bilhete de embarque

**`layouts/recibo.ts`:**
- **Fonte:** Consolas / Courier New (vêm com o Windows, onde o app roda; não precisa baixar).
- **Parciais:** acima de 20 km, agrupadas de 5 em 5 ("KM 01–05 … 26:10") para caber.
- **Campo sem dado:** some. Por exemplo, CALORIAS sem valor não aparece.

**`layouts/bilhete.ts`:**
- **Classe:** vem da distância e do tipo do treino:
  - Longão: 18 km ou mais;
  - Tiro: tem voltas curtas;
  - Rodagem: o resto.
- **Voo:** `KCT` + data (ex.: `KCT-2909`).
- **Mini rota:** só quando há GPS.

## Fase 5 — Conferência e fechamento

**Testar nas suas atividades reais:**
- longão com FC;
- trilha com subida;
- bike;
- esteira (sem GPS: os modelos de rota somem);
- treino curto.

**Conferir em cada um:**
- com foto, sem foto e com fundo transparente;
- a imagem salva em 1080×1920;
- os modelos antigos seguem iguais (`/story-calibrate` num modelo com arte).

**Documentos:**
- `ESTADO_DO_PROJETO.md`;
- `BACKLOG.md` com as ideias: Capa de revista, Frase da Duni, Feed 4:5, Vídeo animado (rota se desenhando, números subindo, via `canvas.captureStream`);
- fechar o plano e atualizar a memória do gerador de Stories.

---

## Verificação

- `pnpm exec tsc --noEmit` em `apps/web`. Não há mudança no backend.
- `preview_start kactus` (a sessão já está salva no painel). Abrir uma atividade, depois Compartilhar, e passar pelos 6 modelos novos.
- Salvar o PNG e conferir o tamanho: fundo escuro, transparente e com foto.
- Conferir que o modelo some quando falta o dado: Batimento em treino sem FC, Montanha em treino plano, rotas na esteira.
- Screenshots de cada modelo para você aprovar o visual **antes** de fechar cada fase. Se algum não agradar, ajusto ou tiro (como foi com o boneco).
- Nenhum erro no console. Os 19 modelos antigos continuam listados e iguais.

## Registro de execução

### Fase 0 (2026-09-29)
- Este documento criado.

### Fase 1 (2026-09-29)
- `StoryLayoutData` ganhou `splits`, `zones`, `hrZones` e `athleteName`; `StoryLayout` ganhou `available(input)` e `isNew`. O gerador recebe parciais e zonas da página da atividade e busca o perfil (zonas de FC e nome).
- Simplificação em relação ao plano: em vez de tornar `art` opcional, os modelos de código usam a própria logo (`/brand/kactus-wordmark.png`) como "arte". O carregamento do gerador continua igual e os 19 modelos não mudam.
- `lib/story/draw.ts`: fundo (foto + véu ou brilho da cor), logo, texto, ajuste de tamanho, média móvel, percentil, velocidade por ponto, parciais usáveis, código de barras, datas.
- `DATA_LAYOUTS` (modelos de código) ficam fora de `STORY_LAYOUTS`, para o `/story-calibrate` seguir só com as artes; `availableLayouts` junta as duas listas, com os novos na frente.

### Fase 2 (2026-09-29)
- `layouts/batimento.ts`: FC média gigante, curva de FC em papel de eletrocardiograma colorida por zona (brilho da cor da zona), faixa de tempo por zona e rodapé com distância, tempo, ritmo e data. Escala pelo percentil 2% (o aquecimento achatava a curva).
- **Zonas iguais às da atividade:** `resolveHrZones` em `lib/athlete.ts` espelha o `resolve_hr_zones` do backend (zonas do perfil > Karvonen > %FCmax). Antes a curva usava a FC máx do treino e dava "zona 5" onde a faixa dizia "zona 3".
- `layouts/parciais.ts`: km mais rápido gigante, régua branca, barras por km (a mais rápida na cor do esporte com brilho), linha tracejada da média, total grande, tempo e média. Bike mostra km/h.
- Conferido em imagem inteira: longão de 34 km (01/05) e pedalada de 45 km (11/07).

### Fase 3 (2026-09-29)
- `layouts/montanha.ts`: subida acumulada gigante, sol listrado na cor do esporte atrás (preenche o céu em qualquer relevo), três camadas de relevo (as de trás espelhadas/deslocadas e esmaecidas), neblina, crista com curva suave e brilho, cume marcado, eixo 0 km → total.
  - Primeira versão reprovada no próprio teste: num treino quase plano (+111 m em 34 km) a normalização transformava ruído em picos serrilhados. Agora suaviza duas vezes (~1,5% do percurso) e a altura é proporcional ao desnível real (cordilheira só com ~300 m de relevo; mínimo 45%).
- `layouts/rotaRitmo.ts`: ritmo médio gigante, rota com gradiente de velocidade (azul lento → cor do esporte → laranja rápido, cortes nos percentis 10/90), halo, marcadores de km (1 em 1 até 15 km, depois de 5 em 5; o que cai em cima de outro na ida e volta é pulado), anéis de largada/chegada, legenda com os ritmos reais das pontas. Velocidade suavizada em janela larga (a cor piscava e parecia tracejado).
