import { buildArtLayer, clearedBox } from "../art";
import { drawRoute, projectRoute } from "../engine";
import { ROTA_GRANDE as R } from "../regions";
import type { StoryLayout } from "../types";
import { drawPhotoAndScrims } from "./shared";

/**
 * Modelo "19" do usuário: só a rota, ocupando quase a arte inteira, e a logo
 * grande embaixo. Não mostra métricas — é o traçado que conta a história.
 */
export const rotaGrande: StoryLayout = {
  id: "rota-grande",
  label: "Rota grande",
  art: R.art,
  requiresRoute: true,
  draw(ctx, data) {
    drawPhotoAndScrims(ctx, data, [{ box: { x: 0, y: 0, w: 1080, h: 1920 }, direction: "flat", strength: 0.35 }]);

    const base = buildArtLayer(data.art, R.art, { mode: "clear", rects: [R.route] }, data.color, [R.logo]);
    ctx.drawImage(base, 0, 0);

    const coords = projectRoute(data.routePoints, R.routePlot);
    if (coords) drawRoute(ctx, coords, { color: data.color, lineWidth: 12, clip: clearedBox(R.route) });
  },
};
