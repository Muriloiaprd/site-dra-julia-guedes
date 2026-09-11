"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { ChartTooltipBox, LegendDot } from "@/components/ui/charts";
import { Alert, EmptyState, PageContainer, PageHeader, Panel, ProgressBar, Segmented, Skeleton, StatusDot, TrendBadge } from "@/components/ui/primitives";
import {
  fetchActivities,
  fetchMe,
  fetchPredictionsOverview,
  simulateTsb,
  type ActivitySummary,
  type PredictionsOverview,
  type SimulatedDay,
} from "@/lib/api";
import { axisProps, C, gridProps } from "@/lib/theme";
import { formatClock, formatPace, formatPaceShort, sportGroup } from "@/lib/utils";

const RACE_LABELS: Record<string, { short: string; name: string }> = {
  "5k": { short: "5K", name: "5 km" },
  "10k": { short: "10K", name: "10 km" },
  "21k": { short: "21K", name: "Meia maratona" },
  "42k": { short: "42K", name: "Maratona" },
};

function confidenceLabel(c: number): string {
  if (c >= 1.0) return "Tempo real";
  if (c >= 0.75) return "Alta confiança";
  return "Estimado";
}

function confidenceColor(c: number): string {
  if (c >= 1.0) return C.accent;
  if (c >= 0.75) return C.lime;
  return C.warning;
}

const RISK_COLORS: Record<string, string> = {
  low: C.accent,
  moderate: C.warning,
  high: C.danger,
  unknown: C.muted,
};

const RISK_LABELS: Record<string, string> = {
  low: "Baixo",
  moderate: "Moderado",
  high: "Alto",
  unknown: "Sem dados",
};

const DAYS_OPTIONS = [
  { value: 7, label: "7d" },
  { value: 14, label: "14d" },
  { value: 21, label: "21d" },
  { value: 30, label: "30d" },
] as const;

const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Pace mensal (ponderado por distancia) das corridas >= 3 km + regressao linear. */
function monthlyPaceTrend(acts: ActivitySummary[]) {
  const runs = acts.filter((a) => sportGroup(a.sport) === "run" && a.avg_pace_s_per_km && (a.distance_m ?? 0) >= 3000);
  const buckets = new Map<string, { w: number; sum: number; n: number; km: number }>();
  for (const a of runs) {
    const d = new Date(a.start_time);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const b = buckets.get(key) ?? { w: 0, sum: 0, n: 0, km: 0 };
    b.w += a.distance_m!; b.sum += a.avg_pace_s_per_km! * a.distance_m!; b.n += 1; b.km += a.distance_m! / 1000;
    buckets.set(key, b);
  }
  const rows = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, b]) => ({ key, label: `${MONTH_SHORT[+key.slice(5) - 1]}/${key.slice(2, 4)}`, pace: b.sum / b.w, runs: b.n, km: b.km }));
  if (rows.length >= 2) {
    const n = rows.length;
    const mx = (n - 1) / 2;
    const my = rows.reduce((s, r) => s + r.pace, 0) / n;
    let num = 0, den = 0;
    rows.forEach((r, i) => { num += (i - mx) * (r.pace - my); den += (i - mx) ** 2; });
    const slope = den ? num / den : 0;
    const intercept = my - slope * mx;
    const withTrend = rows.map((r, i) => ({ ...r, trend: intercept + slope * i }));
    const first = withTrend[0].trend, last = withTrend[n - 1].trend;
    return { rows: withTrend, changePct: ((last - first) / first) * 100 };
  }
  return { rows: rows.map((r) => ({ ...r, trend: r.pace })), changePct: null };
}

