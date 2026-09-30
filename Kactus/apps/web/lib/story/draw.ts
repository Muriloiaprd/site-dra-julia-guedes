/**
 * Utilitários dos modelos desenhados 100% em código (sem arte do Canva): o
 * dado do treino vira a arte. A "arte" que o gerador carrega para eles é só a
 * logo (`WORDMARK`), que chega em `data.art` e nunca é tingida.
 */
import type { ActivityDetail, ActivityPoint, Split } from "@/lib/api";
import { drawCoverImage, STORY_H, STORY_W } from "./engine";
import type { StoryLayoutData } from "./types";

export const WORDMARK = "/brand/kactus-wordmark.png";
export const DISPLAY = "Montserrat, Inter, sans-serif";
export const SANS = "Inter, sans-serif";
/** Consolas e Courier New vêm com o Windows, onde o app roda. */
export const MONO = "Consolas, 'Courier New', monospace";

export function rgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/**
 * Fundo dos modelos de código. Com foto: a foto + um véu escuro (o dado precisa
 * de contraste). Sem foto: o preto da marca com um brilho suave da cor do esporte.
 * Transparente: nada.
 */
export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  data: StoryLayoutData,
  opts: { veil?: number; glow?: { x: number; y: number; r: number } } = {}
): void {
  if (data.transparent) return;
  if (data.photo) {
    drawCoverImage(ctx, data.photo.image, { x: 0, y: 0, w: STORY_W, h: STORY_H }, data.photo);
    ctx.save();
    ctx.fillStyle = `rgba(6,6,6,${opts.veil ?? 0.55})`;
    ctx.fillRect(0, 0, STORY_W, STORY_H);
    ctx.restore();
    return;
  }
  const g = opts.glow ?? { x: STORY_W / 2, y: STORY_H * 0.45, r: STORY_W };
  const grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
  grad.addColorStop(0, rgba(data.color, 0.13));
  grad.addColorStop(1, rgba(data.color, 0));
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, STORY_W, STORY_H);
  ctx.restore();
}

/** Logo KACTUS com altura `h`, ancorada em (x, y = topo). */
export function drawBrand(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, h: number, align: "left" | "center" | "right" = "center"): void {
  if (!img.width) return;
  const w = (img.width / img.height) * h;
  const left = align === "left" ? x : align === "right" ? x - w : x - w / 2;
  ctx.drawImage(img, left, y, w, h);
}

export function txt(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: { font: string; color?: string; align?: CanvasTextAlign; baseline?: CanvasTextBaseline; tracking?: number; glow?: string; shadow?: boolean }
): number {
  ctx.save();
  ctx.font = opts.font;
  ctx.letterSpacing = `${opts.tracking ?? 0}px`;
  ctx.textAlign = opts.align ?? "left";
  ctx.textBaseline = opts.baseline ?? "alphabetic";
  ctx.fillStyle = opts.color ?? "#fff";
  if (opts.glow) {
    ctx.shadowColor = opts.glow;
    ctx.shadowBlur = 40;
  } else if (opts.shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 2;
  }
  ctx.fillText(text, x, y);
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
}

/** Maior tamanho (até `max`) em que `text` cabe em `width`. */
export function fitSize(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, width: number, max: number, min = 20): number {
  ctx.save();
  let size = max;
  for (; size > min; size -= 4) {
    ctx.font = font(size);
    if (ctx.measureText(text).width <= width) break;
  }
  ctx.restore();
  return size;
}

/** Média móvel simétrica que ignora nulos (o ponto sem dado herda a média dos vizinhos). */
export function smooth(values: (number | null)[], radius: number): (number | null)[] {
  return values.map((_, i) => {
    let sum = 0, n = 0;
    for (let j = Math.max(0, i - radius); j <= Math.min(values.length - 1, i + radius); j++) {
      const v = values[j];
      if (v != null && Number.isFinite(v)) { sum += v; n++; }
    }
    return n ? sum / n : null;
  });
}

export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * p)))];
}

/** Velocidade (m/s) por ponto: a do relógio, ou derivada de distância/tempo. */
export function speedSeries(points: ActivityPoint[]): (number | null)[] {
  return points.map((p, i) => {
    if (p.speed_ms != null) return p.speed_ms;
    const prev = points[i - 1];
    if (!prev || p.distance_m == null || prev.distance_m == null) return null;
    const dt = p.elapsed_time_s - prev.elapsed_time_s;
    return dt > 0 ? (p.distance_m - prev.distance_m) / dt : null;
  });
}

/** Parciais que contam: com ritmo e ao menos 500 m (a sobra final curta distorce o gráfico). */
export function usableSplits(splits: Split[]): Split[] {
  return splits.filter((s) => s.pace_s_per_km != null && s.distance_m >= 500);
}

/** Código de barras feito das parciais: cada km vira um grupo de barras cuja espessura segue o ritmo. */
export function drawBarcode(ctx: CanvasRenderingContext2D, values: number[], box: { x: number; y: number; w: number; h: number }, color: string): void {
  if (!values.length) return;
  const min = Math.min(...values), max = Math.max(...values);
  const norm = values.map((v) => (max > min ? (v - min) / (max - min) : 0.5));
  // cada valor gera 3 barras (grossa, fina, media) para parecer código de verdade
  const bars: number[] = [];
  norm.forEach((n, i) => bars.push(2 + n * 7, 1 + ((i * 7) % 3), 2 + (1 - n) * 5));
  const total = bars.reduce((a, b) => a + b, 0) + bars.length * 3;
  const k = box.w / total;
  ctx.save();
  ctx.fillStyle = color;
  let x = box.x;
  for (const b of bars) {
    ctx.fillRect(x, box.y, b * k, box.h);
    x += (b + 3) * k;
  }
  ctx.restore();
}

export function firstName(name: string | null): string | null {
  const n = name?.trim().split(/\s+/)[0];
  return n ? n.toUpperCase() : null;
}

export const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

export function startDate(a: ActivityDetail): Date {
  return new Date(a.start_time);
}

export function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "29 SET 2026" */
export function dayLabel(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
