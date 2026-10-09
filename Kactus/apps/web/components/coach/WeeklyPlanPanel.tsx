"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

import { WorkoutReview } from "@/components/coach/WorkoutReview";
import { SportTile } from "@/components/SportIcon";
import { Alert, Panel } from "@/components/ui/primitives";
import {
  CoachApiError,
  moveWorkout,
  regenerateWorkout,
  type PlannedWorkout,
  type WeeklyPlan,
  type WorkoutStep,
} from "@/lib/api";
import { parseLocalDate, toISODate, WEEK_LABELS } from "@/lib/athlete";
import { formatDuration, sportColor } from "@/lib/utils";

const INTENSITY: Record<string, { label: string; color: string }> = {
  leve: { label: "Leve", color: "#00FF66" },
  moderado: { label: "Moderado", color: "#FFC145" },
  forte: { label: "Forte", color: "#F85149" },
};

const STEP_LABEL: Record<WorkoutStep["fase"], string> = {
  aquecimento: "Aquecimento",
  principal: "Principal",
  desaquecimento: "Desaquecimento",
};

function dayShort(iso: string) {
  const d = parseLocalDate(iso);
  return `${WEEK_LABELS[(d.getDay() + 6) % 7]} ${d.getDate()}`;
}

function shortDate(iso: string) {
  // "05 de outubro"
  return parseLocalDate(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}

function weekDays(start: string, end: string): string[] {
  const out: string[] = [];
  const d = parseLocalDate(start);
  const last = parseLocalDate(end);
  while (d <= last) {
    out.push(toISODate(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function volume(w: PlannedWorkout) {
  const parts: string[] = [];
  if (w.target_distance_m) parts.push(`${(w.target_distance_m / 1000).toFixed(1)} km`);
  if (w.target_duration_s) parts.push(formatDuration(w.target_duration_s));
  return parts.join(" · ") || "—";
}

// A IA as vezes ja escreve o rotulo no valor ("FC Z2"); nao repetir.
function labeled(label: string, value: string) {
  return value.trimStart().toUpperCase().startsWith(label) ? value : `${label} ${value}`;
}

function stepDetail(s: WorkoutStep) {
  const parts: string[] = [];
  if (s.repeticoes) parts.push(`${s.repeticoes}×`);
  if (s.distancia_km) parts.push(`${s.distancia_km} km`);
  if (s.duracao_min) parts.push(`${s.duracao_min} min`);
  if (s.ritmo) parts.push(s.ritmo);
  if (s.zona_fc) parts.push(labeled("FC", s.zona_fc));
  if (s.recuperacao) parts.push(`recuperação: ${s.recuperacao}`);
  return parts.join(" · ");
}

/** Lista curta; vazia nao aparece (a tela so mostra o que tem conteudo). */
function BulletList({ title, items, color }: { title: string; items: string[]; color?: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="od-metric-label mb-1.5" style={color ? { color } : undefined}>{title}</div>
      <ul className="space-y-1 text-[0.8rem] leading-snug text-brand-textSecondary">
        {items.map((it, i) => <li key={i} className="flex gap-1.5"><span className="text-brand-muted">•</span><span>{it}</span></li>)}
      </ul>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="od-tile px-3 py-2.5">
      <div className="od-metric-label">{label}</div>
      <div className="od-num mt-1 text-[1.05rem] leading-tight">{value}</div>
      {sub && <div className="mt-0.5 text-[0.68rem] text-brand-muted">{sub}</div>}
    </div>
  );
}

function WorkoutActions({ w, onDone }: { w: PlannedWorkout; onDone: (notice?: string) => Promise<void> }) {
  const [mode, setMode] = useState<"review" | "regen" | "move" | null>(null);
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(w.date);
  const [conflict, setConflict] = useState<{ title: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<string | undefined>) {
    setBusy(true);
    setError(null);
    try {
      const notice = await fn();
      setMode(null);
      setConflict(null);
      await onDone(notice);
    } catch (e) {
      if (e instanceof CoachApiError && e.detail.error === "date_conflict" && e.detail.conflict) {
        setConflict({ title: e.detail.conflict.title });
      } else if (e instanceof CoachApiError) {
        setError(e.detail.message ?? `Erro: ${e.detail.error}`);
      } else {
        setError(e instanceof Error ? e.message : "Erro");
      }
    } finally {
      setBusy(false);
    }
  }

  const regen = () => run(async () => {
    const res = await regenerateWorkout(w.id, reason.trim());
    return `${dayShort(w.date)}: ${res.explanation}`;
  });
  const move = (onConflict: "error" | "swap" | "keep_both") => run(async () => {
    await moveWorkout(w.id, date, onConflict);
    return undefined;
  });

  return (
    <div>
      {error && <p className="mb-2 text-xs text-brand-danger">{error}</p>}
      {mode === null && (
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <button type="button" onClick={() => setMode("review")} className="od-btn od-btn-primary od-btn-sm">Analisar este treino</button>
          <button type="button" onClick={() => setMode("regen")} className="od-btn od-btn-secondary od-btn-sm">Pedir outro treino</button>
          <button type="button" onClick={() => setMode("move")} className="od-btn od-btn-ghost od-btn-sm">Mudar de dia</button>
        </div>
      )}
      {mode === "review" && (
        <WorkoutReview
          w={w}
          onClose={() => setMode(null)}
          onDone={async (notice) => { setMode(null); await onDone(notice); }}
        />
      )}
      {mode === "regen" && (
        <div className="space-y-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && reason.trim().length >= 3) regen(); }}
            maxLength={300}
            placeholder='Por quê? Ex.: "panturrilha dura", "só tenho 30 min"'
            className="od-input od-input-sm"
            aria-label="Motivo para trocar o treino"
            autoFocus
          />
          <div className="flex gap-2">
            <button type="button" onClick={regen} disabled={busy || reason.trim().length < 3} className="od-btn od-btn-primary od-btn-sm">
              {busy ? "A Duni está pensando…" : "Pedir à Duni"}
            </button>
            <button type="button" onClick={() => setMode(null)} disabled={busy} className="od-btn od-btn-ghost od-btn-sm">Cancelar</button>
          </div>
        </div>
      )}
      {mode === "move" && (
        <div className="space-y-2">
          <label className="flex flex-wrap items-center gap-2 text-xs text-brand-muted">
            Novo dia
            <input
              type="date"
              value={date}
              min={toISODate(new Date())}
              onChange={(e) => { setDate(e.target.value); setConflict(null); }}
              className="od-input od-input-sm !w-auto"
            />
          </label>
          {conflict ? (
            <div className="rounded-xl px-3 py-2 text-xs" style={{ background: "rgba(255,193,69,0.06)", boxShadow: "inset 0 0 0 1px rgba(255,193,69,0.25)" }}>
              <p className="mb-2 text-brand-warning">Já tem &quot;{conflict.title}&quot; nesse dia.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => move("swap")} disabled={busy} className="od-btn od-btn-primary od-btn-sm">Trocar os dois de dia</button>
                <button type="button" onClick={() => move("keep_both")} disabled={busy} className="od-btn od-btn-secondary od-btn-sm">Manter os dois</button>
                <button type="button" onClick={() => { setConflict(null); setMode(null); }} disabled={busy} className="od-btn od-btn-ghost od-btn-sm">Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={() => move("error")} disabled={busy || !date || date === w.date} className="od-btn od-btn-primary od-btn-sm">
                {busy ? "Movendo…" : "Mover"}
              </button>
              <button type="button" onClick={() => setMode(null)} disabled={busy} className="od-btn od-btn-ghost od-btn-sm">Cancelar</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const PHASE_COLOR: Record<WorkoutStep["fase"], string> = {
  aquecimento: "#00BFFF",
  principal: "#00FF66",
  desaquecimento: "#7C8CFF",
};

function intensityOf(w: PlannedWorkout) {
  return w.target_intensity ? INTENSITY[w.target_intensity] : undefined;
}

/** Cor do treino no quadro: a intensidade; sem ela, a cor do esporte. */
function workoutColor(w: PlannedWorkout) {
  return intensityOf(w)?.color ?? sportColor(w.sport);
}

/** Tamanho da barra do dia: km; sem distancia, 10 min contam como 1 km. */
function workload(w: PlannedWorkout) {
  if (w.target_distance_m) return w.target_distance_m / 1000;
  if (w.target_duration_s) return w.target_duration_s / 600;
  return 3;
}

function dayLong(iso: string) {
  const s = parseLocalDate(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function MoonIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

/** Barra com as fases do treino, do tamanho de cada uma (tempo; sem tempo, distancia). */
function StepBar({ steps, main }: { steps: WorkoutStep[]; main: string }) {
  const size = (s: WorkoutStep) => s.duracao_min ?? (s.distancia_km ? s.distancia_km * 6 : 0);
  const sized = steps.every((s) => size(s) > 0);
  return (
    <div className="flex h-2.5 gap-1" aria-hidden>
      {steps.map((s, i) => {
        const c = s.fase === "principal" ? main : PHASE_COLOR[s.fase] ?? "#888";
        return (
          <div
            key={i}
            className="rounded-full"
            style={{ flexGrow: sized ? size(s) : 1, flexBasis: 0, background: `linear-gradient(90deg, ${c}, ${c}aa)`, boxShadow: `0 0 10px ${c}55` }}
          />
        );
      })}
    </div>
  );
}

/* ───────── km a km: as fases do treino distribuidas em cada quilometro ───────── */

type Pace = [number, number]; // s/km no comeco e no fim do trecho (iguais se constante)
/** Como cada passo fica no km a km. `estimated`: a Duni nao deu o pace e a tela estimou. */
type StepPlan = { fase: WorkoutStep["fase"]; km: number; pace: Pace | null; estimated: boolean };
type KmPart = { fase: WorkoutStep["fase"]; frac: number; pace: number | null; estimated: boolean };
type KmRow = { label: string; partial: number | null; parts: KmPart[] };

/** Caminhada ~10:00/km; trote de aquecimento/desaquecimento ~45 s/km mais lento que o principal. */
const WALK_PACE = 600;
const EASY_EXTRA = 45;

/** "6:00/km" → [360,360]; "6:00 → 5:30/km" (progressivo) → [360,330]; "6:00–6:20/km" (faixa) → media. */
function parsePace(text?: string | null): Pace | null {
  const found = [...(text ?? "").matchAll(/(\d{1,2}):(\d{2})/g)].map((m) => Number(m[1]) * 60 + Number(m[2]));
  if (found.length === 0) return null;
  if (found.length === 1) return [found[0], found[0]];
  if (/→|->/.test(text ?? "")) return [found[0], found[1]];
  const avg = (found[0] + found[1]) / 2;
  return [avg, avg];
}

function fmtPace(s: number) {
  const r = Math.round(s);
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`;
}

const avgPace = (p: Pace) => (p[0] + p[1]) / 2;

/**
 * Distancia e pace de cada passo. Sem pace: tempo ÷ distancia; no principal, o ritmo
 * alvo do treino; no aquecimento/desaquecimento, estimado (caminhada ou trote leve).
 * Sem distancia: tempo ÷ pace; aquecimento/desaquecimento sem nada contam 5 min.
 * O que faltar para o volume do treino vai para o principal sem medida.
 */
function stepPlans(w: PlannedWorkout): StepPlan[] {
  const total = (w.target_distance_m ?? 0) / 1000;
  const mainPace = parsePace(w.targets?.ritmo);
  const steps = w.steps ?? [];
  if (steps.length === 0) return total > 0 ? [{ fase: "principal", km: total, pace: mainPace, estimated: false }] : [];

  const plans = steps.map((s): StepPlan => {
    let pace = parsePace(s.ritmo);
    let estimated = false;
    if (!pace && s.distancia_km && s.duracao_min) {
      const p = (s.duracao_min * 60) / s.distancia_km;
      pace = [p, p];
    }
    if (!pace && s.fase === "principal") pace = mainPace;
    if (!pace && s.fase !== "principal") {
      const p = /caminh|andar|marcha/i.test(s.descricao) ? WALK_PACE : (mainPace ? avgPace(mainPace) : 390) + EASY_EXTRA;
      pace = [p, p];
      estimated = true;
    }
    let km = s.distancia_km ?? 0;
    if (!km && pace) {
      const min = s.duracao_min ?? (s.fase === "principal" ? 0 : 5);
      km = (min * 60) / avgPace(pace);
    }
    return { fase: s.fase, km, pace, estimated };
  });
  const known = plans.reduce((a, p) => a + p.km, 0);
  const open = plans.filter((p) => p.km === 0);
  if (total > known + 0.05 && open.length) {
    for (const p of open) p.km = (total - known) / open.length;
  }
  return plans;
}

function kmRows(plans: StepPlan[]): KmRow[] {
  const segs = plans.filter((p) => p.km > 0);
  const total = segs.reduce((a, s) => a + s.km, 0);
  const rows: KmRow[] = [];
  for (let i = 0; i < total - 0.05; i++) {
    const lo = i;
    const hi = Math.min(i + 1, total);
    const parts: KmPart[] = [];
    let a = 0;
    for (const s of segs) {
      const b = a + s.km;
      const o = Math.min(b, hi) - Math.max(a, lo);
      if (o > 1e-6) {
        const mid = (Math.max(a, lo) + Math.min(b, hi)) / 2;
        const pace = s.pace ? s.pace[0] + (s.pace[1] - s.pace[0]) * ((mid - a) / s.km) : null;
        parts.push({ fase: s.fase, frac: o / (hi - lo), pace, estimated: s.estimated });
      }
      a = b;
    }
    const len = hi - lo;
    rows.push({ label: `KM ${i + 1}`, partial: len < 0.95 ? len : null, parts });
  }
  return rows;
}

function KmBreakdown({ plans, color }: { plans: StepPlan[]; color: string }) {
  const rows = kmRows(plans);
  if (rows.length === 0) return null;
  const phaseColor = (f: WorkoutStep["fase"]) => (f === "principal" ? color : PHASE_COLOR[f] ?? "#888");
  const dense = rows.length > 12;
  const anyEstimated = rows.some((r) => r.parts.some((p) => p.estimated));
  const cols = "grid grid-cols-[3.2rem_minmax(0,1fr)_auto] items-center gap-3";

  return (
    <div>
      <div className={`mb-2 ${cols}`}>
        <span className="od-metric-label col-span-2">Distância</span>
        <span className="od-metric-label text-right">Pace</span>
      </div>
      <ol className={dense ? "space-y-1" : "space-y-2"}>
        {rows.map((r) => (
          <li key={r.label} className={cols}>
            <span className="text-[0.74rem] font-semibold text-brand-textSecondary">
              {r.label}
              {r.partial != null && <span className="ml-1 text-[0.62rem] font-normal text-brand-muted">{r.partial.toFixed(1).replace(".", ",")}</span>}
            </span>
            <div className={`flex overflow-hidden rounded-full bg-white/[0.05] ${dense ? "h-1.5" : "h-2"}`} style={{ width: r.partial != null ? `${Math.max(r.partial * 100, 12)}%` : undefined }}>
              {r.parts.map((p, j) => (
                <div key={j} style={{ width: `${p.frac * 100}%`, background: phaseColor(p.fase), boxShadow: `0 0 8px ${phaseColor(p.fase)}66` }} />
              ))}
            </div>
            {/* um pace por fase do km, na cor da fase */}
            <span className="flex justify-end gap-1.5 whitespace-nowrap">
              {r.parts.map((p, j) => (
                <span key={j} className="od-num text-[0.78rem]" style={{ color: phaseColor(p.fase) }} title={STEP_LABEL[p.fase]}>
                  {p.pace != null ? `${p.estimated ? "~" : ""}${fmtPace(p.pace)}` : "livre"}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[0.64rem] text-brand-muted">
        {(["aquecimento", "principal", "desaquecimento"] as const).map((f) => (
          <span key={f} className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: phaseColor(f) }} />{STEP_LABEL[f]}
          </span>
        ))}
        {anyEstimated && <span>· ~ pace estimado</span>}
      </div>
    </div>
  );
}

function WorkoutDetail({ w, onDone, next }: { w: PlannedWorkout; onDone: (notice?: string) => Promise<void>; next: boolean }) {
  const t = w.targets ?? {};
  const intensity = intensityOf(w);
  const color = workoutColor(w);
  const editable = w.status === "planned" && w.date >= toISODate(new Date());
  const targets = [
    ["Ritmo", t.ritmo],
    ["Cadência", t.cadencia],
    ["Zona de FC", t.zona_fc],
    ["Ritmo no plano (GAP)", t.gap],
    ["Terreno", t.terreno],
  ].filter(([, v]) => v) as [string, string][];
  const steps = w.steps ?? [];
  const plans = stepPlans(w);
  const hasNotes = t.metrica_prioritaria || t.observacoes || t.ajuste_pedido;

  return (
    <div className="space-y-5">
      {/* como fazer · (alvos | km a km, e embaixo deles o que priorizar) */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1.8fr)]">
        <div className="min-w-0 space-y-4">
          <div className="flex items-start gap-3">
            <SportTile sport={w.sport} size={46} radius={14} />
            <div className="min-w-0 flex-1">
              <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-brand-muted">
                {dayLong(w.date)}{t.tipo ? ` · ${t.tipo}` : ""}
              </div>
              <h3 className="mt-0.5 font-display text-xl font-bold leading-tight">{w.title}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="od-badge od-badge-muted !normal-case !tracking-normal">{volume(w)}</span>
                {intensity && (
                  <span className="od-badge !normal-case !tracking-normal" style={{ color: intensity.color, background: `${intensity.color}14`, boxShadow: `inset 0 0 0 1px ${intensity.color}40` }}>
                    {intensity.label}
                  </span>
                )}
                {next && <span className="od-badge">Próximo treino</span>}
                {w.status === "done" && <span className="od-badge">✓ Feito</span>}
                {w.status === "skipped" && <span className="od-badge od-badge-muted">Pulado</span>}
              </div>
            </div>
          </div>

          {(w.objective || w.reason) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {w.objective && (
                <div className="rounded-xl px-3.5 py-3" style={{ background: `${color}0b`, boxShadow: `inset 0 0 0 1px ${color}26` }}>
                  <div className="od-metric-label mb-1" style={{ color }}>Para quê</div>
                  <p className="text-[0.84rem] leading-snug">{w.objective}</p>
                </div>
              )}
              {w.reason && (
                <div className="od-tile px-3.5 py-3">
                  <div className="od-metric-label mb-1">Por que agora</div>
                  <p className="text-[0.84rem] leading-snug text-brand-textSecondary">{w.reason}</p>
                </div>
              )}
            </div>
          )}

          {steps.length > 0 && (
            <div>
              <div className="od-metric-label mb-2">Como fazer</div>
              <StepBar steps={steps} main={color} />
              <ol className="mt-3">
                {steps.map((s, i) => {
                  const c = s.fase === "principal" ? color : PHASE_COLOR[s.fase] ?? "#888";
                  const p = plans[i];
                  return (
                    <li key={i} className="relative flex gap-3 pb-3 last:pb-0">
                      {i < steps.length - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-white/10" aria-hidden />}
                      <span className="relative mt-1 h-[11px] w-[11px] shrink-0 rounded-full" style={{ background: c, boxShadow: `0 0 10px ${c}88` }} aria-hidden />
                      <div className="min-w-0">
                        <div className="text-[0.66rem] font-bold uppercase tracking-wider" style={{ color: c }}>{STEP_LABEL[s.fase] ?? s.fase}</div>
                        <div className="text-[0.85rem]">{s.descricao}</div>
                        <div className="mt-0.5 text-[0.72rem] text-brand-muted">
                          {stepDetail(s)}
                          {!s.ritmo && p?.pace && (
                            <span style={{ color: c }}>{stepDetail(s) ? " · " : ""}{p.estimated ? "~" : ""}{fmtPace(avgPace(p.pace))}/km{p.estimated ? " (estimado)" : ""}</span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
          {!w.objective && !steps.length && w.description && <p className="text-sm text-brand-textSecondary">{w.description}</p>}
        </div>

        <div className="min-w-0 space-y-4">
          <div className="grid gap-6 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
            {targets.length > 0 && (
              <div className="min-w-0">
                <div className="od-metric-label mb-2">Alvos</div>
                <dl className="grid grid-cols-2 gap-1.5">
                  {targets.map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-white/[0.03] px-2.5 py-1.5" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)" }}>
                      <dt className="text-[0.6rem] uppercase tracking-wider text-brand-muted">{k}</dt>
                      <dd className="mt-0.5 text-[0.78rem] font-semibold leading-snug">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            <div className="min-w-0">
              <KmBreakdown plans={plans} color={color} />
            </div>
          </div>

          {/* embaixo dos alvos e do km a km: o que priorizar e as observacoes */}
          {hasNotes && (
            <div className="space-y-2">
              {t.metrica_prioritaria && !/pse/i.test(t.metrica_prioritaria) && (
                <p className="rounded-xl bg-white/[0.03] px-3.5 py-2.5 text-[0.8rem] text-brand-textSecondary">
                  <span className="text-brand-muted">Se ritmo e FC não baterem, priorize: </span><span className="font-semibold text-white">{t.metrica_prioritaria}</span>
                </p>
              )}
              {t.observacoes && <p className="px-1 text-[0.8rem] text-brand-textSecondary">{t.observacoes}</p>}
              {t.ajuste_pedido && <p className="px-1 text-[0.72rem] text-brand-muted">Trocado a seu pedido: &quot;{t.ajuste_pedido}&quot;</p>}
            </div>
          )}
        </div>
      </div>

      {editable && (
        <div className="flex justify-end border-t border-white/5 pt-4">
          <div className="w-full sm:w-[420px]"><WorkoutActions w={w} onDone={onDone} /></div>
        </div>
      )}
    </div>
  );
}

/** Um dia no quadro da semana: a barra mostra o volume (altura) e a intensidade (cor). */
function DayColumn({
  date, list, maxLoad, today, selected, nextId, onSelect,
}: {
  date: string;
  list: PlannedWorkout[];
  maxLoad: number;
  today: string;
  selected: boolean;
  nextId?: string;
  onSelect: () => void;
}) {
  const d = parseLocalDate(date);
  const isToday = date === today;
  const isNext = list.some((w) => w.id === nextId);
  const past = date < today;
  const allDone = list.length > 0 && list.every((w) => w.status === "done");
  const first = list[0];

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative flex min-w-[128px] snap-start flex-col rounded-2xl p-3 text-left transition-all duration-200 hover:-translate-y-0.5 lg:min-w-0 ${past && !allDone && !selected ? "opacity-55" : ""}`}
      style={{
        background: isToday
          ? "linear-gradient(180deg, #11402a, #0b2a1b)"
          : selected ? "rgba(255,255,255,0.06)" : list.length ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.012)",
        boxShadow: selected
          ? `inset 0 0 0 1.5px ${isToday ? "#2f9e62" : "rgba(255,255,255,0.35)"}, 0 10px 28px -16px rgba(0,0,0,0.9)`
          : isToday ? "inset 0 0 0 1px #1f6e44" : "inset 0 0 0 1px rgba(255,255,255,0.05)",
      }}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span className={`text-[0.66rem] font-bold uppercase tracking-[0.14em] ${selected || isToday ? "text-white" : "text-brand-muted"}`}>
          {WEEK_LABELS[(d.getDay() + 6) % 7]}
        </span>
        <span className="od-num text-[1.35rem] leading-none">{d.getDate()}</span>
      </div>
      <div className="mt-1 flex h-4 items-center gap-2">
        {isToday && <span className="rounded bg-[#1f6e44] px-1.5 text-[0.58rem] font-bold uppercase tracking-[0.14em] text-white">Hoje</span>}
        {isNext ? (
          <span className="inline-flex items-center gap-1 text-[0.58rem] font-bold uppercase tracking-[0.14em] text-brand-accent">
            <span className="h-1.5 w-1.5 animate-od-pulse rounded-full bg-brand-accent" />Próximo
          </span>
        ) : null}
      </div>

      {/* barras: altura = volume; cor = intensidade */}
      <div className="mt-2 flex h-20 items-end justify-center gap-1.5 rounded-xl px-1.5 pb-1.5" style={{ background: "rgba(0,0,0,0.25)" }}>
        {list.length === 0 ? (
          <div className="mb-0.5 w-full border-t border-dashed border-white/15" />
        ) : (
          list.map((w) => {
            const c = workoutColor(w);
            const h = Math.max(18, Math.round((workload(w) / maxLoad) * 100));
            return (
              <div
                key={w.id}
                className="relative w-full max-w-[34px] rounded-t-lg rounded-b-md transition-all duration-500"
                style={{
                  height: `${h}%`,
                  background: w.status === "skipped" ? "rgba(255,255,255,0.08)" : `linear-gradient(180deg, ${c}, ${c}33)`,
                  boxShadow: w.status === "skipped" ? undefined : `0 0 16px -4px ${c}99`,
                }}
              >
                {w.status === "done" && (
                  <span className="absolute inset-x-0 top-1 text-center text-[0.7rem] font-bold text-black/70">✓</span>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="mt-2.5 min-h-[3.4rem]">
        {first ? (
          <>
            <div className="flex items-center gap-1.5">
              <SportTile sport={first.sport} size={20} radius={6} />
              <span className="truncate text-[0.66rem] text-brand-muted">{volume(first)}</span>
            </div>
            <div className={`mt-1 line-clamp-2 text-[0.78rem] font-semibold leading-snug ${first.status === "skipped" ? "line-through decoration-white/30" : ""}`}>
              {first.title}
            </div>
            {list.length > 1 && <div className="mt-0.5 text-[0.66rem] text-brand-accent">+{list.length - 1} treino</div>}
          </>
        ) : (
          <div className="flex items-center gap-1.5 pt-0.5 text-[0.78rem] text-brand-muted">
            <MoonIcon />
            Descanso
          </div>
        )}
      </div>
    </button>
  );
}

export function WeeklyPlanPanel({
  plan, workouts, onRefresh, onGenerate, generating,
  title = "Plano da semana", note, emptyText, generateLabel = "Gerar plano da semana", detailable = true,
}: {
  plan: WeeklyPlan | null;
  workouts: PlannedWorkout[];
  onRefresh: () => Promise<void>;
  onGenerate: () => void;
  generating: boolean;
  /** Para separar o plano do objetivo do plano "pelo estado de agora". */
  title?: string;
  note?: ReactNode;
  emptyText?: string;
  generateLabel?: string;
  /** Mostra "Detalhar a semana" quando ha treino sem passo a passo (so no plano que vale). */
  detailable?: boolean;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  if (!plan && workouts.length === 0) {
    return (
      <Panel>
        <h2 className="od-label">{title}</h2>
        <div className="mt-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-brand-muted">
            {emptyText ?? "A Duni ainda não montou o plano desta semana. Ela analisa seu histórico, diz o status e explica cada treino."}
          </p>
          <button type="button" onClick={onGenerate} disabled={generating} className="od-btn od-btn-primary shrink-0">
            {generating ? "Montando…" : generateLabel}
          </button>
        </div>
      </Panel>
    );
  }

  const today = toISODate(new Date());
  // Sem o plano da semana (ainda nao detalhado), o quadro mostra os treinos do objetivo
  // dos proximos 7 dias; status e analise so aparecem depois de detalhar.
  const r = plan?.report ?? null;
  const load = r?.carga_semana_anterior ?? null;
  const weekStart = plan?.week_start ?? today;
  const weekEnd = plan?.week_end ?? toISODate(new Date(parseLocalDate(today).getTime() + 6 * 86_400_000));
  const undetailed = workouts.filter((w) => w.status === "planned" && w.date >= today && !(w.steps && w.steps.length));
  const byDate = new Map<string, PlannedWorkout[]>();
  for (const w of workouts) byDate.set(w.date, [...(byDate.get(w.date) ?? []), w]);
  // "Mudar de dia" pode levar um treino para fora da semana: ele vira mais uma coluna
  const days = [...new Set([...weekDays(weekStart, weekEnd), ...workouts.map((w) => w.date)])].sort();
  const maxLoad = Math.max(1, ...workouts.map(workload));
  const nextId = workouts.find((w) => w.status === "planned" && w.date >= today)?.id;
  const nextDate = workouts.find((w) => w.id === nextId)?.date;
  const selected = picked && days.includes(picked) ? picked : days.includes(today) ? today : nextDate ?? days[0];
  const selectedList = byDate.get(selected) ?? [];
  const doneCount = workouts.filter((w) => w.status === "done").length;
  const comp = Object.entries(load?.complementar ?? {});
  // Km e sessoes saem dos treinos salvos, nao do relatorio: "Pedir outro treino" e
  // "Mudar de dia" mudam a semana e o relatorio fica como foi gerado.
  const plannedM = workouts.reduce((s, w) => s + (w.target_distance_m ?? 0), 0);
  const plannedKm = plannedM > 0 ? Math.round(plannedM / 100) / 10 : r?.proxima_semana.km_previsto ?? null;
  const hasEvaluation = r ? Object.values(r.avaliacao).some((l) => l.length > 0) : false;
  const hasCriteria = r ? Object.values(r.criterios_ajuste).some((l) => l.length > 0) : false;
  const done = async (n?: string) => {
    if (n) setNotice(n);
    await onRefresh();
  };

  return (
    <Panel className="space-y-5">
      {/* 1. cabecalho: a semana e um resumo curto em numeros */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="od-label od-label-accent">{title}</h2>
          <p className="mt-1.5 font-display text-2xl font-extrabold tracking-tight">
            {shortDate(weekStart)} <span className="text-brand-muted">→</span> {shortDate(weekEnd)}
          </p>
          {!plan && <p className="mt-0.5 text-[0.74rem] text-brand-muted">Treinos do plano do objetivo nestes 7 dias</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[0.74rem]">
          <span className="rounded-full bg-white/[0.04] px-2.5 py-1 text-brand-textSecondary">
            <span className="od-num text-white">{plannedKm != null ? `~${plannedKm} km` : "—"}</span>
          </span>
          <span className="rounded-full bg-white/[0.04] px-2.5 py-1 text-brand-textSecondary">
            <span className="od-num text-white">{workouts.length}</span> treino{workouts.length === 1 ? "" : "s"}
          </span>
          <span className="rounded-full bg-white/[0.04] px-2.5 py-1 text-brand-textSecondary">
            <span className="od-num text-white">{doneCount}/{workouts.length}</span> feitos
          </span>
        </div>
      </div>

      {note}
      {detailable && undetailed.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ background: "rgba(0,191,255,0.06)", boxShadow: "inset 0 0 0 1px rgba(0,191,255,0.25)" }}>
          <p className="text-[0.82rem] text-brand-textSecondary">
            {undetailed.length === workouts.filter((w) => w.status === "planned" && w.date >= today).length
              ? "Estes treinos ainda não têm o passo a passo (aquecimento, ritmos, desaquecimento)."
              : `${undetailed.length} treino${undetailed.length === 1 ? "" : "s"} desta semana ainda sem o passo a passo.`}
            {" "}A Duni detalha seguindo o plano do objetivo, sem mudar dia nem distância.
          </p>
          <button type="button" onClick={onGenerate} disabled={generating} className="od-btn od-btn-primary od-btn-sm shrink-0">
            {generating ? "Detalhando…" : "Detalhar a semana"}
          </button>
        </div>
      )}
      {notice && <Alert tone="accent" title="A Duni ajustou o plano">{notice}</Alert>}

      {/* 2. o quadro da semana: um dia por coluna */}
      <div>
        <div
          className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2 lg:grid lg:overflow-visible lg:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]"
          style={{ "--cols": days.length } as CSSProperties}
          role="group"
          aria-label="Dias da semana"
        >
          {days.map((d) => (
            <DayColumn
              key={d}
              date={d}
              list={byDate.get(d) ?? []}
              maxLoad={maxLoad}
              today={today}
              selected={d === selected}
              nextId={nextId}
              onSelect={() => setPicked(d)}
            />
          ))}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.68rem] text-brand-muted">
          {Object.values(INTENSITY).map((it) => (
            <span key={it.label} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: it.color }} />{it.label}
            </span>
          ))}
          <span>· altura da barra = volume do treino</span>
        </div>
      </div>

      {/* 3. o dia escolhido, aberto logo abaixo do quadro */}
      <div key={selected} className="animate-od-fade-up rounded-2xl p-4 sm:p-5" style={{ background: "rgba(255,255,255,0.025)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)" }}>
        {selectedList.length === 0 ? (
          <div className="flex items-center gap-3 text-sm text-brand-textSecondary">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-brand-muted">
              <MoonIcon size={20} />
            </span>
            <div>
              <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-brand-muted">{dayLong(selected)}</div>
              <p className="mt-0.5">Dia de descanso. Recuperar também faz parte do treino.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {selectedList.map((w, i) => (
              <div key={w.id} className={i > 0 ? "border-t border-white/5 pt-6" : ""}>
                <WorkoutDetail w={w} onDone={done} next={w.id === nextId} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. o resto fica recolhido (so com a semana detalhada) */}
      {r && load && (
      <details className="group rounded-xl bg-white/[0.02]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-[0.82rem] text-brand-textSecondary hover:text-white">
          Ver análise completa
          <span className="transition-transform group-open:rotate-180" aria-hidden>▾</span>
        </summary>
        <div className="space-y-5 px-4 pb-4">
          <div>
            <div className="od-metric-label mb-2">Semana anterior (últimos 7 dias)</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Corrida" value={load.corrida_km != null ? `${load.corrida_km} km` : "—"} sub={load.corridas != null ? `${load.corridas} corrida${load.corridas === 1 ? "" : "s"}` : undefined} />
              <Stat label="Tempo" value={load.corrida_minutos ? formatDuration(load.corrida_minutos * 60) : "—"} sub={load.ritmo_medio ?? undefined} />
              <Stat label="Longão" value={load.longao_km ? `${load.longao_km} km` : "—"} />
              <Stat label="Treinos" value={load.treinos_total != null ? `${load.treinos_total}` : "—"} sub="contando os complementares" />
            </div>
            {(comp.length > 0 || load.intensidade_28d_pct) && (
              <p className="mt-2 text-[0.72rem] text-brand-muted">
                {comp.length ? `Complementar: ${comp.map(([k, v]) => `${k} ${v.sessoes}× (${v.minutos} min)`).join(", ")}. ` : ""}
                {load.intensidade_28d_pct
                  ? `Últimos 28 dias: ${load.intensidade_28d_pct.leve_z1_z2}% leve, ${load.intensidade_28d_pct.moderado_z3}% moderado, ${load.intensidade_28d_pct.forte_z4_z5}% forte.`
                  : ""}
              </p>
            )}
          </div>

          {hasEvaluation && (
            <div className="grid gap-4 sm:grid-cols-2">
              <BulletList title="Pontos positivos" items={r.avaliacao.positivos} color="#00FF66" />
              <BulletList title="Sinais de cansaço" items={r.avaliacao.fadiga} color="#FFC145" />
              <BulletList title="Riscos" items={r.avaliacao.riscos} color="#F85149" />
              <BulletList title="Evolução" items={r.avaliacao.evolucao} />
            </div>
          )}

          {hasCriteria && (
            <div>
              <div className="od-metric-label mb-2">Quando mudar o treino</div>
              <div className="grid gap-4 sm:grid-cols-2">
                <BulletList title="Manter" items={r.criterios_ajuste.manter} color="#00FF66" />
                <BulletList title="Reduzir" items={r.criterios_ajuste.reduzir} color="#FFC145" />
                <BulletList title="Pode acelerar" items={r.criterios_ajuste.acelerar} color="#C6FF00" />
                <BulletList title="Parar" items={r.criterios_ajuste.interromper} color="#F85149" />
              </div>
            </div>
          )}

          {r.proximas_4_semanas.length > 0 && (
            <div>
              <div className="od-metric-label mb-2">Direção das próximas 4 semanas</div>
              <div className="grid gap-2 sm:grid-cols-4">
                {r.proximas_4_semanas.map((w4) => (
                  <div key={w4.semana} className="od-tile px-3 py-2">
                    <div className="od-metric-label">Semana {w4.semana}</div>
                    <div className="od-num mt-1">{w4.km_aproximado != null ? `~${w4.km_aproximado} km` : "—"}</div>
                    <div className="mt-0.5 text-[0.72rem] text-brand-muted">{w4.foco}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </details>
      )}
    </Panel>
  );
}
