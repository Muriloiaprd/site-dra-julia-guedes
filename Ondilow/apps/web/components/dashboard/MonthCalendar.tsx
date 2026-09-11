"use client";

import { useState } from "react";
import { Panel, Skeleton } from "@/components/ui/primitives";
import { MONTH_PT, sameDay, toISODate } from "@/lib/athlete";
import type { ActivitySummary, PlannedWorkout } from "@/lib/api";
import { sportColor } from "@/lib/utils";

const DOW = ["S", "T", "Q", "Q", "S", "S", "D"];

export function MonthCalendar({
  activities, plan, loading, onSelect, className = "",
}: {
  activities: ActivitySummary[];
  plan: PlannedWorkout[];
  loading: boolean;
  onSelect: (a: ActivitySummary) => void;
  className?: string;
}) {
  const [offset, setOffset] = useState(0);
  const today = new Date();
  const ref = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const year = ref.getFullYear(), month = ref.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const startDow = (ref.getDay() + 6) % 7;

  const byDay = new Map<number, ActivitySummary[]>();
  activities.forEach((a) => {
    const d = new Date(a.start_time);
    if (d.getMonth() === month && d.getFullYear() === year) byDay.set(d.getDate(), [...(byDay.get(d.getDate()) ?? []), a]);
  });
  const planByDate = new Map(plan.map((w) => [w.date, w]));

  const monthActs = Array.from(byDay.values()).flat();
  const monthKm = monthActs.reduce((s, a) => s + (a.distance_m ?? 0), 0) / 1000;

  return (
    <Panel className={className} aria-label="Calendário">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="od-label">Calendário</h2>
        <div className="flex items-center gap-1">
          <button type="button" className="od-icon-btn !h-7 !w-7 !rounded-lg" onClick={() => setOffset((o) => o - 1)} aria-label="Mês anterior" disabled={offset <= -11}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <span className="min-w-[92px] text-center text-[0.78rem] font-semibold">{MONTH_PT[month]} <span className="text-brand-muted">{year !== today.getFullYear() ? year : ""}</span></span>
          <button type="button" className="od-icon-btn !h-7 !w-7 !rounded-lg" onClick={() => setOffset((o) => o + 1)} aria-label="Próximo mês" disabled={offset >= 1}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>
      </div>

      {loading ? <Skeleton className="h-56" /> : (
        <>
          <div className="mb-1.5 grid grid-cols-7 gap-1">
            {DOW.map((d, i) => <div key={i} className="text-center text-[0.6rem] font-bold tracking-wider text-brand-textTertiary">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startDow }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: lastDay }, (_, i) => i + 1).map((day) => {
              const d = new Date(year, month, day);
              const acts = byDay.get(day) ?? [];
              const planned = planByDate.get(toISODate(d));
              const isToday = sameDay(d, today);
              const isFuture = d > today && !isToday;
              const color = acts[0] ? sportColor(acts[0].sport) : undefined;
              const done = acts.length > 0;
              const label = done ? `${acts.length} atividade(s)` : planned ? `Planejado: ${planned.title}` : undefined;
              return (
                <button
                  key={day}
                  type="button"
                  title={label}
                  disabled={!done}
                  onClick={() => done && onSelect(acts[0])}
                  className="relative flex aspect-square flex-col items-center justify-center gap-[3px] rounded-[9px] text-[0.7rem] transition-all duration-150 enabled:hover:scale-[1.08]"
                  style={{
                    background: isToday ? "rgba(0,255,102,0.14)" : done ? `${color}14` : "transparent",
                    boxShadow: isToday
                      ? "inset 0 0 0 1px rgba(0,255,102,0.6), 0 0 14px -4px rgba(0,255,102,0.6)"
                      : done ? `inset 0 0 0 1px ${color}33`
                      : planned ? "inset 0 0 0 1px rgba(255,255,255,0.16)" : undefined,
                    color: isToday ? "#00FF66" : done ? "#fff" : isFuture ? "#6E6E6E" : "#8a8a8a",
                    fontWeight: isToday || done ? 700 : 500,
                    cursor: done ? "pointer" : "default",
                  }}
                >
                  <span className="tabular-nums leading-none">{day}</span>
                  <span className="flex h-1 items-center gap-[2px]">
                    {acts.slice(0, 3).map((a, k) => (
                      <span key={k} className="h-1 w-1 rounded-full" style={{ background: sportColor(a.sport), boxShadow: `0 0 4px ${sportColor(a.sport)}` }} />
                    ))}
                    {!done && planned && <span className="h-1 w-1 rounded-full" style={{ boxShadow: "inset 0 0 0 1px #999" }} />}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
            <div className="flex items-center gap-3 text-[0.68rem] text-brand-muted">
              <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-brand-accent" />Treino</span>
              <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ boxShadow: "inset 0 0 0 1px #999" }} />Planejado</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-[3px]" style={{ boxShadow: "inset 0 0 0 1px rgba(0,255,102,0.7)" }} />Hoje</span>
            </div>
            <span className="text-[0.7rem] text-brand-muted"><strong className="od-num text-white">{monthActs.length}</strong> {monthActs.length === 1 ? "treino" : "treinos"} · <strong className="od-num text-white">{monthKm < 10 ? monthKm.toFixed(1) : monthKm.toFixed(0)}</strong> km</span>
          </div>
        </>
      )}
    </Panel>
  );
}
