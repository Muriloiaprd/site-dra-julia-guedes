import { buildArtLayer } from "../art";
import { BANDEIRAS as R } from "../regions";
import type { StoryLayout } from "../types";
import { drawPhotoAndScrims, drawStatBand } from "./shared";

/** Modelo "12" do usuário: bandeiras de chegada cruzadas sobre a faixa de 3 colunas e a logo embaixo. Sem rota. */
export const bandeiras: StoryLayout = {
  id: "bandeiras",
  label: "Bandeiras",
  art: R.art,
  draw(ctx, data) {
    drawPhotoAndScrims(ctx, data, [{ box: { x: 0, y: 1250, w: 1080, h: 670 }, direction: "bottom", strength: 0.85 }]);

    const base = buildArtLayer(data.art, R.art, { mode: "clear", rects: R.band.colClears }, data.color, [R.logo]);
    ctx.drawImage(base, 0, 0);

    drawStatBand(ctx, data, R.band);
  },
};
