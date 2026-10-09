/**
 * Último painel para ver com o PC desligado.
 *
 * O dashboard grava um resumo já formatado no localStorage do aparelho a cada
 * carregamento completo. Com o PC desligado o service worker serve public/desligado.html
 * no mesmo endereço, que lê esse resumo e mostra o "último painel" com a faixa
 * "Sem conexão com o PC · dados de …". Só texto pronto: a página offline não
 * carrega o app nem faz conta.
 */

import type { ActivitySummary, GoalPlan, PersonalRecord, PlannedWorkout, TrainingRecommendation } from "@/lib/api";
import { activeSeconds, formatDuration, formatPaceShort, isBikeSport, recordLabel, sportLabel } from "@/lib/utils";

export const SNAPSHOT_KEY = "kactus_ultimo_painel";

export interface DashboardSnapshot {
  v: 1;
  salvo_em: string;
  nome: string | null;
  hoje: { titulo: string; detalhe: string | null; cor: string } | null;
  treino_hoje: string | null;
  proximos: { data: string; titulo: string }[];
  semana: { treinos: number; km: string; tempo: string; meta_km: number | null };
  treinos: { titulo: string; esporte: string; data: string; km: string; tempo: string; ritmo: string | null }[];
  recordes: string[];
  prova: { nome: string; data: string; dias: number } | null;
}

const km = (m: number | null) => `${((m ?? 0) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;

function treino(a: ActivitySummary) {
  const ritmo = isBikeSport(a.sport)
    ? a.avg_speed_kmh != null ? `${a.avg_speed_kmh.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km/h` : null
    : a.avg_pace_s_per_km != null ? `${formatPaceShort(a.avg_pace_s_per_km)}/km` : null;
  return { titulo: a.title ?? sportLabel(a.sport), esporte: sportLabel(a.sport), data: a.start_time, km: km(a.distance_m), tempo: formatDuration(activeSeconds(a)), ritmo };
}

export function buildSnapshot(input: {
  name: string | null;
  recommendation: TrainingRecommendation | null;
  plan: PlannedWorkout[];
  week: { count: number; distance: number; duration: number };
  weeklyKmGoal: number | null;
  activities: ActivitySummary[];
  records: PersonalRecord[];
  goal: GoalPlan | null;
  now?: Date;
}): DashboardSnapshot {
  const now = input.now ?? new Date();
  const hojeIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const pendentes = input.plan.filter((w) => w.status === "planned" && w.date >= hojeIso).sort((a, b) => a.date.localeCompare(b.date));
  const hoje = pendentes.find((w) => w.date === hojeIso);
  const prova = input.goal && input.goal.race_date >= hojeIso
    ? { nome: input.goal.race_name, data: input.goal.race_date, dias: Math.round((new Date(`${input.goal.race_date}T12:00:00`).getTime() - new Date(`${hojeIso}T12:00:00`).getTime()) / 86_400_000) }
    : null;
  return {
    v: 1,
    salvo_em: now.toISOString(),
    nome: input.name,
    hoje: input.recommendation && input.recommendation.type !== "unknown"
      ? { titulo: input.recommendation.label, detalhe: input.recommendation.detail, cor: input.recommendation.color }
      : null,
    treino_hoje: hoje ? hoje.title : null,
    proximos: pendentes.filter((w) => w !== hoje).slice(0, 3).map((w) => ({ data: w.date, titulo: w.title })),
    semana: { treinos: input.week.count, km: km(input.week.distance), tempo: formatDuration(input.week.duration), meta_km: input.weeklyKmGoal },
    treinos: input.activities.slice(0, 5).map(treino),
    recordes: input.records
      .filter((r) => now.getTime() - new Date(r.achieved_at).getTime() < 30 * 86_400_000)
      .slice(0, 3)
      .map((r) => recordLabel(r.record_type)),
    prova,
  };
}

/** Ao sair da conta: o último painel não fica no aparelho. */
export function clearSnapshot(): void {
  try {
    localStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    /* ignore */
  }
}

export function saveSnapshot(s: DashboardSnapshot): void {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(s));
  } catch {
    // modo privado ou armazenamento cheio: sem painel offline, o resto segue
  }
}
