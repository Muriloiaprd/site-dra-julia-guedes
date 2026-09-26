"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Area, Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { ChartTooltipBox, LegendDot, Sparkline } from "@/components/ui/charts";
import { Alert, EmptyState, PageContainer, PageHeader, Panel, Segmented, Skeleton } from "@/components/ui/primitives";
import { fetchHeatmap, fetchLoadMetrics, fetchMe, type DailyMetric, type HeatmapDay } from "@/lib/api";
import { ctlTrend, formFromTsb, latestMetric, riskFromAcwr } from "@/lib/athlete";
import { axisProps, C, gridProps } from "@/lib/theme";

const DAY_OPTIONS = [
  { value: 30, label: "30d" },
  { value: 60, label: "60d" },
  { value: 90, label: "90d" },
  { value: 180, label: "6m" },
  { value: 365, label: "1a" },
] as const;

const SPORT_COLOR_MAP: Record<string, string> = {
  run: "#00FF66",
  trail_run: "#00CC50",
  bike: "#C6FF00",
  mtb: "#99CC00",
  swim: "#00CFFF",
  open_water_swim: "#0099CC",
  walk: "#7FD8BE",
  strength: "#FFB347",
  pilates: "#C9A0FF",
  other: "#888888",
};

function heatmapColor(load: number, sport: string | null): string {
  const base = SPORT_COLOR_MAP[sport ?? ""] ?? "#00FF66";
  if (load <= 0) return "#161616";
  if (load < 30) return base + "40";
  if (load < 60) return base + "80";
  if (load < 100) return base + "c0";
  return base;
}

function tsbColor(tsb: number): string {
  if (tsb >= -10) return C.accent;
  if (tsb >= -30) return C.warning;
  return C.danger;
}

const fmtDay = (v: string) => new Date(v + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
const fmtDayLong = (v: string) => new Date(v + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });

