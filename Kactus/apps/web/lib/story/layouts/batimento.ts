import type { ActivityDetail, HrZones } from "@/lib/api";
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

/** Ponto da curva: `t` = fração do tempo em movimento (0 → 1), `d` = distância ali. */
type Sample = { x: number; hr: number; t: number; d: number | null };

/**
 * Série de FC suavizada (~15 s) e reduzida a ~700 pontos. Fica em cache por atividade:
 * o vídeo redesenha o modelo 30 vezes por segundo.
 */
const seriesCache = new WeakMap<ActivityDetail, Sample[]>();
function hrSeries(a: ActivityDetail): Sample[] {
  const hit = seriesCache.get(a);
  if (hit) return hit;
  const pts = a.points.filter((p) => p.hr != null);
  // eixo no tempo corrido: com o relogio de movimento a pausa some da curva
  const clock = (p: (typeof pts)[number]) => p.moving_s ?? p.elapsed_time_s;
  const t0 = clock(pts[0]);
  const tN = clock(pts[pts.length - 1]) || 1;
  const dt = Math.max(1, (pts[pts.length - 1].elapsed_time_s - pts[0].elapsed_time_s) / pts.length);
  const hrs = smooth(pts.map((p) => p.hr), Math.max(2, Math.round(15 / dt / 2)));
  const step = Math.max(1, Math.floor(pts.length / 700));
  const series: Sample[] = [];
  let lastT = -1;
  for (let i = 0; i < pts.length; i += step) {
    const hr = hrs[i];
    const t = (clock(pts[i]) - t0) / (tN - t0 || 1);
    // parado o relogio nao anda: ponto no mesmo x viraria um risco vertical
    if (hr == null || t <= lastT) continue;
    lastT = t;
    series.push({ x: BAND.x + t * BAND.w, hr, t, d: pts[i].distance_m });
  }
  seriesCache.set(a, series);
  return series;
}

/**
 * "Batimento": a curva de FC do treino inteiro vira um eletrocardiograma,
 * colorido pelas zonas, com a FC média gigante. Minimalismo radical: a prova
 * de que o treino foi de verdade está no próprio coração.
 * Com `progress` < 1 (vídeo) a curva corre da esquerda para a direita com um ponto
 * brilhante na ponta, a média sobe junto e as zonas e o rodapé enchem no mesmo ritmo.
 */
