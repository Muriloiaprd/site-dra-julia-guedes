import { buildArtLayer } from "../art";
import { LOGO_LATERAL as R } from "../regions";
import type { StoryLayout } from "../types";
import { drawPhotoAndScrims, drawValueColumn, INTER_BOLD } from "./shared";

/**
 * Modelo "4" do usuário: logo vertical colada na borda direita (sem a faixa
 * preta da arte original, a pedido do usuário), 4 ícones pequenos na base à
 * esquerda com os valores ao lado, listras nos cantos. Sem rota.
 */
export const logoLateral: StoryLayout = {
  id: "logo-lateral",
  label: "Logo lateral",
  // conteúdo de cima a baixo do Story: no 4:5 ficaria pequeno demais
  feed: false,
  art: R.art,
  draw(ctx, data) {
    drawPhotoAndScrims(ctx, data, [
      { box: { x: 0, y: 1050, w: 1080, h: 870 }, direction: "bottom", strength: 0.75 },
      // a logo branca fica direto na foto: escurece a borda direita pra ela ler em foto clara
      { box: { x: 820, y: 0, w: 260, h: 700 }, direction: "right", strength: 0.6 },
    ]);

    const base = buildArtLayer(data.art, R.art, { mode: "clear", rects: R.valueClears }, data.color, [R.badge]);
    ctx.drawImage(base, 0, 0);

    drawValueColumn(ctx, data, R.values, R.maxW, INTER_BOLD);
  },
};
