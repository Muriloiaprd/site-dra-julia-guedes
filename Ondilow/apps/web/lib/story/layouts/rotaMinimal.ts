import { buildArtLayer, clearedBox } from "../art";
import { drawRoute, fitFontSize, projectRoute, textWithShadow } from "../engine";
import { metricByKey } from "../metrics";
import { ROTA_MINIMAL as R } from "../regions";
import type { StoryLayout } from "../types";
import { drawHiResLogo, drawPhotoAndScrims, metricText, SERIF } from "./shared";

const KEYS = ["distance", "duration", "pace"] as const;

/**
 * Modelo "2" do usuário: três linhas de stats centradas no topo, em serifada,
 * rota pequena no meio e a logo grande embaixo. A rota fica pequena de
 * propósito — é o modelo minimalista.
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

    const clears = [R.textClear, R.route];
    const base = buildArtLayer(
      data.art,
      R.art,
      { mode: "clear", rects: data.logo ? [...clears, R.logo] : clears },
      data.color,
      data.logo ? [] : [R.logo]
    );
    ctx.drawImage(base, 0, 0);

    const coords = projectRoute(data.routePoints, R.routePlot);
    if (coords) drawRoute(ctx, coords, { color: data.color, clip: clearedBox(R.route) });

    drawHiResLogo(ctx, data, R.logoHiRes);

    R.lines.forEach((line, i) => {
      const metric = metricByKey(data.metrics, KEYS[i]);
      if (!metric) return;
      const text = metricText(metric);
      const font = (s: number) => `400 ${s}px ${SERIF}`;
      textWithShadow(ctx, text, R.center, line.y, {
        font: font(fitFontSize(ctx, text, font, R.maxW, line.size, 48)),
        align: "center",
        shadowBlur: 10,
        shadowColor: "rgba(0,0,0,0.5)",
      });
    });
  },
};