export const batimento: StoryLayout = {
  id: "batimento",
  label: "Batimento",
  art: WORDMARK,
  isNew: true,
  animated: true,
  available: ({ activity }) => activity.avg_hr != null && activity.points.filter((p) => p.hr != null).length >= 60,
  draw(ctx, data) {
    const { activity: a, color } = data;
    const progress = Math.min(1, Math.max(0, data.progress ?? 1));
    const series = hrSeries(a);
    // video: a curva vai ate o ponto `upto` (exclusivo); no quadro final, inteira
    const upto = progress >= 1 ? series.length : Math.max(2, Math.round(progress * (series.length - 1)) + 1);
    const shown = series.slice(0, upto);
    const head = shown[shown.length - 1];
    const vals = series.map((s) => s.hr);
    // escala pelo percentil 2%: o aquecimento (FC subindo do repouso) achatava a curva no terco de cima
    const lo = percentile(vals, 0.02) - 8, hi = Math.max(...vals) + 6;
    const maxSeen = a.max_hr ?? Math.max(...vals);
    const yOf = (hr: number) => Math.min(BAND.y + BAND.h, BAND.y + BAND.h - ((hr - lo) / (hi - lo || 1)) * BAND.h);

    drawBackdrop(ctx, data, { veil: 0.62, glow: { x: 540, y: 1070, r: 900 } });

    // topo: FC media gigante. No video, a media e o maximo do trecho ja percorrido,
    // reescalados da curva suavizada para terminar exatamente nos valores oficiais
    let avgHr = a.avg_hr;
    let maxHr = a.max_hr;
    if (progress < 1) {
      const mean = (xs: Sample[]) => xs.reduce((acc, s) => acc + s.hr, 0) / xs.length;
      if (avgHr != null) avgHr = Math.round(mean(shown) * (avgHr / mean(series)));
      if (maxHr) maxHr = Math.min(maxHr, Math.round(Math.max(...shown.map((s) => s.hr)) * (maxHr / Math.max(...vals))));
    }
    txt(ctx, "FREQUÊNCIA CARDÍACA MÉDIA", 540, 250, { font: `600 30px ${SANS}`, color: "rgba(255,255,255,0.72)", align: "center", tracking: 6, shadow: true });
    const avg = String(avgHr ?? "—");
    ctx.save();
    ctx.font = `900 330px ${DISPLAY}`;
    const numW = ctx.measureText(avg).width;
    ctx.font = `700 64px ${SANS}`;
    const unitW = ctx.measureText(" bpm").width;
    ctx.restore();
    const left = 540 - (numW + unitW) / 2;
    txt(ctx, avg, left, 610, { font: `900 330px ${DISPLAY}`, color: "#fff", tracking: -8, shadow: true });
    txt(ctx, " bpm", left + numW, 610, { font: `700 64px ${SANS}`, color, shadow: true });
    if (maxHr) txt(ctx, `máx ${maxHr} bpm`, 540, 690, { font: `500 34px ${SANS}`, color: "rgba(255,255,255,0.6)", align: "center", shadow: true });

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

    // area sutil sob a curva
    ctx.save();
    const fill = ctx.createLinearGradient(0, BAND.y, 0, BAND.y + BAND.h);
    fill.addColorStop(0, "rgba(255,255,255,0.10)");
    fill.addColorStop(1, "rgba(255,255,255,0)");
    ctx.beginPath();
    ctx.moveTo(shown[0].x, BAND.y + BAND.h);
    for (const s of shown) ctx.lineTo(s.x, yOf(s.hr));
    ctx.lineTo(head.x, BAND.y + BAND.h);
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
    while (i < shown.length - 1) {
      const z = zoneOf(shown[i].hr, data.hrZones, maxSeen);
      ctx.beginPath();
      ctx.moveTo(shown[i].x, yOf(shown[i].hr));
      let j = i + 1;
      while (j < shown.length) {
        ctx.lineTo(shown[j].x, yOf(shown[j].hr));
        if (zoneOf(shown[j].hr, data.hrZones, maxSeen) !== z) break;
        j++;
      }
      ctx.strokeStyle = ZONE_COLORS[z];
      ctx.shadowColor = ZONE_COLORS[z];
      ctx.shadowBlur = 22;
      ctx.stroke();
      i = Math.min(j, shown.length - 1);
      if (j >= shown.length) break;
    }
    ctx.restore();

    // video: ponto brilhante na ponta da curva, na cor da zona
    if (progress < 1) {
      const hc = ZONE_COLORS[zoneOf(head.hr, data.hrZones, maxSeen)];
      const hy = yOf(head.hr);
      ctx.save();
      ctx.fillStyle = rgba("#FFFFFF", 0.18);
      ctx.beginPath(); ctx.arc(head.x, hy, 30, 0, Math.PI * 2); ctx.fill();
      ctx.shadowColor = hc;
      ctx.shadowBlur = 40;
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(head.x, hy, 13, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // tempo por zona; no video cada zona enche conforme a curva passa por ela
    const zoneCount = (xs: Sample[]) => ZONE_COLORS.map((_, zi) => xs.filter((s) => zoneOf(s.hr, data.hrZones, maxSeen) === zi).length);
    const totalCount = zoneCount(series);
    const fillOf = progress >= 1 ? totalCount.map(() => 1) : zoneCount(shown).map((c, zi) => (totalCount[zi] ? c / totalCount[zi] : 1));
    const pct = data.zones.length
      ? data.zones.map((z) => z.percent)
      : totalCount.map((c) => (c / series.length) * 100);
    txt(ctx, "TEMPO POR ZONA", 60, 1420, { font: `600 26px ${SANS}`, color: "rgba(255,255,255,0.6)", tracking: 5, shadow: true });
    let x = 60;
    const total = pct.reduce((s, v) => s + v, 0) || 1;
    pct.forEach((p, zi) => {
      const w = (p / total) * 960;
      if (w <= 0) return;
      const f = fillOf[zi] ?? 1;
      ctx.save();
      if (f < 1) {
        ctx.fillStyle = rgba(ZONE_COLORS[zi], 0.18);
        ctx.fillRect(x, 1445, Math.max(0, w - 4), 26);
      }
      ctx.fillStyle = ZONE_COLORS[zi];
      ctx.fillRect(x, 1445, Math.max(0, (w - 4) * f), 26);
      ctx.restore();
      if (p / total >= 0.08) txt(ctx, `Z${zi + 1} ${Math.round((p / total) * 100 * f)}%`, x, 1510, { font: `700 26px ${SANS}`, color: ZONE_COLORS[zi], shadow: true });
      x += w;
    });

    // rodape: no video, distancia e tempo correm junto com a ponta da curva
    let meters = a.distance_m;
    let seconds = activeSeconds(a);
    if (progress < 1) {
      meters = head.d ?? (a.distance_m ?? 0) * head.t;
      seconds *= head.t;
    }
    const dist = distanceParts(meters);
    const pace = isBikeSport(a.sport)
      ? a.avg_speed_kmh != null ? `${a.avg_speed_kmh.toFixed(1)} km/h` : null
      : a.avg_pace_s_per_km != null ? `${formatPaceShort(a.avg_pace_s_per_km)}/km` : null;
    const lineOf = (d: ReturnType<typeof distanceParts>, s: number) => [`${d.value} ${d.unit}`, formatDuration(s), pace].filter(Boolean).join("  ·  ");
    const line = lineOf(dist, seconds);
    // tamanho medido no texto final: no video a fonte nao muda de quadro para quadro
    const size = fitSize(ctx, lineOf(distanceParts(a.distance_m), activeSeconds(a)), (px) => `700 ${px}px ${SANS}`, 960, 46);
    txt(ctx, line, 540, 1640, { font: `700 ${size}px ${SANS}`, color: "#fff", align: "center", shadow: true });
    txt(ctx, dayLabel(startDate(a)), 540, 1695, { font: `500 30px ${SANS}`, color: rgba("#FFFFFF", 0.55), align: "center", tracking: 4, shadow: true });
    drawBrand(ctx, data.art, 540, 1745, 62);
  },
};
