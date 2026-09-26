"use client";

import { LinkAction, Panel, Skeleton, TrendBadge } from "@/components/ui/primitives";
import { SportIcon } from "@/components/SportIcon";
import { LegendDot } from "@/components/ui/charts";
import { getMonday, pctChange, sameDay, toISODate, weekDates, WEEK_LABELS, type WeekAgg } from "@/lib/athlete";
import type { ActivitySummary, PlannedWorkout } from "@/lib/api";
import { formatDuration, sportLabel } from "@/lib/utils";

type DayState = "done" | "today" | "planned" | "rest" | "open";

function isRestWorkout(w: PlannedWorkout) {
  return /rest|descanso|off/i.test(w.sport) || /descanso|folga/i.test(w.title);
}

export function WeekStrip({
  activities, plan, loading, cur, prevToDate, className = "",
}: {
  activities: ActivitySummary[];
  plan: PlannedWorkout[];
  loading: boolean;
  cur: WeekAgg;
  prevToDate: WeekAgg;
  className?: string;
}) {
  const today = new Date();
  const startToday = new Date(today); startToday.setHours(0, 0, 0, 0);
  const days = weekDates(getMonday());

  const cells = days.map((d) => {
    const acts = activities.filter((a) => sameDay(new Date(a.start_time), d));
    const planned = plan.find((w) => w.date === toISODate(d)) ?? null;
    const isToday = sameDay(d, today);
    const isPast = d < startToday;
    let state: DayState;
    if (acts.length) state = "done";
    else if (isToday) state = planned && !isRestWorkout(planned) ? "today" : "rest";
    else if (isPast) state = "rest";
    else if (planned) state = isRestWorkout(planned) ? "rest" : "planned";
    else state = "open";

    const load = acts.length ? acts.reduce((s, a) => s + a.duration_s, 0) : planned?.target_duration_s ?? 0;
    const dist = acts.length ? acts.reduce((s, a) => s + (a.distance_m ?? 0), 0) : planned?.target_distance_m ?? 0;
    const sport = acts[0]?.sport ?? planned?.sport ?? null;
    const label = acts.length
      ? sportLabel(acts[0].sport)
      : state === "rest" ? (planned && isRestWorkout(planned) ? planned.title : "Descanso")
      : planned ? planned.title
      : "Livre";
    const metric = dist > 0 ? `${(dist / 1000).toFixed(dist >= 10000 ? 0 : 1)} km` : load > 0 ? formatDuration(load) : null;
    return { d, acts, planned, isToday, state, load, sport, label, metric };
  });

  const maxLoad = Math.max(1, ...cells.map((c) => c.load));

  return (
    <Panel className={className} aria-label="Visão semanal">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="od-label">Visão semanal</h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-brand-muted">
          <span><strong className="od-num text-sm text-white">{(cur.distance / 1000).toFixed(1)}</strong> km</span>
          <span><strong className="od-num text-sm text-white">{formatDuration(cur.duration)}</strong></span>
          <span><strong className="od-num text-sm text-white">{cur.count}</strong> sessões</span>
          <TrendBadge pct={pctChange(cur.distance, prevToDate.distance)} suffix=" vs sem. passada" />
          <LinkAction href="/activities">Atividades</LinkAction>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">{days.map((_, i) => <Skeleton key={i} className="h-[92px] sm:h-[168px]" />)}</div>
      ) : (
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
          {cells.map((c, i) => {
            const done = c.state === "done";
            const style: React.CSSProperties =
              done ? {
                background: "linear-gradient(180deg, rgba(0,255,102,0.14) 0%, rgba(0,255,102,0.03) 100%)",
                boxShadow: "inset 0 0 0 1px rgba(0,255,102,0.38), 0 10px 30px -14px rgba(0,255,102,0.55)",
              } : c.state === "today" ? {
                background: "rgba(0,255,102,0.05)",
                animation: "od-today 2.8s ease-in-out infinite",
              } : c.state === "planned" ? {
                background: "transparent",
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.1)",
                backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.018) 0 6px, transparent 6px 12px)",
              } : c.state === "rest" ? {
                // hoje sem treino continua destacado (anel verde sutil)
                background: c.isToday ? "rgba(0,255,102,0.035)" : "rgba(255,255,255,0.018)",
                animation: c.isToday ? "od-today 2.8s ease-in-out infinite" : undefined,
              } : {
                background: "transparent",
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
              };
            const titleColor = done ? "#00FF66" : c.state === "today" ? "#fff" : c.state === "planned" ? "#B8B8B8" : "#7C7C7C";
            const statusText = done ? "Feito" : c.isToday ? "Hoje" : c.state === "planned" ? "Planejado" : c.state === "rest" ? "" : "—";

            return (
              <div
                key={i}
                className="relative flex min-w-0 flex-col items-center gap-1.5 rounded-tile px-1 py-2.5 text-center transition-transform duration-200 hover:-translate-y-0.5 sm:items-stretch sm:gap-2 sm:p-3 sm:text-left"
                style={style}
                title={c.acts.length ? c.acts.map((a) => a.title ?? sportLabel(a.sport)).join(", ") : c.planned?.title}
              >
                <div className="flex w-full flex-col items-center justify-between sm:flex-row">
                  <span className="text-[0.62rem] font-bold uppercase tracking-[0.12em]" style={{ color: c.isToday ? "#00FF66" : done ? "#E6E6E6" : "#888" }}>
                    {WEEK_LABELS[i]}
                  </span>
                  <span className="text-[0.62rem] tabular-nums text-brand-textTertiary">{String(c.d.getDate()).padStart(2, "0")}</span>
                </div>

                <div
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-sm sm:h-9 sm:w-9 sm:rounded-xl"
                  style={{
                    background: done ? "radial-gradient(circle at 50% 35%, rgba(0,255,102,0.35), rgba(0,255,102,0.06) 75%)" : "rgba(255,255,255,0.035)",
                    boxShadow: done ? "0 0 16px rgba(0,255,102,0.35)" : undefined,
                    opacity: c.state === "planned" || c.state === "today" ? 0.85 : c.state === "done" ? 1 : 0.5,
                  }}
                >
                  {c.sport && c.state !== "rest"
                    ? <SportIcon sport={c.sport} size="72%" />
                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#777" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M17 18a5 5 0 1 1-6.8-8.3A6 6 0 0 0 17 18Z" /></svg>}
                </div>

                <div className="hidden min-w-0 sm:block">
                  <div className="truncate text-[0.7rem] font-bold uppercase tracking-wide" style={{ color: titleColor }}>{c.label}</div>
                  <div className="od-num mt-0.5 h-5 truncate text-[0.95rem]" style={{ color: done ? "#fff" : "#9a9a9a" }}>{c.metric ?? ""}</div>
                </div>
                <div className="od-num truncate text-[0.6rem] sm:hidden" style={{ color: done ? "#fff" : "#888" }}>{c.metric?.replace(" km", "") ?? ""}</div>

                <div className="mt-auto hidden w-full sm:block">
                  <div className="mb-1.5 flex items-center justify-between text-[0.6rem] font-semibold uppercase tracking-wider" style={{ color: titleColor }}>
                    <span>{statusText}</span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full transition-[width] duration-700"
                      style={{
                        width: `${(c.load / maxLoad) * 100}%`,
                        background: done ? "linear-gradient(90deg,#00FF66,#C6FF00)" : "rgba(255,255,255,0.22)",
                        boxShadow: done ? "0 0 8px rgba(0,255,102,0.6)" : undefined,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <LegendDot color="#00FF66" label="Realizado" />
        <span className="inline-flex items-center gap-1.5 text-[0.72rem] text-brand-muted"><span className="h-2 w-2 rounded-full" style={{ boxShadow: "inset 0 0 0 1px #888" }} />Planejado (Duni)</span>
        <LegendDot color="#3a3a3a" label="Descanso" />
        <span className="inline-flex items-center gap-1.5 text-[0.72rem] text-brand-muted"><span className="h-2 w-2 rounded-full animate-od-pulse bg-brand-accent" />Hoje</span>
        <span className="ml-auto hidden text-[0.68rem] text-brand-textTertiary sm:inline">Barra = carga relativa (duração)</span>
      </div>
    </Panel>
  );
}
