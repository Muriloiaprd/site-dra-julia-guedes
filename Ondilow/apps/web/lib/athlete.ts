/**
 * Interpretacao dos dados do atleta para a UI (dashboard, carga, coach).
 * Tudo aqui deriva de dados reais da API — nada de valores ficticios.
 */
import type { ActivityPoint, ActivitySummary, DailyMetric, TrainingRecommendation, WeeklyStatus } from "@/lib/api";
import { C } from "@/lib/theme";
import { sportGroup } from "@/lib/utils";

export const WEEK_SESSION_GOAL = 5;
export const WEEK_HOURS_GOAL = 8;
export const WEEK_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
export const MONTH_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/* ───────────── datas ───────────── */

export function getMonday(ref = new Date()): Date {
  const d = new Date(ref);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

export function weekDates(mon: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i); return d;
  });
}

export function sameDay(a: Date, b: Date) { return a.toDateString() === b.toDateString(); }

/** YYYY-MM-DD no fuso local (datas do plano do coach vem assim). */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseLocalDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

export function nameFromEmail(email: string): string {
  const local = email.split("@")[0];
  const first = local.split(/[._-]/)[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/* ───────────── semana ───────────── */

export interface WeekAgg {
  distance: number;
  duration: number;
  count: number;
  elevation: number;
}

function agg(list: ActivitySummary[]): WeekAgg {
  return {
    distance: list.reduce((s, a) => s + (a.distance_m ?? 0), 0),
    duration: list.reduce((s, a) => s + a.duration_s, 0),
    elevation: Math.round(list.reduce((s, a) => s + (a.elevation_gain_m ?? 0), 0)),
    count: list.length,
  };
}

export function calcWeekStats(acts: ActivitySummary[]) {
  const mon = getMonday();
  const prevMon = new Date(mon); prevMon.setDate(mon.getDate() - 7);
  const now = new Date();
  // semana anterior comparada ate o mesmo ponto da semana (comparacao justa)
  const prevCut = new Date(now); prevCut.setDate(now.getDate() - 7);
  const cur = acts.filter((a) => { const d = new Date(a.start_time); return d >= mon && d <= now; });
  const prevFull = acts.filter((a) => { const d = new Date(a.start_time); return d >= prevMon && d < mon; });
  const prevToDate = prevFull.filter((a) => new Date(a.start_time) <= prevCut);
  return { cur: agg(cur), prev: agg(prevFull), prevToDate: agg(prevToDate), curActs: cur };
}

export function pctChange(cur: number | null | undefined, prev: number | null | undefined): number | null {
  if (cur == null || prev == null || !prev) return null;
  return ((cur - prev) / prev) * 100;
}

/* ───────────── carga / prontidao ───────────── */

export function latestMetric(metrics: DailyMetric[]): DailyMetric | null {
  for (let i = metrics.length - 1; i >= 0; i--) {
    if (metrics[i].tsb != null || metrics[i].ctl != null) return metrics[i];
  }
  return null;
}

export function metricDaysAgo(metrics: DailyMetric[], days: number): DailyMetric | null {
  const latest = latestMetric(metrics);
  if (!latest) return null;
  const target = parseLocalDate(latest.date);
  target.setDate(target.getDate() - days);
  const iso = toISODate(target);
  let best: DailyMetric | null = null;
  for (const m of metrics) {
    if (m.date <= iso && (m.tsb != null || m.ctl != null)) best = m;
  }
  return best;
}

export interface Readiness {
  value: number | null;
  source: "load" | "recommendation" | "none";
  tsb: number | null;
  acwr: number | null;
}

/**
 * Prontidao 0-100 derivada do TSB (forma) e penalizada por ACWR alto.
 * Sem metricas de carga, cai para a recomendacao do motor de previsoes;
 * sem nada, nao inventa numero (value = null).
 */
export function computeReadiness(metrics: DailyMetric[], rec: TrainingRecommendation | null): Readiness {
  const latest = latestMetric(metrics);
  if (latest?.tsb != null) {
    let v = 72 + latest.tsb * 1.1;
    if (latest.acwr != null && latest.acwr > 1.3) v -= (latest.acwr - 1.3) * 80;
    return { value: Math.round(Math.max(8, Math.min(98, v))), source: "load", tsb: latest.tsb, acwr: latest.acwr };
  }
  if (rec && rec.type !== "unknown") {
    const map = { hard: 85, moderate: 68, easy: 50, rest: 28 } as const;
    return { value: map[rec.type], source: "recommendation", tsb: null, acwr: null };
  }
  return { value: null, source: "none", tsb: null, acwr: null };
}

export function statusHeadline(readiness: number | null): string {
  if (readiness == null) return "Aguardando dados";
  if (readiness >= 80) return "Pronto para evoluir";
  if (readiness >= 60) return "Bom momento para treinar";
  if (readiness >= 40) return "Treine com moderação";
  return "Priorize a recuperação";
}

export function statusSubtitle(readiness: number | null, rec: TrainingRecommendation | null): string {
  if (rec?.detail) return rec.detail;
  if (readiness == null) return "Importe suas atividades para o Ondilow começar a interpretar sua forma.";
  if (readiness >= 80) return "Seu corpo responde bem aos estímulos. Mantenha o foco na consistência.";
  if (readiness >= 60) return "Recuperação em dia — sustente o ritmo com consistência.";
  if (readiness >= 40) return "Sinais de fadiga moderada. Ajuste a intensidade de hoje.";
  return "Carga acumulada alta. Priorize sono e recuperação ativa.";
}

/* ───────────── status da Duni ───────────── */

/** `level` na mesma escala da prontidao em divergencia(): 0 = pode treinar, 2 = recuperar. */
export const WEEKLY_STATUS: Record<WeeklyStatus, { emoji: string; label: string; color: string; level: number }> = {
  verde: { emoji: "🟢", label: "Recuperado", color: "#00FF66", level: 0 },
  amarelo: { emoji: "🟡", label: "Atenção", color: "#FFC145", level: 0.5 },
  laranja: { emoji: "🟠", label: "Fadiga acumulada", color: "#FF8A3D", level: 1.5 },
  vermelho: { emoji: "🔴", label: "Recuperação prioritária", color: "#F85149", level: 2 },
};

/**
 * A prontidao do dashboard olha so TSB/ACWR; a Duni olha fadiga, check-ins e
 * tendencia. Prontidao >= 60 / 40-59 / < 40 vira 0 / 1 / 2 e diverge da Duni a
 * 1+ de distancia: 75% x laranja sim, 75% x amarelo nao, 30% x laranja nao.
 */
export function duniDiverges(readiness: number | null, status: WeeklyStatus): boolean {
  if (readiness == null) return false;
  const level = readiness >= 60 ? 0 : readiness >= 40 ? 1 : 2;
  return Math.abs(level - WEEKLY_STATUS[status].level) >= 1;
}

export function readinessColor(v: number | null): string {
  if (v == null) return C.muted;
  if (v >= 60) return C.accent;
  if (v >= 40) return C.warning;
  return C.danger;
}

export type Tone = { label: string; color: string };

/** TSB -> estado de recuperacao. */
export function recoveryFromTsb(tsb: number | null): Tone {
  if (tsb == null) return { label: "—", color: C.muted };
  if (tsb >= -10) return { label: "Boa", color: C.accent };
  if (tsb >= -25) return { label: "Moderada", color: C.warning };
  return { label: "Baixa", color: C.danger };
}

/** TSB -> forma. */
export function formFromTsb(tsb: number | null): Tone {
  if (tsb == null) return { label: "Sem dados", color: C.muted };
  if (tsb > 5) return { label: "Descansado", color: C.accent };
  if (tsb >= -10) return { label: "Equilibrada", color: C.accent };
  if (tsb >= -30) return { label: "Em construção", color: C.warning };
  return { label: "Sobrecarga", color: C.danger };
}

/** ACWR -> risco (0.8–1.3 zona ideal). */
export function riskFromAcwr(acwr: number | null): Tone & { zone: string } {
  if (acwr == null) return { label: "Sem dados", zone: "—", color: C.muted };
  if (acwr > 1.5) return { label: "Alto", zone: "Risco de lesão", color: C.danger };
  if (acwr > 1.3) return { label: "Atenção", zone: "Acima do ideal", color: C.warning };
  if (acwr >= 0.8) return { label: "Baixo", zone: "Zona ideal", color: C.accent };
  return { label: "Baixo", zone: "Subcarga", color: C.warning };
}

/** Tendencia de fitness (CTL) nos ultimos N dias. */
export function ctlTrend(metrics: DailyMetric[], days = 14): Tone & { delta: number | null } {
  const latest = latestMetric(metrics);
  const past = metricDaysAgo(metrics, days);
  if (latest?.ctl == null || past?.ctl == null) return { label: "Sem dados", color: C.muted, delta: null };
  const delta = latest.ctl - past.ctl;
  if (delta > 1.5) return { label: "Em alta", color: C.accent, delta };
  if (delta < -1.5) return { label: "Em queda", color: C.warning, delta };
  return { label: "Estável", color: C.textSecondary, delta };
}

/* ───────────── series de pontos ───────────── */

/** Serie de pace (s/km) suavizada a partir dos pontos de GPS/velocidade. */
export function paceSeries(points: ActivityPoint[], buckets = 36): number[] {
  const speeds = points.map((p) => p.speed_ms).filter((s): s is number => s != null && s > 0.6);
  if (speeds.length < 4) return [];
  const size = Math.max(1, Math.floor(speeds.length / buckets));
  const out: number[] = [];
  for (let i = 0; i < speeds.length; i += size) {
    const chunk = speeds.slice(i, i + size);
    const avg = chunk.reduce((s, v) => s + v, 0) / chunk.length;
    out.push(1000 / avg);
  }
  // corta outliers (paradas/GPS ruidoso) para o grafico nao achatar
  const sorted = [...out].sort((a, b) => a - b);
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  const p10 = sorted[Math.floor(sorted.length * 0.1)];
  return out.map((v) => Math.min(p90, Math.max(p10, v)));
}

export function elevationSeries(points: ActivityPoint[], buckets = 48): number[] {
  const alts = points.map((p) => p.altitude_m).filter((a): a is number => a != null);
  if (alts.length < 4) return [];
  const size = Math.max(1, Math.floor(alts.length / buckets));
  const out: number[] = [];
  for (let i = 0; i < alts.length; i += size) out.push(alts[i]);
  return out;
}

/** Compara uma atividade com a media das N anteriores do mesmo grupo de esporte. */
export function compareWithRecent(activity: ActivitySummary, all: ActivitySummary[], n = 10) {
  const group = sportGroup(activity.sport);
  const idx = all.findIndex((a) => a.id === activity.id);
  const prior = all.slice(idx + 1).filter((a) => sportGroup(a.sport) === group).slice(0, n);
  const paceL = prior.filter((a) => a.avg_pace_s_per_km != null);
  const distL = prior.filter((a) => a.distance_m != null);
  const avgPace = paceL.length ? paceL.reduce((s, a) => s + a.avg_pace_s_per_km!, 0) / paceL.length : null;
  const avgDist = distL.length ? distL.reduce((s, a) => s + a.distance_m!, 0) / distL.length : null;
  return {
    sample: prior.length,
    pacePct: pctChange(activity.avg_pace_s_per_km, avgPace),
    distPct: pctChange(activity.distance_m, avgDist),
  };
}
