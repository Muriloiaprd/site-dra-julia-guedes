"use client";

import { useState } from "react";

import { WeeklyPlanPanel } from "@/components/coach/WeeklyPlanPanel";
import { AiOrb } from "@/components/dashboard/CoachCard";
import { Panel } from "@/components/ui/primitives";
import type { FreeWeekResponse, PlannedWorkout, WeeklyPlanResponse } from "@/lib/api";
import { parseLocalDate, toISODate, WEEK_LABELS } from "@/lib/athlete";

type View = "objetivo" | "semana" | "comparar";

const VIEWS: { id: View; label: string; hint: string }[] = [
  { id: "objetivo", label: "Do objetivo", hint: "O que o plano até a prova manda" },
  { id: "semana", label: "Da semana", hint: "O que a Duni faria agora, pelo seu estado" },
  { id: "comparar", label: "Comparar", hint: "Os dois lado a lado; você escolhe" },
];

const RECOMMEND = {
  objetivo: { label: "Seguir o plano do objetivo", color: "#00BFFF" },
  semana: { label: "Seguir o plano da semana", color: "#C6FF00" },
  misturar: { label: "Misturar os dois", color: "#FFC145" },
};

const INTENSITY_COLOR: Record<string, string> = { leve: "#00FF66", moderado: "#FFC145", forte: "#F85149" };

const km = (w: PlannedWorkout) => (w.target_distance_m ? Number(w.target_distance_m) / 1000 : 0);
const fmtKm = (v: number) => `${Number(v.toFixed(1)).toLocaleString("pt-BR")} km`;

function totals(list: PlannedWorkout[]) {
  return {
    km: list.reduce((s, w) => s + km(w), 0),
    runs: list.length,
    long: Math.max(0, ...list.map(km)),
    hard: list.filter((w) => w.target_intensity === "forte").length,
  };
}

/** Dois treinos "iguais" para a comparacao: mesmo tipo e km parecido (ou os dois descanso). */
function same(a?: PlannedWorkout, b?: PlannedWorkout) {
  if (!a || !b) return !a && !b;
  return (a.targets?.tipo ?? a.title) === (b.targets?.tipo ?? b.title) && Math.abs(km(a) - km(b)) < 0.6;
}

function Cell({ w, tone }: { w?: PlannedWorkout; tone: string }) {
  if (!w) return <div className="text-[0.8rem] text-brand-muted">Descanso</div>;
  const c = INTENSITY_COLOR[w.target_intensity ?? "leve"] ?? "#888";
  return (
    <div className="min-w-0 border-l-2 pl-2.5" style={{ borderColor: tone }}>
      <div className="truncate text-[0.84rem] font-semibold">{w.title}</div>
      <div className="flex items-center gap-1.5 text-[0.72rem] text-brand-textSecondary">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c }} />
        <span className="truncate">{[w.targets?.tipo, km(w) ? fmtKm(km(w)) : null].filter(Boolean).join(" · ")}</span>
      </div>
      {w.targets?.ritmo && <div className="truncate text-[0.68rem] text-brand-muted">{w.targets.ritmo}</div>}
    </div>
  );
}

