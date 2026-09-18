import { buildArtLayer, clearedBox } from "../art";
import { drawCoverImage, drawRoute, drawScrim, fitFontSize, projectRoute, STORY_H, STORY_W, textWithShadow } from "../engine";
import { metricByKey } from "../metrics";
import { ROTA_FAIXA as R } from "../regions";
import type { StoryLayout } from "../types";

const KEYS = ["distance", "duration", "pace"] as const;

/**
 * Modelo "7" do usuário: listras diagonais no topo e na base, rota grande no
 * centro, faixa inferior com 3 colunas de stats (rótulo em cima, valor embaixo,
 * como no original).
 */
export const rotaFaixa: StoryLayout = {
  id: "rota-faixa",
  label: "Rota + faixa",
  art: R.art,
  requiresRoute: true,
  draw(ctx, data) {
    if (data.photo && !data.transparent) {
      drawCoverImage(ctx, data.photo.image, { x: 0, y: 0, w: STORY_W, h: STORY_H }, data.photo);
    }
    if (!data.transparent) {
      drawScrim(ctx, { x: 0, y: STORY_H - 620, w: STORY_W, h: 620 }, "bottom", 0.85);
    }

    const base = buildArtLayer(
      data.art,
      R.art,
      { mode: "clear", rects: data.logo ? [R.route, ...R.colClears, R.logo] : [R.route, ...R.colClears] },
      data.color,
      data.logo ? [] : [R.logo]
    );
    ctx.drawImage(base, 0, 0);

    const coords = projectRoute(data.routePoints, R.routePlot);
    if (coords) drawRoute(ctx, coords, { color: data.color, clip: clearedBox(R.route) });

    if (data.logo) {
      ctx.drawImage(data.logo, R.logoHiRes.x, R.logoHiRes.y, R.logoHiRes.w, R.logoHiRes.h);
    }

    R.cols.forEach((col, i) => {
      const metric = metricByKey(data.metrics, KEYS[i]);
      if (!metric) return;

      const label = metric.label.toUpperCase();
      const labelFont = (s: number) => `700 ${s}px 'Montserrat', sans-serif`;
      textWithShadow(ctx, label, col.label.x, col.label.y, {
        font: labelFont(fitFontSize(ctx, label, labelFont, R.colMaxW, col.label.size, 18)),
        color: "rgba(255,255,255,0.75)",
        align: "center",
        shadowBlur: 6,
        shadowColor: "rgba(0,0,0,0.45)",
      });

      const value = metric.value + (metric.unit ? ` ${metric.unit}` : "");
      const valueFont = (s: number) => `800 ${s}px 'Montserrat', sans-serif`;
      textWithShadow(ctx, value, col.value.x, col.value.y, {
        font: valueFont(fitFontSize(ctx, value, valueFont, R.colMaxW, col.value.size, 30)),
        align: "center",
        shadowBlur: 6,
        shadowColor: "rgba(0,0,0,0.45)",
      });
    });
  },
};
