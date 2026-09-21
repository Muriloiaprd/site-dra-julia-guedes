import { buildArtLayer } from "../art";
import { fitFontSize, textWithShadow } from "../engine";
import { metricByKey } from "../metrics";
import { ICONES_SOLIDOS as R } from "../regions";
import type { StoryLayout } from "../types";
import { drawHiResLogo, drawPhotoAndScrims, metricText } from "./shared";

const KEYS = ["distance", "duration", "pace"] as const;

/**
 * Modelo "12" do usuário: três ícones sólidos grandes (corredor, cronômetro,
 * velocímetro), cada um com rótulo em caixa alta e o valor embaixo, listras
 * no topo e na base, logo grande.
 */
export const iconesSolidos: StoryLayout = {
  id: "icones-solidos",
  label: "Ícones sólidos",
  art: R.art,
  draw(ctx, data) {
    drawPhotoAndScrims(ctx, data, [{ box: { x: 0, y: 0, w: 1080, h: 1920 }, direction: "flat", strength: 0.45 }]);

    const base = buildArtLayer(
      data.art,
      R.art,
      { mode: "clear", rects: data.logo ? [...R.rowClears, R.logo] : R.rowClears },
      data.color,
      data.logo ? [] : [R.logo]
    );
    ctx.drawImage(base, 0, 0);
    drawHiResLogo(ctx, data, R.logoHiRes);

    R.rows.forEach((row, i) => {
      const metric = metricByKey(data.metrics, KEYS[i]);
      if (!metric) return;

      const label = metric.label.toUpperCase();
      const labelFont = (s: number) => `700 ${s}px 'Montserrat', sans-serif`;
      textWithShadow(ctx, label, R.x, row.label.y, {
        font: labelFont(fitFontSize(ctx, label, labelFont, R.maxW, row.label.size, 28)),
        shadowBlur: 8,
        shadowColor: "rgba(0,0,0,0.45)",
      });

      const value = metricText(metric);
      const valueFont = (s: number) => `800 ${s}px 'Montserrat', sans-serif`;
      textWithShadow(ctx, value, R.x, row.value.y, {
        font: valueFont(fitFontSize(ctx, value, valueFont, R.maxW, row.value.size, 48)),
        shadowBlur: 8,
        shadowColor: "rgba(0,0,0,0.45)",
      });
    });
  },
};
