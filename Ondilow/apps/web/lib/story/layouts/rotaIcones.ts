import { buildArtLayer } from "../art";
import { drawCoverImage, drawRoute, drawScrim, projectRoute, STORY_H, STORY_W, textWithShadow } from "../engine";
import { metricByKey } from "../metrics";
import { ROTA_ICONES as R } from "../regions";
import type { StoryLayout } from "../types";

const KEYS = ["distance", "duration", "pace", "elevation"] as const;

/**
 * Modelo "13" do usuário: rota grande à esquerda, coluna de ícones à direita
 * com o valor de cada métrica. A rota de exemplo é apagada inteira (os ícones
 * ficam dentro da caixa dela, então saem junto) e os ícones voltam por cima do
 * traçado novo — assim a rota ocupa toda a área que o modelo reservou.
 */
export const rotaIcones: StoryLayout = {
  id: "rota-icones",
  label: "Rota + ícones",
  art: R.art,
  requiresRoute: true,
  draw(ctx, data) {
    if (data.photo && !data.transparent) {
      drawCoverImage(ctx, data.photo.image, { x: 0, y: 0, w: STORY_W, h: STORY_H }, data.photo);
    }
    if (!data.transparent) {
      drawScrim(ctx, { x: 0, y: 1150, w: STORY_W, h: STORY_H - 1150 }, "bottom", 0.75);
      drawScrim(ctx, { x: 0, y: 0, w: STORY_W, h: 200 }, "top", 0.45);
    }

    const base = buildArtLayer(
      data.art,
      R.art,
      { mode: "clear", rects: [R.route, ...R.valueClears] },
      data.color,
      [R.logo]
    );
    ctx.drawImage(base, 0, 0);

    const coords = projectRoute(data.routePoints, R.route);
    if (coords) drawRoute(ctx, coords, { color: data.color });

    const icons = buildArtLayer(data.art, `${R.art}#icons`, { mode: "keep", rects: R.icons }, data.color);
    ctx.drawImage(icons, 0, 0);

    R.values.forEach((slot, i) => {
      const metric = metricByKey(data.metrics, KEYS[i]);
      if (!metric) return;
      textWithShadow(ctx, metric.value + (metric.unit ? ` ${metric.unit}` : ""), slot.x, slot.y, {
        font: `800 ${slot.size}px 'Montserrat', sans-serif`,
        shadowBlur: 6,
        shadowColor: "rgba(0,0,0,0.45)",
      });
    });
  },
};
