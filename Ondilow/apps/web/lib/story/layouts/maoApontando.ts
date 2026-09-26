import { buildArtLayer } from "../art";
import { fitFontSize, textWithShadow } from "../engine";
import { metricByKey } from "../metrics";
import { MAO_APONTANDO as R } from "../regions";
import type { StoryLayout } from "../types";
import { drawPhotoAndScrims, LINE_KEYS, metricText, SERIF } from "./shared";

/**
 * Modelo "9" do usuário: mão apontando para três linhas em serifada
 * (distância, tempo e ritmo). Deixa a foto quase inteira à mostra. Sem rota e
 * sem logo.
 */
export const maoApontando: StoryLayout = {
  id: "mao-apontando",
  label: "Mão",
  art: R.art,
  draw(ctx, data) {
    drawPhotoAndScrims(ctx, data, [{ box: { x: 0, y: 1250, w: 1080, h: 670 }, direction: "bottom", strength: 0.75 }]);

    const base = buildArtLayer(data.art, R.art, { mode: "clear", rects: R.lineClears }, data.color);
    ctx.drawImage(base, 0, 0);

    const font = (s: number) => `400 ${s}px ${SERIF}`;
    R.lines.forEach((line, i) => {
      const metric = metricByKey(data.metrics, LINE_KEYS[i]);
      if (!metric) return;
      const text = metricText(metric);
      textWithShadow(ctx, text, R.center, line.y, {
        font: font(fitFontSize(ctx, text, font, R.maxW, line.size, 24)),
        align: "center",
        shadowBlur: 8,
        shadowColor: "rgba(0,0,0,0.5)",
      });
    });
  },
};
