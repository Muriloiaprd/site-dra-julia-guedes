"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

import { isRestWorkout } from "@/components/dashboard/WeekStrip";
import { SportTile } from "@/components/SportIcon";
import { Panel, Skeleton } from "@/components/ui/primitives";
import type { ActivitySummary, PlannedWorkout } from "@/lib/api";
import { MONTH_PT, sameDay, toISODate } from "@/lib/athlete";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { activeSeconds, formatDuration, formatPaceShort, isBikeSport, sportColor, sportLabel } from "@/lib/utils";

const DOW = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const DOW_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

const INTENSITY: Record<string, { label: string; color: string }> = {
  leve: { label: "Leve", color: "#00FF66" },
  moderado: { label: "Moderado", color: "#FFC145" },
  forte: { label: "Forte", color: "#F85149" },
};

/** `color` para o fundo escuro (gaveta do dia); `light` para a grade, que tem fundo claro. */
type Situacao = { label: string; icon: string; color: string; light: string };

const SIT = {
  descanso: { label: "Descanso", icon: "·", color: "#8C8C8C", light: "#6B726B" },
  cumprido: { label: "Cumprido", icon: "✓", color: "#00FF66", light: "#0A8A43" },
  perdido: { label: "Perdido", icon: "✕", color: "#F85149", light: "#C62F28" },
  hoje: { label: "Hoje", icon: "●", color: "#C6FF00", light: "#5F7A00" },
  planejado: { label: "Planejado", icon: "○", color: "#B5B5B5", light: "#4F564F" },
} satisfies Record<string, Situacao>;

/** Cumprido / perdido / hoje / planejado / descanso. O servidor marca o passado (reconcile_plan). */
function situacao(w: PlannedWorkout, todayIso: string): Situacao {
  if (isRestWorkout(w)) return SIT.descanso;
  if (w.status === "done") return SIT.cumprido;
  if (w.status === "skipped") return SIT.perdido;
  if (w.date === todayIso) return SIT.hoje;
  if (w.date < todayIso) return SIT.perdido;
  return SIT.planejado;
}

/** Verde de hoje na grade clara. */
const TODAY_LIGHT = "#0A8A43";

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

/** Dia do mês vizinho na grade: só o número, apagado. Fora da navegação por Tab (as setas andam no mês). */
function NeighborDay({ n, label, onClick }: { n: number; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      onClick={onClick}
      className="flex min-h-[54px] justify-center rounded-lg p-1 transition-colors hover:bg-white/[0.04] sm:min-h-[112px] sm:justify-start sm:rounded-xl sm:p-1.5"
      style={{ background: "#EDF0EB", boxShadow: "inset 0 0 0 1px #E1E5DF" }}
    >
      <span className="od-num flex h-6 items-center px-1 text-[0.95rem] font-bold leading-none text-[#B3BAB2] sm:text-[1.05rem]">{n}</span>
    </button>
  );
}

