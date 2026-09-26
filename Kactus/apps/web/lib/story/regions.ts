/**
 * Constantes medidas nas artes Kactus de `public/story-art/` (1080x1920,
 * exportadas do Canva com fundo transparente; ver
 * docs/PLANEJAMENTO_2026-09-26.md — Fase 3).
 *
 * Como foram medidas: cada linha de texto de exemplo da arte foi ajustada no
 * próprio canvas do navegador contra as fontes candidatas (Montserrat, Inter,
 * Impact, Georgia, Arial…), variando fonte, peso, tamanho e espaçamento até
 * maximizar a sobreposição (IoU) com os pixels da arte. `x`/`y` são a origem
 * do `fillText` (baseline alfabética) e `size` é o tamanho em px da fonte
 * escolhida, ambos saídos desse ajuste. As caixas `*Clears` são a tinta
 * branca do texto de exemplo (bbox de alfa), com folga — é o que se apaga da
 * arte antes de escrever o valor real.
 *
 * As logos ficam as embutidas na arte: nas artes Kactus elas saem tão nítidas
 * quanto o arquivo original reduzido, então não há mais logo de alta resolução
 * desenhada por cima. `logo` é só a caixa que o recolor por esporte não pode
 * tocar (`noTint` em `buildArtLayer`).
 */

import type { Box } from "./engine";

export interface TextSlot {
  /** Baseline alfabética, medida na arte. */
  y: number;
  x: number;
  size: number;
}

/** Modelo 1: coluna de 4 ícones à direita, na metade de baixo, valores ao lado. Montserrat 700. */
export const ICONES_DIREITA = {
  art: "/story-art/icones-direita.png",
  maxW: 270,
  values: [
    { x: 787, y: 1132, size: 50 },
    { x: 787, y: 1276, size: 52 },
    { x: 787, y: 1423, size: 50 },
    { x: 787, y: 1570, size: 50 },
  ] satisfies TextSlot[],
  valueClears: [
    { x: 783, y: 1091, w: 245, h: 53 },
    { x: 783, y: 1235, w: 245, h: 47 },
    { x: 783, y: 1377, w: 245, h: 55 },
    { x: 783, y: 1530, w: 245, h: 44 },
  ] satisfies Box[],
  logo: { x: 675, y: 1638, w: 342, h: 75 } satisfies Box,
};

/** Modelo 2: 4 ícones grandes empilhados à esquerda, valor ao lado, logo grande embaixo. Inter 700. */
export const ICONES_ESQUERDA = {
  art: "/story-art/icones-esquerda.png",
  maxW: 650,
  values: [
    { x: 387, y: 332, size: 120 },
    { x: 386, y: 677, size: 126 },
    { x: 385, y: 1022, size: 120 },
    { x: 387, y: 1371, size: 122 },
  ] satisfies TextSlot[],
  valueClears: [
    { x: 388, y: 240, w: 550, h: 118 },
    { x: 388, y: 579, w: 456, h: 103 },
    { x: 388, y: 927, w: 498, h: 111 },
    { x: 393, y: 1278, w: 411, h: 96 },
  ] satisfies Box[],
  logo: { x: 123, y: 1530, w: 809, h: 177 } satisfies Box,
};

/** Modelo 3: três linhas de stats centradas no topo, rota pequena, logo grande. Inter 700. */
export const ROTA_MINIMAL = {
  art: "/story-art/rota-minimal.png",
  /** As três linhas saem numa limpeza só — não há nada entre elas na arte. */
  textClear: { x: 262, y: 258, w: 556, h: 662 } satisfies Box,
  center: 540,
  maxW: 900,
  lines: [{ y: 354, size: 118 }, { y: 631, size: 124 }, { y: 901, size: 118 }],
  route: { x: 406, y: 1058, w: 270, h: 386 } satisfies Box,
  /** Menor que `route`: o modelo é minimalista, a rota não deve crescer até a logo (y 1476). */
  routePlot: { x: 420, y: 1072, w: 242, h: 358 } satisfies Box,
  logo: { x: 117, y: 1476, w: 865, h: 189 } satisfies Box,
};

