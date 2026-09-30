"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Area, Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { ChartTooltipBox, LegendDot, Sparkline } from "@/components/ui/charts";
import { Alert, Panel, Segmented, Skeleton } from "@/components/ui/primitives";
import { simulateTsb, type DailyMetric, type SimulatedDay } from "@/lib/api";
import { latestMetric, riskFromAcwr } from "@/lib/athlete";
import { axisProps, C, gridProps } from "@/lib/theme";

export const DAY_OPTIONS = [
  { value: 30, label: "30d" },
  { value: 60, label: "60d" },
  { value: 90, label: "90d" },
  { value: 180, label: "6m" },
  { value: 365, label: "1a" },
] as const;

const SIM_DAYS_OPTIONS = [
  { value: 7, label: "7d" },
  { value: 14, label: "14d" },
  { value: 21, label: "21d" },
  { value: 30, label: "30d" },
] as const;

function tsbColor(tsb: number): string {
  if (tsb >= -10) return C.accent;
  if (tsb >= -30) return C.warning;
  return C.danger;
}

const fmtDay = (v: string) => new Date(v + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
const fmtDayLong = (v: string) => new Date(v + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });

function LoadTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length || !label) return null;
  const get = (k: string) => payload.find((p) => p.dataKey === k)?.value;
  const rows = [
    { key: "CTL", label: "Condicionamento (CTL)", color: C.accent },
    { key: "ATL", label: "Cansaço recente (ATL)", color: C.info },
    { key: "TSB", label: "Disposição (TSB)", color: C.lime },
    { key: "Carga", label: "Carga do dia (TSS)", color: C.muted },
    { key: "ACWR", label: "Salto de carga (ACWR)", color: C.lime },
  ]
    .filter((r) => get(r.key) != null)
    .map((r) => ({ label: r.label, value: r.key === "ACWR" ? Number(get(r.key)).toFixed(2) : Number(get(r.key)).toFixed(1), color: r.color }));
  return <ChartTooltipBox title={fmtDayLong(label)} rows={rows} />;
}

function KpiCard({ label, name, value, color, spark, loading }: {
  label: string; name: string; value?: string; color: string; spark: number[]; loading: boolean;
}) {
  return (
    <Panel className="!p-4 sm:!p-5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="od-num text-sm" style={{ color }}>{label}</span>
        <span className="truncate text-[0.66rem] text-brand-muted">{name}</span>
      </div>
      {loading ? <Skeleton className="mt-3 h-9 w-24" /> : (
        <div className="od-num mt-2 text-[2rem] leading-none">{value ?? "—"}</div>
      )}
      <div className="mt-3"><Sparkline data={spark} color={color} height={30} responsive /></div>
    </Panel>
  );
}

