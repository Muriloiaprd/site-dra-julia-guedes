"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";

import { isRestWorkout } from "@/components/dashboard/WeekStrip";
import { SportTile } from "@/components/SportIcon";
import { Panel, Skeleton } from "@/components/ui/primitives";
import type { ActivitySummary, PlannedWorkout } from "@/lib/api";
import { MONTH_PT, sameDay, toISODate } from "@/lib/athlete";
import { activeSeconds, formatDuration, formatPaceShort, isBikeSport, sportColor, sportLabel } from "@/lib/utils";

const DOW = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const DOW_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

const INTENSITY: Record<string, { label: string; color: string }> = {
  leve: { label: "Leve", color: "#00FF66" },
  moderado: { label: "Moderado", color: "#FFC145" },
  forte: { label: "Forte", color: "#F85149" },
};

type Situacao = { label: string; icon: string; color: string };

/** Cumprido / perdido / hoje / planejado / descanso. O servidor marca o passado (reconcile_plan). */
function situacao(w: PlannedWorkout, todayIso: string): Situacao {
  if (isRestWorkout(w)) return { label: "Descanso", icon: "·", color: "#8C8C8C" };
  if (w.status === "done") return { label: "Cumprido", icon: "✓", color: "#00FF66" };
  if (w.status === "skipped") return { label: "Perdido", icon: "✕", color: "#F85149" };
  if (w.date === todayIso) return { label: "Hoje", icon: "●", color: "#C6FF00" };
  if (w.date < todayIso) return { label: "Perdido", icon: "✕", color: "#F85149" };
  return { label: "Planejado", icon: "○", color: "#B5B5B5" };
}

/** 52.4 → "52" · 6.2 → "6,2" */
const kmNum = (km: number) => km.toLocaleString("pt-BR", { maximumFractionDigits: km < 10 ? 1 : 0 });

const kmText = (m: number | null | undefined) =>
  m ? `${(m / 1000).toLocaleString("pt-BR", { maximumFractionDigits: m >= 10000 ? 0 : 1 })} km` : null;

