"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { WorkoutEditForm } from "@/components/calendar/WorkoutEditForm";
import { isRestWorkout } from "@/components/dashboard/WeekStrip";
import { SportTile } from "@/components/SportIcon";
import { Panel, Skeleton } from "@/components/ui/primitives";
import type { ActivitySummary, PlannedWorkout } from "@/lib/api";
import { MONTH_PT, toISODate } from "@/lib/athlete";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { activeSeconds, formatDuration, formatPaceShort, isBikeSport, sportLabel } from "@/lib/utils";

const DOW = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

type Visao = "mes" | "semana";

/** Tudo em fundo claro (o resto do app continua escuro). */
const INK = "#14171A";
const MUTED = "#5A625A";
const HAIRLINE = "#E1E6DF";
const TODAY = "#0A8A43";

const INTENSITY: Record<string, { label: string; color: string }> = {
  leve: { label: "Leve", color: "#0A8A43" },
  moderado: { label: "Moderado", color: "#A86A00" },
  forte: { label: "Forte", color: "#C62F28" },
};

/** `fg`/`bg` da etiqueta do treino; `dot` na legenda e nos pontinhos do celular. */
type Situacao = { label: string; icon: string; fg: string; bg: string; dot: string };

const SIT = {
  descanso: { label: "Descanso", icon: "·", fg: "#7A827A", bg: "transparent", dot: "#B3BAB2" },
  concluido: { label: "Concluído", icon: "✓", fg: "#0A6B34", bg: "#DCF2E3", dot: "#16A34A" },
  perdido: { label: "Perdido", icon: "✕", fg: "#A8261F", bg: "#FBE4E2", dot: "#DC3B33" },
  hoje: { label: "Hoje", icon: "●", fg: "#4A6200", bg: "#ECF6CF", dot: "#84CC16" },
  planejado: { label: "Planejado", icon: "○", fg: "#434A43", bg: "#ECEFEA", dot: "#9AA19A" },
} satisfies Record<string, Situacao>;

/** Concluído / perdido / hoje / planejado / descanso. O servidor marca o passado (reconcile_plan). */
function situacao(w: PlannedWorkout, todayIso: string): Situacao {
  if (isRestWorkout(w)) return SIT.descanso;
  if (w.status === "done") return SIT.concluido;
  if (w.status === "skipped") return SIT.perdido;
  if (w.date === todayIso) return SIT.hoje;
  if (w.date < todayIso) return SIT.perdido;
  return SIT.planejado;
}

/* ───────────── datas ───────────── */

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** Segunda-feira da semana de `d`. */
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
const fromIso = (iso: string) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const dow = (d: Date) => DOW[(d.getDay() + 6) % 7];
const mes3 = (d: Date) => MONTH_PT[d.getMonth()].slice(0, 3).toLowerCase();

/** "TER, 21 OUT" */
const shortDate = (d: Date) => `${dow(d)}, ${d.getDate()} ${mes3(d)}`.toUpperCase();

