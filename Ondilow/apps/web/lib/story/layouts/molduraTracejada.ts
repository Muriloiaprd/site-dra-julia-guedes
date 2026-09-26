import { buildArtLayer } from "../art";
import { fitFontSize } from "../engine";
import { metricByKey, type StoryMetric } from "../metrics";
import { MOLDURA_TRACEJADA as R } from "../regions";
import type { StoryLayout } from "../types";
import { CONDENSED, drawPhotoAndScrims, squeezedText } from "./shared";

/** Ícone de cada linha na arte: símbolo da marca → tempo, alfinete → distância, cronômetro → ritmo. */
const KEYS = ["duration", "distance", "pace"] as const;

/**
 * Como na arte, unidade em caixa alta e colada: "5,10KM". O ritmo por km sai
 * na notação de corrida (5'40"); velocidade de ciclismo fica em KM/H. O tempo
 * não tem unidade e fica como vem ("3m50s") — em caixa alta virava "3M50S".
 */
function frameText(metric: StoryMetric): string {
  if (metric.key === "pace" && metric.unit === "/km") {
    const [min, sec] = metric.value.split(":");
    if (sec !== undefined) return `${min}'${sec}"`;
  }
  return metric.value + (metric.unit ? metric.unit.toUpperCase() : "");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/**
 * Modelo "16" do usuário: moldura de linhas tracejadas, três linhas de ícone
 * + valor em fonte condensada e a data da atividade embaixo. Os ícones são
 * brancos na arte — o recolor por esporte não mexe neles (saturação zero),
 * só nas linhas tracejadas.
 */
export const molduraTracejada: StoryLayout = {
  id: "moldura-tracejada",
  label: "Moldura",
  art: R.art,
  draw(ctx, data) {
    drawPhotoAndScrims(ctx, data, [{ box: { x: 0, y: 300, w: 1080, h: 1320 }, direction: "flat", strength: 0.45 }]);

    const base = buildArtLayer(
      data.art,
      R.art,
      { mode: "clear", rects: [...R.valueClears, R.dateClear] },
      data.color,
      [R.logo]
    );
    ctx.drawImage(base, 0, 0);

    const font = (s: number) => `${s}px ${CONDENSED}`;
    R.values.forEach((slot, i) => {
      const metric = metricByKey(data.metrics, KEYS[i]);
      if (!metric) return;
      const text = frameText(metric);
      squeezedText(ctx, text, slot.x, slot.y, R.squeeze, {
        font: font(fitFontSize(ctx, text, font, R.maxW / R.squeeze, slot.size, 60)),
        shadowBlur: 12,
        shadowColor: "rgba(0,0,0,0.5)",
      });
    });

    const date = formatDate(data.activity.start_time);
    squeezedText(ctx, date, R.date.x, R.date.y, R.squeeze, {
      font: font(fitFontSize(ctx, date, font, 700 / R.squeeze, R.date.size, 60)),
      align: "center",
      shadowBlur: 12,
      shadowColor: "rgba(0,0,0,0.5)",
    });
  },
};
