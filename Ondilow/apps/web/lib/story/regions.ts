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

/* ════════════════════════════════════════════════════════════════
   Modelos 1, 2, 4, 5, 6, 8, 11, 12, 14 e 15 (adicionados em 2026-09-20)

   Medidos com o mesmo algoritmo de bandas de alfa do story-art-probe, mais a
   cor média de cada região: o texto de exemplo impresso na arte é BRANCO (é o
   que se apaga e redesenha) e ícones/decoração são LIMA (ficam). Boa parte
   desses PNGs parecia vazia numa visualização com fundo branco justamente
   por isso — branco sobre transparente.

   `logoHiRes` sai da caixa visível do logo.png (x 8, y 206, 1344x278 em
   1366x768), escalada para cobrir a logo embutida e centrada nela, com fator
   0.9855 calibrado contra o par já medido do ICONES_ESQUERDA (bate em ~1px).
   Baselines = topo do glifo + altura dos dígitos medida em cada arte.
   ════════════════════════════════════════════════════════════════ */

/** Faixa de 3 colunas (rótulo + valor) que os modelos 5, 6, 7 e 8 dividem nas MESMAS coordenadas. */
export const STAT_BAND = {
  colMaxW: ROTA_FAIXA.colMaxW,
  cols: ROTA_FAIXA.cols,
  colClears: ROTA_FAIXA.colClears,
};

export type StatBand = typeof STAT_BAND;

/** Modelo 1: espelho do 3 — coluna de ícones à direita, mais baixa, valores ao lado. */
export const ICONES_DIREITA = {
  art: "/story-art/icones-direita.png",
  maxW: 270,
  values: [
    { x: 787, y: 1133, size: 56 },
    { x: 787, y: 1278, size: 56 },
    { x: 787, y: 1420, size: 56 },
    { x: 787, y: 1570, size: 56 },
  ] satisfies TextSlot[],
  valueClears: [
    { x: 780, y: 1086, w: 290, h: 62 },
    { x: 780, y: 1231, w: 290, h: 55 },
    { x: 780, y: 1373, w: 290, h: 63 },
    { x: 780, y: 1526, w: 290, h: 52 },
  ] satisfies Box[],
  logo: { x: 670, y: 1658, w: 314, h: 67 } satisfies Box,
  logoHiRes: { x: 670.4, y: 1612.1, w: 314.5, h: 176.8 } satisfies Box,
};

/** Modelo 2: 3 linhas de stats centradas no topo (serifada, como no Canva), rota pequena, logo grande. */
export const ROTA_MINIMAL = {
  art: "/story-art/rota-minimal.png",
  /** As três linhas saem numa limpeza só — não há nada entre elas na arte. */
  textClear: { x: 250, y: 240, w: 580, h: 690 } satisfies Box,
  center: 540,
  maxW: 900,
  lines: [{ y: 343, size: 120 }, { y: 622, size: 120 }, { y: 893, size: 120 }],
  route: { x: 360, y: 1010, w: 360, h: 470 } satisfies Box,
  /** Menor que `route`: o modelo é minimalista, a rota não deve crescer até a logo (y 1545). */
  routePlot: { x: 390, y: 1040, w: 300, h: 410 } satisfies Box,
  logo: { x: 281, y: 1545, w: 504, h: 106 } satisfies Box,
  logoHiRes: { x: 281.7, y: 1470.5, w: 504.8, h: 283.8 } satisfies Box,
};

/** Modelo 4: logo vertical num badge preto na lateral direita, 4 ícones na base à esquerda. */
export const LOGO_LATERAL = {
  art: "/story-art/logo-lateral.png",
  maxW: 690,
  values: [
    { x: 243, y: 1288, size: 54 },
    { x: 243, y: 1426, size: 54 },
    { x: 243, y: 1562, size: 54 },
    { x: 243, y: 1707, size: 54 },
  ] satisfies TextSlot[],
  valueClears: [
    { x: 236, y: 1242, w: 260, h: 60 },
    { x: 236, y: 1380, w: 260, h: 54 },
    { x: 236, y: 1516, w: 260, h: 62 },
    { x: 236, y: 1664, w: 260, h: 51 },
  ] satisfies Box[],
  /**
   * A logo aqui é girada 90° dentro do badge. Fica a embutida (como no
   * ROTA_ICONES): trocar pela de alta resolução exigiria rotacionar e
   * recalibrar, e o badge já está nítido no tamanho em que aparece.
   */
  badge: { x: 959, y: 108, w: 121, h: 459 } satisfies Box,
};

/** Modelo 5: o 7 sem as listras diagonais — rota grande + faixa de 3 colunas. */
export const ROTA_LIMPA = {
  art: "/story-art/rota-limpa.png",
  route: { x: 226, y: 505, w: 643, h: 907 } satisfies Box,
  routePlot: { x: 226, y: 505, w: 643, h: 907 } satisfies Box,
  band: STAT_BAND,
  logo: { x: 436, y: 1797, w: 231, h: 49 } satisfies Box,
  logoHiRes: { x: 436.3, y: 1763.1, w: 231.4, h: 130.1 } satisfies Box,
};

