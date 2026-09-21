import { buildArtLayer, clearedBox } from "../art";
import { drawCoverImage, drawRoute, drawScrim, projectRoute, STORY_H, STORY_W } from "../engine";
import { ROTA_FAIXA as R } from "../regions";
import type { StoryLayout } from "../types";
import { drawStatBand } from "./shared";

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

    drawStatBand(ctx, data, R);
  },
};