/** Modelo 4: logo vertical num badge preto na lateral direita, 4 ícones na base à esquerda. Inter 700. */
export const LOGO_LATERAL = {
  art: "/story-art/logo-lateral.png",
  maxW: 600,
  values: [
    { x: 205, y: 1281, size: 55 },
    { x: 204, y: 1440, size: 58 },
    { x: 204, y: 1598, size: 55 },
    { x: 203, y: 1759, size: 56 },
  ] satisfies TextSlot[],
  valueClears: [
    { x: 202, y: 1236, w: 258, h: 59 },
    { x: 202, y: 1393, w: 214, h: 52 },
    { x: 202, y: 1552, w: 233, h: 56 },
    { x: 204, y: 1713, w: 194, h: 49 },
  ] satisfies Box[],
  /** A logo aqui é girada 90° dentro do badge — fica a embutida, protegida do recolor. */
  badge: { x: 958, y: 106, w: 114, h: 464 } satisfies Box,
};

/**
 * Faixa de 3 colunas (rótulo em cima, valor embaixo) dos modelos 5, 6, 7, 8 e
 * 12. Rótulos em Inter 400 com espaçamento leve; valores em Inter 700 bem
 * apertado. Os rótulos e os valores não dividem o mesmo centro na arte, por
 * isso cada coluna tem os dois.
 */
export interface StatBand {
  colMaxW: number;
  cols: { label: TextSlot; value: TextSlot }[];
  colClears: Box[];
}

function statBand(labelDx: number, valueDx: number, dy: number): StatBand {
  const labelCenters = [254, 548, 838];
  const valueCenters = [258, 564, 846];
  const labelInk: [number, number][] = [[182, 143], [502, 93], [781, 110]];
  const valueInk: [number, number][] = [[140, 238], [456, 219], [737, 220]];
  return {
    // divisórias da arte em x≈400 e x≈708: 250 de largura cabe sem encostar nelas
    colMaxW: 250,
    cols: labelCenters.map((lc, i) => ({
      label: { x: lc + labelDx, y: 1669 + dy, size: 31.5 },
      value: { x: valueCenters[i] + valueDx, y: 1734 + dy, size: 56 },
    })),
    colClears: [
      ...labelInk.map(([x, w]) => ({ x: x + labelDx - 4, y: 1641 + dy, w: w + 8, h: 36 })),
      ...valueInk.map(([x, w]) => ({ x: x + valueDx - 4, y: 1686 + dy, w: w + 8, h: 63 })),
    ],
  };
}

/** Modelo 5: rota grande + faixa de 3 colunas + logo embaixo. Os valores ficam 5px à direita dos do 6. */
export const ROTA_LIMPA = {
  art: "/story-art/rota-limpa.png",
  route: { x: 234, y: 514, w: 625, h: 892 } satisfies Box,
  routePlot: { x: 234, y: 514, w: 625, h: 892 } satisfies Box,
  band: statBand(0, 5, 0),
  logo: { x: 321, y: 1780, w: 432, h: 95 } satisfies Box,
};

/** Modelo 6: só o símbolo e a faixa de 3 colunas. Sem rota. */
export const FAIXA_SIMPLES = {
  art: "/story-art/faixa-simples.png",
  band: statBand(0, 0, 0),
  logo: { x: 458, y: 1395, w: 180, h: 193 } satisfies Box,
};

/** Modelo 7: listras no topo e na base, rota grande, símbolo e a faixa de 3 colunas. */
export const ROTA_FAIXA = {
  art: "/story-art/rota-faixa.png",
  route: { x: 247, y: 412, w: 625, h: 892 } satisfies Box,
  /** A rota termina a ~90px do símbolo (y 1395): a tinta cabe com folga. */
  routePlot: { x: 247, y: 412, w: 625, h: 892 } satisfies Box,
  band: statBand(0, 0, 0),
  logo: { x: 458, y: 1395, w: 180, h: 193 } satisfies Box,
};

