import { buildArtLayer } from "../art";
import { fitFontSize, textWithShadow } from "../engine";
import { metricByKey } from "../metrics";
import { TENIS as R } from "../regions";
import type { StoryLayout } from "../types";
import { drawPhotoAndScrims, INTER_BOLD, LINE_KEYS, metricText } from "./shared";

/**
 * Modelo "11" do usuário: tênis de corrida com três linhas em escada à
 * direita (distância, tempo e ritmo) e a logo embaixo. Sem rota.
 */
export const tenis: StoryLayout = {
  id: "tenis",
  label: "Tênis",
  art: R.art,
  draw(ctx, data) {
    drawPhotoAndScrims(ctx, data, [{ box: { x: 0, y: 1250, w: 1080, h: 670 }, direction: "bottom", strength: 0.8 }]);

    const base = buildArtLayer(data.art, R.art, { mode: "clear", rects: R.valueClears }, data.color, [R.logo]);
    ctx.drawImage(base, 0, 0);

    R.values.forEach((slot, i) => {
      const metric = metricByKey(data.metrics, LINE_KEYS[i]);
      if (!metric) return;
      const text = metricText(metric);
      textWithShadow(ctx, text, slot.x, slot.y, {
        font: INTER_BOLD(fitFontSize(ctx, text, INTER_BOLD, slot.maxW, slot.size, 24)),
        shadowBlur: 8,
        shadowColor: "rgba(0,0,0,0.45)",
      });
    });
  },
};
