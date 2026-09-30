import type { HrZones } from "@/lib/api";
import { activeSeconds, distanceParts, formatDuration, formatPaceShort, isBikeSport } from "@/lib/utils";
import { dayLabel, DISPLAY, drawBackdrop, drawBrand, fitSize, percentile, rgba, SANS, smooth, startDate, txt, WORDMARK } from "../draw";
import type { StoryLayout } from "../types";

/** Cores fixas por zona: a zona é informação, não enfeite (não segue a cor do esporte). */
const ZONE_COLORS = ["#4FC3F7", "#00FF66", "#C6FF00", "#FFB020", "#FF3B30"];
const BAND = { x: 60, y: 830, w: 960, h: 480 };

function zoneOf(hr: number, zones: HrZones | null, maxSeen: number): number {
  if (zones) {
    const tops = [zones.z1[1], zones.z2[1], zones.z3[1], zones.z4[1]];
    const i = tops.findIndex((t) => hr < t);
    return i === -1 ? 4 : i;
  }
  const pct = hr / maxSeen;
  return pct < 0.6 ? 0 : pct < 0.7 ? 1 : pct < 0.8 ? 2 : pct < 0.9 ? 3 : 4;
}

/**
 * "Batimento": a curva de FC do treino inteiro vira um eletrocardiograma,
 * colorido pelas zonas, com a FC média gigante. Minimalismo radical: a prova
 * de que o treino foi de verdade está no próprio coração.
 */
