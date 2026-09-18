/**
 * Constantes medidas nos PNGs originais (public/story-art/) via
 * app/(dev)/story-art-probe e via medição de bounding box de alfa no console.
 * Ver docs/PLANEJAMENTO_ATIVIDADES.md — Etapa 1 e Fase 4.
 *
 * Os tamanhos de fonte não são chute: cada `size` foi derivado da altura real
 * do glifo na arte dividida pela razão altura/em da fonte carregada
 * (Montserrat ~0.70 para dígitos e ~0.72 para caixa alta). O bloco
 * `STATS_DIREITA` usa Inter (ver `layouts/statsDireita.ts`) — a fonte real do
 * Canva ali é "Canva Sans", proprietária e não redistribuível.
 *
 * `logoHiRes` é onde a logo de alta resolução (`/story-art/logo.png`, 1366x768,
 * o arquivo original do usuário) é desenhada por cima da logo embutida na arte,
 * que é bem menor e mais macia. A escala é independente em X e Y de propósito:
 * no `rota-icones` a logo foi esticada verticalmente no Canva, e reproduzir a
 * mesma distorção é o que faz a nova encaixar exatamente sobre a antiga.
 */

import type { Box } from "./engine";

export interface TextSlot {
  /** Baseline alfabética, medida na arte. */
  y: number;
  x: number;
  size: number;
  align?: CanvasTextAlign;
}

export const ROTA_ICONES = {
  art: "/story-art/rota-icones.png",
  /** Caixa da rota de exemplo na arte — é a área que se apaga da arte. */
  route: { x: 74, y: 572, w: 622, h: 886 } satisfies Box,
  /**
   * Onde a rota nova é PROJETADA — sempre ⊆ `route`. Encolhida na largura
   * (622 → 488) para a tinta da rota (linha + glow, ~40px de sangramento por
   * borda) nunca alcançar a coluna de ícones, que começa em x=574. `route`
   * continua sendo só a área apagada; não confundir os dois papéis de novo.
   */
  routePlot: { x: 74, y: 572, w: 488, h: 886 } satisfies Box,
  /**
   * Os ícones ficam dentro da caixa da rota, então são apagados junto com ela e
   * redesenhados por cima do traçado novo (assim a rota pode ocupar toda a área
   * que o modelo reservou sem cobrir ícone nenhum).
   */
  icons: [
    { x: 576, y: 586, w: 110, h: 106 },
    { x: 580, y: 754, w: 103, h: 113 },
    { x: 576, y: 929, w: 110, h: 108 },
    { x: 574, y: 1107, w: 114, h: 93 },
  ] satisfies Box[],
  values: [
    { x: 717, y: 667, size: 61 },
    { x: 717, y: 838, size: 61 },
    { x: 717, y: 1011, size: 61 },
    { x: 717, y: 1177, size: 61 },
  ] satisfies TextSlot[],
  valueClears: [
    { x: 700, y: 600, w: 330, h: 90 },
    { x: 700, y: 771, w: 330, h: 90 },
    { x: 700, y: 944, w: 330, h: 90 },
    { x: 700, y: 1111, w: 330, h: 95 },
  ] satisfies Box[],
  /**
   * Aqui a logo da arte fica fundida com o risco diagonal lima e tem um brilho
   * branco em volta do texto, então não dá pra apagá-la sem cortar o risco nem
   * medir a escala com confiança (disco e texto discordam: 0.32 vs 0.26).
   * Este é o único layout que segue com a logo embutida da arte.
   */
  logo: { x: 110, y: 1570, w: 522, h: 192 } satisfies Box,
  logoHiRes: null,
};

export const ICONES_ESQUERDA = {
  art: "/story-art/icones-esquerda.png",
  values: [
    { x: 426, y: 571, size: 99 },
    { x: 426, y: 849, size: 99 },
    { x: 426, y: 1129, size: 99 },
    { x: 426, y: 1412, size: 99 },
  ] satisfies TextSlot[],
  valueClears: [
    { x: 400, y: 484, w: 500, h: 110 },
    { x: 400, y: 762, w: 500, h: 110 },
    { x: 400, y: 1036, w: 500, h: 116 },
    { x: 400, y: 1319, w: 500, h: 110 },
  ] satisfies Box[],
  logo: { x: 156, y: 1553, w: 711, h: 158 } satisfies Box,
  logoHiRes: { x: 156.7, y: 1453.2, w: 712.1, h: 398.9 } satisfies Box,
};

