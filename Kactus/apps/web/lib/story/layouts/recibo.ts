import type { Split } from "@/lib/api";
import { activeSeconds, distanceParts, formatClock, formatDuration, formatPaceShort, isBikeSport } from "@/lib/utils";
import { STORY_H, STORY_W } from "../engine";
import { DISPLAY, drawBackdrop, drawBarcode, firstName, hhmm, MONO, startDate, usableSplits, WORDMARK } from "../draw";
import type { StoryLayout } from "../types";

const PAPER = "#F4F1EA";
const INK = "#1A1A1A";
const W = 760; // largura do papel
const PAD = 44;
const TOOTH = 22; // serrilhado das bordas

type Row =
  | { kind: "text"; text: string; size: number; weight?: number; align?: "left" | "center"; font?: string; gap: number }
  | { kind: "pair"; left: string; right: string; size: number; weight?: number; gap: number }
  | { kind: "dots"; left: string; right: string; size: number; weight?: number; gap: number }
  | { kind: "rule"; gap: number }
  | { kind: "barcode"; values: number[]; h: number; gap: number };

/** Itens do cupom: um por km; acima de 16, agrupa de 5 em 5 (e de 10 em 10 acima de 80). */
function items(splits: Split[]): { label: string; value: string }[] {
  if (splits.length <= 16) {
    // trecho final incompleto mostra a distancia, senao "KM 03 ... 8:49" parece um km lento
    return splits.map((s) => ({
      label: `KM ${String(s.index).padStart(2, "0")}${s.distance_m < 950 ? ` (${(s.distance_m / 1000).toFixed(2).replace(".", ",")})` : ""}`,
      value: formatClock(s.duration_s),
    }));
  }
  const size = splits.length > 80 ? 10 : 5;
  const out: { label: string; value: string }[] = [];
  for (let i = 0; i < splits.length; i += size) {
    const g = splits.slice(i, i + size);
    const a = String(g[0].index).padStart(2, "0"), b = String(g[g.length - 1].index).padStart(2, "0");
    out.push({ label: `KM ${a}-${b}`, value: formatClock(g.reduce((s, x) => s + x.duration_s, 0)) });
  }
  return out;
}

/**
 * "Recibo": o treino como cupom fiscal. Cada km é um item, o total é a
 * distância, o troco são zero desculpas. Anti-estética de propósito: é o
 * formato que mais se repassa. Desenhado numa camada própria para o serrilhado
 * sair transparente de verdade (sobre foto ou em PNG transparente).
 */
