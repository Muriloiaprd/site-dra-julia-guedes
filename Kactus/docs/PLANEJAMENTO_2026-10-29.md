# Planejamento — Vídeo animado "Como funciona o Kactus" (2026-10-29)

## Contexto

O Murilo quer um vídeo animado, engraçado e claro, explicando como o Kactus funciona **hoje**, no estilo da imagem de referência: boneco de traço simples, cabeça redonda, olhos enormes, cores chapadas, contorno preto meio tremido, fundo claro. Decisões tomadas com ele:

- **Produção:** eu gero tudo por código (personagens em SVG + Remotion → MP4).
- **Formato:** horizontal 16:9, 1920×1080, 30 fps, **2 a 3 minutos**.
- **Voz:** gerada grátis (Edge TTS, vozes neurais pt-BR), uma voz para cada personagem.
- **Público:** amigos e redes sociais — gente que corre e não conhece o app. Foco em "por que é legal", pouco jargão.
- **Custo:** R$ 0, sem cartão (Remotion é gratuito para pessoa física; Edge TTS é grátis).
- **Estilo:** personagem **original**, só inspirado no estilo minimalista da referência — não copiar o boneco do autor da imagem.

Ao executar, este plano vira `Kactus/docs/PLANEJAMENTO_2026-10-29.md` (documento novo do dia) e cada fase termina em commit + push. O app não muda, então os commits levam `[fluxograma: sem mudança]`.

## Personagens

- **Beto** — corredor amador, cabeça redonda branca, olhos gigantes com pupila pequena, camiseta verde Kactus, braços e pernas de linha. Bem-intencionado e meio perdido. Voz: `pt-BR-AntonioNeural`.
- **Duni** — a treinadora de IA, o cacto rainha com coroa, redesenhada no mesmo estilo a partir de `apps/web/public/duni/duni.svg`. Direta, carinhosa e um pouco sarcástica. Voz: `pt-BR-FranciscaNeural` (alternativa `pt-BR-ThalitaNeural`).
- **O app** — telas do Kactus em versão "desenho" (não print), baseadas nos layouts de `docs/screenshots/` e no fluxograma (`docs/fluxograma/areas/*.js`), para tudo bater com o app de hoje.

## Roteiro (≈ 2 min 40 s)

Cada cena tem uma piada visual e uma informação. Tudo o que é dito existe no app hoje (conferido no fluxograma).

| # | Cena | Tempo | O que mostra | Piada |
|---|---|---|---|---|
| 1 | Abertura | 0:00–0:12 | Beto chega suado de um treino, senta à mesa e olha o relógio: "Corri 10 km... e agora?" | Uma gota de suor cai em câmera lenta no relógio. |
| 2 | O problema | 0:12–0:25 | O treino dele está espalhado: relógio, caderno, planilha, print no celular. | Os papéis brigam entre si; um pega fogo. |
| 3 | Liga o Kactus | 0:25–0:37 | Ícone do cacto perto do relógio do Windows (Kactus Controle) acende verde; abre no PC ou no iPhone. | Beto tenta abraçar o cacto. "Ai." |
| 4 | Importar | 0:37–0:52 | Exporta o `.fit` do Garmin e arrasta em Perfil › Importar. O app "mastiga" e cospe pace, tempo em movimento, carga e recordes. | Arremesso de basquete no arquivo. "Tempo em movimento não conta a parada no pastel." |
| 5 | Dashboard | 0:52–1:05 | Três perguntas do painel: **como estou, o que fiz, o que fazer hoje**. | Três plaquinhas pulam como num programa de auditório. |
| 6 | Desempenho | 1:05–1:20 | Forma, risco de lesão e previsão de prova em linguagem simples. | Beto abre o "Modo avançado", vê CTL/ATL/TSB voando, fecha correndo. |
| 7 | Duni | 1:20–1:45 | A Duni entra: check-in "Como foi?", comentário do treino, chat. Beto pede para trocar o treino de amanhã e ela troca no calendário de verdade. | "Treino de tiro amanhã. Sim, tiro. Não, não é de festa junina." |
| 8 | Calendário e plano | 1:45–2:02 | Etiquetas verde (feito), vermelha (perdido), cinza (planejado). Plano até a prova em degraus: base → construção → pico → polimento. | A etiqueta vermelha encara o Beto. Ele sobe os degraus e o último é a linha de chegada. |
| 9 | Equipamentos | 2:02–2:12 | Tênis conta km; com 600 km pede troca. | O tênis velho, todo remendado, grita "me aposenta!". |
| 10 | Story | 2:12–2:27 | Compartilhar → Story (imagem ou vídeo com a rota), postado para os amigos. | Celulares dos amigos explodem em curtidas; um responde "quem é você e o que fez com o Beto?". |
| 11 | Fecho | 2:27–2:40 | Resumo em 3 passos: **Treina → Importa → o Kactus explica e a Duni planeja.** Logo Kactus. | Beto vai abraçar a Duni... "Ai." de novo. |

