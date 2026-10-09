import type { ActivityDetail } from "@/lib/api";
import { activeSeconds, formatDuration, formatPaceShort, isBikeSport, sportLabel } from "@/lib/utils";
import { drawCoverImage, drawRoute, projectRoute, STORY_H, STORY_W } from "../engine";
import { DISPLAY, drawBarcode, fitSize, MONTHS, rgba, SANS, startDate, txt, usableSplits, WORDMARK } from "../draw";
import { SERIF } from "./shared";
import type { StoryLayout } from "../types";

const M = 70; // margem da capa
const MESES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

/** Número da edição: o dia do ano do treino (muda todo dia, como uma revista diária). */
function edicao(d: Date): number {
  return Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000);
}

/** Chamadas de capa: até 3, com o que o treino tiver. */
function chamadas(a: ActivityDetail): [string, string][] {
  const out: [string, string][] = [];
  if (isBikeSport(a.sport)) {
    if (a.avg_speed_kmh != null) out.push(["VELOCIDADE", `${a.avg_speed_kmh.toFixed(1).replace(".", ",")} km/h de média`]);
  } else if (a.avg_pace_s_per_km != null) {
    out.push(["RITMO", `${formatPaceShort(a.avg_pace_s_per_km)}/km do começo ao fim`]);
  }
  if (a.avg_hr != null) out.push(["CORAÇÃO", `${a.avg_hr} bpm de média`]);
  if (a.elevation_gain_m != null && a.elevation_gain_m >= 30) out.push(["SUBIDA", `+${Math.round(a.elevation_gain_m)} m encarados`]);
  out.push(["FOCO", `${formatDuration(activeSeconds(a))} em movimento`]);
  return out.slice(0, 3);
}

/**
 * "Capa de revista": o treino como capa — nome da revista no alto, a distância
 * como manchete, chamadas com ritmo, FC e subida, selo de edição especial e o
 * código de barras. Com foto, a foto é a capa; sem foto, a rota vira a imagem.
 */