/** Simulador de forma futura: projeta CTL/ATL/TSB mantendo um TSS diario constante. */
function TsbSimulator() {
  const [simDays, setSimDays] = useState<number>(14);
  const [simTss, setSimTss] = useState("60");
  const [simData, setSimData] = useState<SimulatedDay[]>([]);
  const [simLoading, setSimLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSimulate() {
    const tssValue = parseFloat(simTss) || 60;
    setSimLoading(true);
    setError(null);
    try {
      setSimData(await simulateTsb(Array.from({ length: simDays }, () => tssValue)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro na simulação");
    } finally {
      setSimLoading(false);
    }
  }

  const simLast = simData[simData.length - 1];

  return (
    <div>
      <h3 className="od-label mb-1">Simulador de forma futura (TSB)</h3>
      <p className="mb-4 text-xs text-brand-muted">Projete CTL, ATL e TSB mantendo um TSS diário constante.</p>
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div>
          <span className="od-field-label">Período</span>
          <Segmented options={SIM_DAYS_OPTIONS} value={simDays} onChange={setSimDays} size="md" ariaLabel="Período da simulação" />
        </div>
        <label>
          <span className="od-field-label">TSS diário planejado</span>
          <input type="number" value={simTss} onChange={(e) => setSimTss(e.target.value)} className="od-input !w-28 !py-2" min="0" max="300" step="5" />
        </label>
        <button onClick={handleSimulate} disabled={simLoading} className="od-btn od-btn-primary">
          {simLoading ? "Calculando…" : "Simular"}
        </button>
      </div>
      {error && <div className="mb-3"><Alert tone="danger">{error}</Alert></div>}

      {simData.length > 0 ? (
        <>
          {simLast && (
            <div className="mb-4 grid grid-cols-3 gap-2">
              {[
                { k: "CTL final", v: simLast.ctl.toFixed(1), c: C.accent },
                { k: "ATL final", v: simLast.atl.toFixed(1), c: C.info },
                { k: "TSB final", v: `${simLast.tsb > 0 ? "+" : ""}${simLast.tsb.toFixed(1)}`, c: tsbColor(simLast.tsb) },
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
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart accessibilityLayer data={simData} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="sim-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.accent} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} />
              <XAxis {...axisProps} dataKey="date" tickFormatter={(v: string) => new Date(v + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} minTickGap={28} />
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
        <div className="od-tile flex items-center justify-center py-8 text-center text-sm text-brand-muted">
          Configure o TSS diário e clique em Simular para projetar sua forma.
        </div>
      )}
    </div>
  );
}

/**
 * Um unico "Modo avancado" recolhido com tudo que e tecnico (antes espalhado em Carga e Previsoes):
 * KPIs com sigla, condicionamento x cansaco, TSB, ACWR, simulador e como tudo e calculado.
 */
export function AdvancedSection({ data, loading, days, onDaysChange }: {
  data: DailyMetric[];
  loading: boolean;
  days: number;
  onDaysChange: (d: number) => void;
}) {
  const latest = latestMetric(data);
  const risk = riskFromAcwr(latest?.acwr ?? null);
  const acwrMax = Math.max(2, ...data.map((d) => d.acwr ?? 0)) + 0.1;
  const series = (k: keyof DailyMetric) => data.map((d) => d[k] as number | null).filter((v): v is number => v != null);

  const chartData = useMemo(() => data.map((d) => ({
    date: d.date,
    CTL: d.ctl != null ? +d.ctl.toFixed(1) : null,
    ATL: d.atl != null ? +d.atl.toFixed(1) : null,
    TSB: d.tsb != null ? +d.tsb.toFixed(1) : null,
    Carga: d.daily_load != null ? +d.daily_load.toFixed(1) : null,
    ACWR: d.acwr != null ? +d.acwr.toFixed(3) : null,
  })), [data]);

  return (
    <details className="od-panel group !p-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 sm:px-6">
        <span className="od-label od-label-plain">Modo avançado (CTL, ATL, TSB, ACWR, simulador e fórmulas)</span>
        <span className="text-brand-muted transition-transform duration-200 group-open:rotate-180" aria-hidden>▾</span>
      </summary>
      <div className="space-y-6 border-t border-white/5 px-5 pb-5 pt-4 sm:px-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="CTL" name="Condicionamento · 42 dias" value={latest?.ctl?.toFixed(1)} color={C.accent} spark={series("ctl")} loading={loading} />
          <KpiCard label="ATL" name="Cansaço · 7 dias" value={latest?.atl?.toFixed(1)} color={C.info} spark={series("atl")} loading={loading} />
          <KpiCard
            label="TSB" name="Disposição"
            value={latest?.tsb != null ? (latest.tsb > 0 ? "+" : "") + latest.tsb.toFixed(1) : undefined}
            color={latest?.tsb != null ? tsbColor(latest.tsb) : C.muted}
            spark={series("tsb")} loading={loading}
          />
          <Panel className="!p-4 sm:!p-5">
            <div className="flex items-baseline justify-between">
              <span className="od-num text-sm text-brand-textSecondary">ACWR</span>
              <span className="text-[0.66rem] text-brand-muted">Salto de carga</span>
            </div>
            {loading ? <Skeleton className="mt-3 h-9 w-24" /> : (
              <div className="od-num mt-2 text-[2rem] leading-none" style={{ color: risk.color }}>{latest?.acwr?.toFixed(2) ?? "—"}</div>
            )}
            <div className="relative mt-4">
              <div className="flex h-1.5 overflow-hidden rounded-full">
                <div style={{ width: "40%", background: "rgba(255,193,69,0.35)" }} />
                <div style={{ width: "25%", background: "rgba(0,255,102,0.55)" }} />
                <div style={{ width: "10%", background: "rgba(255,193,69,0.55)" }} />
                <div style={{ width: "25%", background: "rgba(248,81,73,0.55)" }} />
              </div>
              {latest?.acwr != null && (
                <span
                  className="absolute -top-1 h-3.5 w-1 -translate-x-1/2 rounded-full bg-white transition-[left] duration-700"
                  style={{ left: `${Math.min(100, (latest.acwr / 2) * 100)}%`, boxShadow: "0 0 8px #fff" }}
                />
              )}
              <div className="mt-1.5 flex justify-between text-[0.6rem] tabular-nums text-brand-textTertiary">
                <span>0</span><span>0.8</span><span>1.3</span><span>1.5</span><span>2.0</span>
              </div>
            </div>
          </Panel>
        </div>

        {/* condicionamento x cansaco */}
        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
            <h3 className="od-label">Condicionamento × cansaço</h3>
            <Segmented options={DAY_OPTIONS} value={days} onChange={onDaysChange} ariaLabel="Período" />
          </div>
          <p className="mb-3 text-[0.72rem] text-brand-muted">
            A linha verde sobe devagar quando você treina com constância; a azul sobe rápido depois de treinos fortes. Azul muito acima da verde = cansaço acumulado.
          </p>
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
            <LegendDot color={C.accent} label="Condicionamento (6 semanas)" />
            <LegendDot color={C.info} label="Cansaço recente (7 dias)" />
            <LegendDot color="#3a3a3a" label="Carga do dia" />
          </div>
          {loading ? <Skeleton className="h-[260px]" /> : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart accessibilityLayer data={chartData} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="ctl-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.accent} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis {...axisProps} dataKey="date" tickFormatter={fmtDay} minTickGap={32} />
                <YAxis {...axisProps} yAxisId="l" width={40} />
                <YAxis {...axisProps} yAxisId="r" orientation="right" width={34} tick={{ ...axisProps.tick, fill: "#555" }} />
                <Tooltip content={<LoadTooltip />} cursor={{ stroke: "rgba(0,255,102,0.3)", strokeDasharray: "3 4" }} />
                <Bar yAxisId="r" dataKey="Carga" fill="rgba(255,255,255,0.09)" radius={[3, 3, 0, 0]} maxBarSize={10} />
                <Area yAxisId="l" type="monotone" dataKey="CTL" stroke={C.accent} strokeWidth={2.2} fill="url(#ctl-fill)" dot={false} connectNulls
                  activeDot={{ r: 5, fill: C.accent, stroke: C.bg, strokeWidth: 2 }} style={{ filter: "drop-shadow(0 0 6px rgba(0,255,102,0.35))" }} />
                <Line yAxisId="l" type="monotone" dataKey="ATL" stroke={C.info} strokeWidth={1.8} dot={false} connectNulls activeDot={{ r: 4, fill: C.info }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="od-label">Disposição · TSB</h3>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <LegendDot color={C.accent} label="≥ −10" />
                <LegendDot color={C.warning} label="−10 a −30" />
                <LegendDot color={C.danger} label="< −30" />
              </div>
            </div>
            {loading ? <Skeleton className="h-[220px]" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart accessibilityLayer data={chartData} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis {...axisProps} dataKey="date" tickFormatter={fmtDay} minTickGap={32} />
                  <YAxis {...axisProps} width={40} />
                  <Tooltip content={<LoadTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.18)" />
                  <ReferenceLine y={-30} stroke="rgba(248,81,73,0.35)" strokeDasharray="4 4" />
                  <Bar dataKey="TSB" radius={[3, 3, 3, 3]} maxBarSize={9}>
                    {chartData.map((d, i) => <Cell key={i} fill={d.TSB != null ? tsbColor(d.TSB) : "transparent"} fillOpacity={0.8} />)}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="od-label">Salto de carga · ACWR (7d / 28d)</h3>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <LegendDot color={C.accent} label="0.8–1.3 ideal" />
                <LegendDot color={C.danger} label="> 1.5 risco" />
              </div>
            </div>
            {loading ? <Skeleton className="h-[220px]" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart accessibilityLayer data={chartData} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <ReferenceArea y1={0.8} y2={1.3} fill={C.accent} fillOpacity={0.06} ifOverflow="hidden" />
                  <ReferenceArea y1={1.3} y2={1.5} fill={C.warning} fillOpacity={0.07} ifOverflow="hidden" />
                  <ReferenceArea y1={1.5} y2={acwrMax} fill={C.danger} fillOpacity={0.07} ifOverflow="hidden" />
                  <XAxis {...axisProps} dataKey="date" tickFormatter={fmtDay} minTickGap={32} />
                  <YAxis {...axisProps} width={40} domain={[0, +acwrMax.toFixed(1)]} tickFormatter={(v: number) => v.toFixed(1)} />
                  <Tooltip content={<LoadTooltip />} cursor={{ stroke: "rgba(198,255,0,0.3)", strokeDasharray: "3 4" }} />
                  <ReferenceLine y={1.5} stroke="rgba(248,81,73,0.5)" strokeDasharray="4 4" />
                  <ReferenceLine y={0.8} stroke="rgba(255,193,69,0.4)" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="ACWR" stroke={C.lime} strokeWidth={2} dot={false} connectNulls
                    activeDot={{ r: 5, fill: C.lime, stroke: C.bg, strokeWidth: 2 }} style={{ filter: "drop-shadow(0 0 5px rgba(198,255,0,0.35))" }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <TsbSimulator />

        <div className="border-t border-white/5 pt-4 text-sm text-brand-muted">
          <div className="od-label od-label-plain mb-2">Como tudo é calculado</div>
          <ul className="space-y-2">
            <li className="flex gap-2"><span className="text-brand-accent">▸</span><span><strong className="text-brand-textSecondary">Carga (TSS)</strong>: ciclismo com potência e FTP usa o TSS clássico (Coggan); qualquer modalidade com FC e FC máxima usa TSS_hr = h × (FC/FCmax)² × 100; sem FC nem potência, 50 TSS/hora.</span></li>
            <li className="flex gap-2"><span className="text-brand-accent">▸</span><span><strong className="text-brand-textSecondary">CTL / ATL / TSB</strong>: médias da carga em 42 e 7 dias; a disposição é a diferença entre as duas.</span></li>
            <li className="flex gap-2"><span className="text-brand-accent">▸</span><span><strong className="text-brand-textSecondary">Risco de lesão</strong>: alto se ACWR {">"} 1.5 ou TSB {"<"} −30 em 3 ou mais dos últimos 14 dias; moderado se a semana passou 30% da anterior.</span></li>
            <li className="flex gap-2"><span className="text-brand-accent">▸</span><span><strong className="text-brand-textSecondary">Previsões de prova</strong>: fórmula de Riegel (T2 = T1 × (D2/D1)^1.06) e VDOT de Jack Daniels, a partir do seu melhor tempo recente.</span></li>
            <li className="flex gap-2"><span className="text-brand-accent">▸</span><span><strong className="text-brand-textSecondary">Simulador</strong>: projeta CTL, ATL e TSB assumindo o mesmo TSS todo dia.</span></li>
          </ul>
          <p className="mt-3">
            Para números mais precisos, configure <Link href="/profile" className="text-brand-accent hover:underline">FC máxima, FTP e CSS no perfil</Link>.
          </p>
        </div>
      </div>
    </details>
  );
}
