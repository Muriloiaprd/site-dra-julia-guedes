import { activeSeconds, distanceParts, formatDuration, formatPaceShort, isBikeSport } from "@/lib/utils";
import { dayLabel, DISPLAY, drawBackdrop, drawBrand, fitSize, rgba, SANS, smooth, startDate, txt, WORDMARK } from "../draw";
import type { StoryLayout } from "../types";

const GROUND = 1480; // linha de base das montanhas
const PEAK_TOP = 800; // ate onde o cume pode subir

/**
 * "Montanha": o perfil de altimetria vira uma cordilheira em três camadas
 * (as de trás são o mesmo perfil deslocado e esmaecido, para dar profundidade),
 * crista com brilho e marcador no cume. Aspiracional, feito para subida e trilha.
 */
export const montanha: StoryLayout = {
  id: "montanha",
  label: "Montanha",
  art: WORDMARK,
  isNew: true,
  available: ({ activity }) =>
    (activity.elevation_gain_m ?? 0) >= 20 &&
    activity.points.filter((p) => p.altitude_m != null && p.distance_m != null).length >= 30,
  draw(ctx, data) {
    const { activity: a, color } = data;
    drawBackdrop(ctx, data, { veil: 0.5, glow: { x: 540, y: 1150, r: 900 } });

    // topo: subida acumulada
    txt(ctx, "SUBIDA ACUMULADA", 540, 250, { font: `600 30px ${SANS}`, color: "rgba(255,255,255,0.72)", align: "center", tracking: 6, shadow: true });
    const gain = `+${Math.round(a.elevation_gain_m ?? 0)}`;
    ctx.save();
    ctx.font = `900 300px ${DISPLAY}`;
    const gw = ctx.measureText(gain).width;
    ctx.font = `800 80px ${DISPLAY}`;
    const uw = ctx.measureText(" m").width;
    ctx.restore();
    const gx = 540 - (gw + uw) / 2;
    txt(ctx, gain, gx, 580, { font: `900 300px ${DISPLAY}`, color: "#fff", tracking: -8, shadow: true });
    txt(ctx, " m", gx + gw, 580, { font: `800 80px ${DISPLAY}`, color, shadow: true });

    // perfil: altitude suavizada por distancia, ~320 pontos, de ponta a ponta do Story
    const pts = a.points.filter((p) => p.altitude_m != null && p.distance_m != null);
    // suavizacao forte (~1,5% do percurso): ruido de GPS/barometro nao pode virar pico
    const alts = smooth(smooth(pts.map((p) => p.altitude_m), Math.max(3, Math.round(pts.length / 70))), Math.max(3, Math.round(pts.length / 70)));
    const step = Math.max(1, Math.floor(pts.length / 320));
    const d0 = pts[0].distance_m!, dN = pts[pts.length - 1].distance_m! || 1;
    const prof: { t: number; alt: number }[] = [];
    for (let i = 0; i < pts.length; i += step) prof.push({ t: (pts[i].distance_m! - d0) / (dN - d0 || 1), alt: alts[i]! });
    const minA = Math.min(...prof.map((p) => p.alt)), maxA = Math.max(...prof.map((p) => p.alt));
    // altura proporcional ao desnivel real: treino plano vira colina suave; cordilheira so com ~300 m de relevo
    const relief = Math.min(1, Math.max(0.45, (maxA - minA) / 300));
    const yOf = (alt: number, scale: number) => GROUND - 60 - ((alt - minA) / (maxA - minA || 1)) * (GROUND - 60 - PEAK_TOP) * scale * relief;

    const ridge = (shift: number, scale: number, mirror: boolean) =>
      prof.map((p) => {
        const t = mirror ? 1 - p.t : p.t;
        return [((t + shift) % 1) * 1080, yOf(p.alt, scale)] as [number, number];
      }).sort((m, n) => m[0] - n[0]);

    const fillRidge = (line: [number, number][], style: string | CanvasGradient) => {
      ctx.beginPath();
      ctx.moveTo(0, GROUND);
      ctx.lineTo(0, line[0][1]);
      for (const [x, y] of line) ctx.lineTo(x, y);
      ctx.lineTo(1080, line[line.length - 1][1]);
      ctx.lineTo(1080, GROUND);
      ctx.closePath();
      ctx.fillStyle = style;
      ctx.fill();
    };

    // sol listrado atras das montanhas: preenche o ceu e da profundidade em qualquer relevo
    ctx.save();
    const sun = { x: 540, y: 1130, r: 290 };
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, sun.r, 0, Math.PI * 2);
    ctx.clip();
    const sunGrad = ctx.createLinearGradient(0, sun.y - sun.r, 0, sun.y + sun.r);
    sunGrad.addColorStop(0, rgba(color, 0.55));
    sunGrad.addColorStop(1, rgba(color, 0.08));
    ctx.fillStyle = sunGrad;
    // faixas cada vez mais finas descendo (sem apagar pixels: funciona com foto e transparente)
    let y = sun.y - sun.r, band = 90, gap = 6;
    while (y < sun.y + sun.r) {
      ctx.fillRect(sun.x - sun.r, y, sun.r * 2, band);
      y += band + gap;
      band = Math.max(10, band * 0.72);
      gap = Math.min(22, gap + 3);
    }
    ctx.restore();

    ctx.save();
    // camadas de tras: o mesmo perfil espelhado/deslocado, mais baixo e esmaecido
    fillRidge(ridge(0, 0.62, true), rgba(color, 0.1));
    fillRidge(ridge(0.35, 0.8, false), rgba(color, 0.2));
    // neblina entre as camadas
    const fog = ctx.createLinearGradient(0, GROUND - 320, 0, GROUND);
    fog.addColorStop(0, "rgba(255,255,255,0)");
    fog.addColorStop(1, "rgba(255,255,255,0.06)");
    ctx.fillStyle = fog;
    ctx.fillRect(0, GROUND - 320, 1080, 320);

    // camada da frente: o perfil real
    const front = prof.map((p) => [p.t * 1080, yOf(p.alt, 1)] as [number, number]);
    const grad = ctx.createLinearGradient(0, PEAK_TOP, 0, GROUND);
    grad.addColorStop(0, rgba(color, 0.75));
    grad.addColorStop(1, rgba(color, 0.04));
    fillRidge(front, grad);
    ctx.beginPath();
    ctx.moveTo(front[0][0], front[0][1]);
    for (let i = 1; i < front.length - 1; i++) {
      const [x, y] = front[i];
      ctx.quadraticCurveTo(x, y, (x + front[i + 1][0]) / 2, (y + front[i + 1][1]) / 2);
    }
    ctx.lineTo(front[front.length - 1][0], front[front.length - 1][1]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.lineJoin = "round";
    ctx.shadowColor = color;
    ctx.shadowBlur = 26;
    ctx.stroke();
    ctx.restore();

    // chao
    ctx.save();
    ctx.fillStyle = data.transparent ? "rgba(0,0,0,0)" : "rgba(8,8,8,0.9)";
    if (!data.transparent) ctx.fillRect(0, GROUND, 1080, 1920 - GROUND);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillRect(0, GROUND, 1080, 3);
    ctx.restore();

    // cume
    const top = front.reduce((best, p) => (p[1] < best[1] ? p : best), front[0]);
    const summit = Math.round(a.elevation_max_m ?? maxA);
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.moveTo(top[0], top[1] - 20); ctx.lineTo(top[0], top[1] - 110); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(top[0], top[1], 11, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    const labelX = Math.min(960, Math.max(120, top[0]));
    txt(ctx, `CUME ${summit} m`, labelX, top[1] - 124, { font: `800 30px ${DISPLAY}`, color: "#fff", align: "center", tracking: 3, shadow: true });

    // eixo de distancia
    const dist = distanceParts(a.distance_m);
    txt(ctx, "0 km", 40, GROUND + 50, { font: `600 28px ${SANS}`, color: "rgba(255,255,255,0.55)", shadow: true });
    txt(ctx, `${dist.value} ${dist.unit}`, 1040, GROUND + 50, { font: `600 28px ${SANS}`, color: "rgba(255,255,255,0.55)", align: "right", shadow: true });

    // rodape
    const pace = isBikeSport(a.sport)
      ? a.avg_speed_kmh != null ? `${a.avg_speed_kmh.toFixed(1)} km/h` : null
      : a.avg_pace_s_per_km != null ? `${formatPaceShort(a.avg_pace_s_per_km)}/km` : null;
    const line = [`${dist.value} ${dist.unit}`, formatDuration(activeSeconds(a)), pace].filter(Boolean).join("  ·  ");
    const size = fitSize(ctx, line, (px) => `700 ${px}px ${SANS}`, 960, 46);
    txt(ctx, line, 540, 1650, { font: `700 ${size}px ${SANS}`, color: "#fff", align: "center", shadow: true });
    txt(ctx, dayLabel(startDate(a)), 540, 1705, { font: `500 30px ${SANS}`, color: rgba("#FFFFFF", 0.55), align: "center", tracking: 4, shadow: true });
    drawBrand(ctx, data.art, 540, 1755, 62);
  },
};
