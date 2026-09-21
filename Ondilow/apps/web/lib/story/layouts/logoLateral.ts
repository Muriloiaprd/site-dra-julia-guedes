import { buildArtLayer } from "../art";
import { LOGO_LATERAL as R } from "../regions";
import type { StoryLayout } from "../types";
import { drawPhotoAndScrims, drawValueColumn } from "./shared";

/**
 * Modelo "4" do usuário: logo vertical num badge preto colado na borda
 * direita, 4 ícones pequenos na base à esquerda com os valores ao lado,
 * listras nos cantos. Sem rota.
 */
export const logoLateral: StoryLayout = {
  id: "logo-lateral",
  label: "Logo lateral",
  art: R.art,
  draw(ctx, data) {
    drawPhotoAndScrims(ctx, data, [{ box: { x: 0, y: 1050, w: 1080, h: 870 }, direction: "bottom", strength: 0.75 }]);

    const base = buildArtLayer(data.art, R.art, { mode: "clear", rects: R.valueClears }, data.color, [R.badge]);
    ctx.drawImage(base, 0, 0);

    drawValueColumn(ctx, data, R.values, R.maxW);
  },
};
