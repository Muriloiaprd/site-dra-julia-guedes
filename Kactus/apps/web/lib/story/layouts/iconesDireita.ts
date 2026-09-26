import { buildArtLayer } from "../art";
import { ICONES_DIREITA as R } from "../regions";
import type { StoryLayout } from "../types";
import { drawPhotoAndScrims, drawValueColumn, MONTSERRAT_BOLD } from "./shared";

/**
 * Modelo "1" do usuário: coluna de 4 ícones à direita, na metade de baixo,
 * valor ao lado de cada um e a logo embaixo. Sem rota.
 */
export const iconesDireita: StoryLayout = {
  id: "icones-direita",
  label: "Ícones à direita",
  art: R.art,
  draw(ctx, data) {
    drawPhotoAndScrims(ctx, data, [{ box: { x: 0, y: 900, w: 1080, h: 1020 }, direction: "bottom", strength: 0.75 }]);

    const base = buildArtLayer(data.art, R.art, { mode: "clear", rects: R.valueClears }, data.color, [R.logo]);
    ctx.drawImage(base, 0, 0);

    drawValueColumn(ctx, data, R.values, R.maxW, MONTSERRAT_BOLD);
  },
};
