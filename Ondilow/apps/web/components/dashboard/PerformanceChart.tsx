"use client";

import { useMemo, useState } from "react";
import {
  Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ChartTooltipBox, LegendDot } from "@/components/ui/charts";
import { EmptyState, Panel, Segmented, Skeleton, TrendBadge } from "@/components/ui/primitives";
import { pctChange } from "@/lib/athlete";
import type { ActivitySummary } from "@/lib/api";
import { axisProps, C, gridProps } from "@/lib/theme";
import { formatPace, formatPaceShort, sportLabel } from "@/lib/utils";

type EvolMetric = "distance" | "pace" | "hr";
const PERIODS = [
  { value: "7D", label: "7D", days: 7 },
  { value: "30D", label: "30D", days: 30 },
  { value: "3M", label: "3M", days: 90 },
  { value: "6M", label: "6M", days: 180 },
  { value: "1A", label: "1A", days: 365 },
] as const;
type Period = (typeof PERIODS)[number]["value"];

const METRICS: { key: EvolMetric; label: string; unit: string; invert: boolean }[] = [
  { key: "distance", label: "Distância", unit: "km", invert: false },
  { key: "pace", label: "Pace médio", unit: "/km", invert: true },
  { key: "hr", label: "FC média", unit: "bpm", invert: false },
];

interface Row {
  x: number;
  cur?: number;
  prev?: number;
  trend?: number;
  id?: string;
  title?: string;
  origX?: number;
}

const DAY = 86400000;

function valueOf(a: ActivitySummary, m: EvolMetric): number {
  if (m === "distance") return (a.distance_m ?? 0) / 1000;
  if (m === "pace") return a.avg_pace_s_per_km ?? 0;
  return a.avg_hr ?? 0;
}

/** Agregado do periodo: soma de km, pace ponderado por distancia, FC ponderada por duracao. */
function aggregate(list: ActivitySummary[], m: EvolMetric): number | null {
  if (m === "distance") {
    const km = list.reduce((s, a) => s + (a.distance_m ?? 0), 0) / 1000;
    return list.length ? km : null;
  }
  if (m === "pace") {
    const l = list.filter((a) => a.avg_pace_s_per_km && a.distance_m);
    const w = l.reduce((s, a) => s + a.distance_m!, 0);
    return w ? l.reduce((s, a) => s + a.avg_pace_s_per_km! * a.distance_m!, 0) / w : null;
  }
  const l = list.filter((a) => a.avg_hr);
  const w = l.reduce((s, a) => s + a.duration_s, 0);
  return w ? l.reduce((s, a) => s + a.avg_hr! * a.duration_s, 0) / w : null;
}

function fmt(v: number | null, m: EvolMetric): string {
  if (v == null) return "—";
  if (m === "distance") return v >= 100 ? v.toFixed(0) : v.toFixed(1);
  if (m === "pace") return formatPaceShort(v);
  return String(Math.round(v));
}

function PerfTooltip({ active, payload, metric }: { active?: boolean; payload?: { payload: Row }[]; metric: EvolMetric }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const date = new Date(row.origX ?? row.x).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
  const f = (v: number) => (metric === "distance" ? `${v.toFixed(2)} km` : metric === "pace" ? formatPace(v) : `${Math.round(v)} bpm`);
  const rows: { label: string; value: string; color?: string }[] = [];
  if (row.cur != null) rows.push({ label: "Atividade", value: f(row.cur), color: C.accent });
  if (row.prev != null) rows.push({ label: "Período anterior", value: f(row.prev), color: C.muted });
  if (row.trend != null) rows.push({ label: "Tendência", value: f(row.trend), color: C.lime });
  return (
    <ChartTooltipBox
      title={date}
      rows={rows}
      footer={row.id ? <span className="truncate">{row.title} · <span className="text-brand-accent">clique para abrir</span></span> : undefined}
    />
  );
}

