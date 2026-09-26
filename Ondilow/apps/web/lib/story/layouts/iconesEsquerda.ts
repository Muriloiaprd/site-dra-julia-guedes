import { buildArtLayer } from "../art";
import { ICONES_ESQUERDA as R } from "../regions";
import type { StoryLayout } from "../types";
import { drawPhotoAndScrims, drawValueColumn, INTER_BOLD } from "./shared";

/**
 * Modelo "2" do usuário: 4 ícones grandes empilhados à esquerda, cada um com o
 * valor da métrica ao lado, logo grande embaixo. Sem rota — funciona mesmo
 * sem GPS.
 */
export const iconesEsquerda: StoryLayout = {
  id: "icones-esquerda",
  label: "Ícones à esquerda",
  art: R.art,
  draw(ctx, data) {
    drawPhotoAndScrims(ctx, data, [
      { box: { x: 0, y: 180, w: 1080, h: 1260 }, direction: "flat", strength: 0.35 },
      { box: { x: 0, y: 1420, w: 1080, h: 500 }, direction: "bottom", strength: 0.6 },
    ]);

    const base = buildArtLayer(data.art, R.art, { mode: "clear", rects: R.valueClears }, data.color, [R.logo]);
    ctx.drawImage(base, 0, 0);

    drawValueColumn(ctx, data, R.values, R.maxW, INTER_BOLD);
  },
};
