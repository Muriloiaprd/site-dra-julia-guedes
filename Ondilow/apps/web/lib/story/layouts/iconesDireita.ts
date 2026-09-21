import { buildArtLayer } from "../art";
import { ICONES_DIREITA as R } from "../regions";
import type { StoryLayout } from "../types";
import { drawHiResLogo, drawPhotoAndScrims, drawValueColumn } from "./shared";

/**
 * Modelo "1" do usuário: espelho do 3 — coluna de 4 ícones à direita, na
 * metade de baixo, valor ao lado de cada um e a logo embaixo. Sem rota.
 */
export const iconesDireita: StoryLayout = {
  id: "icones-direita",
  label: "Ícones à direita",
  art: R.art,
  draw(ctx, data) {
    drawPhotoAndScrims(ctx, data, [{ box: { x: 0, y: 900, w: 1080, h: 1020 }, direction: "bottom", strength: 0.75 }]);

    const base = buildArtLayer(
      data.art,
      R.art,
      { mode: "clear", rects: data.logo ? [...R.valueClears, R.logo] : R.valueClears },
      data.color,
      data.logo ? [] : [R.logo]
    );
    ctx.drawImage(base, 0, 0);
    drawHiResLogo(ctx, data, R.logoHiRes);

    drawValueColumn(ctx, data, R.values, R.maxW);
  },
};
