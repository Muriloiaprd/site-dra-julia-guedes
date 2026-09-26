import { drawCoverImage, drawScrim, fitFontSize, STORY_H, STORY_W, textWithShadow, type Box } from "../engine";
import { metricByKey, type StoryMetric } from "../metrics";
import type { StatBand } from "../regions";
import type { StoryLayoutData } from "../types";

/** Fonte condensada dos modelos 15 e 16. Impact vem com o Windows, onde o app roda; os outros são fallback. */
export const CONDENSED = "Impact, 'Arial Narrow', 'Roboto Condensed', sans-serif";

/**
 * Texto comprimido na horizontal por `squeeze` (1 = normal), ancorado em
 * (x, y) conforme o `align`. A condensada das artes 15 e 16 é bem mais
 * estreita que a Impact: na altura certa, a Impact sairia larga demais.
 */
export function squeezedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  squeeze: number,
  opts: Parameters<typeof textWithShadow>[4]
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(squeeze, 1);
  textWithShadow(ctx, text, 0, 0, opts);
  ctx.restore();
}
/** Serifada do modelo 9 — no Canva era uma serifada de sistema; Georgia é a equivalente no Windows. */
export const SERIF = "Georgia, 'Noto Serif', 'Times New Roman', serif";

/**
 * `flat` escurece a caixa por igual: nos modelos com texto de cima a baixo
 * (13, 15, 16), dois gradientes se encontrando no meio deixariam justamente
 * a linha do meio sem contraste.
 */
export type Scrim = { box: Box; direction: "top" | "bottom" | "flat"; strength: number };

/** Foto de fundo (se houver e o fundo não for transparente) e os escurecimentos que seguram o contraste do texto. */
export function drawPhotoAndScrims(ctx: CanvasRenderingContext2D, data: StoryLayoutData, scrims: Scrim[]): void {
  if (data.photo && !data.transparent) {
    drawCoverImage(ctx, data.photo.image, { x: 0, y: 0, w: STORY_W, h: STORY_H }, data.photo);
  }
  if (data.transparent) return;
  for (const s of scrims) {
    if (s.direction === "flat") {
      ctx.save();
      ctx.fillStyle = `rgba(6,6,6,${s.strength})`;
      ctx.fillRect(s.box.x, s.box.y, s.box.w, s.box.h);
      ctx.restore();
    } else {
      drawScrim(ctx, s.box, s.direction, s.strength);
    }
  }
}

/** "38,00 km", "5:20 /km", "1:52:34" — unidade separada por espaço, como no resto do gerador. */
export function metricText(metric: StoryMetric): string {
  return metric.value + (metric.unit ? ` ${metric.unit}` : "");
}

/**
 * Faixa de 3 colunas (rótulo em cima, valor embaixo) dos modelos 5, 6, 7, 8 e
 * 12, na ordem da arte: distância, ritmo e tempo — o ritmo vira velocidade no
 * ciclismo, pelo próprio `resolveStoryMetrics`. Rótulo como na arte, sem
 * caixa alta.
 */
export function drawStatBand(ctx: CanvasRenderingContext2D, data: StoryLayoutData, band: StatBand): void {
  const keys = ["distance", "pace", "duration"] as const;
  band.cols.forEach((col, i) => {
    const metric = metricByKey(data.metrics, keys[i]);
    if (!metric) return;

    const labelFont = (s: number) => `400 ${s}px 'Inter', sans-serif`;
    textWithShadow(ctx, metric.label, col.label.x, col.label.y, {
      font: labelFont(fitFontSize(ctx, metric.label, labelFont, band.colMaxW, col.label.size, 18, 0.04)),
      letterSpacing: col.label.size * 0.04,
      align: "center",
      shadowBlur: 6,
      shadowColor: "rgba(0,0,0,0.45)",
    });

    const value = metricText(metric);
    const valueFont = (s: number) => `700 ${s}px 'Inter', sans-serif`;
    const valueSize = fitFontSize(ctx, value, valueFont, band.colMaxW, col.value.size, 30, -0.05);
    textWithShadow(ctx, value, col.value.x, col.value.y, {
      font: valueFont(valueSize),
      letterSpacing: valueSize * -0.05,
      align: "center",
      shadowBlur: 6,
      shadowColor: "rgba(0,0,0,0.45)",
    });
  });
}

/**
 * Coluna de valores ao lado dos ícones (modelos 1, 2, 4 e 14): distância,
 * tempo, ritmo e elevação, na ordem dos ícones da arte. Métrica ausente deixa
 * o espaço vazio em vez de mostrar traço. `font` é a família e o peso da arte
 * (ex.: `700 {s}px 'Inter'`).
 */
export function drawValueColumn(
  ctx: CanvasRenderingContext2D,
  data: StoryLayoutData,
  slots: { x: number; y: number; size: number }[],
  maxW: number,
  font: (size: number) => string
): void {
  const keys = ["distance", "duration", "pace", "elevation"] as const;
  slots.forEach((slot, i) => {
    const metric = metricByKey(data.metrics, keys[i]);
    if (!metric) return;
    const text = metricText(metric);
    textWithShadow(ctx, text, slot.x, slot.y, {
      font: font(fitFontSize(ctx, text, font, maxW, slot.size, 28)),
      shadowBlur: 8,
      shadowColor: "rgba(0,0,0,0.45)",
    });
  });
}

/** Linhas de texto soltas (modelos 3, 9, 10 e 11): distância, tempo e ritmo, na ordem da arte. */
export const LINE_KEYS = ["distance", "duration", "pace"] as const;

/** Fonte da maioria das artes Kactus: Inter 700. */
export const INTER_BOLD = (s: number) => `700 ${s}px 'Inter', sans-serif`;
/** Fonte dos modelos 1 e 14: Montserrat 700. */
export const MONTSERRAT_BOLD = (s: number) => `700 ${s}px 'Montserrat', sans-serif`;