/** Modelo 6: só a faixa de 3 colunas e o disco da logo. Sem rota. */
export const FAIXA_SIMPLES = {
  art: "/story-art/faixa-simples.png",
  band: STAT_BAND,
  /** Só o disco, sem o "ndilow" — o logo.png (horizontal) não serve, fica o embutido. */
  logoDisc: { x: 505, y: 1538, w: 71, h: 68 } satisfies Box,
};

/** Modelo 8: listras no topo e na base, logo e a faixa de 3 colunas. Sem rota. */
export const FAIXA_LISTRAS = {
  art: "/story-art/faixa-listras.png",
  band: STAT_BAND,
  logo: { x: 425, y: 1549, w: 230, h: 48 } satisfies Box,
  logoHiRes: { x: 425.3, y: 1514.8, w: 230.4, h: 129.5 } satisfies Box,
};

/**
 * Modelo 11: bandeiras de chegada cruzadas sobre a faixa. A faixa é a mesma
 * do 7, só que 9px à esquerda e 30px acima (divisórias em x 389 e 697).
 */
export const BANDEIRAS = {
  art: "/story-art/bandeiras.png",
  band: {
    colMaxW: ROTA_FAIXA.colMaxW,
    cols: ROTA_FAIXA.cols.map((c) => ({
      label: { ...c.label, x: c.label.x - 9, y: c.label.y - 30 },
      value: { ...c.value, x: c.value.x - 9, y: c.value.y - 30 },
    })),
    colClears: ROTA_FAIXA.colClears.map((b) => ({ ...b, x: b.x - 9, y: b.y - 30 })),
  } satisfies StatBand,
  logo: { x: 418, y: 1768, w: 231, h: 49 } satisfies Box,
  logoHiRes: { x: 418.3, y: 1734.1, w: 231.4, h: 130.1 } satisfies Box,
};

/** Modelo 12: ícones sólidos grandes, rótulo em caixa alta + valor ao lado, listras, logo grande. */
export const ICONES_SOLIDOS = {
  art: "/story-art/icones-solidos.png",
  x: 464,
  maxW: 576,
  rows: [
    { label: { y: 355, size: 62 }, value: { y: 493, size: 111 } },
    { label: { y: 750, size: 62 }, value: { y: 888, size: 111 } },
    { label: { y: 1155, size: 62 }, value: { y: 1289, size: 111 } },
  ],
  rowClears: [
    { x: 455, y: 290, w: 600, h: 220 },
    { x: 455, y: 697, w: 600, h: 200 },
    { x: 455, y: 1090, w: 600, h: 210 },
  ] satisfies Box[],
  logo: { x: 230, y: 1462, w: 619, h: 129 } satisfies Box,
  logoHiRes: { x: 230.9, y: 1369.9, w: 620, h: 348.6 } satisfies Box,
};

/** Modelo 14: tudo centralizado — rótulo lima pequeno, valor branco grande em fonte condensada. */
export const ROTULOS_CENTRO = {
  art: "/story-art/rotulos-centro.png",
  center: 540,
  maxW: 900,
  rows: [
    { label: { y: 485, size: 46 }, value: { y: 673, size: 177 } },
    { label: { y: 871, size: 46 }, value: { y: 1056, size: 177 } },
    { label: { y: 1256, size: 46 }, value: { y: 1443, size: 177 } },
  ],
  /**
   * O rótulo também é apagado: é texto chapado na arte ("Ritmo médio") e
   * precisa virar "Velocidade média" no ciclismo.
   */
  rowClears: [
    { x: 300, y: 440, w: 480, h: 260 },
    { x: 300, y: 825, w: 480, h: 260 },
    { x: 300, y: 1213, w: 480, h: 250 },
  ] satisfies Box[],
  logo: { x: 407, y: 1536, w: 254, h: 54 } satisfies Box,
  logoHiRes: { x: 407.4, y: 1498.7, w: 254.4, h: 143 } satisfies Box,
};

/**
 * Modelo 15: moldura de linhas tracejadas, três linhas ícone + valor e a data
 * embaixo. Os ícones são BRANCOS na arte (por isso o PNG parecia vazio) e o
 * primeiro "ícone" é o disco da logo.
 */
export const MOLDURA_TRACEJADA = {
  art: "/story-art/moldura-tracejada.png",
  x: 470,
  maxW: 499,
  values: [
    { x: 470, y: 607, size: 162 },
    { x: 470, y: 899, size: 162 },
    { x: 470, y: 1168, size: 162 },
  ] satisfies TextSlot[],
  valueClears: [
    { x: 440, y: 470, w: 600, h: 147 },
    { x: 440, y: 762, w: 600, h: 146 },
    { x: 440, y: 1031, w: 600, h: 146 },
  ] satisfies Box[],
  date: { x: 540, y: 1520, size: 150 },
  dateClear: { x: 200, y: 1375, w: 680, h: 165 } satisfies Box,
  logoDisc: { x: 211, y: 441, w: 213, h: 201 } satisfies Box,
};

export const LOGO_HI_RES = "/story-art/logo.png";
