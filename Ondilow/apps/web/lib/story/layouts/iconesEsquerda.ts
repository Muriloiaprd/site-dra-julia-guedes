import { buildArtLayer } from "../art";
import { drawCoverImage, drawScrim, STORY_H, STORY_W, textWithShadow } from "../engine";
import { metricByKey } from "../metrics";
import { ICONES_ESQUERDA as R } from "../regions";
import type { StoryLayout } from "../types";

const KEYS = ["distance", "duration", "pace", "elevation"] as const;

/**
 * Modelo "3" do usuário: coluna de 4 ícones empilhados à esquerda, cada um com
 * o valor da métrica ao lado, logo embaixo. Sem rota — funciona mesmo sem GPS.
 */
export const iconesEsquerda: StoryLayout = {
  id: "icones-esquerda",
  label: "Ícones à esquerda",
  art: R.art,
  draw(ctx, data) {
    if (data.photo && !data.transparent) {
      drawCoverImage(ctx, data.photo.image, { x: 0, y: 0, w: STORY_W, h: STORY_H }, data.photo);
    }
    if (!data.transparent) {
      drawScrim(ctx, { x: 0, y: 0, w: 700, h: STORY_H }, "top", 0.35);
      drawScrim(ctx, { x: 0, y: STORY_H - 500, w: STORY_W, h: 500 }, "bottom", 0.6);
    }

    // a logo embutida é apagada e substituída pela de alta resolução — apagar
    // antes é o que garante que não sobre fantasma da antiga por baixo
    const base = buildArtLayer(
      data.art,
      R.art,
      { mode: "clear", rects: data.logo ? [...R.valueClears, R.logo] : R.valueClears },
      data.color,
      data.logo ? [] : [R.logo]
    );
    ctx.drawImage(base, 0, 0);

    if (data.logo) {
      ctx.drawImage(data.logo, R.logoHiRes.x, R.logoHiRes.y, R.logoHiRes.w, R.logoHiRes.h);
    }

    R.values.forEach((slot, i) => {
      const metric = metricByKey(data.metrics, KEYS[i]);
      if (!metric) return;
      textWithShadow(ctx, metric.value + (metric.unit ? ` ${metric.unit}` : ""), slot.x, slot.y, {
        font: `800 ${slot.size}px 'Montserrat', sans-serif`,
        shadowBlur: 8,
        shadowColor: "rgba(0,0,0,0.45)",
      });
    });
  },
};
