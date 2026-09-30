import type { ActivityDetail } from "@/lib/api";
import { activeSeconds, formatDuration, formatPaceShort, isBikeSport, sportGroup } from "@/lib/utils";
import { projectRoute, STORY_W } from "../engine";
import { DISPLAY, drawBackdrop, drawBarcode, drawBrand, firstName, hhmm, MONTHS, SANS, startDate, txt, usableSplits, WORDMARK } from "../draw";
import type { StoryLayout } from "../types";

const CARD = { x: 70, y: 330, w: 940, h: 1230 };
const HEADER_H = 150;
const PERF_Y = 900; // picote, relativo ao cartao
const INK = "#111111";
const MUTED = "#6B6B6B";

/** "Classe" do voo pelo tipo do treino. */
function travelClass(a: ActivityDetail): string {
  const km = (a.distance_m ?? 0) / 1000;
  if (isBikeSport(a.sport)) return km >= 60 ? "LONGÃO" : "PEDAL";
  if (sportGroup(a.sport) === "swim") return "NADO";
  if (sportGroup(a.sport) !== "run") return "LIVRE";
  if (km >= 18) return "LONGÃO";
  const shortLaps = a.laps.filter((l) => (l.distance_m ?? 0) > 0 && (l.distance_m ?? 0) < 1100).length;
  if (shortLaps >= 4) return "TIRO";
  return "RODAGEM";
}

/**
 * "Bilhete de embarque": o treino como cartão de embarque. KM 0 → KM 38,
 * portão = ritmo, assento = FC, classe = tipo do treino. Premium e colecionável:
 * vira série ("meus voos da semana"). Cartão numa camada própria para os
 * recortes do picote saírem transparentes.
 */
