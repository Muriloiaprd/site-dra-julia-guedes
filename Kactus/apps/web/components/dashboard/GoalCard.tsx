"use client";

import Link from "next/link";
import { PHASE_STYLE } from "@/components/coach/GoalPlanPanel";
import { Panel, ProgressBar, Skeleton } from "@/components/ui/primitives";
import type { AthleteMemory, GoalPlan, RacePrediction } from "@/lib/api";
import { parseLocalDate, toISODate } from "@/lib/athlete";
import { formatClock, formatPaceShort } from "@/lib/utils";

const RACE_SHORT: Record<string, string> = { "5k": "5K", "10k": "10K", "21k": "21K", "42k": "42K" };

function daysTo(iso: string): number {
  return Math.round((parseLocalDate(iso).getTime() - parseLocalDate(toISODate(new Date())).getTime()) / 86_400_000);
}

function shortDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * "Próxima prova": contagem regressiva da prova do plano do objetivo (fase, semana,
 * km da semana e o tempo-alvo) e as outras provas com data que estão nas memórias da
 * Duni. Sem prova cadastrada, convida a cadastrar e mostra o potencial atual (VDOT).
 */
export function GoalCard({
  predictions, loading, goal = null, races = [], className = "",
}: {
  predictions: RacePrediction[];
  loading: boolean;
  goal?: GoalPlan | null;
  races?: AthleteMemory[];
  className?: string;
}) {
  const today = toISODate(new Date());
  const upcoming = races
    .filter((m) => m.active && m.kind === "prova" && m.event_date && m.event_date >= today)
    .sort((a, b) => a.event_date!.localeCompare(b.event_date!));
  const main = goal && goal.race_date >= today ? goal : null;
  const others = upcoming.filter((m) => !main || m.event_date !== main.race_date).slice(0, 3);
  const first = main ? null : upcoming[0] ?? null;

  const weekIdx = main ? main.weeks.findIndex((w) => w.inicio <= today && today <= w.fim) : -1;
  const week = weekIdx >= 0 ? main!.weeks[weekIdx] : null;
  const phase = week ? PHASE_STYLE[week.fase] : null;
  const progress = main && main.weeks.length ? Math.max(0, weekIdx + 1) / main.weeks.length * 100 : 0;
  const targetS = main ? main.paces.prova * main.race_distance_km : null;

  return (
    <Panel variant="accent" className={`flex flex-col overflow-hidden ${className}`} aria-label="Próxima prova">
      <h2 className="od-label od-label-accent relative">Próxima prova</h2>

      {loading ? (
        <Skeleton className="mt-4 h-40" />
      ) : main ? (
        <div className="relative mt-3 flex flex-1 flex-col">
          <h3 className="font-display text-[1.25rem] font-extrabold leading-tight tracking-tight">{main.race_name}</h3>
          <p className="mt-0.5 text-xs text-brand-muted">{shortDate(main.race_date)}</p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="od-num text-[2.6rem] leading-none text-brand-accent">{daysTo(main.race_date)}</span>
            <span className="text-sm font-semibold text-brand-textSecondary">dias</span>
          </div>
          {week && phase && (
            <div className="mt-3 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="od-badge !normal-case !tracking-normal" style={{ color: phase.color, background: `${phase.color}14`, boxShadow: `inset 0 0 0 1px ${phase.color}44` }}>
                  {phase.label}{week.alivio ? " · alívio" : ""}
                </span>
                <span className="text-brand-muted">Semana {weekIdx + 1} de {main.weeks.length} · {week.km} km</span>
              </div>
              <ProgressBar value={progress} height={5} />
            </div>
          )}
          {targetS != null && (
            <p className="mt-3 text-xs text-brand-textSecondary">
              Alvo do plano: <strong className="od-num text-white">{formatClock(targetS)}</strong> · {formatPaceShort(main.paces.prova)}/km
            </p>
          )}
        </div>
      ) : first ? (
        <div className="relative mt-3 flex-1">
          <h3 className="font-display text-[1.25rem] font-extrabold leading-tight tracking-tight">{first.content}</h3>
          <p className="mt-0.5 text-xs text-brand-muted">{shortDate(first.event_date!)}</p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="od-num text-[2.6rem] leading-none text-brand-accent">{daysTo(first.event_date!)}</span>
            <span className="text-sm font-semibold text-brand-textSecondary">dias</span>
          </div>
          <p className="mt-3 text-xs text-brand-muted">Peça à Duni o plano do objetivo para ter fases, semanas e o ritmo de prova.</p>
        </div>
      ) : (
        <div className="relative mt-3 flex-1">
          <h3 className="font-display text-[1.25rem] font-extrabold uppercase leading-[1.05] tracking-tight">
            Defina seu<br /><span className="text-brand-accent">próximo desafio</span>
          </h3>
          <p className="mt-2 text-[0.8rem] leading-relaxed text-brand-muted">
            Cadastre a prova com a data em &quot;O que a Duni sabe de você&quot; e ela monta o plano até lá.
          </p>
          {predictions.length > 0 && (
            <div className="od-tile mt-3 p-3">
              <div className="od-metric-label mb-2 flex items-center justify-between">
                <span>Seu potencial hoje</span>
                <span className="normal-case tracking-normal text-brand-textTertiary">VDOT {predictions[0].vdot}</span>
              </div>
              <ul className="space-y-1.5">
                {predictions.map((p) => (
                  <li key={p.distance} className="flex items-center justify-between gap-2">
                    <span className="w-9 text-[0.7rem] font-bold text-brand-textSecondary">{RACE_SHORT[p.distance] ?? p.distance}</span>
                    <span className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                    <span className="od-num text-[0.95rem]">{formatClock(p.predicted_s)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!loading && others.length > 0 && (
        <ul className="relative mt-3 space-y-1 border-t border-white/5 pt-3 text-xs">
          {others.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2">
              <span className="truncate text-brand-textSecondary">{m.content}</span>
              <span className="shrink-0 tabular-nums text-brand-muted">{daysTo(m.event_date!)} dias</span>
            </li>
          ))}
        </ul>
      )}

      <Link href="/coach" className="od-btn od-btn-secondary relative mt-4 w-full">
        {main ? "Ver o plano até a prova" : first ? "Montar o plano com a Duni" : "Cadastrar a prova na Duni"} <span aria-hidden>→</span>
      </Link>
    </Panel>
  );
}