/** Modelo 8: listras no topo e na base, símbolo e a faixa de 3 colunas. Sem rota. */
export const FAIXA_LISTRAS = {
  art: "/story-art/faixa-listras.png",
  band: statBand(0, 0, 0),
  logo: { x: 458, y: 1395, w: 180, h: 194 } satisfies Box,
};

/** Modelo 9: mão apontando para 3 linhas em serifada. Sem logo. */
export const MAO_APONTANDO = {
  art: "/story-art/mao-apontando.png",
  center: 855,
  /** A mão acaba em x≈719: 260 de largura centrada em 855 não encosta nela. */
  maxW: 260,
  lines: [{ y: 1421, size: 43 }, { y: 1531, size: 43 }, { y: 1635, size: 43 }],
  lineClears: [
    { x: 761, y: 1384, w: 189, h: 47 },
    { x: 754, y: 1491, w: 204, h: 44 },
    { x: 763, y: 1599, w: 177, h: 50 },
  ] satisfies Box[],
};

/** Modelo 10: símbolo grande + 3 linhas escalonadas à direita. Inter 700. */
export const SIMBOLO_METRICAS = {
  art: "/story-art/simbolo-metricas.png",
  maxW: 290,
  values: [
    { x: 766, y: 1421, size: 47 },
    { x: 753, y: 1530, size: 49 },
    { x: 768, y: 1636, size: 46 },
  ] satisfies TextSlot[],
  valueClears: [
    { x: 764, y: 1383, w: 219, h: 51 },
    { x: 751, y: 1488, w: 217, h: 47 },
    { x: 766, y: 1597, w: 188, h: 48 },
  ] satisfies Box[],
  logo: { x: 463, y: 1361, w: 255, h: 273 } satisfies Box,
};

/** Modelo 11: tênis + 3 linhas em diagonal + logo embaixo. Inter 700. */
export const TENIS = {
  art: "/story-art/tenis.png",
  /** Linhas em escada: cada uma tem até a borda direita (com margem) pra crescer. */
  values: [
    { x: 513, y: 1513, size: 46, maxW: 530 },
    { x: 630, y: 1608, size: 48, maxW: 420 },
    { x: 726, y: 1701, size: 46, maxW: 330 },
  ],
  valueClears: [
    { x: 510, y: 1475, w: 219, h: 51 },
    { x: 627, y: 1567, w: 217, h: 46 },
    { x: 724, y: 1662, w: 188, h: 48 },
  ] satisfies Box[],
  logo: { x: 214, y: 1712, w: 352, h: 77 } satisfies Box,
};

/** Modelo 12: bandeiras de chegada sobre a faixa, que aqui sobe 32px (rótulos 16px e valores 12px à esquerda). */
export const BANDEIRAS = {
  art: "/story-art/bandeiras.png",
  band: statBand(-16, -12, -32),
  logo: { x: 305, y: 1751, w: 432, h: 94 } satisfies Box,
};

/**
 * Modelo 13: ícones sólidos grandes, rótulo em caixa alta + valor embaixo, logo
 * grande. A arte parece Open Sans (não auto-hospedada): rótulo em Inter 400 e
 * valor em Arial 700 foram os que mais se sobrepuseram.
 */
export const ICONES_SOLIDOS = {
  art: "/story-art/icones-solidos.png",
  x: 461,
  maxW: 580,
  rows: [
    { label: { y: 355, size: 59 }, value: { y: 489, size: 100 } },
    { label: { y: 750, size: 59 }, value: { y: 888, size: 109 } },
    { label: { y: 1155, size: 59 }, value: { y: 1290, size: 108 } },
  ],
  rowClears: [
    { x: 455, y: 292, w: 600, h: 216 },
    { x: 455, y: 700, w: 600, h: 195 },
    { x: 455, y: 1092, w: 600, h: 205 },
  ] satisfies Box[],
  logo: { x: 71, y: 1439, w: 964, h: 211 } satisfies Box,
};

