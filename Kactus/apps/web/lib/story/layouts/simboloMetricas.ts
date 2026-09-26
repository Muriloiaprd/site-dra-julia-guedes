import { buildArtLayer } from "../art";
import { fitFontSize, textWithShadow } from "../engine";
import { metricByKey } from "../metrics";
import { SIMBOLO_METRICAS as R } from "../regions";
import type { StoryLayout } from "../types";
import { drawPhotoAndScrims, INTER_BOLD, LINE_KEYS, metricText } from "./shared";

/**
 * Modelo "10" do usuário: o símbolo da marca grande e, à direita dele, três
 * linhas escalonadas (distância, tempo e ritmo). Sem rota.
 */
export const simboloMetricas: StoryLayout = {
  id: "simbolo-metricas",
  label: "Símbolo",
  art: R.art,
  draw(ctx, data) {
    drawPhotoAndScrims(ctx, data, [{ box: { x: 0, y: 1250, w: 1080, h: 670 }, direction: "bottom", strength: 0.75 }]);

    const base = buildArtLayer(data.art, R.art, { mode: "clear", rects: R.valueClears }, data.color, [R.logo]);
    ctx.drawImage(base, 0, 0);

    R.values.forEach((slot, i) => {
      const metric = metricByKey(data.metrics, LINE_KEYS[i]);
      if (!metric) return;
      const text = metricText(metric);
      textWithShadow(ctx, text, slot.x, slot.y, {
        font: INTER_BOLD(fitFontSize(ctx, text, INTER_BOLD, R.maxW, slot.size, 24)),
        shadowBlur: 8,
        shadowColor: "rgba(0,0,0,0.45)",
      });
    });
  },
};
