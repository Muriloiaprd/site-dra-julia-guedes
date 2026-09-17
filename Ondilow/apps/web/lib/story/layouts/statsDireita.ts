import { buildArtLayer } from "../art";
import { drawCoverImage, drawRoute, drawScrim, fitFontSize, projectRoute, STORY_H, STORY_W, textWithShadow } from "../engine";
import { metricByKey } from "../metrics";
import { STATS_DIREITA as R } from "../regions";
import type { StoryLayout } from "../types";

const KEYS = ["distance", "pace", "duration"] as const;
/** Sombra dura deslocada, como no original (cinza, sem desfoque). */
const HARD_SHADOW = {
  shadowBlur: 0,
  shadowColor: "rgba(95,95,95,0.95)",
  shadowOffset: { x: 9, y: 9 },
} as const;

/**
 * Modelo "17" do usuário: blocos rótulo+valor alinhados à direita no topo, rota
 * na base, logo centralizada. "Canva Sans" no Canva (fonte proprietária, sem
 * licença de redistribuição web) — usamos Inter, a aproximação livre mais
 * próxima, auto-hospedada.
 */
export const statsDireita: StoryLayout = {
  id: "stats-direita",
  label: "Stats à direita",
  art: R.art,
  requiresRoute: true,
  draw(ctx, data) {
    if (data.photo && !data.transparent) {
      drawCoverImage(ctx, data.photo.image, { x: 0, y: 0, w: STORY_W, h: STORY_H }, data.photo);
    }
    if (!data.transparent) {
      drawScrim(ctx, { x: 0, y: 0, w: STORY_W, h: 1000 }, "top", 0.4);
      drawScrim(ctx, { x: 0, y: STORY_H - 700, w: STORY_W, h: 700 }, "bottom", 0.75);
    }

    const base = buildArtLayer(
      data.art,
      R.art,
      { mode: "clear", rects: data.logo ? [R.route, ...R.blockClears, R.logo] : [R.route, ...R.blockClears] },
      data.color,
      data.logo ? [] : [R.logo]
    );
    ctx.drawImage(base, 0, 0);

    const coords = projectRoute(data.routePoints, R.route);
    if (coords) drawRoute(ctx, coords, { color: data.color, lineWidth: 7 });

    if (data.logo) {
      ctx.drawImage(data.logo, R.logoHiRes.x, R.logoHiRes.y, R.logoHiRes.w, R.logoHiRes.h);
    }

    R.blocks.forEach((block, i) => {
      const metric = metricByKey(data.metrics, KEYS[i]);
      if (!metric) return;
      const labelFont = (s: number) => `700 ${s}px 'Inter', sans-serif`;
      const valueFont = (s: number) => `800 ${s}px 'Inter', sans-serif`;
      const value = metric.value + (metric.unit ? ` ${metric.unit}` : "");
      textWithShadow(ctx, metric.label, R.right, block.label.y, {
        font: labelFont(fitFontSize(ctx, metric.label, labelFont, R.maxW, block.label.size, 48)),
        align: "right",
        ...HARD_SHADOW,
      });
      textWithShadow(ctx, value, R.right, block.value.y, {
        font: valueFont(fitFontSize(ctx, value, valueFont, R.maxW, block.value.size, 70)),
        align: "right",
        ...HARD_SHADOW,
      });
    });
  },
};