function Compare({
  goalList, free, onUse, using, onGenerateFree, generatingFree,
}: {
  goalList: PlannedWorkout[];
  free: FreeWeekResponse;
  onUse: (dates?: string[]) => void;
  using: string | null;
  onGenerateFree: () => void;
  generatingFree: boolean;
}) {
  if (!free.plan) {
    return (
      <Panel>
        <h2 className="od-label">Comparar</h2>
        <div className="mt-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-brand-muted">Para comparar, a Duni precisa montar o plano da semana pelo seu estado de agora.</p>
          <button type="button" onClick={onGenerateFree} disabled={generatingFree} className="od-btn od-btn-primary shrink-0">
            {generatingFree ? "Montando…" : "Gerar plano da semana"}
          </button>
        </div>
      </Panel>
    );
  }
  const today = toISODate(new Date());
  const start = parseLocalDate(free.plan.week_start);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return toISODate(d);
  });
  const goalBy = new Map(goalList.map((w) => [w.date, w]));
  const freeBy = new Map(free.workouts.map((w) => [w.date, w]));
  const pickBy = new Map((free.comparison?.dias ?? []).map((d) => [d.data, d]));
  const tg = totals(days.map((d) => goalBy.get(d)).filter(Boolean) as PlannedWorkout[]);
  const tf = totals(free.workouts);
  const rec = free.comparison ? RECOMMEND[free.comparison.recomenda] : null;
  const diffDays = days.filter((d) => d >= today && !same(goalBy.get(d), freeBy.get(d)) && goalBy.get(d)?.status !== "done");

  return (
    <Panel className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="od-label od-label-accent">Objetivo × Agora</h2>
          <p className="mt-1 text-sm text-brand-muted">Os dois planos desta semana lado a lado. Use o da semana só nos dias que quiser.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onGenerateFree} disabled={generatingFree || using !== null} className="od-btn od-btn-ghost od-btn-sm">
            {generatingFree ? "Montando…" : "Gerar de novo"}
          </button>
          <button type="button" onClick={() => onUse()} disabled={using !== null || diffDays.length === 0} className="od-btn od-btn-primary od-btn-sm">
            {using === "all" ? "Aplicando…" : "Usar a semana toda"}
          </button>
        </div>
      </div>

      {rec && free.comparison && (
        <div className="flex items-start gap-3 rounded-2xl p-4" style={{ background: `${rec.color}0d`, boxShadow: `inset 0 0 0 1px ${rec.color}40` }}>
          <AiOrb size={34} active={false} />
          <div>
            <div className="font-display text-[1rem] font-bold" style={{ color: rec.color }}>A Duni recomenda: {rec.label.toLowerCase()}</div>
            <p className="mt-0.5 text-[0.84rem] text-brand-textSecondary">{free.comparison.explicacao}</p>
          </div>
        </div>
      )}

      {/* totais */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Do objetivo", t: tg, color: "#00BFFF" },
          { label: "Da semana", t: tf, color: "#C6FF00" },
        ].map(({ label, t, color }) => (
          <div key={label} className="od-tile px-3.5 py-3" style={{ boxShadow: `inset 0 2px 0 ${color}` }}>
            <div className="od-metric-label" style={{ color }}>{label}</div>
            <div className="od-num mt-1 text-[1.15rem]">{fmtKm(t.km)}</div>
            <div className="text-[0.72rem] text-brand-muted">
              {t.runs} treino{t.runs === 1 ? "" : "s"} · longão {fmtKm(t.long)} · {t.hard} forte{t.hard === 1 ? "" : "s"}
            </div>
          </div>
        ))}
      </div>

      {/* dia a dia */}
      <div className="overflow-hidden rounded-2xl" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)" }}>
        <div className="hidden grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,1fr)_9.5rem] gap-3 bg-white/[0.03] px-4 py-2 text-[0.64rem] font-bold uppercase tracking-wider text-brand-muted md:grid">
          <span>Dia</span><span style={{ color: "#00BFFF" }}>Do objetivo</span><span style={{ color: "#C6FF00" }}>Da semana</span><span />
        </div>
        {days.map((d) => {
          const g = goalBy.get(d);
          const f = freeBy.get(d);
          const equal = same(g, f);
          const pick = pickBy.get(d);
          const dt = parseLocalDate(d);
          const canUse = !equal && d >= today && g?.status !== "done";
          return (
            <div
              key={d}
              className="grid grid-cols-2 gap-3 border-t border-white/5 px-4 py-3 md:grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,1fr)_9.5rem] md:items-center"
              style={!equal ? { background: "rgba(255,193,69,0.03)" } : undefined}
            >
              <div className="col-span-2 flex items-center gap-2 md:col-span-1 md:block">
                <div className="text-[0.72rem] font-bold uppercase tracking-wider">{WEEK_LABELS[(dt.getDay() + 6) % 7]} {dt.getDate()}</div>
                {d === today && <span className="rounded bg-[#1f6e44] px-1.5 text-[0.56rem] font-bold uppercase text-white">Hoje</span>}
                {equal && <span className="text-[0.64rem] text-brand-muted md:block">iguais</span>}
              </div>
              <Cell w={g} tone="#00BFFF" />
              <Cell w={f} tone="#C6FF00" />
              <div className="col-span-2 flex flex-wrap items-center gap-2 md:col-span-1 md:justify-end">
                {pick && !equal && (
                  <span className="text-[0.66rem] text-brand-muted" title={pick.motivo}>
                    Duni: <span style={{ color: pick.escolha === "semana" ? "#C6FF00" : "#00BFFF" }}>{pick.escolha === "semana" ? "da semana" : "do objetivo"}</span>
                  </span>
                )}
                {canUse && (
                  <button type="button" onClick={() => onUse([d])} disabled={using !== null} className="od-btn od-btn-secondary od-btn-sm !px-2.5 !py-1">
                    {using === d ? "Usando…" : "Usar o da semana"}
                  </button>
                )}
              </div>
              {pick && !equal && <p className="col-span-2 text-[0.7rem] text-brand-muted md:col-span-4 md:-mt-1 md:pl-[6.25rem]">{pick.motivo}</p>}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/**
 * Plano da semana com tres vistas quando ha plano do objetivo: o do objetivo (o que
 * vale na agenda), o da semana pelo estado de agora (proposta) e a comparacao, onde
 * o atleta leva para a agenda os dias que quiser do plano da semana.
 */
export function WeekPlans({
  week, goalWorkouts, hasGoal, free, onRefresh, onGenerate, generating, onGenerateFree, generatingFree, onUseFree, usingFree,
}: {
  week: WeeklyPlanResponse;
  goalWorkouts: PlannedWorkout[];
  hasGoal: boolean;
  free: FreeWeekResponse | null;
  onRefresh: () => Promise<void>;
  onGenerate: () => void;
  generating: boolean;
  onGenerateFree: () => void;
  generatingFree: boolean;
  onUseFree: (dates?: string[]) => void;
  usingFree: string | null;
}) {
  const [view, setView] = useState<View>("objetivo");
  const main = (
    <WeeklyPlanPanel
      plan={week.plan}
      workouts={week.workouts}
      onRefresh={onRefresh}
      onGenerate={onGenerate}
      generating={generating}
      title={hasGoal ? "Plano da semana · do objetivo" : "Plano da semana"}
    />
  );
  if (!hasGoal) return main;

  // a semana vem pela data (com ou sem plano da semana); sem nada, os treinos do objetivo
  const goalList = week.workouts.length ? week.workouts : goalWorkouts;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Planos da semana">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            onClick={() => setView(v.id)}
            title={v.hint}
            className={`od-chip !px-3.5 !py-1.5 !text-[0.8rem] ${view === v.id ? "is-active" : ""}`}
          >
            {v.label}
          </button>
        ))}
        <span className="text-[0.72rem] text-brand-muted">{VIEWS.find((v) => v.id === view)?.hint}</span>
      </div>

      {view === "objetivo" && main}
      {view === "semana" && (
        <WeeklyPlanPanel
          plan={free?.plan ?? null}
          workouts={free?.workouts ?? []}
          onRefresh={onRefresh}
          onGenerate={onGenerateFree}
          generating={generatingFree}
          title="Plano da semana · pelo estado de agora"
          detailable={false}
          emptyText="A Duni monta a semana só pelo seu estado de agora (último mês, dor, cansaço), sem seguir o plano do objetivo. É uma proposta: não muda a sua agenda."
          note={
            <p className="rounded-xl bg-white/[0.03] px-3.5 py-2.5 text-[0.78rem] text-brand-textSecondary">
              Proposta: não muda a sua agenda. Para usar algum dia, vá em <button type="button" onClick={() => setView("comparar")} className="font-semibold text-brand-accent underline">Comparar</button>.
            </p>
          }
        />
      )}
      {view === "comparar" && (
        <Compare
          goalList={goalList}
          free={free ?? { plan: null, workouts: [], comparison: null }}
          onUse={onUseFree}
          using={usingFree}
          onGenerateFree={onGenerateFree}
          generatingFree={generatingFree}
        />
      )}
    </div>
  );
}