As falas completas ficam em `video/roteiro/falas.json` (personagem, texto, cena) e são revisadas pelo Murilo antes de animar.

## Como vai ser feito (técnico)

- **Pasta:** `Kactus/video/` — fora de `apps/*` para não entrar no `pnpm install` do app. `package.json` próprio, Remotion 4 com versão exata.
- **Remotion:** composição `ComoFuncionaKactus` 1920×1080 a 30 fps; uma `<Sequence>` por cena; duração de cada cena calculada pela duração dos áudios (`calculateMetadata`).
- **Traço "feito à mão":** contornos pretos de ~5 px e um filtro SVG `feTurbulence` + `feDisplacementMap` cuja semente muda a cada 3 quadros ("line boil"), dando o tremido da referência.
- **Componentes reaproveitáveis** (`video/src/`): `Beto` (poses, piscar, boca que abre com o volume da fala via `@remotion/media-utils`), `Duni`, `Balao`, `TelaApp` (moldura de PC/iPhone com telas desenhadas), `Cenario` (mesa, sofá, fundo).
- **Marca:** cores e logo de `apps/web/public/brand/` e `apps/web/tailwind.config.ts`.
- **Vozes:** `video/scripts/gerar_vozes.py`, rodado com `uv run --with edge-tts`, gera um MP3 por fala em `video/public/audio/` e as legendas (marcas de palavra) em JSON.
- **Efeitos sonoros:** sintetizados por um script Python (pop, boing, whoosh, "ai"), sem baixar nada. Trilha de música só se o Murilo escolher uma CC0 e aprovar o download.
- **Legendas:** gravadas no vídeo (grandes, pensando em quem assiste sem som) e também em `.srt`.
- **Render:** `npx remotion render`. Se o Chrome que o Remotion baixa não abrir aqui (como acontece com o Chromium do Playwright), usar o Edge com `--browser-executable`. O Remotion já traz o próprio ffmpeg.
- **Saída:** `video/out/como-funciona-kactus.mp4`, fora do Git (`.gitignore`), porque é arquivo grande.
- **Prévia:** entrada `kactus-video` no `.claude/launch.json` da raiz abrindo o Remotion Studio na porta 3022, para conferir as cenas no navegador.

## Fases (cada uma termina em commit + push)

0. **Documento** — salvar este plano como `docs/PLANEJAMENTO_2026-10-29.md`. ✅ feito
1. **Roteiro e storyboard** — `falas.json` completo e um quadro parado (PNG via `remotion still`) de cada cena. **Pausa para o Murilo aprovar** falas e visual antes de animar. ✅ feito, aguardando aprovação: ver [VIDEO_STORYBOARD_2026-10-29.md](./VIDEO_STORYBOARD_2026-10-29.md)
2. **Base e personagens** — projeto Remotion, filtro de traço tremido, Beto e Duni com piscar e poses; teste de 5 s. ✅ feito: `video/src/anim.ts` (piscar, respirar, mola, boca falando), Beto com andar, fala e mistura de poses, Duni quicando e falando; composição `TestePersonagens`.
3. **Vozes e sincronia** — gerar os MP3, tempos das cenas a partir dos áudios, boca mexendo com a fala, legendas. ✅ feito: 26 MP3 em `video/public/audio/` (2 min de voz), filme `ComoFuncionaKactus` com 2 min 10 s e as cenas ainda paradas, boca seguindo o volume da voz, legenda no vídeo e `.srt`.
4. **Cenas 1 a 5** — abertura até o Dashboard, animadas. ✅ feito: cada cena se anima sincronizada com as palavras da voz (`src/cenaTempo.ts`); balões, câmera, saltos e arremesso em `src/ui/Animados.tsx`.
5. **Cenas 6 a 11** — Desempenho até o fecho, animadas.
6. **Som e acabamento** — efeitos sonoros, mixagem (voz acima dos efeitos), legendas finais, render 1080p, revisão com o Murilo e ajustes.

## Verificação

- Remotion Studio no painel do navegador: assistir cada cena e conferir os quadros-chave com `npx remotion still` (prints).
- Conferir que a duração total fica entre 2 e 3 min e que nenhuma fala é cortada ou se sobrepõe.
- Conferir cada afirmação do roteiro contra o fluxograma (`docs/fluxograma/areas/*.js`), para o vídeo não prometer algo que o app não faz (por exemplo: a importação do Garmin é manual, por arquivo).
- Abrir o MP4 final e conferir imagem, som e legendas; entregar o caminho do arquivo ao Murilo.