export const batimento: StoryLayout = {
  id: "batimento",
  label: "Batimento",
  art: WORDMARK,
  isNew: true,
  available: ({ activity }) => activity.avg_hr != null && activity.points.filter((p) => p.hr != null).length >= 60,
  draw(ctx, data) {
    const { activity: a, color } = data;
    drawBackdrop(ctx, data, { veil: 0.62, glow: { x: 540, y: 1070, r: 900 } });

    // topo: FC media gigante
    txt(ctx, "FREQUÊNCIA CARDÍACA MÉDIA", 540, 250, { font: `600 30px ${SANS}`, color: "rgba(255,255,255,0.72)", align: "center", tracking: 6, shadow: true });
    const avg = String(a.avg_hr ?? "—");
    ctx.save();
    ctx.font = `900 330px ${DISPLAY}`;
    const numW = ctx.measureText(avg).width;
    ctx.font = `700 64px ${SANS}`;
    const unitW = ctx.measureText(" bpm").width;
    ctx.restore();
    const left = 540 - (numW + unitW) / 2;
    txt(ctx, avg, left, 610, { font: `900 330px ${DISPLAY}`, color: "#fff", tracking: -8, shadow: true });
    txt(ctx, " bpm", left + numW, 610, { font: `700 64px ${SANS}`, color, shadow: true });
    if (a.max_hr) txt(ctx, `máx ${a.max_hr} bpm`, 540, 690, { font: `500 34px ${SANS}`, color: "rgba(255,255,255,0.6)", align: "center", shadow: true });

    // papel de eletrocardiograma
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let y = BAND.y; y <= BAND.y + BAND.h; y += 60) {
      ctx.beginPath(); ctx.moveTo(BAND.x, y); ctx.lineTo(BAND.x + BAND.w, y); ctx.stroke();
    }
    for (let x = BAND.x; x <= BAND.x + BAND.w; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, BAND.y); ctx.lineTo(x, BAND.y + BAND.h); ctx.stroke();
    }
    ctx.restore();

    // serie de FC suavizada (~15 s) e reduzida a ~700 pontos
    const pts = a.points.filter((p) => p.hr != null);
    const t0 = pts[0].elapsed_time_s;
    const tN = pts[pts.length - 1].elapsed_time_s || 1;
    const dt = Math.max(1, (tN - t0) / pts.length);
    const hrs = smooth(pts.map((p) => p.hr), Math.max(2, Math.round(15 / dt / 2)));
    const step = Math.max(1, Math.floor(pts.length / 700));
    const series: { x: number; hr: number }[] = [];
    for (let i = 0; i < pts.length; i += step) {
      const hr = hrs[i];
      if (hr != null) series.push({ x: BAND.x + ((pts[i].elapsed_time_s - t0) / (tN - t0 || 1)) * BAND.w, hr });
    }
    const vals = series.map((s) => s.hr);
    // escala pelo percentil 2%: o aquecimento (FC subindo do repouso) achatava a curva no terco de cima
    const lo = percentile(vals, 0.02) - 8, hi = Math.max(...vals) + 6;
    const maxSeen = a.max_hr ?? Math.max(...vals);
    const yOf = (hr: number) => Math.min(BAND.y + BAND.h, BAND.y + BAND.h - ((hr - lo) / (hi - lo || 1)) * BAND.h);

    // area sutil sob a curva
    ctx.save();
    const fill = ctx.createLinearGradient(0, BAND.y, 0, BAND.y + BAND.h);
    fill.addColorStop(0, "rgba(255,255,255,0.10)");
    fill.addColorStop(1, "rgba(255,255,255,0)");
    ctx.beginPath();
    ctx.moveTo(series[0].x, BAND.y + BAND.h);
    for (const s of series) ctx.lineTo(s.x, yOf(s.hr));
    ctx.lineTo(series[series.length - 1].x, BAND.y + BAND.h);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();

    // linha em trechos da mesma zona, com brilho da cor da zona
    ctx.save();
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    let i = 0;
    while (i < series.length - 1) {
      const z = zoneOf(series[i].hr, data.hrZones, maxSeen);
      ctx.beginPath();
      ctx.moveTo(series[i].x, yOf(series[i].hr));
      let j = i + 1;
      while (j < series.length) {
        ctx.lineTo(series[j].x, yOf(series[j].hr));
        if (zoneOf(series[j].hr, data.hrZones, maxSeen) !== z) break;
        j++;
      }
      ctx.strokeStyle = ZONE_COLORS[z];
      ctx.shadowColor = ZONE_COLORS[z];
      ctx.shadowBlur = 22;
      ctx.stroke();
      i = Math.min(j, series.length - 1);
      if (j >= series.length) break;
    }
    ctx.restore();

    // tempo por zona
    const pct = data.zones.length
      ? data.zones.map((z) => z.percent)
      : ZONE_COLORS.map((_, zi) => (series.filter((s) => zoneOf(s.hr, data.hrZones, maxSeen) === zi).length / series.length) * 100);
    txt(ctx, "TEMPO POR ZONA", 60, 1420, { font: `600 26px ${SANS}`, color: "rgba(255,255,255,0.6)", tracking: 5, shadow: true });
    let x = 60;
    const total = pct.reduce((s, v) => s + v, 0) || 1;
    pct.forEach((p, zi) => {
      const w = (p / total) * 960;
      if (w <= 0) return;
      ctx.save();
      ctx.fillStyle = ZONE_COLORS[zi];
      ctx.fillRect(x, 1445, Math.max(0, w - 4), 26);
      ctx.restore();
      if (p / total >= 0.08) txt(ctx, `Z${zi + 1} ${Math.round((p / total) * 100)}%`, x, 1510, { font: `700 26px ${SANS}`, color: ZONE_COLORS[zi], shadow: true });
      x += w;
    });

    // rodape
    const dist = distanceParts(a.distance_m);
    const pace = isBikeSport(a.sport)
      ? a.avg_speed_kmh != null ? `${a.avg_speed_kmh.toFixed(1)} km/h` : null
      : a.avg_pace_s_per_km != null ? `${formatPaceShort(a.avg_pace_s_per_km)}/km` : null;
    const line = [`${dist.value} ${dist.unit}`, formatDuration(activeSeconds(a)), pace].filter(Boolean).join("  ·  ");
    const size = fitSize(ctx, line, (px) => `700 ${px}px ${SANS}`, 960, 46);
    txt(ctx, line, 540, 1640, { font: `700 ${size}px ${SANS}`, color: "#fff", align: "center", shadow: true });
    txt(ctx, dayLabel(startDate(a)), 540, 1695, { font: `500 30px ${SANS}`, color: rgba("#FFFFFF", 0.55), align: "center", tracking: 4, shadow: true });
    drawBrand(ctx, data.art, 540, 1745, 62);
  },
};
