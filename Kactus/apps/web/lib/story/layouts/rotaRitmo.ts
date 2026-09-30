import { activeSeconds, distanceParts, formatDuration, formatPaceShort, isBikeSport } from "@/lib/utils";
import { projectRoute } from "../engine";
import { dayLabel, DISPLAY, drawBackdrop, drawBrand, percentile, rgba, SANS, smooth, speedSeries, startDate, txt, WORDMARK } from "../draw";
import type { StoryLayout } from "../types";

const ROUTE_BOX = { x: 90, y: 640, w: 900, h: 860 };
const SLOW = "#2563EB";
const FAST = "#FF6A00";

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 0 = lento (azul), 0.5 = cor do esporte, 1 = rapido (laranja). */
function ramp(t: number, mid: string): string {
  const [a, b, u] = t < 0.5 ? [hexRgb(SLOW), hexRgb(mid), t / 0.5] : [hexRgb(mid), hexRgb(FAST), (t - 0.5) / 0.5];
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * u));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/**
 * "Rota pelo ritmo": o traçado colorido pela velocidade (lento → cor do esporte →
 * rápido), como telemetria de corrida, com marcadores de km e a legenda com os
 * ritmos reais das pontas.
 */
export const rotaRitmo: StoryLayout = {
  id: "rota-ritmo",
  label: "Rota pelo ritmo",
  art: WORDMARK,
  isNew: true,
  available: ({ activity, routePoints }) =>
    routePoints.length >= 30 && activity.points.some((p) => p.speed_ms != null || p.distance_m != null),
  draw(ctx, data) {
    const { activity: a, color } = data;
    const bike = isBikeSport(a.sport);
    drawBackdrop(ctx, data, { veil: 0.6, glow: { x: 540, y: 1070, r: 800 } });

    // topo
    const avg = bike
      ? a.avg_speed_kmh != null ? { v: a.avg_speed_kmh.toFixed(1).replace(".", ","), u: " km/h", l: "VELOCIDADE MÉDIA" } : null
      : a.avg_pace_s_per_km != null ? { v: formatPaceShort(a.avg_pace_s_per_km), u: " /km", l: "RITMO MÉDIO" } : null;
    if (avg) {
      txt(ctx, avg.l, 540, 250, { font: `600 30px ${SANS}`, color: "rgba(255,255,255,0.72)", align: "center", tracking: 6, shadow: true });
      ctx.save();
      ctx.font = `900 230px ${DISPLAY}`;
      const vw = ctx.measureText(avg.v).width;
      ctx.font = `800 60px ${DISPLAY}`;
      const uw = ctx.measureText(avg.u).width;
      ctx.restore();
      const x = 540 - (vw + uw) / 2;
      txt(ctx, avg.v, x, 500, { font: `900 230px ${DISPLAY}`, color: "#fff", tracking: -6, shadow: true });
      txt(ctx, avg.u, x + vw, 500, { font: `800 60px ${DISPLAY}`, color, shadow: true });
    }

    // pontos com GPS + velocidade suavizada, reduzidos a ~1200
    const all = a.points;
    // janela larga (~0,3% do treino, minimo 15 pontos): senao a cor pisca a cada passo e o traço parece tracejado
    const speeds = smooth(speedSeries(all), Math.max(15, Math.round(all.length / 300)));
    const geo = all.map((p, i) => ({ p, s: speeds[i] })).filter((g) => g.p.lat != null && g.p.lon != null);
    const step = Math.max(1, Math.floor(geo.length / 1200));
    const sample = geo.filter((_, i) => i % step === 0 || i === geo.length - 1);
    const coords = projectRoute(sample.map((g) => ({ lat: g.p.lat!, lon: g.p.lon! })), ROUTE_BOX);
    if (!coords) return;
    const valid = sample.map((g) => g.s).filter((s): s is number => s != null && s > 0.5);
    const lo = percentile(valid, 0.1), hi = percentile(valid, 0.9);
    const tOf = (s: number | null) => (s == null ? 0.5 : Math.min(1, Math.max(0, (s - lo) / (hi - lo || 1))));

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // halo por baixo do traçado inteiro
    ctx.beginPath();
    coords.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 30;
    ctx.stroke();
    // trechos coloridos pela velocidade
    ctx.lineWidth = 11;
    for (let i = 1; i < coords.length; i++) {
      const c = ramp(tOf(sample[i].s), color);
      ctx.beginPath();
      ctx.moveTo(coords[i - 1][0], coords[i - 1][1]);
      ctx.lineTo(coords[i][0], coords[i][1]);
      ctx.strokeStyle = c;
      ctx.shadowColor = c;
      ctx.shadowBlur = 14;
      ctx.stroke();
    }
    ctx.restore();

    // marcadores de km (todos ate 15 km, depois de 5 em 5)
    const totalKm = (a.distance_m ?? 0) / 1000;
    const every = totalKm <= 15 ? 1 : 5;
    let nextKm = every;
    const placed: [number, number][] = [];
    sample.forEach((g, i) => {
      const d = g.p.distance_m;
      if (d == null || d / 1000 < nextKm) return;
      const [x, y] = coords[i];
      // ida e volta pelo mesmo caminho: marcador em cima de outro nao aparece
      if (placed.some(([px, py]) => Math.hypot(px - x, py - y) < 44)) { nextKm += every; return; }
      placed.push([x, y]);
      ctx.save();
      ctx.fillStyle = "#0A0A0A";
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
      txt(ctx, String(nextKm), x, y + 1, { font: `800 18px ${DISPLAY}`, color: "#fff", align: "center", baseline: "middle" });
      nextKm += every;
    });
    // largada e chegada
    for (const [x, y] of [coords[0], coords[coords.length - 1]]) {
      ctx.save();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // legenda: gradiente com os ritmos reais das pontas
    const fmt = (s: number) => (bike ? `${(s * 3.6).toFixed(1).replace(".", ",")} km/h` : `${formatPaceShort(1000 / s)}/km`);
    const bar = { x: 190, y: 1580, w: 700, h: 16 };
    ctx.save();
    const g = ctx.createLinearGradient(bar.x, 0, bar.x + bar.w, 0);
    g.addColorStop(0, SLOW);
    g.addColorStop(0.5, color);
    g.addColorStop(1, FAST);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(bar.x, bar.y, bar.w, bar.h, 8);
    ctx.fill();
    ctx.restore();
    txt(ctx, "LENTO", bar.x, bar.y - 16, { font: `700 24px ${SANS}`, color: "rgba(255,255,255,0.6)", tracking: 4, shadow: true });
    txt(ctx, "RÁPIDO", bar.x + bar.w, bar.y - 16, { font: `700 24px ${SANS}`, color: "rgba(255,255,255,0.6)", align: "right", tracking: 4, shadow: true });
    if (valid.length) {
      // azul claro no texto: o azul da rampa some no fundo escuro
      txt(ctx, fmt(lo), bar.x, bar.y + 52, { font: `700 30px ${SANS}`, color: "#7AA2FF", shadow: true });
      txt(ctx, fmt(hi), bar.x + bar.w, bar.y + 52, { font: `700 30px ${SANS}`, color: FAST, align: "right", shadow: true });
    }

    // rodape
    const dist = distanceParts(a.distance_m);
    txt(ctx, `${dist.value} ${dist.unit}  ·  ${formatDuration(activeSeconds(a))}`, 540, 1720, { font: `700 44px ${SANS}`, color: "#fff", align: "center", shadow: true });
    txt(ctx, dayLabel(startDate(a)), 540, 1770, { font: `500 28px ${SANS}`, color: rgba("#FFFFFF", 0.55), align: "center", tracking: 4, shadow: true });
    drawBrand(ctx, data.art, 540, 1805, 56);
  },
};