export const bilhete: StoryLayout = {
  id: "bilhete",
  label: "Bilhete de embarque",
  art: WORDMARK,
  isNew: true,
  available: ({ activity }) => (activity.distance_m ?? 0) >= 500,
  draw(ctx, data) {
    const { activity: a, color } = data;
    const bike = isBikeSport(a.sport);
    const d = startDate(a);
    const end = new Date(d.getTime() + a.duration_s * 1000);
    const km = ((a.distance_m ?? 0) / 1000).toFixed((a.distance_m ?? 0) >= 10000 ? 0 : 1).replace(".", ",");

    const layer = document.createElement("canvas");
    layer.width = CARD.w;
    layer.height = CARD.h;
    const c = layer.getContext("2d")!;
    const W = CARD.w;

    // cartao branco + faixa do topo na cor do esporte
    c.fillStyle = "#F7F7F2";
    c.beginPath(); c.roundRect(0, 0, W, CARD.h, 36); c.fill();
    c.save();
    c.beginPath(); c.roundRect(0, 0, W, CARD.h, 36); c.clip();
    c.fillStyle = color;
    c.fillRect(0, 0, W, HEADER_H);
    c.restore();
    txt(c, "BOARDING PASS", 56, 96, { font: `900 50px ${DISPLAY}`, color: INK, tracking: 2 });
    txt(c, "KACTUS AIR", W - 56, 72, { font: `800 30px ${DISPLAY}`, color: INK, align: "right", tracking: 4 });
    txt(c, "CORRIDA SEM LIMITES", W - 56, 108, { font: `700 20px ${SANS}`, color: "rgba(17,17,17,0.7)", align: "right", tracking: 4 });

    // origem -> destino
    txt(c, "DE", 56, 250, { font: `700 24px ${SANS}`, color: MUTED, tracking: 4 });
    // "KM 0" e "KM 100" lado a lado: encolhe os dois se nao couberem com folga
    let big = 128;
    const bigFont = (px: number) => `900 ${px}px ${DISPLAY}`;
    for (; big > 70; big -= 4) {
      c.font = bigFont(big);
      if (c.measureText("KM 0").width + c.measureText(`KM ${km}`).width < W - 112 - 60) break;
    }
    txt(c, "KM 0", 56, 380, { font: bigFont(big), color: INK, tracking: -4 });
    txt(c, `LARGADA ${hhmm(d)}`, 56, 430, { font: `600 28px ${SANS}`, color: MUTED });
    txt(c, "PARA", W - 56, 250, { font: `700 24px ${SANS}`, color: MUTED, align: "right", tracking: 4 });
    txt(c, `KM ${km}`, W - 56, 380, { font: bigFont(big), color: INK, align: "right", tracking: -4 });
    txt(c, `CHEGADA ${hhmm(end)}`, W - 56, 430, { font: `600 28px ${SANS}`, color: MUTED, align: "right" });
    // trajeto: linha tracejada com o "aviao" (um ponto na cor do esporte com contorno)
    c.save();
    c.strokeStyle = "rgba(17,17,17,0.35)";
    c.lineWidth = 3;
    c.setLineDash([10, 10]);
    c.beginPath(); c.moveTo(56, 480); c.lineTo(W - 56, 480); c.stroke();
    c.setLineDash([]);
    c.fillStyle = color;
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.beginPath(); c.arc(W / 2, 480, 16, 0, Math.PI * 2); c.fill(); c.stroke();
    c.restore();

    // campos
    const name = firstName(data.athleteName) ?? "ATLETA";
    const gate = bike
      ? a.avg_speed_kmh != null ? `${a.avg_speed_kmh.toFixed(1).replace(".", ",")}` : "—"
      : a.avg_pace_s_per_km != null ? formatPaceShort(a.avg_pace_s_per_km) : "—";
    const fields: [string, string][][] = [
      [["PASSAGEIRO", name], ["DATA", `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]}`], ["VOO", `KCT-${String(d.getDate()).padStart(2, "0")}${String(d.getMonth() + 1).padStart(2, "0")}`]],
      [[bike ? "PORTÃO · KM/H" : "PORTÃO · RITMO", gate], ["ASSENTO · FC", a.avg_hr != null ? String(a.avg_hr) : "—"], ["CLASSE", travelClass(a)]],
    ];
    const colW = (W - 112) / 3;
    fields.forEach((row, ri) => {
      row.forEach(([label, value], ci) => {
        const x = 56 + ci * colW;
        const y = 580 + ri * 150;
        txt(c, label, x, y, { font: `700 22px ${SANS}`, color: MUTED, tracking: 3 });
        let size = 50;
        c.font = `800 ${size}px ${DISPLAY}`;
        while (c.measureText(value).width > colW - 16 && size > 26) { size -= 2; c.font = `800 ${size}px ${DISPLAY}`; }
        txt(c, value, x, y + 60, { font: `800 ${size}px ${DISPLAY}`, color: INK });
      });
    });

    // picote: linha tracejada + meias-luas recortadas (transparentes de verdade)
    c.save();
    c.strokeStyle = "rgba(17,17,17,0.3)";
    c.lineWidth = 3;
    c.setLineDash([14, 12]);
    c.beginPath(); c.moveTo(50, PERF_Y); c.lineTo(W - 50, PERF_Y); c.stroke();
    c.globalCompositeOperation = "destination-out";
    for (const x of [0, W]) { c.beginPath(); c.arc(x, PERF_Y, 30, 0, Math.PI * 2); c.fill(); }
    c.restore();

    // canhoto: codigo de barras + mini rota (ou o tempo, sem GPS)
    const splits = usableSplits(data.splits);
    const bars = splits.length ? splits.map((s) => s.pace_s_per_km!) : [3, 7, 2, 9, 4, 6, 8, 3, 5, 7, 2, 6];
    drawBarcode(c, bars, { x: 56, y: PERF_Y + 70, w: 520, h: 150 }, INK);
    txt(c, `TEMPO DE VOO ${formatDuration(activeSeconds(a))}`, 56, PERF_Y + 270, { font: `700 26px ${SANS}`, color: MUTED, tracking: 2 });
    const route = projectRoute(data.routePoints, { x: W - 330, y: PERF_Y + 40, w: 280, h: 250 });
    if (route) {
      c.save();
      c.strokeStyle = INK;
      c.lineWidth = 6;
      c.lineJoin = "round";
      c.lineCap = "round";
      c.beginPath();
      route.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.stroke();
      c.fillStyle = color;
      for (const [x, y] of [route[0], route[route.length - 1]]) { c.beginPath(); c.arc(x, y, 10, 0, Math.PI * 2); c.fill(); c.stroke(); }
      c.restore();
    }

    // cena
    drawBackdrop(ctx, data, { veil: 0.45, glow: { x: 540, y: 900, r: 900 } });
    txt(ctx, "EMBARQUE CONFIRMADO ✓", STORY_W / 2, 250, { font: `800 38px ${DISPLAY}`, color, align: "center", tracking: 6, shadow: true });
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 18;
    ctx.drawImage(layer, CARD.x, CARD.y);
    ctx.restore();
    layer.width = layer.height = 1;
    drawBrand(ctx, data.art, STORY_W / 2, 1650, 70);
    txt(ctx, "BOM VOO.", STORY_W / 2, 1790, { font: `600 30px ${SANS}`, color: "rgba(255,255,255,0.6)", align: "center", tracking: 8, shadow: true });
  },
};