function TrainingHeatmap({ data }: { data: HeatmapDay[] }) {
  // agrupa por data -> {sport, load} para o primeiro esporte do dia (maior carga)
  const byDate = new Map<string, { load: number; sport: string | null }>();
  for (const d of data) {
    const existing = byDate.get(d.date);
    if (!existing || (d.daily_load ?? 0) > existing.load) {
      byDate.set(d.date, { load: d.daily_load ?? 0, sport: d.sport });
    }
  }

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const weeks: { date: string; load: number; sport: string | null }[][] = [];

  // começa no domingo da semana que contém (hoje - 104 dias)
  const start = new Date(today);
  start.setDate(start.getDate() - 104 - start.getDay());

  const cur = new Date(start);
  for (let w = 0; w < 16; w++) {
    const week: { date: string; load: number; sport: string | null }[] = [];
    for (let d = 0; d < 7; d++) {
      const iso = cur.toISOString().split("T")[0];
      const entry = byDate.get(iso);
      week.push({ date: iso, load: entry?.load ?? 0, sport: entry?.sport ?? null });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }

  const DAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

  return (
    <div className="flex gap-[5px]">
      <div className="mr-1 flex flex-col gap-[5px] pt-6">
        {DAYS.map((d, i) => (
          <div key={i} className="flex h-[15px] w-3 items-center justify-center text-[0.6rem] text-brand-textTertiary">
            {i % 2 === 1 ? d : ""}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => {
        const firstDay = new Date(week[0].date + "T12:00:00");
        const showMonth = firstDay.getDate() <= 7;
        return (
          <div key={wi} className="flex flex-1 flex-col gap-[5px]">
            <div className="flex h-5 items-end">
              {showMonth && (
                <span className="text-[0.62rem] capitalize text-brand-muted">
                  {firstDay.toLocaleDateString("pt-BR", { month: "short" })}
                </span>
              )}
            </div>
            {week.map((cell, di) => (
              <div
                key={di}
                title={`${fmtDayLong(cell.date)}${cell.load > 0 ? ` — TSS ${cell.load.toFixed(0)}` : " — sem treino"}`}
                className="aspect-square min-h-[11px] w-full max-w-[22px] rounded-[4px] transition-transform duration-150 hover:scale-125"
                style={{
                  backgroundColor: heatmapColor(cell.load, cell.sport),
                  boxShadow: cell.load >= 100 ? `0 0 8px ${heatmapColor(cell.load, cell.sport)}` : undefined,
                }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function LoadTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length || !label) return null;
  const get = (k: string) => payload.find((p) => p.dataKey === k)?.value;
  const rows = [
    { key: "CTL", label: "Fitness (CTL)", color: C.accent },
    { key: "ATL", label: "Fadiga (ATL)", color: C.info },
    { key: "TSB", label: "Forma (TSB)", color: C.lime },
    { key: "Carga", label: "TSS do dia", color: C.muted },
    { key: "ACWR", label: "ACWR", color: C.lime },
  ]
    .filter((r) => get(r.key) != null)
    .map((r) => ({ label: r.label, value: r.key === "ACWR" ? Number(get(r.key)).toFixed(2) : Number(get(r.key)).toFixed(1), color: r.color }));
  return <ChartTooltipBox title={fmtDayLong(label)} rows={rows} />;
}

export default function MetricsPage() {
  const router = useRouter();
  const [data, setData] = useState<DailyMetric[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapDay[]>([]);
  const [days, setDays] = useState<number>(90);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMe().then((u) => {
      if (!u) { router.push("/login"); return; }
    });
  }, [router]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.allSettled([
      fetchLoadMetrics(days),
      fetchHeatmap(112),
    ]).then(([loadRes, heatRes]) => {
      if (loadRes.status === "fulfilled") setData(loadRes.value);
      else setError(loadRes.reason instanceof Error ? loadRes.reason.message : "Erro");
      if (heatRes.status === "fulfilled") setHeatmap(heatRes.value);
    }).finally(() => setLoading(false));
  }, [days]);

  const latest = latestMetric(data);

  const chartData = useMemo(() => data.map((d) => ({
    date: d.date,
    CTL: d.ctl != null ? +d.ctl.toFixed(1) : null,
    ATL: d.atl != null ? +d.atl.toFixed(1) : null,
    TSB: d.tsb != null ? +d.tsb.toFixed(1) : null,
    Carga: d.daily_load != null ? +d.daily_load.toFixed(1) : null,
    ACWR: d.acwr != null ? +d.acwr.toFixed(3) : null,
  })), [data]);

  const hasData = data.some((d) => d.ctl != null || (d.daily_load ?? 0) > 0);
  const form = formFromTsb(latest?.tsb ?? null);
  const risk = riskFromAcwr(latest?.acwr ?? null);
  const trend = ctlTrend(data);
  const acwrMax = Math.max(2, ...data.map((d) => d.acwr ?? 0)) + 0.1;

  const series = (k: keyof DailyMetric) => data.map((d) => d[k] as number | null).filter((v): v is number => v != null);

  return (
    <PageContainer>
      <PageHeader
        kicker="Centro de análise"
        title="Carga de treino"
        description="Fitness, fadiga e forma calculados a partir do TSS diário — o mesmo modelo usado por atletas e treinadores de elite."
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M3 20h18" /><path d="M6 16v-4M10 16V8M14 16v-6M18 16V5" /></svg>}
        actions={<Segmented options={DAY_OPTIONS} value={days} onChange={setDays} size="md" ariaLabel="Período" />}
      />

      {error && <div className="mb-4"><Alert tone="danger" title="Erro ao carregar métricas">{error}</Alert></div>}

      {!loading && !hasData && !error ? (
        <Panel>
          <EmptyState
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M3 12h4l3 8 4-16 3 8h4" /></svg>}
            title="Ainda não há carga para analisar"
            description="CTL, ATL, TSB e ACWR aparecem aqui assim que você importar atividades. Quanto mais histórico, mais precisa a leitura."
            action={<Link href="/import" className="od-btn od-btn-primary">Importar atividades →</Link>}
          />
        </Panel>
      ) : (
        <div className="od-stagger space-y-4">
          {/* status textual */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { k: "Forma", v: form.label, c: form.color, s: latest?.tsb != null ? `TSB ${latest.tsb > 0 ? "+" : ""}${latest.tsb.toFixed(1)}` : "—" },
              { k: "Risco", v: risk.label, c: risk.color, s: latest?.acwr != null ? `ACWR ${latest.acwr.toFixed(2)} · ${risk.zone}` : "—" },
              { k: "Tendência", v: trend.label, c: trend.color, s: trend.delta != null ? `CTL ${trend.delta > 0 ? "+" : ""}${trend.delta.toFixed(1)} em 14 dias` : "—" },
            ].map((t) => (
              <Panel key={t.k} variant="flush" className="flex items-center gap-4 !rounded-card px-5 py-4" style={{ boxShadow: `inset 0 0 0 1px ${t.c}22` }}>
                <span className="h-10 w-1 rounded-full" style={{ background: t.c, boxShadow: `0 0 12px ${t.c}` }} />
                <div className="min-w-0">
                  <div className="od-metric-label">{t.k}</div>
                  {loading ? <Skeleton className="mt-1 h-6 w-28" /> : (
                    <div className="od-num text-[1.35rem] uppercase leading-tight" style={{ color: t.c }}>{t.v}</div>
                  )}
                  <div className="text-[0.72rem] text-brand-muted">{t.s}</div>
                </div>
              </Panel>
            ))}
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="CTL" name="Fitness · 42 dias" value={latest?.ctl?.toFixed(1)} color={C.accent} spark={series("ctl")} loading={loading} />
            <KpiCard label="ATL" name="Fadiga · 7 dias" value={latest?.atl?.toFixed(1)} color={C.info} spark={series("atl")} loading={loading} />
            <KpiCard
              label="TSB" name="Forma do dia"
              value={latest?.tsb != null ? (latest.tsb > 0 ? "+" : "") + latest.tsb.toFixed(1) : undefined}
              color={latest?.tsb != null ? tsbColor(latest.tsb) : C.muted}
              spark={series("tsb")} loading={loading}
            />
            <Panel className="!p-4 sm:!p-5">
              <div className="flex items-baseline justify-between">
                <span className="od-num text-sm text-brand-textSecondary">ACWR</span>
                <span className="text-[0.66rem] text-brand-muted">Agudo : crônico</span>
              </div>
              {loading ? <Skeleton className="mt-3 h-9 w-24" /> : (
                <div className="od-num mt-2 text-[2rem] leading-none" style={{ color: risk.color }}>{latest?.acwr?.toFixed(2) ?? "—"}</div>
              )}
              {/* regua de zonas 0–2 */}
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

          {/* CTL / ATL + carga */}
          <Panel>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="od-label">Fitness × Fadiga</h2>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <LegendDot color={C.accent} label="CTL · fitness" />
                <LegendDot color={C.info} label="ATL · fadiga" />
                <LegendDot color="#3a3a3a" label="TSS diário" />
              </div>
            </div>
            {loading ? <Skeleton className="h-[280px]" /> : (
              <ResponsiveContainer width="100%" height={280}>
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
          </Panel>

          <div className="grid gap-4 xl:grid-cols-2">
            {/* TSB */}
            <Panel>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="od-label">Forma · TSB</h2>
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
            </Panel>

            {/* ACWR */}
            <Panel>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="od-label">ACWR · risco de lesão (7d / 28d)</h2>
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
            </Panel>
          </div>

          {/* heatmap */}
          <Panel>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="od-label">Consistência · últimas 16 semanas</h2>
              <div className="flex items-center gap-1.5 text-[0.68rem] text-brand-muted">
                <span>Menos</span>
                {["#161616", "#00FF6640", "#00FF6680", "#00FF66c0", "#00FF66"].map((c, i) => (
                  <div key={i} className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: c }} />
                ))}
                <span>Mais TSS</span>
              </div>
            </div>
            {loading ? <Skeleton className="h-36" /> : heatmap.length === 0 ? (
              <EmptyState title="Sem treinos nas últimas 16 semanas" description="Importe atividades para ver sua consistência." />
            ) : (
              <div className="overflow-x-auto pb-1">
                <div className="min-w-[420px]"><TrainingHeatmap data={heatmap} /></div>
              </div>
            )}
          </Panel>

          {/* info sobre TSS */}
          <details className="od-panel group !p-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 sm:px-6">
              <span className="od-label od-label-plain">Como o TSS é calculado</span>
              <span className="text-brand-muted transition-transform duration-200 group-open:rotate-180" aria-hidden>▾</span>
            </summary>
            <div className="border-t border-white/5 px-5 pb-5 pt-4 text-sm text-brand-muted sm:px-6">
              <ul className="space-y-2">
                <li className="flex gap-2"><span className="text-brand-accent">▸</span>Ciclismo com potência e FTP configurado: TSS clássico (Coggan)</li>
                <li className="flex gap-2"><span className="text-brand-accent">▸</span>Qualquer modalidade com FC e FC Máxima configurada: TSS_hr = h × (FC/FCmax)² × 100</li>
                <li className="flex gap-2"><span className="text-brand-accent">▸</span>Sem dados de FC ou potência: estimativa de 50 TSS/hora</li>
              </ul>
              <p className="mt-3">
                Para métricas mais precisas, configure sua <Link href="/profile" className="text-brand-accent hover:underline">FC Máxima e FTP no perfil</Link>.
              </p>
            </div>
          </details>
        </div>
      )}
    </PageContainer>
  );
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
