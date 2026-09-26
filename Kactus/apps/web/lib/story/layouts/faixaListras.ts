import { buildArtLayer } from "../art";
import { FAIXA_LISTRAS as R } from "../regions";
import type { StoryLayout } from "../types";
import { drawPhotoAndScrims, drawStatBand } from "./shared";

/** Modelo "8" do usuário: listras diagonais no topo e na base, o símbolo da marca e a faixa de 3 colunas. Sem rota. */
export const faixaListras: StoryLayout = {
  id: "faixa-listras",
  label: "Faixa + listras",
  art: R.art,
  draw(ctx, data) {
    drawPhotoAndScrims(ctx, data, [
      { box: { x: 0, y: 1300, w: 1080, h: 620 }, direction: "bottom", strength: 0.85 },
      { box: { x: 0, y: 0, w: 1080, h: 220 }, direction: "top", strength: 0.4 },
    ]);

    const base = buildArtLayer(data.art, R.art, { mode: "clear", rects: R.band.colClears }, data.color, [R.logo]);
    ctx.drawImage(base, 0, 0);

    drawStatBand(ctx, data, R.band);
  },
};
