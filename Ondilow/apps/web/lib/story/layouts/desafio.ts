import { sportLabel } from "@/lib/utils";
import { buildArtLayer } from "../art";
import { drawCoverImage, drawScrim, fitFontSize, STORY_H, STORY_W, textWithShadow } from "../engine";
import { metricByKey } from "../metrics";
import { DESAFIO as R } from "../regions";
import type { StoryLayout } from "../types";

const KEYS = ["duration", "pace", "distance"] as const;

/**
 * Modelo "16" do usuário: título gigante em 2 linhas, listras no topo, 3
 * valores com rótulo embaixo, logo em badge preto e xadrez na base. A logo aqui
 * é a variante monocromática dentro do badge, então não recebe o arquivo
 * colorido de alta resolução.
 */
export const desafio: StoryLayout = {
  id: "desafio",
  label: "Desafio",
  art: R.art,
  draw(ctx, data) {
    if (data.photo && !data.transparent) {
      drawCoverImage(ctx, data.photo.image, { x: 0, y: 0, w: STORY_W, h: STORY_H }, data.photo);
    }
    if (!data.transparent) {
      drawScrim(ctx, { x: 0, y: 900, w: STORY_W, h: STORY_H - 900 }, "bottom", 0.9);
    }

    const base = buildArtLayer(
      data.art,
      R.art,
      { mode: "clear", rects: [...R.titleClears, ...R.colClears] },
      data.color,
      [R.logo]
    );
    ctx.drawImage(base, 0, 0);

    const title = (data.activity.title ?? sportLabel(data.activity.sport)).toUpperCase();
    const words = title.split(" ");
    const mid = Math.ceil(words.length / 2);
    const lines = [words.slice(0, mid).join(" ") || title, words.slice(mid).join(" ")];

    ctx.save();
    ctx.textAlign = "left";
    ctx.fillStyle = data.color;
    lines.forEach((line, i) => {
      if (!line) return;
      const slot = R.title[i];
      const fontAt = (size: number) => `900 ${size}px 'Montserrat', sans-serif`;
      ctx.font = fontAt(fitFontSize(ctx, line, fontAt, slot.maxW, slot.size, 40));
      ctx.fillText(line, slot.x, slot.y);
    });
    ctx.restore();

    R.cols.forEach((col, i) => {
      const metric = metricByKey(data.metrics, KEYS[i]);
      if (!metric) return;
      const value = metric.value + (metric.unit ?? "");
      const valueFont = (s: number) => `800 ${s}px 'Montserrat', sans-serif`;
      ctx.save();
      ctx.font = valueFont(fitFontSize(ctx, value, valueFont, R.colMaxW, col.value.size, 34));
      ctx.textAlign = "left";
      ctx.fillStyle = data.color;
      ctx.fillText(value, col.value.x, col.value.y);
      ctx.restore();

      const label = metric.label.toUpperCase();
      const labelFont = (s: number) => `700 ${s}px 'Montserrat', sans-serif`;
      textWithShadow(ctx, label, col.label.x, col.label.y, {
        font: labelFont(fitFontSize(ctx, label, labelFont, R.colMaxW, col.label.size, 20)),
        color: "#fff",
        shadowBlur: 0,
      });
    });
  },
};
