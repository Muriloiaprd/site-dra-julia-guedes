import { sportLabel } from "@/lib/utils";
import { buildArtLayer } from "../art";
import { fitFontSize, textWithShadow } from "../engine";
import { metricByKey } from "../metrics";
import { DESAFIO as R } from "../regions";
import type { StoryLayout } from "../types";
import { drawPhotoAndScrims } from "./shared";

const KEYS = ["duration", "pace", "distance"] as const;

/**
 * Modelo "17" do usuário: título gigante em 2 linhas, listras no topo, 3
 * valores com rótulo embaixo, logo em badge preto e xadrez na base. Título e
 * valores na cor do esporte, com o espaçamento aberto da arte.
 */
export const desafio: StoryLayout = {
  id: "desafio",
  label: "Desafio",
  art: R.art,
  draw(ctx, data) {
    drawPhotoAndScrims(ctx, data, [{ box: { x: 0, y: 900, w: 1080, h: 1020 }, direction: "bottom", strength: 0.9 }]);

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

    const titleFont = (s: number) => `900 ${s}px 'Montserrat', sans-serif`;
    lines.forEach((line, i) => {
      if (!line) return;
      const slot = R.title[i];
      const size = fitFontSize(ctx, line, titleFont, slot.maxW, slot.size, 40, R.tracking);
      textWithShadow(ctx, line, slot.x, slot.y, {
        font: titleFont(size),
        letterSpacing: size * R.tracking,
        color: data.color,
        shadowBlur: 0,
        shadowOffset: { x: 0, y: 0 },
      });
    });

    R.cols.forEach((col, i) => {
      const metric = metricByKey(data.metrics, KEYS[i]);
      if (!metric) return;
      const value = metric.value + (metric.unit ?? "");
      const valueFont = (s: number) => `900 ${s}px 'Montserrat', sans-serif`;
      const size = fitFontSize(ctx, value, valueFont, R.colMaxW, col.value.size, 34, R.tracking);
      textWithShadow(ctx, value, col.value.x, col.value.y, {
        font: valueFont(size),
        letterSpacing: size * R.tracking,
        color: data.color,
        shadowBlur: 0,
        shadowOffset: { x: 0, y: 0 },
      });

      const label = metric.label.toUpperCase();
      const labelFont = (s: number) => `400 ${s}px 'Inter', sans-serif`;
      textWithShadow(ctx, label, col.label.x, col.label.y, {
        font: labelFont(fitFontSize(ctx, label, labelFont, R.colMaxW, col.label.size, 20)),
        shadowBlur: 0,
        shadowOffset: { x: 0, y: 0 },
      });
    });
  },
};