/** "20 – 26 de outubro" · "27 de out – 2 de nov" */
function weekTitle(a: Date, b: Date) {
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} – ${b.getDate()} de ${MONTH_PT[a.getMonth()].toLowerCase()}`
    : `${a.getDate()} de ${mes3(a)} – ${b.getDate()} de ${mes3(b)}`;
}

/* ───────────── textos ───────────── */

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

const paceText = (a: ActivitySummary) => (a.avg_pace_s_per_km && !isBikeSport(a.sport) ? `${formatPaceShort(a.avg_pace_s_per_km)}/km` : null);

/** Uma etiqueta na grade: treino planejado (cor da situação) ou atividade feita sem plano (concluído). */
type Item = { key: string; sport: string; title: string; sub: string | null; extra: string | null; sit: Situacao };

function planItem(w: PlannedWorkout, todayIso: string): Item {
  const intensity = w.target_intensity ? INTENSITY[w.target_intensity]?.label : null;
  return {
    key: w.id, sport: w.sport, title: w.title, sit: situacao(w, todayIso),
    sub: targetText(w) || null,
    extra: [intensity, w.targets?.ritmo, w.targets?.zona_fc].filter(Boolean).join(" · ") || null,
  };
}

function activityItem(a: ActivitySummary): Item {
  return {
    key: a.id, sport: a.sport, title: a.title ?? sportLabel(a.sport), sit: SIT.concluido,
    sub: kmText(a.distance_m) ?? formatDuration(activeSeconds(a)),
    extra: [paceText(a), a.avg_hr ? `${Math.round(a.avg_hr)} bpm` : null].filter(Boolean).join(" · ") || null,
  };
}

/* ───────────── peças ───────────── */

/** Ícone de traço do esporte, na cor da etiqueta. */
function SportGlyph({ sport }: { sport: string }) {
  const svg = (d: ReactNode) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">{d}</svg>
  );
  if (["run", "trail_run", "treadmill"].includes(sport)) return svg(<><circle cx="14" cy="4" r="2" /><path d="m5 21 4-6 3 2 2-6" /><path d="m7 11 3-3 5 1 2 4h3" /></>);
  if (isBikeSport(sport)) return svg(<><circle cx="5.5" cy="16" r="3.5" /><circle cx="18.5" cy="16" r="3.5" /><path d="m5.5 16 4-7h5l4 7M9.5 9 13 16" /></>);
  if (sport.includes("swim")) return svg(<><circle cx="16" cy="6" r="2" /><path d="m4 13 5-4 4 3" /><path d="M2 18c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5" /></>);
  if (sport === "strength" || sport === "pilates") return svg(<path d="M6 6v12M18 6v12M3 9v6M21 9v6M6 12h12" />);
  if (sport === "rest") return svg(<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z" />);
  return svg(<path d="M3 12h4l3 8 4-16 3 8h4" />);
}

function Pill({ it, full }: { it: Item; full?: boolean }) {
  return (
    <span className="block min-w-0">
      <span className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-[0.68rem] font-semibold leading-tight" style={{ color: it.sit.fg, background: it.sit.bg }}>
        <SportGlyph sport={it.sport} />
        {/* no mês, até duas linhas: a célula é estreita no computador com o menu e o painel do dia */}
        <span className={full ? "min-w-0 break-words" : "line-clamp-2 min-w-0 break-words"}>{it.title}</span>
      </span>
      {it.sub && <span className="mt-0.5 block truncate px-1.5 text-[0.64rem]" style={{ color: MUTED }}>{it.sub}</span>}
      {full && it.extra && <span className="block px-1.5 text-[0.62rem] leading-snug" style={{ color: MUTED }}>{it.extra}</span>}
    </span>
  );
}

function CalendarIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="od-icon-btn !h-8 !w-8 !rounded-full" aria-label="Fechar">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
    </button>
  );
}

/** Dá para editar à mão: ainda não feito, de hoje em diante (a API confere de novo). */
const editavel = (w: PlannedWorkout, todayIso: string) => w.status === "planned" && w.date >= todayIso && !isRestWorkout(w);

/** O detalhe de um dia: no painel da direita (computador) e na gaveta (celular e tablet). */
function DayDetail({ date, plans, acts, todayIso, onSemana, onChanged }: {
  date: Date;
  plans: PlannedWorkout[];
  acts: ActivitySummary[];
  todayIso: string;
  /** Só na visão Mês: abre a semana deste dia. */
  onSemana?: () => void;
  /** Um treino foi editado aqui: a página avisa todas as telas. */
  onChanged?: () => void;
}) {
  const iso = toISODate(date);
  const vazio = plans.length === 0 && acts.length === 0;
  const [editing, setEditing] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  // trocou de dia: fecha a edição e o aviso
  useEffect(() => { setEditing(null); setSaved(null); }, [iso]);
  return (
    <div className="space-y-3">
      {saved && (
        <p role="status" className="rounded-xl px-3 py-2 text-[0.75rem] font-semibold" style={{ color: "#0A6B34", background: "#DCF2E3" }}>
          Treino salvo. Já aparece no Calendário, no Dashboard e no plano.
        </p>
      )}
      {plans.map((w) => {
        const s = situacao(w, todayIso);
        if (editing === w.id) {
          return (
            <article key={w.id} className="space-y-2 rounded-xl bg-white p-3.5" style={{ boxShadow: `inset 0 0 0 1px ${HAIRLINE}` }}>
              <div className="text-[0.62rem] font-bold uppercase tracking-wider" style={{ color: MUTED }}>Editar treino</div>
              <WorkoutEditForm
                w={w}
                onCancel={() => setEditing(null)}
                onSaved={() => { setEditing(null); setSaved(w.id); onChanged?.(); }}
              />
            </article>
          );
        }
        const intensity = w.target_intensity ? INTENSITY[w.target_intensity] : undefined;
        const target = targetText(w);
        return (
          <article key={w.id} className="space-y-2 rounded-xl bg-white p-3.5" style={{ boxShadow: `inset 0 0 0 1px ${HAIRLINE}` }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[0.62rem] font-bold uppercase tracking-wider" style={{ color: MUTED }}>Planejado{w.goal_plan_id ? " · plano do objetivo" : w.weekly_plan_id ? " · plano da semana" : ""}</div>
                <p className="mt-0.5 font-semibold leading-snug">{w.title}</p>
              </div>
              <span className="shrink-0 rounded-full px-2 py-0.5 text-[0.66rem] font-bold" style={{ color: s.fg, background: s.bg === "transparent" ? "#F0F2EF" : s.bg }}>
                {s.icon} {s.label}
              </span>
            </div>
            <p className="text-[0.75rem]" style={{ color: MUTED }}>
              {sportLabel(w.sport)}
              {intensity && <> · <span style={{ color: intensity.color }}>{intensity.label}</span></>}
              {target && <> · {target}</>}
            </p>
            {(w.targets?.ritmo || w.targets?.zona_fc) && (
              <p className="text-[0.75rem]" style={{ color: MUTED }}>
                {w.targets?.ritmo && <>Ritmo <span style={{ color: INK }}>{w.targets.ritmo}</span></>}
                {w.targets?.ritmo && w.targets?.zona_fc && " · "}
                {w.targets?.zona_fc && <>FC <span style={{ color: INK }}>{w.targets.zona_fc}</span></>}
              </p>
            )}
            {(w.objective || w.description) && <p className="text-[0.75rem] leading-snug" style={{ color: MUTED }}>{w.objective ?? w.description}</p>}
            {w.targets?.observacoes && <p className="text-[0.72rem] leading-snug" style={{ color: MUTED }}>{w.targets.observacoes}</p>}
            {w.activity_id && (
              <Link href={`/activities/${w.activity_id}`} className="inline-block text-[0.75rem] font-semibold hover:underline" style={{ color: TODAY }}>Ver o treino feito →</Link>
            )}
            {editavel(w, todayIso) && (
              <button
                type="button"
                onClick={() => { setSaved(null); setEditing(w.id); }}
                className="od-btn od-btn-ghost od-btn-sm !rounded-full"
                aria-label={`Editar o treino ${w.title}`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                Editar treino
              </button>
            )}
            {w.targets?.editado_pelo_atleta && <p className="text-[0.64rem]" style={{ color: MUTED }}>Editado por você</p>}
          </article>
        );
      })}

      {acts.map((a) => (
        <Link key={a.id} href={`/activities/${a.id}`} className="flex items-center gap-3 rounded-xl bg-white p-3 transition-colors hover:bg-[#F7F9F6]" style={{ boxShadow: `inset 0 0 0 1px ${HAIRLINE}` }}>
          <SportTile sport={a.sport} size={34} />
          <span className="min-w-0 flex-1">
            <span className="block text-[0.62rem] font-bold uppercase tracking-wider" style={{ color: MUTED }}>Feito · {new Date(a.start_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
            <span className="block truncate text-[0.85rem] font-semibold">{a.title ?? sportLabel(a.sport)}</span>
            <span className="block truncate text-[0.72rem]" style={{ color: MUTED }}>
              {activityText(a)}
              {paceText(a) ? ` · ${paceText(a)}` : ""}
              {a.avg_hr ? ` · ${Math.round(a.avg_hr)} bpm` : ""}
            </span>
          </span>
          <span style={{ color: TODAY }} aria-hidden>→</span>
        </Link>
      ))}

      {vazio && (
        <div className="flex flex-col items-center px-2 py-6 text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "#ECEFEA", color: "#8A918A" }}><CalendarIcon size={22} /></span>
          <p className="font-semibold">{iso > todayIso ? "Nenhum treino planejado" : "Nenhum treino registrado"}</p>
          <p className="mt-1 text-[0.78rem]" style={{ color: MUTED }}>
            {iso > todayIso ? "Nada planejado para este dia." : "Você não realizou nenhum treino neste dia."}
          </p>
        </div>
      )}

      {onSemana && (
        <button type="button" onClick={onSemana} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-accent py-2.5 text-[0.82rem] font-bold text-black transition-[filter] hover:brightness-95">
          <CalendarIcon /> Ver semana
        </button>
      )}
    </div>
  );
}

/** Painel do dia ao lado da grade só a partir de 1024 px; abaixo disso, a gaveta. */
function useLargo() {
  const [largo, setLargo] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setLargo(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return largo;
}

/**
 * Calendário de treinos em fundo claro: o mês (ou a semana) com o planejado e o feito em etiquetas
 * coloridas pela situação. Tocar num dia mostra o detalhe no painel da direita (computador) ou numa
 * gaveta (celular e tablet).
 */
export function TrainingCalendar({ activities, workouts, loading, onRange, onChanged }: {
  activities: ActivitySummary[];
  /** Treinos planejados do intervalo visível. */
  workouts: PlannedWorkout[];
  loading: boolean;
  /** Avisa o intervalo na tela (com os dias vizinhos do mês) para a página buscar o planejado. */
  onRange: (start: string, end: string) => void;
  /** Um treino foi editado no detalhe do dia. */
  onChanged?: () => void;
}) {
  const today = new Date();
  const todayIso = toISODate(today);
  const largo = useLargo();

  const [visao, setVisao] = useState<Visao>("mes");
  // o dia escolhido manda no que aparece: o mês dele ou a semana dele
  const [sel, setSel] = useState(todayIso);
  const selDate = fromIso(sel);
  const year = selDate.getFullYear();
  const month = selDate.getMonth();

  const gridStart = visao === "mes" ? mondayOf(new Date(year, month, 1)) : mondayOf(selDate);
  const gridEnd = visao === "mes" ? addDays(mondayOf(new Date(year, month + 1, 0)), 6) : addDays(gridStart, 6);
  const startIso = toISODate(gridStart);
  const endIso = toISODate(gridEnd);

  useEffect(() => { onRange(startIso, endIso); }, [startIso, endIso, onRange]);

  const days = useMemo(() => {
    const out: Date[] = [];
    for (let d = fromIso(startIso); toISODate(d) <= endIso; d = addDays(d, 1)) out.push(d);
    return out;
  }, [startIso, endIso]);

  const [panelOpen, setPanelOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  useFocusTrap(drawerRef, drawerOpen, () => setDrawerOpen(false), openerRef);
  useEffect(() => { if (largo) setDrawerOpen(false); }, [largo]);

  const dayRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const focusSel = useRef(false);
  useEffect(() => {
    if (!focusSel.current) return;
    focusSel.current = false;
    dayRefs.current[sel]?.focus();
  }, [sel, visao]);

  const { plansByIso, actsByIso } = useMemo(() => {
    const plansByIso = new Map<string, PlannedWorkout[]>();
    for (const w of workouts) plansByIso.set(w.date, [...(plansByIso.get(w.date) ?? []), w]);
    const actsByIso = new Map<string, ActivitySummary[]>();
    for (const a of activities) {
      const iso = toISODate(new Date(a.start_time));
      if (iso < startIso || iso > endIso) continue;
      actsByIso.set(iso, [...(actsByIso.get(iso) ?? []), a]);
    }
    actsByIso.forEach((list) => list.sort((x, y) => x.start_time.localeCompare(y.start_time)));
    return { plansByIso, actsByIso };
  }, [workouts, activities, startIso, endIso]);

  /** Na grade, a atividade ligada a um treino planejado já aparece nele (verde); só as soltas viram etiqueta. */
  function itemsOf(iso: string): Item[] {
    const plans = plansByIso.get(iso) ?? [];
    const linked = new Set(plans.map((w) => w.activity_id).filter(Boolean));
    return [
      ...plans.map((w) => planItem(w, todayIso)),
      ...(actsByIso.get(iso) ?? []).filter((a) => !linked.has(a.id)).map(activityItem),
    ];
  }

  // resumo do período: o mês (sem os dias vizinhos) ou a semana
  const totals = useMemo(() => {
    const inPeriod = (iso: string) => visao === "semana" || fromIso(iso).getMonth() === month;
    const isos = days.map(toISODate).filter(inPeriod);
    const acts = isos.flatMap((iso) => actsByIso.get(iso) ?? []);
    const plans = isos.flatMap((iso) => plansByIso.get(iso) ?? []).filter((w) => !isRestWorkout(w));
    const past = plans.filter((w) => w.date < todayIso || w.status !== "planned");
    return {
      doneCount: acts.length,
      doneKm: acts.reduce((s, a) => s + (a.distance_m ?? 0), 0) / 1000,
      planCount: plans.length,
      planKm: plans.reduce((s, w) => s + (w.target_distance_m ?? 0), 0) / 1000,
      cumpridos: past.filter((w) => w.status === "done").length,
      vencidos: past.length,
    };
  }, [days, visao, month, actsByIso, plansByIso, todayIso]);

  const isCurrent = visao === "mes" ? year === today.getFullYear() && month === today.getMonth() : todayIso >= startIso && todayIso <= endIso;

  function step(dir: -1 | 1) {
    if (visao === "semana") return setSel(toISODate(addDays(selDate, 7 * dir)));
    // mês novo: hoje, se for o mês atual; senão, o dia 1
    const first = new Date(year, month + dir, 1);
    setSel(first.getFullYear() === today.getFullYear() && first.getMonth() === today.getMonth() ? todayIso : toISODate(first));
  }

  function openDay(iso: string, el: HTMLElement) {
    setSel(iso);
    if (largo) { setPanelOpen(true); return; }
    openerRef.current = el;
    setDrawerOpen(true);
  }

  function verSemana() {
    setVisao("semana");
    setDrawerOpen(false);
  }

  function onGridKey(e: KeyboardEvent<HTMLDivElement>) {
    const stepBy: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next: Date | null = null;
    if (e.key in stepBy) next = addDays(selDate, stepBy[e.key]);
    else if (e.key === "Home") next = visao === "mes" ? new Date(year, month, 1) : gridStart;
    else if (e.key === "End") next = visao === "mes" ? new Date(year, month + 1, 0) : gridEnd;
    if (!next) return;
    e.preventDefault();
    focusSel.current = true;
    setSel(toISODate(next));
  }

  const selPlans = plansByIso.get(sel) ?? [];
  const selActs = actsByIso.get(sel) ?? [];
  const detail = (
    <DayDetail date={selDate} plans={selPlans} acts={selActs} todayIso={todayIso} onSemana={visao === "mes" ? verSemana : undefined} onChanged={onChanged} />
  );

  return (
    <>
      <div className="flex items-start gap-4">
        <Panel aria-label="Calendário de treinos" className="od-cal-claro min-w-0 flex-1">
          {/* cabeçalho: período, navegação e visão */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold">
              {visao === "mes" ? <>{MONTH_PT[month]} {year}</> : weekTitle(gridStart, gridEnd)}
            </h2>
            <div className="flex items-center gap-1.5">
              {!isCurrent && <button type="button" className="od-btn od-btn-ghost od-btn-sm !rounded-full" onClick={() => setSel(todayIso)}>Hoje</button>}
              <button type="button" className="od-icon-btn !h-9 !w-9 !rounded-full" onClick={() => step(-1)} aria-label={visao === "mes" ? "Mês anterior" : "Semana anterior"}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden><path d="m15 18-6-6 6-6" /></svg>
              </button>
              <button type="button" className="od-icon-btn !h-9 !w-9 !rounded-full" onClick={() => step(1)} aria-label={visao === "mes" ? "Próximo mês" : "Próxima semana"}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden><path d="m9 18 6-6-6-6" /></svg>
              </button>
              <label className="relative ml-1">
                <span className="sr-only">Visão</span>
                <select
                  value={visao}
                  onChange={(e) => setVisao(e.target.value as Visao)}
                  className="h-9 cursor-pointer appearance-none rounded-full bg-white pl-4 pr-9 text-[0.8rem] font-semibold outline-none"
                  style={{ color: INK, boxShadow: "inset 0 0 0 1px #D3D9D1" }}
                >
                  <option value="mes">Mês</option>
                  <option value="semana">Semana</option>
                </select>
                <svg className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
              </label>
            </div>
          </div>

          {/* resumo do período, discreto */}
          <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-[0.74rem]" style={{ color: MUTED }}>
            {loading ? <Skeleton className="h-4 w-64" /> : (
              <>
                <span><b className="od-num" style={{ color: INK }}>{kmNum(totals.doneKm)} km</b> feitos · {totals.doneCount} {totals.doneCount === 1 ? "treino" : "treinos"}</span>
                <span><b className="od-num" style={{ color: INK }}>{kmNum(totals.planKm)} km</b> planejados · {totals.planCount} {totals.planCount === 1 ? "treino" : "treinos"}</span>
                <span>Cumpriu <b className="od-num" style={{ color: INK }}>{totals.vencidos ? `${totals.cumpridos} de ${totals.vencidos}` : "—"}</b> {totals.vencidos ? "até hoje" : ""}</span>
              </>
            )}
          </div>

          {loading ? <Skeleton className="h-[460px]" /> : (
            <>
              <div className="overflow-hidden rounded-xl p-px" style={{ background: HAIRLINE }}>
                <div className={`grid-cols-7 gap-px ${visao === "semana" ? "hidden sm:grid" : "grid"}`}>
                  {DOW.map((d) => (
                    <div key={d} className="bg-[#F8FAF7] py-2 text-center text-[0.64rem] font-bold uppercase tracking-wider sm:px-2.5 sm:text-left sm:text-[0.68rem]" style={{ color: MUTED }}>{d}</div>
                  ))}
                </div>
                <div
                  className={`grid-cols-7 gap-px ${visao === "semana" ? "hidden sm:grid" : "grid"}`}
                  role="group"
                  aria-label={`${visao === "mes" ? `Dias de ${MONTH_PT[month]} ${year}` : `Semana de ${weekTitle(gridStart, gridEnd)}`}. Use as setas para andar pelos dias e Enter para abrir.`}
                  onKeyDown={onGridKey}
                >
                  {days.map((d) => {
                    const iso = toISODate(d);
                    // dias do mês vizinho: só o número, apagado; tocar vai para aquele mês
                    if (visao === "mes" && d.getMonth() !== month) {
                      return (
                        <button key={iso} type="button" tabIndex={-1} aria-label={`Ir para ${MONTH_PT[d.getMonth()]}`} onClick={() => setSel(iso)}
                          className="flex min-h-[56px] justify-center bg-[#F3F5F2] p-1 transition-colors hover:bg-[#ECEFEA] sm:min-h-[104px] sm:justify-start sm:p-2"
                        >
                          <span className="od-num text-[0.9rem] font-bold leading-none text-[#B3BAB2] sm:text-[0.95rem]">{d.getDate()}</span>
                        </button>
                      );
                    }
                    const items = itemsOf(iso);
                    const isToday = iso === todayIso;
                    const isSel = iso === sel;
                    const limite = visao === "mes" ? 2 : items.length;
                    return (
                      <button
                        key={iso}
                        ref={(el) => { dayRefs.current[iso] = el; }}
                        type="button"
                        tabIndex={isSel ? 0 : -1}
                        aria-haspopup={largo ? undefined : "dialog"}
                        aria-current={isToday ? "date" : undefined}
                        aria-pressed={largo ? isSel : undefined}
                        aria-label={`${d.getDate()} de ${MONTH_PT[d.getMonth()]}${isToday ? ", hoje" : ""} — ${items.map((it) => `${it.sit.label}: ${it.title}`).join("; ") || "sem treino"}`}
                        onClick={(e) => openDay(iso, e.currentTarget)}
                        className={`relative flex flex-col items-center gap-1 overflow-hidden p-1 text-left transition-colors sm:items-stretch sm:gap-1.5 sm:p-2 ${visao === "mes" ? "min-h-[56px] sm:min-h-[104px]" : "min-h-[300px]"} ${isToday ? "bg-[#F2FAF4]" : "bg-white hover:bg-[#F7F9F6]"}`}
                        style={isToday ? { boxShadow: `inset 0 0 0 2px ${TODAY}` } : isSel && largo && panelOpen ? { boxShadow: "inset 0 0 0 1.5px #8A918A" } : undefined}
                      >
                        <span className="od-num text-[0.9rem] font-bold leading-none sm:text-[0.95rem]" style={{ color: isToday ? TODAY : INK }}>{d.getDate()}</span>
                        {isToday && <span className="absolute right-2 top-2 hidden h-2 w-2 rounded-full sm:block" style={{ background: SIT.hoje.dot }} aria-hidden />}

                        {/* celular: um pontinho por treino (cor da situação; vazio se só planejado) */}
                        <span className="flex flex-wrap justify-center gap-[3px] sm:hidden" aria-hidden>
                          {items.filter((it) => it.sit !== SIT.descanso).slice(0, 3).map((it) => (
                            <span key={it.key} className="h-1.5 w-1.5 rounded-full" style={{ boxShadow: `inset 0 0 0 1.5px ${it.sit.dot}`, background: it.sit === SIT.planejado ? "transparent" : it.sit.dot }} />
                          ))}
                        </span>

                        {/* computador e tablet: etiquetas com o ícone do esporte e os km */}
                        {items.slice(0, limite).map((it) => (
                          <span key={it.key} className="hidden sm:block"><Pill it={it} full={visao === "semana"} /></span>
                        ))}
                        {items.length > limite && <span className="hidden px-1.5 text-[0.6rem] sm:block" style={{ color: MUTED }}>+{items.length - limite}</span>}
                      </button>
                    );
                  })}
                </div>

                {/* semana no celular: um dia por linha */}
                {visao === "semana" && (
                  <ul className="grid gap-px sm:hidden">
                    {days.map((d) => {
                      const iso = toISODate(d);
                      const items = itemsOf(iso);
                      const isToday = iso === todayIso;
                      return (
                        <li key={iso}>
                          <button
                            type="button"
                            aria-haspopup="dialog"
                            aria-current={isToday ? "date" : undefined}
                            onClick={(e) => openDay(iso, e.currentTarget)}
                            className={`flex w-full gap-3 p-3 text-left ${isToday ? "bg-[#F2FAF4]" : "bg-white"}`}
                            style={isToday ? { boxShadow: `inset 0 0 0 2px ${TODAY}` } : undefined}
                          >
                            <span className="w-10 shrink-0 text-center">
                              <span className="block text-[0.62rem] font-bold uppercase tracking-wider" style={{ color: MUTED }}>{dow(d)}</span>
                              <span className="od-num block text-[1.1rem] font-bold leading-tight" style={{ color: isToday ? TODAY : INK }}>{d.getDate()}</span>
                            </span>
                            <span className="min-w-0 flex-1 space-y-1.5 self-center">
                              {items.length ? items.map((it) => <Pill key={it.key} it={it} full />) : <span className="text-[0.75rem]" style={{ color: "#8A918A" }}>Sem treino</span>}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.7rem]" style={{ color: MUTED }}>
                {[SIT.concluido, SIT.planejado, SIT.perdido, SIT.hoje].map((s) => (
                  <span key={s.label} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: s.dot }} />{s.label}</span>
                ))}
                <span className="w-full sm:ml-auto sm:w-auto">Toque num dia para ver e editar o treino.</span>
              </div>
            </>
          )}
        </Panel>

        {/* computador: o dia escolhido ao lado da grade */}
        {largo && panelOpen && (
          <aside className="od-panel od-cal-claro sticky top-4 w-[300px] shrink-0 !p-4" aria-labelledby="dia-lado-titulo">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 id="dia-lado-titulo" className="text-[0.8rem] font-bold tracking-wider">{shortDate(selDate)}</h3>
              <CloseButton onClick={() => setPanelOpen(false)} />
            </div>
            {loading ? <Skeleton className="h-40" /> : detail}
          </aside>
        )}
      </div>

      {/* gaveta do dia (celular e tablet): por baixo no celular, pela direita no tablet; no body, porque um pai
          com transform (animação de entrada) prenderia o "fixed" a ele em vez da tela */}
      {drawerOpen && createPortal(
        <div className="fixed inset-0 z-50" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dia-titulo"
            onClick={(e) => e.stopPropagation()}
            className="od-panel od-cal-claro absolute inset-x-0 bottom-0 max-h-[82vh] animate-od-fade-up overflow-y-auto !rounded-b-none !p-5 sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[400px] sm:!rounded-l-2xl sm:!rounded-r-none"
            style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 id="dia-titulo" className="text-[0.85rem] font-bold tracking-wider">{shortDate(selDate)}</h3>
              <CloseButton onClick={() => setDrawerOpen(false)} />
            </div>
            {detail}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