export const capaRevista: StoryLayout = {
  id: "capa-revista",
  label: "Capa de revista",
  art: WORDMARK,
  isNew: true,
  // de cima a baixo como toda capa: no 4:5 ficaria pequena
  feed: false,
  available: ({ activity }) => (activity.distance_m ?? 0) >= 500,
  draw(ctx, data) {
    const { activity: a, color } = data;
    const d = startDate(a);
    const kmVal = (a.distance_m ?? 0) / 1000;
    const km = kmVal.toFixed(kmVal >= 10 ? 1 : 2).replace(".", ",").replace(/,0+$/, "");

    // imagem da capa
    if (!data.transparent) {
      if (data.photo) {
        drawCoverImage(ctx, data.photo.image, { x: 0, y: 0, w: STORY_W, h: STORY_H }, data.photo);
        ctx.fillStyle = "rgba(6,6,6,0.12)";
        ctx.fillRect(0, 0, STORY_W, STORY_H);
      } else {
        const g = ctx.createRadialGradient(STORY_W / 2, 900, 0, STORY_W / 2, 900, 1100);
        g.addColorStop(0, rgba(color, 0.22));
        g.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, STORY_W, STORY_H);
      }
      // escurece o alto (nome da revista) e o pé (manchete) para o texto ler sobre qualquer foto
      const top = ctx.createLinearGradient(0, 0, 0, 520);
      top.addColorStop(0, "rgba(6,6,6,0.7)");
      top.addColorStop(1, "rgba(6,6,6,0)");
      ctx.fillStyle = top;
      ctx.fillRect(0, 0, STORY_W, 520);
      const foot = ctx.createLinearGradient(0, 1050, 0, STORY_H);
      foot.addColorStop(0, "rgba(6,6,6,0)");
      foot.addColorStop(1, "rgba(6,6,6,0.85)");
      ctx.fillStyle = foot;
      ctx.fillRect(0, 1050, STORY_W, STORY_H - 1050);
    }
    // sem foto, a rota é a "foto" da capa (à direita, longe das chamadas)
    if (!data.photo || data.transparent) {
      const route = projectRoute(data.routePoints, { x: 400, y: 640, w: 620, h: 700 });
      if (route) {
        ctx.save();
        ctx.globalAlpha = 0.9;
        drawRoute(ctx, route, { color, lineWidth: 12 });
        ctx.restore();
      }
    }

    // faixa de cima + nome da revista
    txt(ctx, "A REVISTA DO SEU TREINO", M, 118, { font: `700 26px ${SANS}`, color: "rgba(255,255,255,0.85)", tracking: 6, shadow: true });
    txt(ctx, `Nº ${edicao(d)}`, STORY_W - M, 118, { font: `700 26px ${SANS}`, color: "rgba(255,255,255,0.85)", align: "right", tracking: 4, shadow: true });
    const mast = "KACTUS";
    const mastSize = fitSize(ctx, mast, (s) => `900 ${s}px ${DISPLAY}`, STORY_W - 2 * M + 30, 300, 120);
    txt(ctx, mast, STORY_W / 2, 118 + mastSize * 0.84, { font: `900 ${mastSize}px ${DISPLAY}`, color, align: "center", tracking: -6, shadow: true });
    const ruleY = 118 + mastSize * 0.84 + 34;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(M, ruleY, STORY_W - 2 * M, 3);
    txt(ctx, `EDIÇÃO DE ${MESES[d.getMonth()]} ${d.getFullYear()}`, M, ruleY + 46, { font: `700 26px ${SANS}`, tracking: 4, shadow: true });
    txt(ctx, sportLabel(a.sport).toUpperCase(), STORY_W - M, ruleY + 46, { font: `700 26px ${SANS}`, color, align: "right", tracking: 4, shadow: true });

    // chamadas na coluna da esquerda
    let y = ruleY + 190;
    for (const [kicker, linha] of chamadas(a)) {
      ctx.fillStyle = color;
      ctx.fillRect(M, y - 34, 8, 74);
      txt(ctx, kicker, M + 26, y, { font: `800 28px ${DISPLAY}`, color, tracking: 4, shadow: true });
      const size = fitSize(ctx, linha, (s) => `italic 600 ${s}px ${SERIF}`, 520, 40, 26);
      txt(ctx, linha, M + 26, y + 46, { font: `italic 600 ${size}px ${SERIF}`, shadow: true });
      y += 150;
    }

    // selo "edição especial"
    ctx.save();
    ctx.translate(STORY_W - 200, ruleY + 250);
    ctx.rotate(-0.21);
    ctx.fillStyle = color;
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.arc(0, 0, 118, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    txt(ctx, "EDIÇÃO", 0, -22, { font: `800 30px ${DISPLAY}`, color: "#0A0A0A", align: "center", tracking: 2 });
    txt(ctx, "ESPECIAL", 0, 16, { font: `900 34px ${DISPLAY}`, color: "#0A0A0A", align: "center", tracking: 1 });
    txt(ctx, `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]}`, 0, 56, { font: `700 26px ${SANS}`, color: "rgba(10,10,10,0.75)", align: "center", tracking: 3 });
    ctx.restore();

    // manchete: a distância
    const big = `${km} KM`;
    const bigSize = fitSize(ctx, big, (s) => `900 ${s}px ${DISPLAY}`, STORY_W - 2 * M, 250, 110);
    txt(ctx, big, M - 6, 1560, { font: `900 ${bigSize}px ${DISPLAY}`, tracking: -6, shadow: true });
    const titulo = a.title?.trim() || `Um treino de ${sportLabel(a.sport).toLowerCase()} para guardar`;
    const tSize = fitSize(ctx, titulo, (s) => `italic 700 ${s}px ${SERIF}`, STORY_W - 2 * M, 58, 30);
    txt(ctx, titulo, M, 1640, { font: `italic 700 ${tSize}px ${SERIF}`, color, shadow: true });
    txt(ctx, "Por dentro do treino: o ritmo de cada km, o coração e o que vem pela frente", M, 1700, {
      font: `500 ${fitSize(ctx, "Por dentro do treino: o ritmo de cada km, o coração e o que vem pela frente", (s) => `500 ${s}px ${SANS}`, STORY_W - 2 * M - 250, 26, 18)}px ${SANS}`,
      color: "rgba(255,255,255,0.8)", shadow: true,
    });

    // código de barras no pé, como na banca
    const splits = usableSplits(data.splits);
    const bars = splits.length ? splits.map((s) => s.pace_s_per_km!) : [4, 8, 3, 6, 9, 2, 7, 5, 8, 3, 6, 4];
    ctx.fillStyle = "#F7F7F2";
    ctx.fillRect(STORY_W - M - 220, 1730, 220, 130);
    drawBarcode(ctx, bars, { x: STORY_W - M - 205, y: 1745, w: 190, h: 80 }, "#111111");
    txt(ctx, `R$ 0,00 · Nº ${edicao(d)}`, STORY_W - M - 110, 1850, { font: `700 18px ${SANS}`, color: "#111111", align: "center" });
    txt(ctx, "kactus · edições do seu treino", M, 1840, { font: `600 24px ${SANS}`, color: "rgba(255,255,255,0.6)", tracking: 2, shadow: true });
  },
};
