import { buildArtLayer } from "../art";
import { FAIXA_SIMPLES as R } from "../regions";
import type { StoryLayout } from "../types";
import { drawPhotoAndScrims, drawStatBand } from "./shared";

/**
 * Modelo "6" do usuário: só a faixa de 3 colunas e o símbolo da marca em cima
 * dela — deixa a foto inteira à mostra. Sem rota.
 */
export const faixaSimples: StoryLayout = {
  id: "faixa-simples",
  label: "Só a faixa",
  art: R.art,
  draw(ctx, data) {
    drawPhotoAndScrims(ctx, data, [{ box: { x: 0, y: 1350, w: 1080, h: 570 }, direction: "bottom", strength: 0.85 }]);

    const base = buildArtLayer(data.art, R.art, { mode: "clear", rects: R.band.colClears }, data.color, [R.logo]);
    ctx.drawImage(base, 0, 0);

    drawStatBand(ctx, data, R.band);
  },
};
