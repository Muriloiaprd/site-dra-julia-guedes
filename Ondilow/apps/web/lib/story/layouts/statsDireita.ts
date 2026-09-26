import { buildArtLayer, clearedBox } from "../art";
import { drawRoute, fitFontSize, projectRoute, textWithShadow } from "../engine";
import { metricByKey } from "../metrics";
import { STATS_DIREITA as R } from "../regions";
import type { StoryLayout } from "../types";
import { drawPhotoAndScrims, metricText } from "./shared";

const KEYS = ["distance", "pace", "duration"] as const;
/** Sombra dura deslocada, como na arte (preta a 65%, sem desfoque). */
const HARD_SHADOW = {
  shadowBlur: 0,
  shadowColor: "rgba(0,0,0,0.65)",
  shadowOffset: { x: 9, y: 9 },
} as const;

/**
 * Modelo "18" do usuário: blocos rótulo+valor alinhados à direita no topo, rota
 * na base, logo centralizada.
 */
export const statsDireita: StoryLayout = {
  id: "stats-direita",
  label: "Stats à direita",
  art: R.art,
  requiresRoute: true,
  draw(ctx, data) {
    drawPhotoAndScrims(ctx, data, [
      { box: { x: 0, y: 0, w: 1080, h: 1000 }, direction: "top", strength: 0.4 },
      { box: { x: 0, y: 1220, w: 1080, h: 700 }, direction: "bottom", strength: 0.75 },
    ]);

    const base = buildArtLayer(
      data.art,
      R.art,
      { mode: "clear", rects: [R.route, ...R.blockClears] },
      data.color,
      [R.logo]
    );
    ctx.drawImage(base, 0, 0);

    const coords = projectRoute(data.routePoints, R.routePlot);
    if (coords) drawRoute(ctx, coords, { color: data.color, lineWidth: 7, clip: clearedBox(R.route) });

    const font = (s: number) => `700 ${s}px 'Inter', sans-serif`;
    R.blocks.forEach((block, i) => {
      const metric = metricByKey(data.metrics, KEYS[i]);
      if (!metric) return;
      for (const [text, slot, min] of [[metric.label, block.label, 48], [metricText(metric), block.value, 70]] as const) {
        const size = fitFontSize(ctx, text, font, R.maxW, slot.size, min, R.tracking);
        textWithShadow(ctx, text, R.right, slot.y, {
          font: font(size),
          letterSpacing: size * R.tracking,
          align: "right",
          ...HARD_SHADOW,
        });
      }
    });
  },
};