export default function PredictionsPage() {
  const router = useRouter();
  const [data, setData] = useState<PredictionsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [actsLoading, setActsLoading] = useState(true);

  // Simulacao de TSB
  const [simDays, setSimDays] = useState<number>(14);
  const [simTss, setSimTss] = useState("60");
  const [simData, setSimData] = useState<SimulatedDay[]>([]);
  const [simLoading, setSimLoading] = useState(false);

  useEffect(() => {
    fetchMe().then((u) => {
      if (!u) { router.push("/login"); return; }
    });
  }, [router]);

  useEffect(() => {
    setLoading(true);
    fetchPredictionsOverview()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Erro"))
      .finally(() => setLoading(false));
    // sem filtro de esporte na API: monthlyPaceTrend agrupa corrida + trail + esteira
    fetchActivities(500, 0, undefined, "365")
      .then(setActivities)
      .catch(() => {})
      .finally(() => setActsLoading(false));
  }, []);

  const evolution = useMemo(() => monthlyPaceTrend(activities), [activities]);

  async function handleSimulate() {
    const tssValue = parseFloat(simTss) || 60;
    const planned = Array.from({ length: simDays }, () => tssValue);
    setSimLoading(true);
    try {
      const result = await simulateTsb(planned);
      setSimData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro na simulação");
    } finally {
      setSimLoading(false);
    }
  }

  const simLast = simData[simData.length - 1];

  return (
    <PageContainer>
      <PageHeader
        kicker="Laboratório de performance"
        title="Previsões & análise"
        description="Modelos de VDOT, Riegel e carga aplicados ao seu histórico real para estimar seu potencial e o risco do momento."
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></svg>}
      />

      {error && <div className="mb-4"><Alert tone="danger">{error}</Alert></div>}

      <div className="od-stagger space-y-4">
        {loading ? (
          <div className="grid gap-4 lg:grid-cols-12">
            <Skeleton className="h-52 lg:col-span-7" />
            <Skeleton className="h-52 lg:col-span-5" />
          </div>
        ) : data ? (
          <div className="grid gap-4 lg:grid-cols-12">
            {/* Recomendação de hoje */}
            <Panel variant="hero" className="lg:col-span-7">
              <div className="od-scanline" />
              <h2 className="od-label od-label-accent relative">Recomendação para hoje</h2>
              <div className="relative mt-5 flex items-start gap-4">
                <span className="mt-2 h-12 w-1.5 shrink-0 rounded-full" style={{ background: data.recommendation.color, boxShadow: `0 0 16px ${data.recommendation.color}` }} />
                <div>
                  <p className="font-display text-[2rem] font-extrabold uppercase leading-none tracking-tight sm:text-[2.4rem]" style={{ color: data.recommendation.color }}>
                    {data.recommendation.label}
                  </p>
                  {data.recommendation.detail && (
                    <p className="mt-3 max-w-lg text-sm leading-relaxed text-brand-textSecondary">{data.recommendation.detail}</p>
                  )}
                </div>
              </div>
              <div className="relative mt-6 flex flex-wrap items-center gap-2 text-[0.7rem] text-brand-muted">
                <span className="font-mono tracking-wider text-brand-accent">MODEL</span>
                <span className="od-badge od-badge-muted">TSB</span>
                <span className="od-badge od-badge-muted">ACWR</span>
                <span className="od-badge od-badge-muted">Histórico 28d</span>
              </div>
            </Panel>

            {/* Risco de lesão */}
            <Panel className="lg:col-span-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="od-label">Risco de lesão / overtraining</h2>
                <span className="od-badge" style={{ color: RISK_COLORS[data.risk.level], background: `${RISK_COLORS[data.risk.level]}14`, boxShadow: `inset 0 0 0 1px ${RISK_COLORS[data.risk.level]}44` }}>
                  <StatusDot color={RISK_COLORS[data.risk.level]} size={5} pulse={data.risk.level === "high"} />
                  {RISK_LABELS[data.risk.level]}
                </span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-1.5" aria-hidden>
                {(["low", "moderate", "high"] as const).map((lvl) => {
                  const on = data.risk.level === lvl;
                  return (
                    <div key={lvl}>
                      <div className="h-2 rounded-full transition-all" style={{ background: on ? RISK_COLORS[lvl] : "rgba(255,255,255,0.07)", boxShadow: on ? `0 0 12px ${RISK_COLORS[lvl]}` : undefined }} />
                      <div className="mt-1.5 text-[0.62rem] font-semibold uppercase tracking-wider" style={{ color: on ? RISK_COLORS[lvl] : "#6E6E6E" }}>{RISK_LABELS[lvl]}</div>
                    </div>
                  );
                })}
              </div>
              <ul className="mt-4 space-y-1.5 text-sm">
                {data.risk.reasons.map((r, i) => (
                  <li key={i} className="flex gap-2 text-brand-textSecondary"><span className="text-brand-muted">▸</span>{r}</li>
                ))}
              </ul>
              <p className="mt-4 border-t border-white/5 pt-3 text-sm font-medium" style={{ color: RISK_COLORS[data.risk.level] }}>
                {data.risk.recommendation}
              </p>
            </Panel>
          </div>
        ) : null}

        {/* Previsões de prova */}
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
            <h2 className="od-label">Previsões de prova</h2>
            <span className="text-[0.7rem] text-brand-muted">Fórmula de Riegel + VDOT (Jack Daniels)</span>
          </div>
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-52" />)}</div>
          ) : !data || data.race_predictions.length === 0 ? (
            <Panel>
              <EmptyState
                title="Nenhum recorde de corrida encontrado"
                description="Importe atividades de corrida para gerar previsões."
                action={<Link href="/import" className="od-btn od-btn-secondary">Importar atividades →</Link>}
              />
            </Panel>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {data.race_predictions.map((p) => {
                const meta = RACE_LABELS[p.distance];
                const cc = confidenceColor(p.confidence);
                return (
                  <Panel key={p.distance} interactive className="overflow-hidden">
                    <div aria-hidden className="pointer-events-none absolute -right-3 -top-5 font-display text-[5.5rem] font-black leading-none text-white/[0.03]">{meta?.short ?? p.distance}</div>
                    <div className="relative flex items-center justify-between">
                      <div>
                        <div className="od-num text-lg text-brand-accent">{meta?.short ?? p.distance}</div>
                        <div className="text-[0.7rem] text-brand-muted">{meta?.name}</div>
                      </div>
                      <span className="od-badge od-badge-muted">VDOT {p.vdot}</span>
                    </div>
                    <div className="od-num relative mt-5 text-[2.2rem] leading-none">{formatClock(p.predicted_s)}</div>
                    <div className="relative mt-1.5 text-xs text-brand-muted">{formatPace(p.predicted_s / (p.distance_m / 1000))} médio</div>
                    <div className="relative mt-5">
                      <div className="mb-1.5 flex items-center justify-between text-[0.68rem]">
                        <span className="font-semibold" style={{ color: cc }}>{confidenceLabel(p.confidence)}</span>
                        <span className="tabular-nums text-brand-muted">{Math.round(Math.min(1, p.confidence) * 100)}%</span>
                      </div>
                      <ProgressBar value={Math.min(1, p.confidence) * 100} height={4} color={cc} />
                    </div>
                  </Panel>
                );
              })}
            </div>
          )}
          <p className="mt-2 px-1 text-xs text-brand-muted">
            Baseado nos seus melhores esforços de corrida. Para mais precisão, configure seu perfil e acumule histórico.
          </p>
        </section>

        {/* Evolução */}
        <Panel>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
            <h2 className="od-label">Como sua performance está evoluindo</h2>
            {evolution.changePct != null && (
              <span className="inline-flex items-center gap-2 text-xs text-brand-muted">
                Tendência do pace <TrendBadge pct={evolution.changePct} invert />
              </span>
            )}
          </div>
          <p className="mb-4 text-xs text-brand-muted">Pace médio mensal das corridas de 3 km ou mais (ponderado por distância), com linha de tendência.</p>
          {actsLoading ? <Skeleton className="h-[240px]" /> : evolution.rows.length < 2 ? (
            <EmptyState title="Histórico insuficiente" description="São necessários pelo menos 2 meses com corridas de 3 km ou mais." />
          ) : (
            <>
              <div className="mb-2 flex gap-4">
                <LegendDot color={C.accent} label="Pace mensal" />
                <LegendDot color={C.lime} label="Tendência" dashed />
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={evolution.rows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pace-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.accent} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...gridProps} />
                  <XAxis {...axisProps} dataKey="label" />
                  <YAxis {...axisProps} width={46} reversed domain={["auto", "auto"]} tickFormatter={(v: number) => formatPaceShort(v)} />
                  <Tooltip
                    cursor={{ stroke: "rgba(0,255,102,0.3)", strokeDasharray: "3 4" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const r = payload[0].payload as (typeof evolution.rows)[number];
                      return <ChartTooltipBox title={r.label} rows={[
                        { label: "Pace médio", value: formatPace(r.pace), color: C.accent },
                        { label: "Tendência", value: formatPace(r.trend), color: C.lime },
                        { label: "Corridas", value: `${r.runs} · ${r.km.toFixed(0)} km` },
                      ]} />;
                    }}
                  />
                  <Area type="monotone" dataKey="pace" stroke={C.accent} strokeWidth={2.2} fill="url(#pace-fill)" baseValue="dataMax"
                    dot={{ r: 3, fill: C.accent, strokeWidth: 0 }} activeDot={{ r: 6, fill: C.accent, stroke: C.bg, strokeWidth: 2 }} />
                  <Line type="linear" dataKey="trend" stroke={C.lime} strokeWidth={1.5} strokeDasharray="6 5" dot={false} activeDot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </>
          )}
        </Panel>

        {/* Simulador de TSB */}
        <Panel>
          <h2 className="od-label mb-1">Simulador de forma futura (TSB)</h2>
          <p className="mb-5 text-xs text-brand-muted">Projete CTL, ATL e TSB mantendo um TSS diário constante.</p>
          <div className="mb-5 flex flex-wrap items-end gap-4">
            <div>
              <span className="od-field-label">Período</span>
              <Segmented options={DAYS_OPTIONS} value={simDays} onChange={setSimDays} size="md" ariaLabel="Período da simulação" />
            </div>
            <label>
              <span className="od-field-label">TSS diário planejado</span>
              <input
                type="number"
                value={simTss}
                onChange={(e) => setSimTss(e.target.value)}
                className="od-input !w-28 !py-2"
                min="0"
                max="300"
                step="5"
              />
            </label>
            <button
              onClick={handleSimulate}
              disabled={simLoading}
              className="od-btn od-btn-primary"
            >
              {simLoading ? "Calculando…" : "Simular"}
            </button>
          </div>

          {simData.length > 0 ? (
            <>
              {simLast && (
                <div className="mb-4 grid grid-cols-3 gap-2">
                  {[
                    { k: "CTL final", v: simLast.ctl.toFixed(1), c: C.accent },
                    { k: "ATL final", v: simLast.atl.toFixed(1), c: C.info },
                    { k: "TSB final", v: `${simLast.tsb > 0 ? "+" : ""}${simLast.tsb.toFixed(1)}`, c: simLast.tsb >= -10 ? C.accent : simLast.tsb >= -30 ? C.warning : C.danger },
                  ].map((t) => (
                    <div key={t.k} className="od-tile p-3">
                      <div className="od-metric-label">{t.k}</div>
                      <div className="od-num mt-1 text-xl" style={{ color: t.c }}>{t.v}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mb-2 flex flex-wrap gap-4">
                <LegendDot color={C.accent} label="CTL" />
                <LegendDot color={C.info} label="ATL" />
                <LegendDot color={C.lime} label="TSB" dashed />
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={simData} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sim-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.accent} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...gridProps} />
                  <XAxis
                    {...axisProps}
                    dataKey="date"
                    tickFormatter={(v: string) => new Date(v + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    minTickGap={28}
                  />
                  <YAxis {...axisProps} width={40} />
                  <Tooltip
                    cursor={{ stroke: "rgba(0,255,102,0.3)", strokeDasharray: "3 4" }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const r = payload[0].payload as SimulatedDay;
                      return <ChartTooltipBox
                        title={new Date(String(label) + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
                        rows={[
                          { label: "CTL", value: r.ctl.toFixed(1), color: C.accent },
                          { label: "ATL", value: r.atl.toFixed(1), color: C.info },
                          { label: "TSB", value: r.tsb.toFixed(1), color: C.lime },
                        ]}
                      />;
                    }}
                  />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
                  <Area type="monotone" dataKey="ctl" stroke={C.accent} strokeWidth={2} fill="url(#sim-fill)" dot={false} name="CTL" />
                  <Line type="monotone" dataKey="atl" stroke={C.info} strokeWidth={1.8} dot={false} name="ATL" />
                  <Line type="monotone" dataKey="tsb" stroke={C.lime} strokeWidth={1.5} dot={false} strokeDasharray="5 3" name="TSB" />
                </ComposedChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div className="od-tile flex items-center justify-center py-10 text-center text-sm text-brand-muted">
              Configure o TSS diário e clique em Simular para projetar sua forma.
            </div>
          )}
        </Panel>

        {/* Legenda das fórmulas */}
        <details className="od-panel group !p-0">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 sm:px-6">
            <span className="od-label od-label-plain">Como as previsões são calculadas</span>
            <span className="text-brand-muted transition-transform duration-200 group-open:rotate-180" aria-hidden>▾</span>
          </summary>
          <div className="border-t border-white/5 px-5 pb-5 pt-4 text-sm text-brand-muted sm:px-6">
            <ul className="space-y-2">
              <li><strong className="text-brand-textSecondary">Fórmula de Riegel</strong>: T2 = T1 × (D2/D1)^1.06 — extrapolação científica entre distâncias</li>
              <li><strong className="text-brand-textSecondary">VDOT</strong> (Jack Daniels): estimativa de VO2max com base no seu melhor tempo recente</li>
              <li><strong className="text-brand-textSecondary">Risco de lesão</strong>: ACWR {">"} 1.5 ou TSB {"<"} −30 por 3+ dias = alerta</li>
              <li><strong className="text-brand-textSecondary">Simulação de TSB</strong>: projeta CTL/ATL/TSB assumindo TSS constante por dia</li>
            </ul>
            <p className="mt-3">
              Para previsões mais precisas, configure <Link href="/profile" className="text-brand-accent hover:underline">FC Máxima, FTP e CSS no perfil</Link>.
            </p>
          </div>
        </details>
      </div>
    </PageContainer>
  );
}