export const ROTA_FAIXA = {
  art: "/story-art/rota-faixa.png",
  route: { x: 250, y: 509, w: 636, h: 899 } satisfies Box,
  /** Igual a `route`: nenhuma outra região vizinha, a tinta tem folga de sobra em todas as bordas. */
  routePlot: { x: 250, y: 509, w: 636, h: 899 } satisfies Box,
  /**
   * Na arte cada coluna ocupa ~200px e as divisórias verticais ficam em x=398 e
   * x=706, então o texto é reduzido pra caber em 215 e não encostar nelas.
   */
  colMaxW: 215,
  cols: [
    { label: { x: 268, y: 1669, size: 33 }, value: { x: 268, y: 1742, size: 69 } },
    { label: { x: 558, y: 1669, size: 33 }, value: { x: 558, y: 1742, size: 69 } },
    { label: { x: 845, y: 1669, size: 33 }, value: { x: 845, y: 1742, size: 69 } },
  ],
  colClears: [
    { x: 158, y: 1638, w: 220, h: 110 },
    { x: 448, y: 1638, w: 220, h: 115 },
    { x: 733, y: 1638, w: 225, h: 105 },
  ] satisfies Box[],
  logo: { x: 408, y: 1543, w: 243, h: 60 } satisfies Box,
  logoHiRes: { x: 411.8, y: 1514.6, w: 234.8, h: 130.5 } satisfies Box,
};

export const DESAFIO = {
  art: "/story-art/desafio.png",
  title: [
    { x: 66, y: 1344, size: 104, maxW: 850 },
    { x: 66, y: 1450, size: 104, maxW: 710 },
  ],
  titleClears: [
    { x: 60, y: 1262, w: 860, h: 88 },
    { x: 60, y: 1368, w: 715, h: 88 },
  ] satisfies Box[],
  /** Colunas a ~352px de distância; 330 de folga evita encostar na vizinha. */
  colMaxW: 330,
  cols: [
    { value: { x: 62, y: 1598, size: 69 }, label: { x: 62, y: 1650, size: 36 } },
    { value: { x: 414, y: 1609, size: 69 }, label: { x: 415, y: 1662, size: 36 } },
    { value: { x: 806, y: 1609, size: 69 }, label: { x: 807, y: 1662, size: 36 } },
  ],
  colClears: [
    { x: 56, y: 1543, w: 190, h: 62 },
    { x: 56, y: 1616, w: 105, h: 42 },
    { x: 408, y: 1554, w: 205, h: 62 },
    { x: 408, y: 1627, w: 118, h: 42 },
    { x: 800, y: 1554, w: 185, h: 62 },
    { x: 800, y: 1627, w: 200, h: 42 },
  ] satisfies Box[],
  /** Badge preto com a logo em branco — variante monocromática, o arquivo colorido não serve aqui. */
  logo: { x: 55, y: 1791, w: 348, h: 107 } satisfies Box,
};

export const STATS_DIREITA = {
  art: "/story-art/stats-direita.png",
  route: { x: 577, y: 1006, w: 405, h: 572 } satisfies Box,
  /** Igual a `route`: a folga até a logo (desenhada por cima, depois) é suficiente. */
  routePlot: { x: 577, y: 1006, w: 405, h: 572 } satisfies Box,
  /** A arte alinha o texto à direita em x≈977, não na margem do canvas. */
  right: 977,
  /** Texto cresce pra esquerda; 760 impede que um valor longo estoure a margem. */
  maxW: 760,
  blocks: [
    { label: { y: 201, size: 112 }, value: { y: 346, size: 173 } },
    { label: { y: 509, size: 112 }, value: { y: 670, size: 173 } },
    { label: { y: 813, size: 112 }, value: { y: 961, size: 173 } },
  ],
  blockClears: [
    { x: 620, y: 118, w: 368, h: 92 },
    { x: 488, y: 224, w: 498, h: 132 },
    { x: 780, y: 428, w: 208, h: 87 },
    { x: 447, y: 529, w: 539, h: 147 },
    { x: 768, y: 727, w: 214, h: 92 },
    { x: 515, y: 837, w: 477, h: 130 },
  ] satisfies Box[],
  logo: { x: 638, y: 1608, w: 279, h: 69 } satisfies Box,
  logoHiRes: { x: 641.3, y: 1573.7, w: 271.7, h: 152.8 } satisfies Box,
};

export const LOGO_HI_RES = "/story-art/logo.png";