export const recibo: StoryLayout = {
  id: "recibo",
  label: "Recibo",
  art: WORDMARK,
  isNew: true,
  available: ({ splits }) => usableSplits(splits).length >= 1,
  draw(ctx, data) {
    const { activity: a } = data;
    const bike = isBikeSport(a.sport);
    const splits = usableSplits(data.splits);
    const d = startDate(a);
    const dist = distanceParts(a.distance_m);
    const name = firstName(data.athleteName);

    const rows: Row[] = [
      { kind: "text", text: "KACTUS", size: 76, weight: 900, align: "center", font: DISPLAY, gap: 18 },
      { kind: "text", text: "CUPOM DO TREINO", size: 30, weight: 700, align: "center", gap: 8 },
      { kind: "text", text: "CNPJ 42.195.000/0001-42", size: 24, align: "center", gap: 6 },
      { kind: "text", text: `${d.toLocaleDateString("pt-BR")}   ${hhmm(d)}`, size: 26, align: "center", gap: name ? 6 : 26 },
      ...(name ? [{ kind: "text" as const, text: `ATLETA: ${name}`, size: 26, align: "center" as const, gap: 26 }] : []),
      { kind: "rule", gap: 22 },
      { kind: "pair", left: "ITEM", right: "TEMPO", size: 26, weight: 700, gap: 16 },
      ...items(splits).map((it) => ({ kind: "dots" as const, left: it.label, right: it.value, size: 29, gap: 8 })),
      { kind: "rule", gap: 22 },
      { kind: "pair", left: "TOTAL", right: `${dist.value} ${dist.unit}`, size: 46, weight: 700, gap: 14 },
      { kind: "dots", left: "TEMPO", right: formatDuration(activeSeconds(a)), size: 29, gap: 8 },
    ];
    const pace = bike
      ? a.avg_speed_kmh != null ? `${a.avg_speed_kmh.toFixed(1)} km/h` : null
      : a.avg_pace_s_per_km != null ? `${formatPaceShort(a.avg_pace_s_per_km)}/km` : null;
    if (pace) rows.push({ kind: "dots", left: bike ? "VELOCIDADE" : "RITMO", right: pace, size: 29, gap: 8 });
    if (a.avg_hr != null) rows.push({ kind: "dots", left: "FC MÉDIA", right: `${a.avg_hr} bpm`, size: 29, gap: 8 });
    if ((a.elevation_gain_m ?? 0) > 0) rows.push({ kind: "dots", left: "SUBIDA", right: `+${Math.round(a.elevation_gain_m!)} m`, size: 29, gap: 8 });
    if (a.calories) rows.push({ kind: "dots", left: "CALORIAS", right: `${a.calories} kcal`, size: 29, gap: 8 });
    rows.push(
      { kind: "rule", gap: 22 },
      { kind: "dots", left: "PAGAMENTO", right: "SUOR", size: 29, gap: 8 },
      { kind: "dots", left: "TROCO", right: "0 DESCULPAS", size: 29, gap: 26 },
      { kind: "barcode", values: splits.map((s) => s.pace_s_per_km!), h: 96, gap: 22 },
      { kind: "text", text: "VOLTE SEMPRE", size: 34, weight: 700, align: "center", gap: 6 },
      { kind: "text", text: "kactus · corrida sem limites", size: 24, align: "center", gap: 0 },
    );

    const rowH = (r: Row) => (r.kind === "rule" ? 4 : r.kind === "barcode" ? r.h : r.size * 1.15);
    const contentH = rows.reduce((s, r) => s + rowH(r) + r.gap, 0);
    const H = contentH + PAD * 2 + TOOTH * 2;

    // papel numa camada propria (o serrilhado precisa ser transparente)
    const layer = document.createElement("canvas");
    layer.width = W;
    layer.height = Math.ceil(H);
    const p = layer.getContext("2d")!;
    p.fillStyle = PAPER;
    p.beginPath();
    p.moveTo(0, TOOTH);
    for (let x = 0; x < W; x += TOOTH * 2) { p.lineTo(x + TOOTH, 0); p.lineTo(Math.min(W, x + TOOTH * 2), TOOTH); }
    p.lineTo(W, H - TOOTH);
    for (let x = W; x > 0; x -= TOOTH * 2) { p.lineTo(x - TOOTH, H); p.lineTo(Math.max(0, x - TOOTH * 2), H - TOOTH); }
    p.closePath();
    p.fill();
    // textura sutil de papel termico
    p.globalCompositeOperation = "source-atop";
    const shade = p.createLinearGradient(0, 0, W, 0);
    shade.addColorStop(0, "rgba(0,0,0,0.05)");
    shade.addColorStop(0.5, "rgba(0,0,0,0)");
    shade.addColorStop(1, "rgba(0,0,0,0.06)");
    p.fillStyle = shade;
    p.fillRect(0, 0, W, H);
    p.globalCompositeOperation = "source-over";

    p.fillStyle = INK;
    p.textBaseline = "top";
    let y = TOOTH + PAD;
    const inner = W - PAD * 2;
    for (const r of rows) {
      if (r.kind === "rule") {
        p.save();
        p.strokeStyle = INK;
        p.lineWidth = 3;
        p.setLineDash([12, 9]);
        p.beginPath(); p.moveTo(PAD, y + 2); p.lineTo(W - PAD, y + 2); p.stroke();
        p.restore();
      } else if (r.kind === "barcode") {
        drawBarcode(p, r.values, { x: PAD + 30, y, w: inner - 60, h: r.h }, INK);
      } else if (r.kind === "text") {
        p.font = `${r.weight ?? 400} ${r.size}px ${r.font ?? MONO}`;
        p.textAlign = r.align ?? "left";
        p.letterSpacing = r.font ? "4px" : "1px";
        p.fillText(r.text, r.align === "center" ? W / 2 : PAD, y);
        p.letterSpacing = "0px";
      } else {
        p.font = `${r.weight ?? 400} ${r.size}px ${MONO}`;
        p.textAlign = "left";
        p.fillText(r.left, PAD, y);
        p.textAlign = "right";
        p.fillText(r.right, W - PAD, y);
        if (r.kind === "dots") {
          const lw = p.measureText(r.left).width, rw = p.measureText(r.right).width;
          const dot = p.measureText(".").width;
          const n = Math.max(0, Math.floor((inner - lw - rw - dot * 2) / dot));
          p.textAlign = "left";
          p.fillStyle = "rgba(26,26,26,0.45)";
          p.fillText(" " + ".".repeat(n), PAD + lw, y);
          p.fillStyle = INK;
        }
      }
      y += rowH(r) + r.gap;
    }

    // cena: fundo, sombra e o papel levemente girado; encolhe se o cupom for comprido
    drawBackdrop(ctx, data, { veil: 0.35, glow: { x: 540, y: 960, r: 900 } });
    const maxH = STORY_H - 220;
    const scale = Math.min(1, maxH / H);
    ctx.save();
    ctx.translate(STORY_W / 2, STORY_H / 2);
    ctx.rotate((-2.5 * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 18;
    ctx.drawImage(layer, -W / 2, -H / 2);
    ctx.restore();
    layer.width = layer.height = 1;
  },
};
