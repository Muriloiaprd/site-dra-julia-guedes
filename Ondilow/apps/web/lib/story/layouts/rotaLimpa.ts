import { buildArtLayer, clearedBox } from "../art";
import { drawRoute, projectRoute } from "../engine";
import { ROTA_LIMPA as R } from "../regions";
import type { StoryLayout } from "../types";
import { drawHiResLogo, drawPhotoAndScrims, drawStatBand } from "./shared";

/** Modelo "5" do usuário: o 7 sem as listras — rota grande e a faixa de 3 colunas. */
export const rotaLimpa: StoryLayout = {
  id: "rota-limpa",
  label: "Rota limpa",
  art: R.art,
  requiresRoute: true,
  draw(ctx, data) {
    drawPhotoAndScrims(ctx, data, [{ box: { x: 0, y: 1300, w: 1080, h: 620 }, direction: "bottom", strength: 0.85 }]);

    const clears = [R.route, ...R.band.colClears];
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
    drawStatBand(ctx, data, R.band);
  },
};
