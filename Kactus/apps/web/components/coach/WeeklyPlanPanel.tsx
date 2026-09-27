"use client";

import { useState } from "react";

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
import { parseLocalDate, toISODate, WEEK_LABELS, WEEKLY_STATUS } from "@/lib/athlete";
import { formatDuration } from "@/lib/utils";

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
  return parseLocalDate(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
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

// A IA as vezes ja escreve o rotulo no valor ("PSE 3/10"); nao repetir.
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
  if (s.pse) parts.push(labeled("PSE", s.pse));
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
  const [mode, setMode] = useState<"regen" | "move" | null>(null);
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
    <div className="mt-3 border-t border-white/5 pt-3">
      {error && <p className="mb-2 text-xs text-brand-danger">{error}</p>}
      {mode === null && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setMode("regen")} className="od-btn od-btn-secondary od-btn-sm">Pedir outro treino</button>
          <button type="button" onClick={() => setMode("move")} className="od-btn od-btn-ghost od-btn-sm">Mudar de dia</button>
        </div>
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

function WorkoutCard({
  w, onDone, next = false,
}: {
  w: PlannedWorkout;
  onDone: (notice?: string) => Promise<void>;
  /** O proximo treino da semana: destacado e ja aberto. */
  next?: boolean;
}) {
  const t = w.targets ?? {};
  const intensity = w.target_intensity ? INTENSITY[w.target_intensity] : undefined;
  const editable = w.status === "planned" && w.date >= toISODate(new Date());
  const targets = [
    ["Ritmo", t.ritmo],
    ["Zona de FC", t.zona_fc],
    ["Esforço (PSE)", t.pse],
    ["Ritmo no plano (GAP)", t.gap],
    ["Cadência", t.cadencia],
    ["Terreno", t.terreno],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <details
      open={next}
      className="od-tile group p-0 [&[open]_.chev]:rotate-90"
      style={next ? { boxShadow: "inset 0 0 0 1px rgba(0,255,102,0.4)", background: "rgba(0,255,102,0.05)" } : undefined}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3">
        <div className="w-12 shrink-0 text-[0.66rem] font-bold uppercase tracking-wider" style={{ color: next ? "#00FF66" : undefined }}>
          <span className={next ? "" : "text-brand-muted"}>{dayShort(w.date)}</span>
          {next && <div className="text-[0.56rem] tracking-[0.12em]">Próximo</div>}
        </div>
        <SportTile sport={w.sport} size={30} radius={9} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{w.title}</div>
          <div className="truncate text-[0.7rem] text-brand-muted">{t.tipo ? `${t.tipo} · ` : ""}{volume(w)}</div>
        </div>
        {intensity && <span className="od-badge od-badge-muted !normal-case !tracking-normal" style={{ color: intensity.color }}>{intensity.label}</span>}
        {w.status !== "planned" && <span className="od-badge od-badge-muted">{w.status === "done" ? "Feito" : "Pulado"}</span>}
        <span className="chev text-brand-muted transition-transform" aria-hidden>›</span>
      </summary>
      <div className="space-y-3 px-3 pb-3 text-sm">
        {w.objective && <p><span className="text-brand-muted">Para quê: </span>{w.objective}</p>}
        {w.reason && <p className="text-brand-textSecondary"><span className="text-brand-muted">Por que agora: </span>{w.reason}</p>}
        {w.steps && w.steps.length > 0 && (
          <ol className="space-y-1.5">
            {w.steps.map((s, i) => (
              <li key={i} className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.025)" }}>
                <div className="text-[0.66rem] font-bold uppercase tracking-wider text-brand-accent">{STEP_LABEL[s.fase] ?? s.fase}</div>
                <div className="text-[0.82rem]">{s.descricao}</div>
                {stepDetail(s) && <div className="mt-0.5 text-[0.72rem] text-brand-muted">{stepDetail(s)}</div>}
              </li>
            ))}
          </ol>
        )}
        {targets.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[0.78rem] sm:grid-cols-3">
            {targets.map(([k, v]) => (
              <div key={k}><dt className="text-brand-muted">{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        )}
        {t.metrica_prioritaria && (
          <p className="text-[0.78rem] text-brand-textSecondary">
            <span className="text-brand-muted">Se ritmo, FC e PSE não baterem, priorize: </span>{t.metrica_prioritaria}
          </p>
        )}
        {t.observacoes && <p className="text-[0.78rem] text-brand-textSecondary">{t.observacoes}</p>}
        {t.ajuste_pedido && <p className="text-[0.72rem] text-brand-muted">Trocado a seu pedido: &quot;{t.ajuste_pedido}&quot;</p>}
        {!w.objective && w.description && <p className="text-brand-textSecondary">{w.description}</p>}
        {editable && <WorkoutActions w={w} onDone={onDone} />}
      </div>
    </details>
  );
}

export function WeeklyPlanPanel({
  plan, workouts, onRefresh, onGenerate, generating,
}: {
  plan: WeeklyPlan | null;
  workouts: PlannedWorkout[];
  onRefresh: () => Promise<void>;
  onGenerate: () => void;
  generating: boolean;
}) {
  const [notice, setNotice] = useState<string | null>(null);

  if (!plan) {
    return (
      <Panel>
        <h2 className="od-label">Plano da semana</h2>
        <div className="mt-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-brand-muted">
            A Duni ainda não montou o plano desta semana. Ela analisa seu histórico, diz o status e explica cada treino.
          </p>
          <button type="button" onClick={onGenerate} disabled={generating} className="od-btn od-btn-primary shrink-0">
            {generating ? "Montando…" : "Gerar plano da semana"}
          </button>
        </div>
      </Panel>
    );
  }

  const st = WEEKLY_STATUS[plan.status];
  const r = plan.report;
  const load = r.carga_semana_anterior;
  const days = weekDays(plan.week_start, plan.week_end);
  const byDate = new Map<string, PlannedWorkout[]>();
  for (const w of workouts) byDate.set(w.date, [...(byDate.get(w.date) ?? []), w]);
  // "Mudar de dia" pode levar um treino para fora da semana: ele continua na lista
  const outside = workouts.filter((w) => !days.includes(w.date));
  const today = toISODate(new Date());
  const nextId = workouts.find((w) => w.status === "planned" && w.date >= today)?.id;
  const comp = Object.entries(load.complementar ?? {});
  // Km e sessoes saem dos treinos salvos, nao do relatorio: "Pedir outro treino" e
  // "Mudar de dia" mudam a semana e o relatorio fica como foi gerado.
  const plannedM = workouts.reduce((s, w) => s + (w.target_distance_m ?? 0), 0);
  const plannedKm = plannedM > 0 ? Math.round(plannedM / 100) / 10 : r.proxima_semana.km_previsto;
  const hasEvaluation = Object.values(r.avaliacao).some((l) => l.length > 0);
  const hasCriteria = Object.values(r.criterios_ajuste).some((l) => l.length > 0);
  const done = async (n?: string) => {
    if (n) setNotice(n);
    await onRefresh();
  };

  return (
    <Panel className="space-y-5">
      {/* 1. o essencial: status, leitura e a semana em numeros */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="od-label od-label-accent">Plano da semana · {shortDate(plan.week_start)} a {shortDate(plan.week_end)}</h2>
          <span className="font-mono text-[0.62rem] tracking-wider text-brand-muted">
            gerado {new Date(plan.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <div className="mt-3 flex flex-col gap-2 rounded-xl p-4 sm:flex-row sm:items-center sm:gap-4" style={{ background: `${st.color}0d`, boxShadow: `inset 0 0 0 1px ${st.color}40` }}>
          <div className="shrink-0 font-display text-lg font-bold" style={{ color: st.color }}>{st.emoji} {st.label}</div>
          <p className="text-sm text-brand-textSecondary sm:border-l sm:border-white/10 sm:pl-4">{plan.status_reason}</p>
        </div>
        <p className="mt-3 text-sm leading-relaxed">{r.resumo}</p>
        <p className="mt-2 text-[0.78rem] text-brand-muted">
          <span className="od-num text-white">{plannedKm != null ? `~${plannedKm} km` : "—"}</span>
          {" · "}
          <span className="od-num text-white">{workouts.length}</span> treino{workouts.length === 1 ? "" : "s"}
          {r.proxima_semana.estimulo_principal ? ` · foco: ${r.proxima_semana.estimulo_principal}` : ""}
        </p>
      </div>

      {notice && <Alert tone="accent" title="A Duni ajustou o plano">{notice}</Alert>}

      {/* 2. a semana, um dia por linha (o proximo treino ja aberto) */}
      <div>
        <div className="od-metric-label mb-2">A semana</div>
        <div className="space-y-2">
          {days.map((d) => {
            const list = byDate.get(d);
            if (!list) {
              return (
                <div key={d} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-brand-muted" style={{ background: "rgba(255,255,255,0.015)" }}>
                  <div className="w-12 shrink-0 text-[0.66rem] font-bold uppercase tracking-wider">{dayShort(d)}</div>
                  <span>Descanso</span>
                </div>
              );
            }
            return list.map((w) => <WorkoutCard key={w.id} w={w} onDone={done} next={w.id === nextId} />);
          })}
          {outside.map((w) => <WorkoutCard key={w.id} w={w} onDone={done} next={w.id === nextId} />)}
        </div>
        <p className="mt-2 text-[0.72rem] text-brand-muted">Toque num treino para ver os passos, trocar ou mudar de dia.</p>
      </div>

      {/* 3. o resto fica recolhido */}
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
              <Stat label="Esforço médio" value={load.pse_media != null ? `${load.pse_media}/10` : "—"} sub={load.pse_media == null ? "sem check-in" : undefined} />
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
    </Panel>
  );
}
