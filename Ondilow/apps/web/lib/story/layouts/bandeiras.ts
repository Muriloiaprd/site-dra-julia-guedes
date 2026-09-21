import { buildArtLayer } from "../art";
import { BANDEIRAS as R } from "../regions";
import type { StoryLayout } from "../types";
import { drawHiResLogo, drawPhotoAndScrims, drawStatBand } from "./shared";

/** Modelo "11" do usuário: bandeiras de chegada cruzadas sobre a faixa de 3 colunas. Sem rota. */
export const bandeiras: StoryLayout = {
  id: "bandeiras",
  label: "Bandeiras",
  art: R.art,
  draw(ctx, data) {
    drawPhotoAndScrims(ctx, data, [{ box: { x: 0, y: 1250, w: 1080, h: 670 }, direction: "bottom", strength: 0.85 }]);

    const base = buildArtLayer(
      data.art,
      R.art,
      { mode: "clear", rects: data.logo ? [...R.band.colClears, R.logo] : R.band.colClears },
      data.color,
      data.logo ? [] : [R.logo]
    );
    ctx.drawImage(base, 0, 0);

    drawHiResLogo(ctx, data, R.logoHiRes);
    drawStatBand(ctx, data, R.band);
  },
};