/**
 * Modelo 14: coluna de ícones com o valor ao lado no meio da arte, rota
 * pequena embaixo à direita e a logo na diagonal (fundida com um risco lima,
 * protegida do recolor junto com ele). Montserrat 700.
 */
export const ROTA_ICONES = {
  art: "/story-art/rota-icones.png",
  maxW: 340,
  values: [
    { x: 718, y: 616, size: 63 },
    { x: 719, y: 801, size: 68 },
    { x: 717, y: 985, size: 62 },
    { x: 718, y: 1172, size: 62 },
  ] satisfies TextSlot[],
  valueClears: [
    { x: 714, y: 565, w: 309, h: 66 },
    { x: 714, y: 749, w: 230, h: 57 },
    { x: 715, y: 928, w: 278, h: 68 },
    { x: 718, y: 1123, w: 227, h: 54 },
  ] satisfies Box[],
  route: { x: 667, y: 1260, w: 351, h: 500 } satisfies Box,
  routePlot: { x: 680, y: 1275, w: 325, h: 470 } satisfies Box,
  logo: { x: 110, y: 1560, w: 480, h: 190 } satisfies Box,
};

/**
 * Modelo 15: tudo centralizado — rótulo na cor do esporte (Inter 500) e valor
 * grande em fonte condensada. A condensada da arte é mais estreita que a
 * Impact: o tamanho segue a altura da arte e a largura é comprimida por
 * `squeeze` (largura da arte ÷ largura da Impact no mesmo tamanho, medida nos
 * três valores de exemplo: 0,66–0,69).
 */
export const ROTULOS_CENTRO = {
  art: "/story-art/rotulos-centro.png",
  center: 540,
  maxW: 900,
  squeeze: 0.67,
  rows: [
    { label: { y: 374, size: 45 }, value: { y: 559, size: 170 } },
    { label: { y: 762, size: 45 }, value: { y: 953, size: 180 } },
    { label: { y: 1145, size: 45 }, value: { y: 1333, size: 174 } },
  ],
  /** O rótulo também é apagado: é texto chapado na arte ("Ritmo médio") e precisa virar "Velocidade média" no ciclismo. */
  rowClears: [
    { x: 340, y: 332, w: 400, h: 256 },
    { x: 305, y: 718, w: 470, h: 252 },
    { x: 330, y: 1105, w: 420, h: 236 },
  ] satisfies Box[],
  logo: { x: 216, y: 1444, w: 637, h: 139 } satisfies Box,
};

/**
 * Modelo 16: moldura tracejada, três linhas ícone + valor (Impact) e a data
 * embaixo. O primeiro ícone é o símbolo da marca; os outros dois são brancos
 * (saturação zero), o recolor não mexe neles. A condensada daqui é menos
 * estreita que a do 15: `squeeze` 0,78 (medido nos dígitos e na data).
 */
export const MOLDURA_TRACEJADA = {
  art: "/story-art/moldura-tracejada.png",
  maxW: 520,
  squeeze: 0.78,
  values: [
    { x: 469, y: 607, size: 158 },
    { x: 467, y: 895, size: 152 },
    { x: 445, y: 1163, size: 151 },
  ] satisfies TextSlot[],
  valueClears: [
    { x: 468, y: 475, w: 268, h: 136 },
    { x: 468, y: 768, w: 355, h: 134 },
    { x: 446, y: 1037, w: 302, h: 134 },
  ] satisfies Box[],
  date: { x: 538, y: 1523, size: 170 },
  dateClear: { x: 232, y: 1381, w: 612, h: 150 } satisfies Box,
  logo: { x: 200, y: 419, w: 201, h: 216 } satisfies Box,
};

