"use client";

import { useMemo, useState } from "react";
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartTooltipBox, LegendDot } from "@/components/ui/charts";
import { EmptyState, Panel, Segmented, Skeleton, TrendBadge } from "@/components/ui/primitives";
import type { ActivitySummary, LoadSummary } from "@/lib/api";
import { axisProps, C, gridProps } from "@/lib/theme";
import { formatPace, formatPaceShort, sportGroup } from "@/lib/utils";

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

type View = "volume" | "pace";
const VIEWS = [
  { value: "volume" as const, label: "Volume semanal" },
  { value: "pace" as const, label: "Ritmo mensal" },
];

/** Um grafico so para "estou evoluindo?": volume por semana (16 semanas) ou pace mensal com tendencia. */
export function EvolutionChart({ weeks, activities, activitiesLoading }: {
  weeks: LoadSummary["semanas"] | null;
  activities: ActivitySummary[];
  activitiesLoading: boolean;
}) {
  const [view, setView] = useState<View>("volume");
  const evolution = useMemo(() => monthlyPaceTrend(activities), [activities]);
  const weeksData = (weeks ?? []).map((w) => ({
    ...w,
    label: new Date(w.semana + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
  }));

  return (
    <Panel>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="od-label">Evolução</h2>
        <Segmented options={VIEWS} value={view} onChange={setView} ariaLabel="O que mostrar" />
      </div>

      {view === "volume" ? (
        <>
          <p className="mb-3 text-[0.72rem] text-brand-muted">Quilômetros e horas por semana nas últimas 16 semanas.</p>
          {!weeks ? <Skeleton className="h-[240px]" /> : weeksData.length === 0 ? (
            <EmptyState title="Sem treinos nas últimas 16 semanas" description="Importe atividades para ver o seu volume." />
          ) : (
            <>
              <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
                <LegendDot color={C.accent} label="Corrida (km)" />
                <LegendDot color={C.lime} label="Bike (km)" />
                <LegendDot color="#7FD8BE" label="Caminhada (km)" />
                <LegendDot color={C.info} label="Horas" />
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart accessibilityLayer data={weeksData} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis {...axisProps} dataKey="label" minTickGap={24} />
                  <YAxis {...axisProps} yAxisId="km" width={40} />
                  <YAxis {...axisProps} yAxisId="h" orientation="right" width={30} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const w = payload[0].payload as (typeof weeksData)[number];
                      const rows = [
                        { label: "Corrida", value: `${w.corrida_km} km`, color: C.accent },
                        { label: "Bike", value: `${w.bike_km} km`, color: C.lime },
                        { label: "Caminhada", value: `${w.caminhada_km} km`, color: "#7FD8BE" },
                        { label: "Tempo total", value: `${w.horas} h`, color: C.info },
                        { label: "Treinos", value: `${w.treinos}`, color: C.muted },
                      ].filter((r) => !r.value.startsWith("0 "));
                      return <ChartTooltipBox title={`Semana de ${w.label}${w.em_andamento ? " (em andamento)" : ""}`} rows={rows} />;
                    }}
                  />
                  <Bar yAxisId="km" dataKey="corrida_km" stackId="km" fill={C.accent} fillOpacity={0.8} maxBarSize={26} />
                  <Bar yAxisId="km" dataKey="bike_km" stackId="km" fill={C.lime} fillOpacity={0.55} maxBarSize={26} />
                  <Bar yAxisId="km" dataKey="caminhada_km" stackId="km" fill="#7FD8BE" fillOpacity={0.5} maxBarSize={26} radius={[3, 3, 0, 0]} />
                  <Line yAxisId="h" type="monotone" dataKey="horas" stroke={C.info} strokeWidth={1.8} dot={{ r: 2, fill: C.info }} />
                </ComposedChart>
              </ResponsiveContainer>
            </>
          )}
        </>
      ) : (
        <>
          <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.72rem] text-brand-muted">
            <span>Pace médio por mês das corridas de 3 km ou mais, com linha de tendência.</span>
            {evolution.changePct != null && <span className="inline-flex items-center gap-2">Tendência <TrendBadge pct={evolution.changePct} invert /></span>}
          </p>
          {activitiesLoading ? <Skeleton className="h-[240px]" /> : evolution.rows.length < 2 ? (
            <EmptyState title="Histórico insuficiente" description="São necessários pelo menos 2 meses com corridas de 3 km ou mais." />
          ) : (
            <>
              <div className="mb-2 flex gap-4">
                <LegendDot color={C.accent} label="Pace mensal" />
                <LegendDot color={C.lime} label="Tendência" dashed />
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart accessibilityLayer data={evolution.rows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
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
        </>
      )}
    </Panel>
  );
}