/** O mês inteiro na largura da tela; tocar num dia abre a gaveta com o planejado e o feito. */
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
  const prevLastDay = new Date(year, month, 0).getDate();
  const startDow = (new Date(year, month, 1).getDay() + 6) % 7;

  const [picked, setPicked] = useState<{ key: string; day: number } | null>(null);
  const monthKey = `${year}-${month}`;
  // o dia em foco vale só para o mês em que foi escolhido; ao trocar de mês, hoje ou o dia 1
  const selDay = picked?.key === monthKey && picked.day <= lastDay ? picked.day : isThisMonth ? today.getDate() : 1;
  const dayRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  // gaveta com o detalhe do dia: abre no clique (ou Enter); as setas só andam pela grade
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  useFocusTrap(drawerRef, drawerOpen, () => setDrawerOpen(false), openerRef);

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

  function openDay(day: number) {
    select(day);
    openerRef.current = dayRefs.current[day] ?? null;
    setDrawerOpen(true);
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

  return (
    <>
      <Panel aria-label="Calendário de treinos" className="od-cal-claro">
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
        <div className="mb-4 grid grid-cols-3 gap-2 sm:max-w-xl">
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
            {/* a grade do mês na tela toda: no computador com o nome do treino, no celular com pontinhos */}
            <div className="mb-1.5 grid grid-cols-7 gap-1 sm:gap-1.5">
              {DOW.map((d) => <div key={d} className="text-center text-[0.66rem] font-bold uppercase tracking-wider text-brand-textSecondary sm:px-1.5 sm:text-left sm:text-[0.7rem]">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5" role="group" aria-label={`Dias de ${MONTH_PT[month]} ${year}. Use as setas para andar pelos dias e Enter para abrir.`} onKeyDown={onGridKey}>
              {/* fim do mês anterior: só o número, apagado; tocar vai para aquele mês */}
              {Array.from({ length: startDow }, (_, i) => prevLastDay - startDow + 1 + i).map((n) => (
                <NeighborDay key={`p${n}`} n={n} label={`Ir para ${MONTH_PT[(month + 11) % 12]}`} onClick={() => onMonth(-1)} />
              ))}
              {Array.from({ length: lastDay }, (_, i) => i + 1).map((day) => {
                const d = new Date(year, month, day);
                const plans = planByDay.get(day) ?? [];
                const acts = actsByDay.get(day) ?? [];
                const isToday = sameDay(d, today);
                const resumo = [
                  ...plans.map((w) => `${situacao(w, todayIso).label}: ${w.title}`),
                  acts.length ? `${acts.length} ${acts.length === 1 ? "atividade feita" : "atividades feitas"}` : null,
                ].filter(Boolean).join("; ");
                return (
                  <button
                    key={day}
                    ref={(el) => { dayRefs.current[day] = el; }}
                    type="button"
                    tabIndex={day === selDay ? 0 : -1}
                    aria-haspopup="dialog"
                    aria-current={isToday ? "date" : undefined}
                    aria-label={`${day} de ${MONTH_PT[month]}${isToday ? ", hoje" : ""} — ${resumo || "sem treino"}`}
                    onFocus={() => setPicked({ key: monthKey, day })}
                    onClick={() => openDay(day)}
                    className="flex min-h-[54px] flex-col items-center gap-1 overflow-hidden rounded-lg p-1 text-left transition-colors hover:brightness-[0.97] sm:min-h-[112px] sm:items-stretch sm:rounded-xl sm:p-1.5"
                    style={{
                      background: isToday ? "#E6F6EC" : "#FFFFFF",
                      boxShadow: isToday ? `inset 0 0 0 1.5px ${TODAY_LIGHT}` : "inset 0 0 0 1px #D9DED7",
                    }}
                  >
                    {/* número do dia grande e claro; hoje vem num círculo verde */}
                    <span
                      className={`od-num flex h-6 min-w-[1.5rem] items-center justify-center self-center rounded-full px-1 text-[0.95rem] font-bold leading-none sm:self-start sm:text-[1.05rem] ${isToday ? "text-white" : "text-[#14171A]"}`}
                      style={isToday ? { background: TODAY_LIGHT } : undefined}
                    >
                      {day}
                    </span>

                    {/* celular: um ponto por treino planejado (cor da situação; cheio se cumprido) e por atividade (cor do esporte) */}
                    <span className="flex flex-wrap justify-center gap-[3px] sm:hidden" aria-hidden>
                      {plans.slice(0, 2).map((w) => {
                        const s = situacao(w, todayIso);
                        return <span key={w.id} className="h-1.5 w-1.5 rounded-full" style={{ boxShadow: `inset 0 0 0 1.5px ${s.light}`, background: w.status === "done" ? s.light : "transparent" }} />;
                      })}
                      {acts.slice(0, 2).map((a) => <span key={a.id} className="h-1.5 w-1.5 rounded-full" style={{ background: sportColor(a.sport) }} />)}
                    </span>

                    {/* computador e tablet: o nome do treino e os km */}
                    {plans.slice(0, 2).map((w) => {
                      const s = situacao(w, todayIso);
                      return (
                        <span key={w.id} className="hidden min-w-0 items-center gap-1 rounded-md px-1 py-0.5 text-[0.66rem] leading-tight sm:flex" style={{ color: s.light, background: `${s.light}14`, boxShadow: `inset 0 0 0 1px ${s.light}40` }}>
                          <span aria-hidden className="shrink-0">{s.icon}</span>
                          <span className="truncate">{w.title}</span>
                        </span>
                      );
                    })}
                    {acts.slice(0, 2).map((a) => (
                      <span key={a.id} className="hidden min-w-0 items-center gap-1 px-0.5 text-[0.66rem] leading-tight text-brand-textSecondary sm:flex">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: sportColor(a.sport), boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.25)" }} />
                        <span className="truncate">{kmText(a.distance_m) ?? sportLabel(a.sport)}</span>
                      </span>
                    ))}
                    {acts.length + plans.length > 4 && <span className="hidden px-0.5 text-[0.6rem] text-brand-muted sm:block">+{acts.length + plans.length - 4}</span>}
                  </button>
                );
              })}
              {/* começo do mês seguinte, até fechar a última semana */}
              {Array.from({ length: (7 - ((startDow + lastDay) % 7)) % 7 }, (_, i) => i + 1).map((n) => (
                <NeighborDay key={`n${n}`} n={n} label={`Ir para ${MONTH_PT[(month + 1) % 12]}`} onClick={() => onMonth(1)} />
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-white/5 pt-3 text-[0.68rem] text-brand-muted">
              <span><span style={{ color: SIT.cumprido.light }}>✓</span> Cumprido</span>
              <span><span style={{ color: SIT.perdido.light }}>✕</span> Perdido</span>
              <span><span style={{ color: SIT.hoje.light }}>●</span> Hoje</span>
              <span><span style={{ color: SIT.planejado.light }}>○</span> Planejado</span>
              <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: "#0A8A43" }} /> Atividade feita</span>
              <span className="w-full sm:ml-auto sm:w-auto">Toque num dia para ver os detalhes.</span>
            </div>
          </>
        )}
      </Panel>

      {/* gaveta do dia: entra pela direita no computador e por baixo no celular; no body, porque um pai com
          transform (animação de entrada) prenderia o "fixed" a ele em vez da tela */}
      {drawerOpen && createPortal(
        <div className="fixed inset-0 z-50" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dia-titulo"
            onClick={(e) => e.stopPropagation()}
            className="od-panel absolute inset-x-0 bottom-0 max-h-[82vh] animate-od-fade-up overflow-y-auto !rounded-b-none !p-5 sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[420px] sm:!rounded-l-2xl sm:!rounded-r-none"
            style={{ background: "#0F110F", boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 -20px 60px -20px rgba(0,0,0,0.8)", paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="od-label od-label-accent mb-1">{sameDay(selDate, today) ? "Hoje" : "Dia"}</div>
                <h3 id="dia-titulo" className="font-display text-lg font-bold first-letter:uppercase">{longDate(selDate)}</h3>
              </div>
              <button type="button" onClick={() => setDrawerOpen(false)} className="od-icon-btn !h-9 !w-9 !rounded-full" aria-label="Fechar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-3">
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
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
