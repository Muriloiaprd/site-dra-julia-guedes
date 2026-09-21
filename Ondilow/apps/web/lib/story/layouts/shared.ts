import { drawCoverImage, drawScrim, fitFontSize, STORY_H, STORY_W, textWithShadow, type Box } from "../engine";
import { metricByKey, type StoryMetric } from "../metrics";
import type { StatBand } from "../regions";
import type { StoryLayoutData } from "../types";

/** Fonte condensada dos modelos 14 e 15. Impact vem com o Windows, onde o app roda; os outros são fallback. */
export const CONDENSED = "Impact, 'Arial Narrow', 'Roboto Condensed', sans-serif";
/** Serifada do modelo 2 — no Canva era uma serifada de sistema; Georgia é a equivalente no Windows. */
export const SERIF = "Georgia, 'Noto Serif', 'Times New Roman', serif";

/**
 * `flat` escurece a caixa por igual: nos modelos com texto de cima a baixo
 * (12, 14, 15), dois gradientes se encontrando no meio deixariam justamente
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

/** Desenha a logo de alta resolução, se o usuário tiver uma no perfil. */
export function drawHiResLogo(ctx: CanvasRenderingContext2D, data: StoryLayoutData, box: Box): void {
  if (data.logo) ctx.drawImage(data.logo, box.x, box.y, box.w, box.h);
}

/** "38,00 km", "5:20 /km", "1:52:34" — unidade separada por espaço, como no resto do gerador. */
export function metricText(metric: StoryMetric): string {
  return metric.value + (metric.unit ? ` ${metric.unit}` : "");
}

/**
 * Faixa de 3 colunas (rótulo em cima, valor embaixo) do modelo 7, dividida
 * pelos modelos 5, 6, 8 e 11. Distância, tempo e ritmo — o ritmo vira
 * velocidade no ciclismo, pelo próprio `resolveStoryMetrics`.
 */
export function drawStatBand(ctx: CanvasRenderingContext2D, data: StoryLayoutData, band: StatBand): void {
  const keys = ["distance", "duration", "pace"] as const;
  band.cols.forEach((col, i) => {
    const metric = metricByKey(data.metrics, keys[i]);
    if (!metric) return;

    const label = metric.label.toUpperCase();
    const labelFont = (s: number) => `700 ${s}px 'Montserrat', sans-serif`;
    textWithShadow(ctx, label, col.label.x, col.label.y, {
      font: labelFont(fitFontSize(ctx, label, labelFont, band.colMaxW, col.label.size, 18)),
      color: "rgba(255,255,255,0.75)",
      align: "center",
      shadowBlur: 6,
      shadowColor: "rgba(0,0,0,0.45)",
    });

    const value = metricText(metric);
    const valueFont = (s: number) => `800 ${s}px 'Montserrat', sans-serif`;
    textWithShadow(ctx, value, col.value.x, col.value.y, {
      font: valueFont(fitFontSize(ctx, value, valueFont, band.colMaxW, col.value.size, 30)),
      align: "center",
      shadowBlur: 6,
      shadowColor: "rgba(0,0,0,0.45)",
    });
  });
}

/**
 * Coluna de valores ao lado dos ícones (modelos 1 e 4): distância, tempo,
 * ritmo e elevação, na ordem dos ícones da arte. Métrica ausente deixa o
 * espaço vazio em vez de mostrar traço.
 */
export function drawValueColumn(
  ctx: CanvasRenderingContext2D,
  data: StoryLayoutData,
  slots: { x: number; y: number; size: number }[],
  maxW: number
): void {
  const keys = ["distance", "duration", "pace", "elevation"] as const;
  slots.forEach((slot, i) => {
    const metric = metricByKey(data.metrics, keys[i]);
    if (!metric) return;
    const text = metricText(metric);
    const font = (s: number) => `800 ${s}px 'Montserrat', sans-serif`;
    textWithShadow(ctx, text, slot.x, slot.y, {
      font: font(fitFontSize(ctx, text, font, maxW, slot.size, 28)),
      shadowBlur: 8,
      shadowColor: "rgba(0,0,0,0.45)",
    });
  });
}