/**
 * Modelo 17: título gigante em 2 linhas, listras no topo, 3 valores com
 * rótulo embaixo, logo num badge preto e xadrez na base. Título e valores em
 * Montserrat 900 com espaçamento aberto (5%); rótulos em Inter 400.
 */
export const DESAFIO = {
  art: "/story-art/desafio.png",
  tracking: 0.05,
  title: [
    { x: 63, y: 1342, size: 101, maxW: 950 },
    { x: 63, y: 1448, size: 101, maxW: 950 },
  ],
  titleClears: [
    { x: 64, y: 1265, w: 853, h: 83 },
    { x: 60, y: 1371, w: 707, h: 83 },
  ] satisfies Box[],
  /** Colunas a ~350px de distância; 330 de folga evita encostar na vizinha. */
  colMaxW: 330,
  cols: [
    { value: { x: 63, y: 1598, size: 66 }, label: { x: 61, y: 1650, size: 36 } },
    { value: { x: 414, y: 1609, size: 67 }, label: { x: 413, y: 1662, size: 38 } },
    { value: { x: 808, y: 1609, size: 67 }, label: { x: 804, y: 1662, size: 38 } },
  ],
  colClears: [
    { x: 58, y: 1546, w: 183, h: 56 },
    { x: 411, y: 1557, w: 199, h: 56 },
    { x: 803, y: 1557, w: 173, h: 56 },
    { x: 58, y: 1620, w: 95, h: 34 },
    { x: 412, y: 1630, w: 106, h: 36 },
    { x: 804, y: 1630, w: 190, h: 36 },
  ] satisfies Box[],
  /** Wordmark branco sobre o badge preto — tudo protegido do recolor. */
  logo: { x: 58, y: 1762, w: 370, h: 132 } satisfies Box,
};

/**
 * Modelo 18: blocos rótulo+valor alinhados à direita no topo, rota na base,
 * logo centralizada. "Canva Sans" no Canva (fonte proprietária, sem licença de
 * redistribuição web) — Inter 700 bem apertado (-5%) é a aproximação livre.
 */
export const STATS_DIREITA = {
  art: "/story-art/stats-direita.png",
  route: { x: 582, y: 1012, w: 394, h: 562 } satisfies Box,
  routePlot: { x: 595, y: 1025, w: 368, h: 536 } satisfies Box,
  /** A arte alinha o texto à direita em x≈976, não na margem do canvas. */
  right: 976,
  /** Texto cresce pra esquerda; 760 impede que um valor longo estoure a margem. */
  maxW: 760,
  tracking: -0.05,
  blocks: [
    { label: { y: 195, size: 90 }, value: { y: 340, size: 138 } },
    { label: { y: 499, size: 90 }, value: { y: 642, size: 138 } },
    { label: { y: 803, size: 90 }, value: { y: 946, size: 138 } },
  ],
  /** Inclui a sombra dura (deslocada 9px) do texto de exemplo. */
  blockClears: [
    { x: 620, y: 118, w: 365, h: 90 },
    { x: 488, y: 224, w: 500, h: 130 },
    { x: 780, y: 428, w: 205, h: 84 },
    { x: 447, y: 529, w: 540, h: 140 },
    { x: 768, y: 727, w: 215, h: 88 },
    { x: 515, y: 837, w: 470, h: 124 },
  ] satisfies Box[],
  logo: { x: 545, y: 1616, w: 417, h: 91 } satisfies Box,
};

/** Modelo 19: só a rota ocupando quase a arte toda e a logo grande embaixo. */
export const ROTA_GRANDE = {
  art: "/story-art/rota-grande.png",
  /** Termina em y 1394: com a folga do clear (6px) não encosta na logo (y 1400). */
  route: { x: 118, y: 192, w: 851, h: 1202 } satisfies Box,
  routePlot: { x: 140, y: 215, w: 808, h: 1160 } satisfies Box,
  logo: { x: 59, y: 1407, w: 986, h: 214 } satisfies Box,
};
