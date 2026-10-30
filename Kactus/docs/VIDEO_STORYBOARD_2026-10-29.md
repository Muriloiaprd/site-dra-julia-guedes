# Vídeo "Como funciona o Kactus" — storyboard (Fase 1)

Fase 1 do [PLANEJAMENTO_2026-10-29.md](./PLANEJAMENTO_2026-10-29.md): as falas completas e um quadro parado de cada cena, para aprovar **antes** de animar.

- **Falas:** [`video/roteiro/falas.json`](../video/roteiro/falas.json), com 11 cenas, 26 falas, quem fala, o texto e a ação de cada cena.
- **Folha com tudo:** [`video/storyboard/storyboard.png`](../video/storyboard/storyboard.png)
- **Um quadro por cena:** `video/storyboard/cena-01.png` … `cena-11.png` (1920×1080). A legenda embaixo mostra a fala principal da cena; a etiqueta no canto só existe no storyboard.

## Personagens

- **Beto**: cabeça redonda, olhos gigantes, camiseta verde Kactus, braços e pernas de linha (`video/src/personagens/Beto.tsx`, com 9 poses e 6 bocas).
- **Duni**: o cacto rainha do app redesenhado no mesmo traço, com coroa, cílios e vaso (`video/src/personagens/Duni.tsx`).
- O traço "fervendo", como desenho feito quadro a quadro, vem de um filtro SVG em `video/src/ui/Papel.tsx`.

## Gerar de novo

Rodar pelo **PowerShell**: o Edge headless não abre a partir do Git Bash nesta máquina.

```powershell
cd "C:\Cloude Code\Kactus\video"
npm install
node scripts/storyboard.mjs            # todas as cenas e a folha
node scripts/storyboard.mjs Cena04     # só uma
```

Para mexer olhando: `npm run studio` (Remotion Studio na porta 3022, ou a config `kactus-video` do `.claude/launch.json` da raiz).

## Teste de movimento (Fase 2)

A composição `TestePersonagens` (5 s) mostra o Beto entrando andando, acenando e falando, e a Duni brotando do chão, quicando e falando. Para gerar (pelo PowerShell):

```powershell
npx remotion render src/index.ts TestePersonagens out/teste-personagens.mp4
```

Os movimentos ficam em `video/src/anim.ts` (piscar, respirar, mola, boca falando) e nas props dos personagens (`andar`, `andarForca`, `fala`, `respiro`, `inclinar`, `misturarPoses`, `bracosAndando`; na Duni, `pulo`, `fala` e os braços). Até a Fase 3, a boca mexe num padrão fixo; depois passa a seguir o volume da voz.

## Vozes e sincronia (Fase 3)

- `npm run vozes` (`scripts/gerar_vozes.py`, Edge TTS grátis + `miniaudio`) gera um MP3 por fala em `public/audio/` e o índice `vozes.json`, com a duração, o tempo de cada palavra e o **volume quadro a quadro**. Só gera de novo as falas cujo texto ou voz mudou.
- As vozes e os ajustes (velocidade e tom) ficam em `roteiro/falas.json` → `vozes`. O tênis e o amigo usam a voz do Antonio com outro tom.
- Pausas: `antes`/`depois` por cena e `pausaAntes` por fala, também no `falas.json`.
- `src/linhaDoTempo.ts` calcula quando cada cena e cada fala começam a partir dos áudios. O filme (`ComoFuncionaKactus`) tem a duração exata disso: hoje são 2 min 10 s.
- A boca do Beto e da Duni segue o volume da voz sozinha (`src/FalaContexto.tsx`), em qualquer cena.
- Legendas: no próprio vídeo e em `.srt` (`npm run legendas` → `out/como-funciona-kactus.srt`).

```powershell
npx remotion render src/index.ts ComoFuncionaKactus out/fase3-vozes.mp4 --concurrency=4
```

## O que falta (próximas fases)

Animar as cenas (Fases 4 e 5) e pôr efeitos sonoros e acabamento (Fase 6).
