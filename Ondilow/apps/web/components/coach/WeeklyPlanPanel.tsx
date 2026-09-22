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

function stepDetail(s: WorkoutStep) {
  const parts: string[] = [];
  if (s.repeticoes) parts.push(`${s.repeticoes}×`);
  if (s.distancia_km) parts.push(`${s.distancia_km} km`);
  if (s.duracao_min) parts.push(`${s.duracao_min} min`);
  if (s.ritmo) parts.push(s.ritmo);
  if (s.zona_fc) parts.push(`FC ${s.zona_fc}`);
  if (s.pse) parts.push(`PSE ${s.pse}`);
  if (s.recuperacao) parts.push(`recuperação: ${s.recuperacao}`);
  return parts.join(" · ");
}

function BulletList({ title, items, color }: { title: string; items: string[]; color?: string }) {
  return (
    <div>
      <div className="od-metric-label mb-1.5" style={color ? { color } : undefined}>{title}</div>
      {items.length === 0 ? (
        <p className="text-xs text-brand-textTertiary">—</p>
      ) : (
        <ul className="space-y-1 text-[0.8rem] leading-snug text-brand-textSecondary">
          {items.map((it, i) => <li key={i} className="flex gap-1.5"><span className="text-brand-muted">•</span><span>{it}</span></li>)}
        </ul>
      )}
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

function WorkoutCard({ w, onDone }: { w: PlannedWorkout; onDone: (notice?: string) => Promise<void> }) {
  const t = w.targets ?? {};
  const intensity = w.target_intensity ? INTENSITY[w.target_intensity] : undefined;
  const editable = w.status === "planned" && w.date >= toISODate(new Date());
  const targets = [
    ["Ritmo", t.ritmo],
    ["GAP", t.gap],
    ["Zona de FC", t.zona_fc],
    ["PSE", t.pse],
    ["Cadência", t.cadencia],
    ["Terreno", t.terreno],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <details className="od-tile group p-0 [&[open]_.chev]:rotate-90">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3">
        <div className="w-12 shrink-0 text-[0.66rem] font-bold uppercase tracking-wider text-brand-muted">{dayShort(w.date)}</div>
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
        {w.objective && <p><span className="text-brand-muted">Objetivo: </span>{w.objective}</p>}
        {w.reason && <p className="text-brand-textSecondary"><span className="text-brand-muted">Por que nesta semana: </span>{w.reason}</p>}
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
  const byDate = new Map(workouts.map((w) => [w.date, w]));
  const days = weekDays(plan.week_start, plan.week_end);
  const comp = Object.entries(load.complementar ?? {});
  const done = async (n?: string) => {
    if (n) setNotice(n);
    await onRefresh();
  };

  return (
    <Panel className="space-y-5">
      {/* 1. resumo */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="od-label od-label-accent">Plano da semana · {shortDate(plan.week_start)} a {shortDate(plan.week_end)}</h2>
          <span className="font-mono text-[0.62rem] tracking-wider text-brand-muted">
            gerado {new Date(plan.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            {plan.model_used ? ` · ${plan.model_used}` : ""}
          </span>
        </div>
        <div className="mt-3 flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-start" style={{ background: `${st.color}0d`, boxShadow: `inset 0 0 0 1px ${st.color}40` }}>
          <div className="shrink-0">
            <div className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-brand-muted">Status da Duni</div>
            <div className="mt-1 font-display text-lg font-bold" style={{ color: st.color }}>{st.emoji} {st.label}</div>
          </div>
          <p className="text-sm text-brand-textSecondary sm:border-l sm:border-white/10 sm:pl-4">{plan.status_reason}</p>
        </div>
        <p className="mt-3 text-sm leading-relaxed">{r.resumo}</p>
      </div>

      {notice && <Alert tone="accent" title="A Duni ajustou o plano">{notice}</Alert>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <div className="od-metric-label mb-2">Semana anterior (últimos 7 dias)</div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Corrida" value={load.corrida_km != null ? `${load.corrida_km} km` : "—"} sub={load.corridas != null ? `${load.corridas} corrida${load.corridas === 1 ? "" : "s"}` : undefined} />
            <Stat label="Tempo" value={load.corrida_minutos ? formatDuration(load.corrida_minutos * 60) : "—"} sub={load.ritmo_medio ?? undefined} />
            <Stat label="Longão" value={load.longao_km ? `${load.longao_km} km` : "—"} />
            <Stat label="PSE média" value={load.pse_media != null ? `${load.pse_media}` : "—"} sub={load.carga_interna_srpe != null ? `sRPE ${load.carga_interna_srpe}` : "sem check-in"} />
          </div>
          <p className="mt-2 text-[0.72rem] text-brand-muted">
            {comp.length ? `Complementar: ${comp.map(([k, v]) => `${k} ${v.sessoes}× (${v.minutos} min)`).join(", ")}. ` : ""}
            {load.intensidade_28d_pct
              ? `Intensidade em 28 dias: ${load.intensidade_28d_pct.leve_z1_z2}% leve, ${load.intensidade_28d_pct.moderado_z3}% moderado, ${load.intensidade_28d_pct.forte_z4_z5}% forte.`
              : ""}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <BulletList title="Pontos positivos" items={r.avaliacao.positivos} color="#00FF66" />
          <BulletList title="Sinais de fadiga" items={r.avaliacao.fadiga} color="#FFC145" />
          <BulletList title="Riscos" items={r.avaliacao.riscos} color="#F85149" />
          <BulletList title="Evolução" items={r.avaliacao.evolucao} />
        </div>
      </div>

      <div className="od-tile grid gap-3 p-3 text-sm sm:grid-cols-4">
        <div><div className="od-metric-label">Próxima semana</div><div className="od-num mt-1">{r.proxima_semana.km_previsto != null ? `~${r.proxima_semana.km_previsto} km` : "—"}</div></div>
        <div><div className="od-metric-label">Sessões</div><div className="od-num mt-1">{r.proxima_semana.sessoes}</div></div>
        <div><div className="od-metric-label">Estímulo principal</div><div className="mt-1 text-[0.82rem]">{r.proxima_semana.estimulo_principal}</div></div>
        <div><div className="od-metric-label">Objetivo</div><div className="mt-1 text-[0.82rem]">{r.proxima_semana.objetivo}</div></div>
      </div>

      {/* 2. tabela */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-[0.78rem]">
          <thead className="text-[0.62rem] uppercase tracking-wider text-brand-muted">
            <tr className="border-b border-white/5">
              {["Dia", "Treino", "Distância", "Ritmo/GAP", "FC", "PSE", "Cadência", "Objetivo"].map((h) => <th key={h} className="px-2 py-2 font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const w = byDate.get(d);
              const t = w?.targets ?? {};
              return (
                <tr key={d} className="border-b border-white/5 align-top">
                  <td className="whitespace-nowrap px-2 py-2 font-semibold text-brand-muted">{dayShort(d)}</td>
                  {w ? (
                    <>
                      <td className="px-2 py-2 font-semibold">{w.title}</td>
                      <td className="whitespace-nowrap px-2 py-2">{volume(w)}</td>
                      <td className="px-2 py-2">{[t.ritmo, t.gap && `GAP ${t.gap}`].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="px-2 py-2">{t.zona_fc || "—"}</td>
                      <td className="max-w-[140px] px-2 py-2" title={t.pse ?? undefined}><span className="line-clamp-2">{t.pse || "—"}</span></td>
                      <td className="px-2 py-2">{t.cadencia || "—"}</td>
                      <td className="max-w-[220px] px-2 py-2 text-brand-textSecondary"><span className="line-clamp-2">{w.objective || w.description || "—"}</span></td>
                    </>
                  ) : (
                    <td colSpan={7} className="px-2 py-2 text-brand-muted">Descanso</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 3. cada treino */}
      <div>
        <div className="od-metric-label mb-2">Treinos, um por um</div>
        <div className="space-y-2">
          {workouts.length === 0 ? (
            <p className="text-sm text-brand-muted">Nenhum treino neste plano.</p>
          ) : workouts.map((w) => <WorkoutCard key={w.id} w={w} onDone={done} />)}
        </div>
      </div>

      {/* 4. criterios */}
      <div>
        <div className="od-label mb-3">Critérios para ajustar o treino</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <BulletList title="Manter" items={r.criterios_ajuste.manter} color="#00FF66" />
          <BulletList title="Reduzir" items={r.criterios_ajuste.reduzir} color="#FFC145" />
          <BulletList title="Acelerar" items={r.criterios_ajuste.acelerar} color="#C6FF00" />
          <BulletList title="Interromper" items={r.criterios_ajuste.interromper} color="#F85149" />
        </div>
      </div>

      {r.proximas_4_semanas.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-[0.78rem] text-brand-muted hover:text-white">Direção das próximas 4 semanas (só volume e foco)</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            {r.proximas_4_semanas.map((s) => (
              <div key={s.semana} className="od-tile px-3 py-2">
                <div className="od-metric-label">Semana {s.semana}</div>
                <div className="od-num mt-1">{s.km_aproximado != null ? `~${s.km_aproximado} km` : "—"}</div>
                <div className="mt-0.5 text-[0.72rem] text-brand-muted">{s.foco}</div>
              </div>
            ))}
          </div>
        </details>
      )}
    </Panel>
  );
}
