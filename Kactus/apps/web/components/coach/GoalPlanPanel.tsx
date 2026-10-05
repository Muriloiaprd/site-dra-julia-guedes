"use client";

import { useState } from "react";

import { Panel } from "@/components/ui/primitives";
import type { GoalPhase, GoalPlan, GoalPlanResponse, PlannedWorkout } from "@/lib/api";
import { parseLocalDate, toISODate, WEEK_LABELS } from "@/lib/athlete";

export const PHASE_STYLE: Record<GoalPhase, { label: string; color: string }> = {
  base: { label: "Base", color: "#00BFFF" },
  construcao: { label: "Construção", color: "#C6FF00" },
  pico: { label: "Pico", color: "#FF8A3D" },
  polimento: { label: "Polimento", color: "#7C8CFF" },
};

const INTENSITY_COLOR: Record<string, string> = { leve: "#00FF66", moderado: "#FFC145", forte: "#F85149" };
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function fmtPace(s: number) {
  const r = Math.round(s);
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`;
}

function fmtKm(km: number) {
  return `${Number(km.toFixed(1)).toLocaleString("pt-BR")} km`;
}

function shortDay(iso: string) {
  const d = parseLocalDate(iso);
  return `${WEEK_LABELS[(d.getDay() + 6) % 7]} ${d.getDate()}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Faixa das fases, cada uma do tamanho das suas semanas, com a marca de "voce esta aqui". */
function PhaseStrip({ plan, currentIndex }: { plan: GoalPlan; currentIndex: number }) {
  const total = plan.weeks.length;
  return (
    <div>
      <div className="relative">
        <div className="flex h-3 gap-1">
          {plan.phases.map((p) => {
            const n = plan.weeks.filter((w) => w.fase === p.fase).length;
            const c = PHASE_STYLE[p.fase].color;
            return <div key={p.fase} className="rounded-full" style={{ flexGrow: n, flexBasis: 0, background: `linear-gradient(90deg, ${c}, ${c}99)`, boxShadow: `0 0 12px ${c}55` }} />;
          })}
        </div>
        {currentIndex >= 0 && (
          <div className="absolute -top-1.5 flex flex-col items-center" style={{ left: `calc(${((currentIndex + 0.5) / total) * 100}% - 6px)` }} aria-hidden>
            <span className="h-6 w-3 rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,0.7)]" />
          </div>
        )}
      </div>
      <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: plan.phases.map((p) => `${plan.weeks.filter((w) => w.fase === p.fase).length}fr`).join(" ") }}>
        {plan.phases.map((p) => (
          <div key={p.fase} className="min-w-0">
            <div className="flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-wider" style={{ color: PHASE_STYLE[p.fase].color }}>
              {PHASE_STYLE[p.fase].label}
            </div>
            <div className="text-[0.64rem] text-brand-muted">
              {parseLocalDate(p.inicio).getDate()} {MONTHS[parseLocalDate(p.inicio).getMonth()]} – {parseLocalDate(p.fim).getDate()} {MONTHS[parseLocalDate(p.fim).getMonth()]}
            </div>
            <p className="mt-1 line-clamp-3 text-[0.72rem] leading-snug text-brand-textSecondary">{p.foco}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Km de cada semana ate a prova: cor da fase; semana de alivio mais apagada. */
function WeekChart({ plan, currentIndex, selected, onSelect }: { plan: GoalPlan; currentIndex: number; selected: number; onSelect: (i: number) => void }) {
  const max = Math.max(...plan.weeks.map((w) => w.km), 1);
  return (
    <div>
      <div className="flex h-44 items-end gap-[3px] pt-6" role="group" aria-label="Km por semana até a prova">
        {plan.weeks.map((w, i) => {
          const c = PHASE_STYLE[w.fase].color;
          const isRace = i === plan.weeks.length - 1;
          const past = i < currentIndex;
          return (
            <button
              key={w.semana}
              type="button"
              onClick={() => onSelect(i)}
              title={`Semana ${w.semana} · ${PHASE_STYLE[w.fase].label}${w.alivio ? " (alívio)" : ""} · ${fmtKm(w.km)} · longão ${fmtKm(w.longao_km)}`}
              aria-pressed={i === selected}
              className="group relative flex h-full flex-1 items-end"
            >
              <div
                className="w-full rounded-t-md transition-all duration-200 group-hover:brightness-125"
                style={{
                  height: `${Math.max(6, (w.km / max) * 100)}%`,
                  background: isRace ? "linear-gradient(180deg, #fff, #7C8CFF)" : `linear-gradient(180deg, ${c}${w.alivio ? "66" : ""}, ${c}22)`,
                  opacity: past ? 0.45 : 1,
                  boxShadow: i === selected ? `0 0 0 2px #fff, 0 0 18px ${c}` : i === currentIndex ? "0 0 0 1.5px rgba(255,255,255,0.7)" : undefined,
                }}
              />
              {isRace && <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-sm" aria-hidden>🏁</span>}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-[3px]" aria-hidden>
        {plan.weeks.map((w, i) => {
          const d = parseLocalDate(w.inicio);
          const prev = i > 0 ? parseLocalDate(plan.weeks[i - 1].inicio) : null;
          const newMonth = !prev || prev.getMonth() !== d.getMonth();
          return <div key={w.semana} className="flex-1 text-[0.6rem] text-brand-muted">{newMonth ? MONTHS[d.getMonth()] : ""}</div>;
        })}
      </div>
    </div>
  );
}

function WeekWorkouts({ plan, index, workouts }: { plan: GoalPlan; index: number; workouts: PlannedWorkout[] }) {
  const w = plan.weeks[index];
  const list = workouts.filter((x) => x.date >= w.inicio && x.date <= w.fim);
  const c = PHASE_STYLE[w.fase].color;
  return (
    <div key={w.semana} className="animate-od-fade-up rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.025)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)" }}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-display text-lg font-bold">Semana {w.semana}</span>
        <span className="text-[0.72rem] font-bold uppercase tracking-wider" style={{ color: c }}>
          {PHASE_STYLE[w.fase].label}{w.alivio ? " · alívio" : ""}
        </span>
        <span className="text-[0.74rem] text-brand-muted">
          {shortDay(w.inicio)} a {shortDay(w.fim)} · {fmtKm(w.km)} · longão {fmtKm(w.longao_km)}
        </span>
      </div>
      {list.length === 0 ? (
        <p className="mt-2 text-sm text-brand-muted">Sem treinos a fazer nesta semana.</p>
      ) : (
        <ul className="mt-3 grid gap-2 md:grid-cols-3">
          {list.map((x) => {
            const ic = INTENSITY_COLOR[x.target_intensity ?? "leve"] ?? "#888";
            return (
              <li key={x.id} className={`od-tile px-3.5 py-3 ${x.status === "skipped" ? "opacity-50" : ""}`} style={{ boxShadow: `inset 3px 0 0 ${ic}` }}>
                <div className="flex items-center justify-between gap-2 text-[0.66rem] font-semibold uppercase tracking-wider text-brand-muted">
                  <span>{shortDay(x.date)}</span>
                  {x.status === "done" && <span className="text-brand-accent">✓ feito</span>}
                  {x.status === "skipped" && <span>pulado</span>}
                </div>
                <div className="mt-1 text-[0.9rem] font-semibold leading-snug">{x.title}</div>
                <div className="mt-0.5 text-[0.72rem] text-brand-textSecondary">
                  {x.targets?.tipo ?? ""}{x.target_distance_m ? ` · ${fmtKm(Number(x.target_distance_m) / 1000)}` : ""}
                </div>
                {x.targets?.ritmo && <div className="mt-1.5 text-[0.72rem]"><span className="text-brand-muted">Ritmo </span>{x.targets.ritmo}</div>}
                {x.targets?.zona_fc && <div className="text-[0.72rem]"><span className="text-brand-muted">FC </span>{x.targets.zona_fc}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function GoalPlanPanel({
  goal, onGenerate, generating,
}: {
  goal: GoalPlanResponse | null;
  onGenerate: (daysPerWeek: number) => void;
  generating: boolean;
}) {
  const plan = goal?.plan ?? null;
  const [days, setDays] = useState<number>(plan?.days_per_week ?? 3);
  const today = toISODate(new Date());
  const currentIndex = plan ? plan.weeks.findIndex((w) => w.inicio <= today && today <= w.fim) : -1;
  const [picked, setPicked] = useState<number | null>(null);

  const daysPicker = (
    <div className="flex items-center gap-1.5 text-[0.72rem] text-brand-muted" role="radiogroup" aria-label="Dias de corrida por semana">
      Dias/semana
      {[3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={days === n} onClick={() => setDays(n)} className={`od-chip !px-2.5 !py-0.5 !text-[0.72rem] ${days === n ? "is-active" : ""}`}>
          {n}
        </button>
      ))}
    </div>
  );

  if (!plan) {
    return (
      <Panel>
        <h2 className="od-label">Plano do objetivo</h2>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="max-w-2xl text-sm text-brand-muted">
            A Duni monta todos os treinos até a sua prova: fases, km de cada semana, longões e os ritmos certos para você.
            Ela usa a prova com data que estiver em &quot;O que a Duni sabe de você&quot;.
          </p>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            {daysPicker}
            <button type="button" onClick={() => onGenerate(days)} disabled={generating} className="od-btn od-btn-primary">
              {generating ? "Montando…" : "Gerar plano do objetivo"}
            </button>
          </div>
        </div>
      </Panel>
    );
  }

  const selected = picked ?? (currentIndex >= 0 ? currentIndex : 0);
  const daysLeft = Math.round((parseLocalDate(plan.race_date).getTime() - parseLocalDate(today).getTime()) / 86_400_000);
  const raceDate = parseLocalDate(plan.race_date).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  const p = plan.paces;

  return (
    <Panel className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="od-label od-label-accent">Plano do objetivo</h2>
          <p className="mt-1.5 font-display text-2xl font-extrabold tracking-tight">{plan.race_name}</p>
          <p className="mt-0.5 text-sm text-brand-textSecondary">
            {raceDate} · <span className="font-semibold text-white">faltam {daysLeft} dias</span> · {fmtKm(plan.race_distance_km)}
          </p>
          <p className="mt-2 max-w-2xl text-sm text-brand-textSecondary">{plan.summary}</p>
        </div>
        <div className="shrink-0 space-y-2 lg:w-[360px]">
          <div className="grid grid-cols-2 gap-1.5 text-[0.74rem]">
            {[
              ["Leve", `${fmtPace(p.leve_rapido)}–${fmtPace(p.leve_lento)}`],
              ["Limiar", fmtPace(p.limiar)],
              ["Intervalo", fmtPace(p.intervalo)],
              ["Ritmo de prova", fmtPace(p.prova)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                <div className="text-[0.6rem] uppercase tracking-wider text-brand-muted">{k}</div>
                <div className="od-num">{v}<span className="text-brand-muted">/km</span></div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {daysPicker}
            <button type="button" onClick={() => onGenerate(days)} disabled={generating} className="od-btn od-btn-ghost od-btn-sm">
              {generating ? "Refazendo…" : "Refazer a partir de hoje"}
            </button>
          </div>
        </div>
      </div>

      {plan.analysis && plan.analysis.length > 0 && (
        <details className="group rounded-2xl bg-white/[0.02]" open>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3">
            <span className="od-metric-label">O que a Duni levou em conta · últimos 6 meses</span>
            <span className="text-brand-muted transition-transform group-open:rotate-180" aria-hidden>▾</span>
          </summary>
          <ul className="grid gap-2 px-4 pb-4 md:grid-cols-2">
            {plan.analysis.map((a) => (
              <li key={a.tema} className="od-tile px-3.5 py-2.5">
                <div className="text-[0.64rem] font-bold uppercase tracking-wider text-brand-accent">{a.tema}</div>
                <p className="mt-0.5 text-[0.8rem] leading-snug text-brand-textSecondary">{a.texto}</p>
              </li>
            ))}
          </ul>
        </details>
      )}

      <PhaseStrip plan={plan} currentIndex={currentIndex} />

      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <span className="od-metric-label">Km por semana até a prova</span>
          <span className="text-[0.66rem] text-brand-muted">
            {currentIndex >= 0 ? `Você está na semana ${currentIndex + 1} de ${plan.weeks.length}` : `${plan.weeks.length} semanas`} · barra mais clara = semana de alívio · toque numa semana
          </span>
        </div>
        <WeekChart plan={plan} currentIndex={currentIndex} selected={selected} onSelect={setPicked} />
      </div>

      <WeekWorkouts plan={plan} index={selected} workouts={goal?.workouts ?? []} />
    </Panel>
  );
}