/** 1800 → "30 min" · 5040 → "1h24" */
function durText(s: number) {
  const min = Math.round(s / 60);
  return min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}` : `${min} min`;
}

function targetText(w: PlannedWorkout) {
  return [kmText(w.target_distance_m), w.target_duration_s ? durText(w.target_duration_s) : null].filter(Boolean).join(" · ");
}

function activityText(a: ActivitySummary) {
  return [kmText(a.distance_m), formatDuration(activeSeconds(a))].filter(Boolean).join(" · ");
}

/** "terça, 20 de outubro" */
function longDate(d: Date) {
  return `${DOW_LONG[d.getDay()]}, ${d.getDate()} de ${MONTH_PT[d.getMonth()].toLowerCase()}`;
}

export function TrainingCalendar({
  year, month, activities, workouts, loading, onMonth,
}: {
  year: number;
  /** 0 a 11 */
  month: number;
  activities: ActivitySummary[];
  /** Treinos planejados do mês visível (pode trazer dias vizinhos). */
  workouts: PlannedWorkout[];
  loading: boolean;
  /** -1 mês anterior · +1 próximo · 0 volta para hoje */
  onMonth: (step: -1 | 0 | 1) => void;
}) {
  const today = new Date();
  const todayIso = toISODate(today);
  const isThisMonth = today.getFullYear() === year && today.getMonth() === month;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const startDow = (new Date(year, month, 1).getDay() + 6) % 7;

  const [picked, setPicked] = useState<{ key: string; day: number } | null>(null);
  const monthKey = `${year}-${month}`;
  // o dia escolhido vale só para o mês em que foi escolhido; ao trocar de mês, hoje ou o dia 1
  const selDay = picked?.key === monthKey && picked.day <= lastDay ? picked.day : isThisMonth ? today.getDate() : 1;
  const dayRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  const { actsByDay, planByDay } = useMemo(() => {
    const actsByDay = new Map<number, ActivitySummary[]>();
    for (const a of activities) {
      const d = new Date(a.start_time);
      if (d.getFullYear() === year && d.getMonth() === month) actsByDay.set(d.getDate(), [...(actsByDay.get(d.getDate()) ?? []), a]);
    }
    actsByDay.forEach((list) => list.sort((x, y) => x.start_time.localeCompare(y.start_time)));
    const planByDay = new Map<number, PlannedWorkout[]>();
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
    for (const w of workouts) {
      if (!w.date.startsWith(prefix)) continue;
      const day = Number(w.date.slice(8, 10));
      planByDay.set(day, [...(planByDay.get(day) ?? []), w]);
    }
    return { actsByDay, planByDay };
  }, [activities, workouts, year, month]);

  const totals = useMemo(() => {
    const acts = Array.from(actsByDay.values()).flat();
    const plans = Array.from(planByDay.values()).flat().filter((w) => !isRestWorkout(w));
    const past = plans.filter((w) => w.date < todayIso || w.status !== "planned");
    return {
      doneCount: acts.length,
      doneKm: acts.reduce((s, a) => s + (a.distance_m ?? 0), 0) / 1000,
      planCount: plans.length,
      planKm: plans.reduce((s, w) => s + (w.target_distance_m ?? 0), 0) / 1000,
      cumpridos: past.filter((w) => w.status === "done").length,
      vencidos: past.length,
    };
  }, [actsByDay, planByDay, todayIso]);

  function select(day: number, focus = false) {
    setPicked({ key: monthKey, day });
    if (focus) dayRefs.current[day]?.focus();
  }

  function onGridKey(e: KeyboardEvent<HTMLDivElement>) {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next: number | null = null;
    if (e.key in step) next = Math.min(lastDay, Math.max(1, selDay + step[e.key]));
    else if (e.key === "Home") next = 1;
    else if (e.key === "End") next = lastDay;
    if (next == null) return;
    e.preventDefault();
    select(next, true);
  }

  const selDate = new Date(year, month, selDay);
  const selPlans = planByDay.get(selDay) ?? [];
  const selActs = actsByDay.get(selDay) ?? [];

  // semanas do mês (segunda a domingo) para a lista do celular
  const weeks = useMemo(() => {
    const out: number[][] = [];
    let cur: number[] = [];
    for (let d = 1; d <= lastDay; d++) {
      cur.push(d);
      if ((startDow + d) % 7 === 0 || d === lastDay) { out.push(cur); cur = []; }
    }
    return out;
  }, [lastDay, startDow]);

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <Panel className="lg:col-span-8" aria-label="Calendário de treinos">
        {/* cabeçalho: mês e navegação */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold">
            {MONTH_PT[month]} <span className="text-brand-muted">{year}</span>
          </h2>
          <div className="flex items-center gap-1.5">
            {!isThisMonth && <button type="button" className="od-btn od-btn-ghost od-btn-sm" onClick={() => onMonth(0)}>Hoje</button>}
            <button type="button" className="od-icon-btn !h-8 !w-8 !rounded-lg" onClick={() => onMonth(-1)} aria-label="Mês anterior">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <button type="button" className="od-icon-btn !h-8 !w-8 !rounded-lg" onClick={() => onMonth(1)} aria-label="Próximo mês">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </div>
        </div>

        {/* totais do mês */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          {[
            { k: "Feito", v: `${kmNum(totals.doneKm)} km`, s: `${totals.doneCount} ${totals.doneCount === 1 ? "treino" : "treinos"}` },
            { k: "Plano", v: `${kmNum(totals.planKm)} km`, s: `${totals.planCount} ${totals.planCount === 1 ? "treino" : "treinos"}` },
            { k: "Cumpriu", v: totals.vencidos ? `${totals.cumpridos} de ${totals.vencidos}` : "—", s: totals.vencidos ? "até hoje" : "nada vencido" },
          ].map((t) => (
            <div key={t.k} className="od-tile px-3 py-2.5">
              <div className="od-metric-label truncate">{t.k}</div>
              {loading ? <Skeleton className="mt-1.5 h-5 w-14" /> : <div className="od-num mt-1 truncate text-[1.15rem] leading-tight">{t.v}</div>}
              <div className="truncate text-[0.66rem] text-brand-muted">{t.s}</div>
            </div>
          ))}
        </div>

        {loading ? <Skeleton className="h-[420px]" /> : (
          <>
            {/* computador e tablet: grade do mês */}
            <div className="hidden md:block">
              <div className="mb-1.5 grid grid-cols-7 gap-1.5">
                {DOW.map((d) => <div key={d} className="px-1 text-[0.62rem] font-bold uppercase tracking-wider text-brand-textTertiary">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1.5" role="group" aria-label={`Dias de ${MONTH_PT[month]} ${year}. Use as setas para andar pelos dias.`} onKeyDown={onGridKey}>
                {Array.from({ length: startDow }).map((_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: lastDay }, (_, i) => i + 1).map((day) => {
                  const d = new Date(year, month, day);
                  const plans = planByDay.get(day) ?? [];
                  const acts = actsByDay.get(day) ?? [];
                  const isToday = sameDay(d, today);
                  const selected = day === selDay;
                  const resumo = [
                    ...plans.map((w) => `${situacao(w, todayIso).label}: ${w.title}`),
                    acts.length ? `${acts.length} ${acts.length === 1 ? "atividade feita" : "atividades feitas"}` : null,
                  ].filter(Boolean).join("; ");
                  return (
                    <button
                      key={day}
                      ref={(el) => { dayRefs.current[day] = el; }}
                      type="button"
                      tabIndex={selected ? 0 : -1}
                      aria-pressed={selected}
                      aria-current={isToday ? "date" : undefined}
                      aria-label={`${day} de ${MONTH_PT[month]}${isToday ? ", hoje" : ""} — ${resumo || "sem treino"}`}
                      onClick={() => select(day)}
                      className="flex min-h-[104px] flex-col gap-1 overflow-hidden rounded-xl p-1.5 text-left transition-colors hover:bg-white/[0.04]"
                      style={{
                        background: selected ? "rgba(255,255,255,0.05)" : isToday ? "rgba(0,255,102,0.06)" : "rgba(255,255,255,0.015)",
                        boxShadow: selected
                          ? "inset 0 0 0 1.5px rgba(0,255,102,0.7)"
                          : isToday ? "inset 0 0 0 1px rgba(0,255,102,0.45)" : "inset 0 0 0 1px rgba(255,255,255,0.05)",
                      }}
                    >
                      <span className={`od-num px-0.5 text-[0.78rem] leading-none ${isToday ? "text-brand-accent" : acts.length || plans.length ? "text-white" : "text-brand-textTertiary"}`}>
                        {day}
                      </span>
                      {plans.slice(0, 2).map((w) => {
                        const s = situacao(w, todayIso);
                        return (
                          <span key={w.id} className="flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5 text-[0.64rem] leading-tight" style={{ color: s.color, background: `${s.color}12`, boxShadow: `inset 0 0 0 1px ${s.color}38` }}>
                            <span aria-hidden className="shrink-0">{s.icon}</span>
                            <span className="truncate">{w.title}</span>
                          </span>
                        );
                      })}
                      {acts.slice(0, 2).map((a) => (
                        <span key={a.id} className="flex min-w-0 items-center gap-1 px-0.5 text-[0.64rem] leading-tight text-brand-textSecondary">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: sportColor(a.sport), boxShadow: `0 0 5px ${sportColor(a.sport)}` }} />
                          <span className="truncate">{kmText(a.distance_m) ?? sportLabel(a.sport)}</span>
                        </span>
                      ))}
                      {acts.length + plans.length > 4 && <span className="px-0.5 text-[0.6rem] text-brand-muted">+{acts.length + plans.length - 4}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* celular: lista por semana, só os dias com algo (e hoje) */}
            <div className="space-y-4 md:hidden">
              {weeks.map((days) => {
                const shown = days.filter((day) => (planByDay.get(day)?.length ?? 0) + (actsByDay.get(day)?.length ?? 0) > 0 || (isThisMonth && day === today.getDate()));
                const km = days.reduce((s, day) => s + (actsByDay.get(day) ?? []).reduce((t, a) => t + (a.distance_m ?? 0), 0), 0) / 1000;
                return (
                  <section key={days[0]} aria-label={`Semana de ${days[0]} a ${days[days.length - 1]}`}>
                    <div className="mb-1.5 flex items-baseline justify-between px-1">
                      <span className="od-metric-label">{days[0]}–{days[days.length - 1]} de {MONTH_PT[month].toLowerCase()}</span>
                      <span className="text-[0.68rem] text-brand-muted">{km > 0 ? `${kmNum(km)} km feitos` : ""}</span>
                    </div>
                    {shown.length === 0 ? (
                      <p className="rounded-xl bg-white/[0.02] px-3 py-2.5 text-[0.75rem] text-brand-textTertiary">Nada nesta semana.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {shown.map((day) => {
                          const d = new Date(year, month, day);
                          const plans = planByDay.get(day) ?? [];
                          const acts = actsByDay.get(day) ?? [];
                          const isToday = sameDay(d, today);
                          return (
                            <li key={day}>
                              <button
                                type="button"
                                onClick={() => select(day)}
                                aria-pressed={day === selDay}
                                className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left"
                                style={{
                                  background: day === selDay ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
                                  boxShadow: day === selDay ? "inset 0 0 0 1.5px rgba(0,255,102,0.7)" : isToday ? "inset 0 0 0 1px rgba(0,255,102,0.45)" : undefined,
                                }}
                              >
                                <span className="w-9 shrink-0 text-center">
                                  <span className="block text-[0.6rem] font-bold uppercase text-brand-textTertiary">{DOW[(d.getDay() + 6) % 7]}</span>
                                  <span className={`od-num block text-[1.05rem] leading-tight ${isToday ? "text-brand-accent" : ""}`}>{day}</span>
                                </span>
                                <span className="min-w-0 flex-1 space-y-1">
                                  {plans.map((w) => {
                                    const s = situacao(w, todayIso);
                                    return (
                                      <span key={w.id} className="flex items-center gap-1.5 text-[0.8rem]">
                                        <span style={{ color: s.color }} aria-hidden>{s.icon}</span>
                                        <span className="truncate font-medium">{w.title}</span>
                                        <span className="shrink-0 text-[0.68rem]" style={{ color: s.color }}>{s.label}</span>
                                      </span>
                                    );
                                  })}
                                  {acts.map((a) => (
                                    <span key={a.id} className="flex items-center gap-1.5 text-[0.75rem] text-brand-textSecondary">
                                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: sportColor(a.sport) }} />
                                      <span className="truncate">{sportLabel(a.sport)} · {activityText(a)}</span>
                                    </span>
                                  ))}
                                  {plans.length + acts.length === 0 && <span className="text-[0.75rem] text-brand-muted">Hoje — nada planejado</span>}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-white/5 pt-3 text-[0.68rem] text-brand-muted">
              <span><span className="text-brand-accent">✓</span> Cumprido</span>
              <span><span className="text-brand-danger">✕</span> Perdido</span>
              <span><span style={{ color: "#C6FF00" }}>●</span> Hoje</span>
              <span><span style={{ color: "#B5B5B5" }}>○</span> Planejado</span>
              <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-brand-accent" /> Atividade feita</span>
            </div>
          </>
        )}
      </Panel>

      {/* detalhe do dia escolhido */}
      <Panel className="lg:col-span-4 lg:self-start lg:sticky lg:top-6" aria-live="polite" aria-label="Treinos do dia">
        <div className="od-label od-label-accent mb-1">{sameDay(selDate, today) ? "Hoje" : "Dia escolhido"}</div>
        <h3 className="font-display text-lg font-bold first-letter:uppercase">{longDate(selDate)}</h3>

        {loading ? <Skeleton className="mt-4 h-40" /> : (
          <div className="mt-4 space-y-3">
            {selPlans.map((w) => {
              const s = situacao(w, todayIso);
              const intensity = w.target_intensity ? INTENSITY[w.target_intensity] : undefined;
              const target = targetText(w);
              return (
                <article key={w.id} className="od-tile space-y-2 p-3.5" style={{ boxShadow: `inset 0 0 0 1px ${s.color}38` }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[0.62rem] font-bold uppercase tracking-wider text-brand-muted">Planejado{w.goal_plan_id ? " · plano do objetivo" : w.weekly_plan_id ? " · plano da semana" : ""}</div>
                      <p className="mt-0.5 font-semibold leading-snug">{w.title}</p>
                    </div>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[0.66rem] font-bold" style={{ color: s.color, background: `${s.color}14`, boxShadow: `inset 0 0 0 1px ${s.color}50` }}>
                      {s.icon} {s.label}
                    </span>
                  </div>
                  <p className="text-[0.75rem] text-brand-textSecondary">
                    {sportLabel(w.sport)}
                    {intensity && <> · <span style={{ color: intensity.color }}>{intensity.label}</span></>}
                    {target && <> · {target}</>}
                  </p>
                  {(w.targets?.ritmo || w.targets?.zona_fc) && (
                    <p className="text-[0.75rem] text-brand-textSecondary">
                      {w.targets?.ritmo && <>Ritmo <span className="text-white">{w.targets.ritmo}</span></>}
                      {w.targets?.ritmo && w.targets?.zona_fc && " · "}
                      {w.targets?.zona_fc && <>FC <span className="text-white">{w.targets.zona_fc}</span></>}
                    </p>
                  )}
                  {(w.objective || w.description) && <p className="text-[0.75rem] leading-snug text-brand-muted">{w.objective ?? w.description}</p>}
                  {w.activity_id && (
                    <Link href={`/activities/${w.activity_id}`} className="inline-block text-[0.75rem] font-semibold text-brand-accent hover:underline">Ver o treino feito →</Link>
                  )}
                </article>
              );
            })}

            {selActs.map((a) => (
              <Link key={a.id} href={`/activities/${a.id}`} className="od-tile flex items-center gap-3 p-3 transition-colors hover:bg-white/[0.05]">
                <SportTile sport={a.sport} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.62rem] font-bold uppercase tracking-wider text-brand-muted">Feito · {new Date(a.start_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="block truncate text-[0.85rem] font-semibold">{a.title ?? sportLabel(a.sport)}</span>
                  <span className="block truncate text-[0.72rem] text-brand-textSecondary">
                    {activityText(a)}
                    {a.avg_pace_s_per_km && !isBikeSport(a.sport) ? ` · ${formatPaceShort(a.avg_pace_s_per_km)}/km` : ""}
                    {a.avg_hr ? ` · ${Math.round(a.avg_hr)} bpm` : ""}
                  </span>
                </span>
                <span className="text-brand-accent" aria-hidden>→</span>
              </Link>
            ))}

            {selPlans.length === 0 && selActs.length === 0 && (
              <p className="rounded-xl bg-white/[0.02] px-3.5 py-3 text-sm text-brand-muted">
                {toISODate(selDate) >= todayIso ? "Nada planejado para este dia." : "Nada planejado nem feito neste dia."}
              </p>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
