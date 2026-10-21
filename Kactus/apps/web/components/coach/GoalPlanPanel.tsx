"use client";

import { useState, type ReactNode } from "react";

import { Panel } from "@/components/ui/primitives";
import { setGoalTarget, type GoalPhase, type GoalPlan, type GoalPlanResponse, type PlannedWorkout } from "@/lib/api";
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

/** "3:59:00", "3:59" ou "239" (min) → segundos; null se não der para ler. */
export function parseRaceTime(text: string): number | null {
  const parts = text.trim().split(":").map((x) => x.trim());
  if (!parts.every((x) => /^\d+$/.test(x))) return null;
  const n = parts.map(Number);
  if (n.length === 3) return n[1] < 60 && n[2] < 60 ? n[0] * 3600 + n[1] * 60 + n[2] : null;
  if (n.length === 2) return n[1] < 60 ? n[0] * 3600 + n[1] * 60 : null;
  if (n.length === 1) return n[0] * 60;
  return null;
}

const clock = (s: number) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** Tempo-alvo do atleta: muda o ritmo de prova e os treinos que usam ele. */
function TargetEditor({ goal, onSaved }: { goal: GoalPlan; onSaved: (g: GoalPlanResponse) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(goal.target_time_s ? clock(goal.target_time_s) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const calculado = goal.paces.prova * goal.race_distance_km;

  async function salvar(value: number | null) {
    setBusy(true);
    setError(null);
    try {
      onSaved(await setGoalTarget(value));
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar o alvo");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    const s = parseRaceTime(text);
    return (
      <form className="space-y-1.5" onSubmit={(e) => { e.preventDefault(); if (s) salvar(s); }}>
        <label className="od-field-label" htmlFor="alvo-prova">Seu tempo-alvo (h:mm:ss)</label>
        <div className="flex gap-1.5">
          <input id="alvo-prova" value={text} onChange={(e) => setText(e.target.value)} placeholder="3:59:00" inputMode="numeric" className="od-input od-input-sm min-w-0 flex-1" autoFocus />
          <button type="submit" disabled={!s || busy} className="od-btn od-btn-primary od-btn-sm">{busy ? "Salvando…" : "Salvar"}</button>
          <button type="button" onClick={() => setEditing(false)} className="od-btn od-btn-ghost od-btn-sm">Cancelar</button>
        </div>
        {s ? <p className="text-[0.7rem] text-brand-muted">Ritmo de prova: {fmtPace(s / goal.race_distance_km)}/km</p> : text && <p className="text-[0.7rem] text-brand-warning">Use h:mm:ss, como 3:59:00.</p>}
        {error && <p className="text-[0.7rem] text-brand-danger">{error}</p>}
      </form>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5 text-[0.74rem]" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)" }}>
      <span>
        <span className="block text-[0.6rem] uppercase tracking-wider text-brand-muted">{goal.target_time_s ? "Seu alvo" : "Alvo calculado"}</span>
        <span className="od-num block text-[1rem] text-white">{clock(goal.target_time_s ?? calculado)}</span>
      </span>
      <span className="flex gap-1.5">
        <button type="button" onClick={() => setEditing(true)} className="od-btn od-btn-ghost od-btn-sm !rounded-full !px-3">{goal.target_time_s ? "Mudar" : "Definir meu alvo"}</button>
        {goal.target_time_s && <button type="button" onClick={() => salvar(null)} disabled={busy} className="od-btn od-btn-ghost od-btn-sm !rounded-full !px-3">Usar o calculado</button>}
      </span>
      {error && <p className="w-full text-[0.7rem] text-brand-danger">{error}</p>}
    </div>
  );
}

/** Ícone de traço numa cor. */
function Glyph({ color, size = 17, children }: { color: string; size?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      {children}
    </svg>
  );
}

/** Cor e ícone de cada tema de "O que a Duni levou em conta" (os temas vêm do servidor). */
const TEMAS: Record<string, { color: string; icon: ReactNode }> = {
  "Último mês": { color: "#00FF66", icon: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></> },
  "Histórico de 6 meses": { color: "#00BFFF", icon: <path d="M5 20v-5M10 20v-9M15 20v-6M20 20V5" /> },
  Pausa: { color: "#A78BFA", icon: <path d="M9 5v14M15 5v14" /> },
  Dor: { color: "#FF8A3D", icon: <><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></> },
  Subida: { color: "#FFC145", icon: <><path d="m3 20 6-9 4 5 3-4 5 8z" /></> },
  Nível: { color: "#2DD4BF", icon: <><circle cx="14" cy="4" r="2" /><path d="m5 21 4-6 3 2 2-6" /><path d="m7 11 3-3 5 1 2 4h3" /></> },
  Dias: { color: "#C6FF00", icon: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></> },
  Preferências: { color: "#C084FC", icon: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></> },
};
const TEMA_PADRAO = { color: "#8C948C", icon: <><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v5h1" /></> };

/** Rota até a prova, com curvas de nível ao fundo e o pino no fim: enfeite do topo do plano (tela larga). */
function RouteArt() {
  return (
    <svg className="pointer-events-none absolute right-[400px] top-6 hidden h-[110px] w-[240px] xl:block" viewBox="0 0 240 110" fill="none" aria-hidden>
      <g stroke="rgba(255,255,255,0.05)" strokeWidth="1">
        <path d="M0 70c40-30 80 10 120-20s80-20 120-40" />
        <path d="M0 88c40-26 80 12 120-14s80-18 120-36" />
        <path d="M0 52c40-30 80 6 120-24s80-18 120-36" />
      </g>
      <path d="M8 100c20-4 26-12 44-14s22 6 38-2 18-22 36-24 22 10 40 4 18-26 30-30 20 2 26-10" stroke="#00FF66" strokeWidth="2" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 6px rgba(0,255,102,0.7))" }} />
      <path d="M222 6c-6 0-10 4-10 9 0 7 10 15 10 15s10-8 10-15c0-5-4-9-10-9z" fill="#00FF66" style={{ filter: "drop-shadow(0 0 8px rgba(0,255,102,0.8))" }} />
      <circle cx="222" cy="15" r="3" fill="#06170c" />
    </svg>
  );
}

export function GoalPlanPanel({
  goal, onGenerate, generating, onGoalChange,
}: {
  goal: GoalPlanResponse | null;
  onGenerate: (daysPerWeek: number) => void;
  generating: boolean;
  onGoalChange?: (g: GoalPlanResponse) => void;
}) {
  const plan = goal?.plan ?? null;
  const [days, setDays] = useState<number>(plan?.days_per_week ?? 3);
  const today = toISODate(new Date());

  const daysPicker = (
    <div className="flex items-center gap-1.5 text-[0.72rem] text-brand-muted" role="radiogroup" aria-label="Dias de corrida por semana">
      <span className="mr-1">Dias/semana</span>
      {[3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={days === n}
          onClick={() => setDays(n)}
          className={`od-num flex h-7 w-7 items-center justify-center rounded-full text-[0.74rem] font-bold transition-colors ${days === n ? "bg-brand-accent text-black" : "text-brand-textSecondary hover:text-white"}`}
          style={days === n ? { boxShadow: "0 0 14px -2px rgba(0,255,102,0.7)" } : { boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.14)" }}
        >
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

  const daysLeft = Math.round((parseLocalDate(plan.race_date).getTime() - parseLocalDate(today).getTime()) / 86_400_000);
  const raceDate = parseLocalDate(plan.race_date).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  const p = plan.paces;
  const paces: { k: string; v: string; icon: ReactNode }[] = [
    { k: "Leve", v: `${fmtPace(p.leve_rapido)}–${fmtPace(p.leve_lento)}`, icon: <><circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="5" r="2.5" /><path d="M8.5 19H17a3.5 3.5 0 0 0 0-7H7a3.5 3.5 0 0 1 0-7h8.5" /></> },
    { k: "Limiar", v: fmtPace(p.limiar), icon: <path d="M5 20v-5M10 20v-9M15 20v-6M20 20V5" /> },
    { k: "Intervalo", v: fmtPace(p.intervalo), icon: <path d="M13 2 4 14h7l-1 8 9-12h-7z" /> },
    { k: "Ritmo de prova", v: fmtPace(p.prova), icon: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M10 2h4M12 2v3" /></> },
  ];

  return (
    <div className="space-y-4">
      <Panel className="relative overflow-hidden">
        {/* rota com o pino da prova, desenhada ao lado do título (só em tela larga) */}
        <RouteArt />
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <div className="min-w-0">
            <h2 className="od-label od-label-accent">Plano do objetivo</h2>
            <p className="mt-2 font-display text-[1.9rem] font-extrabold leading-tight tracking-tight sm:text-[2.3rem] xl:pr-[240px]">{plan.race_name}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.85rem] text-brand-textSecondary">
              <span className="inline-flex items-center gap-2">
                <Glyph color="#C6FF00"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="m9 16 2 2 4-4" /></Glyph>
                {raceDate}
              </span>
              <span className="hidden h-4 w-px bg-white/10 sm:block" aria-hidden />
              <span className="inline-flex items-center gap-2">
                <Glyph color="#00FF66"><circle cx="14" cy="4" r="2" /><path d="m5 21 4-6 3 2 2-6" /><path d="m7 11 3-3 5 1 2 4h3" /></Glyph>
                {daysLeft >= 0 ? <>Faltam <strong className="od-num text-white">{daysLeft}</strong> dias</> : "Prova já passou"}
              </span>
              <span className="hidden h-4 w-px bg-white/10 sm:block" aria-hidden />
              <span className="inline-flex items-center gap-2">
                <Glyph color="#00FF66"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></Glyph>
                {fmtKm(plan.race_distance_km)}
              </span>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-brand-textSecondary">{plan.summary}</p>
          </div>

          <div className="space-y-2 rounded-2xl bg-white/[0.02] p-3" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)" }}>
            <div className="grid grid-cols-2 gap-2">
              {paces.map(({ k, v, icon }) => (
                <div key={k} className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] px-3 py-2.5" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)" }}>
                  <Glyph color="#E8EDE8" size={20}>{icon}</Glyph>
                  <span className="min-w-0">
                    <span className="block truncate text-[0.6rem] uppercase tracking-wider text-brand-muted">{k}</span>
                    <span className="od-num block text-[0.92rem] text-white">{v}<span className="text-brand-muted">/km</span></span>
                  </span>
                </div>
              ))}
            </div>
            {onGoalChange && <TargetEditor key={plan.id + (plan.target_time_s ?? "")} goal={plan} onSaved={onGoalChange} />}
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-1">
              {daysPicker}
              <button type="button" onClick={() => onGenerate(days)} disabled={generating} className="od-btn od-btn-ghost od-btn-sm !rounded-full !px-3.5">
                {generating ? "Refazendo…" : "Refazer a partir de hoje"}
              </button>
            </div>
          </div>
        </div>
      </Panel>

      {plan.analysis && plan.analysis.length > 0 && (
        <Panel aria-labelledby="duni-levou-titulo">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.04]" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.1)" }}>
              <Glyph color="#E8EDE8" size={16}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></Glyph>
            </span>
            <h3 id="duni-levou-titulo" className="shrink-0 text-[0.72rem] font-bold uppercase tracking-[0.14em] text-white">O que a Duni levou em conta</h3>
            <span className="hidden h-px flex-1 bg-white/[0.07] sm:block" aria-hidden />
            <span className="ml-auto shrink-0 text-[0.7rem] text-brand-muted sm:ml-0">Últimos 6 meses</span>
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {plan.analysis.map((a) => {
              const t = TEMAS[a.tema] ?? TEMA_PADRAO;
              return (
                <li key={a.tema} className="flex gap-3.5 rounded-2xl bg-white/[0.02] px-4 py-3.5" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)" }}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: `${t.color}14`, boxShadow: `inset 0 0 0 1px ${t.color}55, 0 0 16px -6px ${t.color}` }}>
                    <Glyph color={t.color} size={18}>{t.icon}</Glyph>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[0.68rem] font-bold uppercase tracking-wider" style={{ color: t.color }}>{a.tema}</span>
                    <span className="mt-0.5 block text-[0.8rem] leading-snug text-brand-textSecondary">{a.texto}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </div>
  );
}

/** As fases até a prova (base, construção, pico, polimento), os km de cada semana e a semana escolhida. */
export function GoalPhases({ goal }: { goal: GoalPlanResponse }) {
  const plan = goal.plan;
  const today = toISODate(new Date());
  const [picked, setPicked] = useState<number | null>(null);
  if (!plan) return null;
  const currentIndex = plan.weeks.findIndex((w) => w.inicio <= today && today <= w.fim);
  const selected = picked ?? (currentIndex >= 0 ? currentIndex : 0);

  return (
    <Panel className="space-y-6">
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

      <WeekWorkouts plan={plan} index={selected} workouts={goal.workouts} />
    </Panel>
  );
}
