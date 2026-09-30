import { activeSeconds, formatDuration, formatPaceShort, isBikeSport } from "@/lib/utils";
import { DISPLAY, drawBackdrop, drawBrand, rgba, SANS, txt, usableSplits, WORDMARK } from "../draw";
import type { StoryLayout } from "../types";

const BARS = { x: 60, y: 820, w: 960, h: 640 };

/**
 * "Parciais brutalistas": uma barra por km (mais alta = mais rápida), o km mais
 * rápido estourado na cor do esporte e o número dele gigante. Grid cru, contraste duro.
 */
export const parciais: StoryLayout = {
  id: "parciais",
  label: "Parciais",
  art: WORDMARK,
  isNew: true,
  available: ({ splits }) => usableSplits(splits).length >= 2,
  draw(ctx, data) {
    const { activity: a, color } = data;
    const bike = isBikeSport(a.sport);
    const splits = usableSplits(data.splits);
    const speeds = splits.map((s) => 3600 / s.pace_s_per_km!); // km/h
    const fastest = speeds.indexOf(Math.max(...speeds));
    const fmt = (i: number) => (bike ? speeds[i].toFixed(1).replace(".", ",") : formatPaceShort(splits[i].pace_s_per_km!));

    drawBackdrop(ctx, data, { veil: 0.62, glow: { x: 540, y: 1150, r: 800 } });

    // topo
    txt(ctx, "KM MAIS RÁPIDO", 60, 250, { font: `800 34px ${DISPLAY}`, color, tracking: 8, shadow: true });
    const w = txt(ctx, fmt(fastest), 48, 560, { font: `900 300px ${DISPLAY}`, color: "#fff", tracking: -10, shadow: true });
    txt(ctx, bike ? " km/h" : " /km", 48 + w, 560, { font: `800 64px ${DISPLAY}`, color, shadow: true });
    txt(ctx, `no km ${splits[fastest].index}`, 60, 640, { font: `600 44px ${SANS}`, color: "rgba(255,255,255,0.7)", shadow: true });

    // regua brutalista
    ctx.save();
    ctx.fillStyle = "#fff";
    ctx.fillRect(60, 730, 960, 8);
    ctx.restore();
    txt(ctx, `${splits.length} KM`, 60, 790, { font: `800 30px ${DISPLAY}`, color: "#fff", tracking: 4, shadow: true });
    txt(ctx, bike ? "VELOCIDADE POR KM" : "RITMO POR KM", 1020, 790, { font: `800 30px ${DISPLAY}`, color: "rgba(255,255,255,0.55)", align: "right", tracking: 4, shadow: true });

    // barras
    const n = splits.length;
    const gap = n <= 15 ? 14 : n <= 30 ? 8 : 4;
    const bw = (BARS.w - gap * (n - 1)) / n;
    const lo = Math.min(...speeds), hi = Math.max(...speeds);
    const hOf = (v: number) => BARS.h * (0.3 + 0.7 * (hi > lo ? (v - lo) / (hi - lo) : 1));
    const labelEvery = n <= 30 ? 1 : 5;
    splits.forEach((s, i) => {
      const h = hOf(speeds[i]);
      const x = BARS.x + i * (bw + gap);
      const y = BARS.y + BARS.h - h;
      ctx.save();
      if (i === fastest) {
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 40;
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.24)";
      }
      ctx.fillRect(x, y, bw, h);
      ctx.restore();
      if (i === 0 || (i + 1) % labelEvery === 0 || i === fastest) {
        txt(ctx, String(s.index), x + bw / 2, BARS.y + BARS.h + 44, {
          font: `700 ${n > 20 ? 22 : 28}px ${SANS}`, color: i === fastest ? color : "rgba(255,255,255,0.5)", align: "center", shadow: true,
        });
      }
    });

    // linha da media
    const avgSpeed = bike ? a.avg_speed_kmh : a.avg_pace_s_per_km ? 3600 / a.avg_pace_s_per_km : null;
    if (avgSpeed != null && avgSpeed >= lo && avgSpeed <= hi) {
      const y = BARS.y + BARS.h - hOf(avgSpeed);
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 10]);
      ctx.beginPath(); ctx.moveTo(BARS.x, y); ctx.lineTo(BARS.x + BARS.w, y); ctx.stroke();
      ctx.restore();
    }

    // rodape: total grande a esquerda, tempo e media a direita
    const km = ((a.distance_m ?? 0) / 1000).toFixed(1).replace(".", ",");
    txt(ctx, `${km}`, 60, 1690, { font: `900 150px ${DISPLAY}`, color: "#fff", tracking: -4, shadow: true });
    txt(ctx, "KM", 64, 1740, { font: `800 34px ${DISPLAY}`, color, tracking: 6, shadow: true });
    const avgTxt = bike
      ? a.avg_speed_kmh != null ? `${a.avg_speed_kmh.toFixed(1).replace(".", ",")} km/h` : "—"
      : a.avg_pace_s_per_km != null ? `${formatPaceShort(a.avg_pace_s_per_km)} /km` : "—";
    txt(ctx, "TEMPO", 1020, 1590, { font: `700 26px ${SANS}`, color: rgba("#FFFFFF", 0.55), align: "right", tracking: 4, shadow: true });
    txt(ctx, formatDuration(activeSeconds(a)), 1020, 1640, { font: `800 46px ${DISPLAY}`, color: "#fff", align: "right", shadow: true });
    txt(ctx, "MÉDIA", 1020, 1690, { font: `700 26px ${SANS}`, color: rgba("#FFFFFF", 0.55), align: "right", tracking: 4, shadow: true });
    txt(ctx, avgTxt, 1020, 1740, { font: `800 46px ${DISPLAY}`, color: "#fff", align: "right", shadow: true });
    drawBrand(ctx, data.art, 540, 1800, 56);
  },
};
