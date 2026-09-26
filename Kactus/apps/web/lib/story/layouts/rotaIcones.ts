import { buildArtLayer, clearedBox } from "../art";
import { drawRoute, projectRoute } from "../engine";
import { ROTA_ICONES as R } from "../regions";
import type { StoryLayout } from "../types";
import { drawPhotoAndScrims, drawValueColumn, MONTSERRAT_BOLD } from "./shared";

/**
 * Modelo "14" do usuário: coluna de ícones com o valor de cada métrica no meio
 * da arte, rota pequena embaixo à direita e a logo na diagonal embaixo à
 * esquerda. O topo fica livre pra foto.
 */
export const rotaIcones: StoryLayout = {
  id: "rota-icones",
  label: "Rota + ícones",
  art: R.art,
  requiresRoute: true,
  draw(ctx, data) {
    drawPhotoAndScrims(ctx, data, [
      { box: { x: 0, y: 500, w: 1080, h: 720 }, direction: "flat", strength: 0.4 },
      { box: { x: 0, y: 1220, w: 1080, h: 700 }, direction: "bottom", strength: 0.75 },
    ]);

    const base = buildArtLayer(
      data.art,
      R.art,
      { mode: "clear", rects: [R.route, ...R.valueClears] },
      data.color,
      [R.logo]
    );
    ctx.drawImage(base, 0, 0);

    const coords = projectRoute(data.routePoints, R.routePlot);
    if (coords) drawRoute(ctx, coords, { color: data.color, clip: clearedBox(R.route) });

    drawValueColumn(ctx, data, R.values, R.maxW, MONTSERRAT_BOLD);
  },
};