export function PerformanceChart({
  activities, loading, onSelect, className = "",
}: {
  activities: ActivitySummary[];
  loading: boolean;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const [metric, setMetric] = useState<EvolMetric>("distance");
  const [period, setPeriod] = useState<Period>("30D");
  const [compare, setCompare] = useState(false);

  const days = PERIODS.find((p) => p.value === period)!.days;
  const now = Date.now();
  const span = days * DAY;

  const { curList, prevList } = useMemo(() => {
    const t = (a: ActivitySummary) => new Date(a.start_time).getTime();
    return {
      curList: activities.filter((a) => t(a) > now - span && t(a) <= now),
      prevList: activities.filter((a) => t(a) > now - 2 * span && t(a) <= now - span),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, span]);

  const summary = useMemo(() => METRICS.map((m) => {
    const c = aggregate(curList, m.key);
    const p = aggregate(prevList, m.key);
    return { ...m, cur: c, delta: pctChange(c, p) };
  }), [curList, prevList]);

  const { rows, trendPct, count } = useMemo(() => {
    const cur = curList
      .map((a) => ({ a, x: new Date(a.start_time).getTime(), v: valueOf(a, metric) }))
      .filter((p) => p.v > 0)
      .sort((p, q) => p.x - q.x);
    const prev = prevList
      .map((a) => ({ x: new Date(a.start_time).getTime(), v: valueOf(a, metric) }))
      .filter((p) => p.v > 0);

    // regressao linear simples para a linha de tendencia
    let slope = 0, intercept = 0;
    if (cur.length >= 2) {
      const n = cur.length;
      const xs = cur.map((p) => (p.x - now) / DAY);
      const mx = xs.reduce((s, v) => s + v, 0) / n;
      const my = cur.reduce((s, p) => s + p.v, 0) / n;
      let num = 0, den = 0;
      cur.forEach((p, i) => { num += (xs[i] - mx) * (p.v - my); den += (xs[i] - mx) ** 2; });
      slope = den ? num / den : 0;
      intercept = my - slope * mx;
    }
    const mean = cur.length ? cur.reduce((s, p) => s + p.v, 0) / cur.length : 0;
    const change = mean ? ((slope * days) / mean) * 100 : 0;

    const out: Row[] = cur.map((p) => ({
      x: p.x, cur: p.v, id: p.a.id, title: p.a.title ?? sportLabel(p.a.sport),
      trend: cur.length >= 3 ? intercept + slope * ((p.x - now) / DAY) : undefined,
    }));
    if (compare) prev.forEach((p) => out.push({ x: p.x + span, prev: p.v, origX: p.x }));
    out.sort((p, q) => p.x - q.x);
    return { rows: out, trendPct: cur.length >= 3 ? change : null, count: cur.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curList, prevList, metric, compare, span, days]);

  const active = METRICS.find((m) => m.key === metric)!;
  const trendGood = trendPct == null ? null : Math.abs(trendPct) < 2 ? null : active.invert ? trendPct < 0 : trendPct > 0;
  const trendText = trendPct == null ? null : trendGood === null ? "Tendência estável" : trendGood ? "Tendência de evolução" : "Tendência de queda";

  return (
    <Panel className={`flex flex-col ${className}`} aria-label="Evolução do desempenho">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="od-label">Evolução do desempenho</h2>
        <Segmented options={PERIODS} value={period} onChange={setPeriod} ariaLabel="Período" />
      </div>

      {/* KPIs do periodo (tambem sao as abas de metrica) */}
      <div className="mt-4 grid grid-cols-3 gap-2" role="tablist" aria-label="Métrica">
        {summary.map((s) => {
          const on = s.key === metric;
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setMetric(s.key)}
              className="relative overflow-hidden rounded-tile p-2.5 text-left transition-all duration-200 sm:p-3.5"
              style={{
                background: on ? "linear-gradient(180deg, rgba(0,255,102,0.09), rgba(0,255,102,0.02))" : "rgba(255,255,255,0.02)",
                boxShadow: on ? "inset 0 0 0 1px rgba(0,255,102,0.3)" : "inset 0 0 0 1px rgba(255,255,255,0.05)",
              }}
            >
              {on && <span className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-brand-accent" style={{ boxShadow: "0 0 10px rgba(0,255,102,0.9)" }} />}
              <div className="od-metric-label truncate" style={{ color: on ? "#00FF66" : undefined }}>{s.label}</div>
              <div className="od-num mt-1 text-[1.15rem] leading-none sm:text-[1.6rem]" style={{ color: on ? "#fff" : "#B8B8B8" }}>
                {fmt(s.cur, s.key)}<span className="ml-1 font-sans text-[0.65rem] font-semibold text-brand-muted sm:text-xs">{s.unit}</span>
              </div>
              <div className="mt-1.5 hidden sm:block"><TrendBadge pct={s.delta} invert={s.invert} suffix=" vs anterior" /></div>
              <div className="mt-1 sm:hidden"><TrendBadge pct={s.delta} invert={s.invert} /></div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <LegendDot color={C.accent} label={`${active.label} · ${count} atividade${count === 1 ? "" : "s"}`} />
          <LegendDot color={C.lime} label="Tendência" dashed />
          {compare && <LegendDot color={C.muted} label="Período anterior" dashed />}
        </div>
        <div className="flex items-center gap-3">
          {trendText && (
            <span className="text-[0.72rem] font-semibold" style={{ color: trendGood === null ? C.textSecondary : trendGood ? C.accent : C.warning }}>
              {trendGood === null ? "■" : trendGood ? "▲" : "▼"} {trendText}
            </span>
          )}
          <button type="button" onClick={() => setCompare((c) => !c)} className={`od-chip ${compare ? "is-active" : ""}`} aria-pressed={compare}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M7 7h13l-4-4M17 17H4l4 4" /></svg>
            Comparar
          </button>
        </div>
      </div>

      <div className="relative mt-3 min-h-[240px] flex-1">
        {loading ? (
          <Skeleton className="h-[240px]" />
        ) : count < 2 ? (
          <EmptyState title="Atividades insuficientes no período" description="Escolha um período maior ou importe mais atividades." />
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart accessibilityLayer
              data={rows}
              margin={{ top: 12, right: 6, left: -6, bottom: 0 }}
              onClick={(s: { activePayload?: { payload: Row }[] } | null) => {
                const id = s?.activePayload?.find((p) => p.payload.id)?.payload.id;
                if (id) onSelect(id);
              }}
              style={{ cursor: "pointer" }}
            >
              <defs>
                <linearGradient id="perf-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.accent} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} />
              <XAxis
                {...axisProps}
                dataKey="x" type="number" scale="time" domain={[now - span, now]}
                tickFormatter={(v: number) => new Date(v).toLocaleDateString("pt-BR", days > 120 ? { month: "short" } : { day: "2-digit", month: "short" })}
                minTickGap={36}
              />
              <YAxis
                {...axisProps}
                width={46}
                reversed={metric === "pace"}
                domain={["auto", "auto"]}
                tickFormatter={(v: number) => (metric === "pace" ? formatPaceShort(v) : metric === "distance" ? `${v}` : `${Math.round(v)}`)}
              />
              <Tooltip content={<PerfTooltip metric={metric} />} cursor={{ stroke: "rgba(0,255,102,0.35)", strokeDasharray: "3 4" }} />
              {compare && (
                <Line dataKey="prev" type="monotone" stroke={C.muted} strokeOpacity={0.7} strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={{ r: 3, fill: C.muted }} connectNulls animationDuration={700} />
              )}
              <Area
                dataKey="cur" type="monotone" stroke={C.accent} strokeWidth={2.2} fill="url(#perf-fill)" connectNulls
                baseValue={metric === "pace" ? "dataMax" : "dataMin"}
                dot={{ r: 2.5, fill: C.accent, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: C.accent, stroke: C.bg, strokeWidth: 2, style: { filter: "drop-shadow(0 0 6px #00FF66)" } }}
                animationDuration={900}
                style={{ filter: "drop-shadow(0 0 6px rgba(0,255,102,0.35))" }}
              />
              <Line dataKey="trend" type="linear" stroke={C.lime} strokeWidth={1.4} strokeDasharray="6 5" dot={false} activeDot={false} connectNulls animationDuration={1100} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </Panel>
  );
}
