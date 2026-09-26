import { buildArtLayer, clearedBox } from "../art";
import { drawRoute, fitFontSize, projectRoute, textWithShadow } from "../engine";
import { metricByKey } from "../metrics";
import { ROTA_MINIMAL as R } from "../regions";
import type { StoryLayout } from "../types";
import { drawPhotoAndScrims, INTER_BOLD, LINE_KEYS, metricText } from "./shared";

/**
 * Modelo "3" do usuário: três linhas de stats centradas no topo, rota pequena
 * no meio e a logo grande embaixo. A rota fica pequena de propósito — é o
 * modelo minimalista.
 */
export const rotaMinimal: StoryLayout = {
  id: "rota-minimal",
  label: "Minimalista",
  art: R.art,
  requiresRoute: true,
  draw(ctx, data) {
    drawPhotoAndScrims(ctx, data, [
      { box: { x: 0, y: 0, w: 1080, h: 1050 }, direction: "top", strength: 0.6 },
      { box: { x: 0, y: 1300, w: 1080, h: 620 }, direction: "bottom", strength: 0.6 },
    ]);

    const base = buildArtLayer(
      data.art,
      R.art,
      { mode: "clear", rects: [R.textClear, R.route] },
      data.color,
      [R.logo]
    );
    ctx.drawImage(base, 0, 0);

    const coords = projectRoute(data.routePoints, R.routePlot);
    if (coords) drawRoute(ctx, coords, { color: data.color, clip: clearedBox(R.route) });

    R.lines.forEach((line, i) => {
      const metric = metricByKey(data.metrics, LINE_KEYS[i]);
      if (!metric) return;
      const text = metricText(metric);
      textWithShadow(ctx, text, R.center, line.y, {
        font: INTER_BOLD(fitFontSize(ctx, text, INTER_BOLD, R.maxW, line.size, 48)),
        align: "center",
        shadowBlur: 10,
        shadowColor: "rgba(0,0,0,0.5)",
      });
    });
  },
};
