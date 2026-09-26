import { buildArtLayer } from "../art";
import { fitFontSize, textWithShadow } from "../engine";
import { metricByKey } from "../metrics";
import { ROTULOS_CENTRO as R } from "../regions";
import type { StoryLayout } from "../types";
import { CONDENSED, drawPhotoAndScrims, metricText, squeezedText } from "./shared";

const KEYS = ["distance", "pace", "duration"] as const;

/**
 * Modelo "15" do usuário: tudo centralizado — rótulo pequeno na cor do
 * esporte e o valor grande em fonte condensada embaixo. A ordem segue a arte:
 * distância, ritmo, tempo.
 */
export const rotulosCentro: StoryLayout = {
  id: "rotulos-centro",
  label: "Centralizado",
  art: R.art,
  draw(ctx, data) {
    drawPhotoAndScrims(ctx, data, [{ box: { x: 0, y: 0, w: 1080, h: 1920 }, direction: "flat", strength: 0.45 }]);

    const base = buildArtLayer(data.art, R.art, { mode: "clear", rects: R.rowClears }, data.color, [R.logo]);
    ctx.drawImage(base, 0, 0);

    R.rows.forEach((row, i) => {
      const metric = metricByKey(data.metrics, KEYS[i]);
      if (!metric) return;

      const labelFont = (s: number) => `500 ${s}px 'Inter', sans-serif`;
      textWithShadow(ctx, metric.label, R.center, row.label.y, {
        font: labelFont(fitFontSize(ctx, metric.label, labelFont, R.maxW, row.label.size, 24)),
        color: data.color,
        align: "center",
        shadowBlur: 8,
        shadowColor: "rgba(0,0,0,0.5)",
      });

      const value = metricText(metric);
      const valueFont = (s: number) => `${s}px ${CONDENSED}`;
      squeezedText(ctx, value, R.center, row.value.y, R.squeeze, {
        font: valueFont(fitFontSize(ctx, value, valueFont, R.maxW / R.squeeze, row.value.size, 60)),
        align: "center",
        shadowBlur: 12,
        shadowColor: "rgba(0,0,0,0.5)",
      });
    });
  },
};
