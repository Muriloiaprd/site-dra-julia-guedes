"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Logo } from "@/components/Logo";
import { clearToken, fetchHeatmap, fetchLoadMetrics, fetchMe, type DailyMetric, type HeatmapDay } from "@/lib/api";
import { formatDate } from "@/lib/utils";

const DAY_OPTIONS = [30, 60, 90, 180, 365];

const SPORT_COLOR_MAP: Record<string, string> = {
  run: "#2f81f7",
  trail_run: "#388bfd",
  bike: "#3fb950",
  mtb: "#56d364",
  swim: "#a371f7",
  open_water_swim: "#bc8cff",
  other: "#8b949e",
};

function heatmapColor(load: number, sport: string | null): string {
  const base = SPORT_COLOR_MAP[sport ?? ""] ?? "#2f81f7";
  if (load <= 0) return "#21262d";
  if (load < 30) return base + "55";
  if (load < 60) return base + "99";
  if (load < 100) return base + "cc";
  return base;
}

function TrainingHeatmap({ data }: { data: HeatmapDay[] }) {
  if (data.length === 0) return null;

  // agrupa por data -> {sport, load} para o primeiro esporte do dia (maior carga)
  const byDate = new Map<string, { load: number; sport: string | null }>();
  for (const d of data) {
    const existing = byDate.get(d.date);
    if (!existing || (d.daily_load ?? 0) > existing.load) {
      byDate.set(d.date, { load: d.daily_load ?? 0, sport: d.sport });
    }
  }

  // gera 15 semanas retroativas (105 dias)
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const weeks: { date: string; load: number; sport: string | null }[][] = [];

  // começa no domingo da semana que contém (hoje - 104 dias)
  const start = new Date(today);
  start.setDate(start.getDate() - 104 - start.getDay());

  let cur = new Date(start);
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
    <div className="overflow-x-auto">
      <div className="flex gap-1 min-w-max">
        {/* rótulos dos dias */}
        <div className="flex flex-col gap-1 mr-1 pt-6">
          {DAYS.map((d, i) => (
            <div key={i} className="h-3 w-3 flex items-center justify-center text-[9px] text-brand-muted">
              {i % 2 === 1 ? d : ""}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => {
          // label do mês na primeira semana do mês
          const firstDay = new Date(week[0].date + "T12:00:00");
          const showMonth = firstDay.getDate() <= 7;
          return (
            <div key={wi} className="flex flex-col gap-1">
              <div className="h-5 flex items-end justify-center">
                {showMonth && (
                  <span className="text-[9px] text-brand-muted">
                    {firstDay.toLocaleDateString("pt-BR", { month: "short" })}
                  </span>
                )}
              </div>
              {week.map((cell, di) => (
                <div
                  key={di}
                  title={`${cell.date}${cell.load > 0 ? ` — TSS: ${cell.load.toFixed(0)}` : ""}`}
                  className="h-3 w-3 rounded-sm cursor-default transition-opacity hover:opacity-80"
                  style={{ backgroundColor: heatmapColor(cell.load, cell.sport) }}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MetricsPage() {
  const router = useRouter();
  const [data, setData] = useState<DailyMetric[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapDay[]>([]);
  const [days, setDays] = useState(90);
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

  const latest = data[data.length - 1];

  const chartData = data.map((d) => ({
    date: d.date,
    CTL: d.ctl != null ? +d.ctl.toFixed(1) : null,
    ATL: d.atl != null ? +d.atl.toFixed(1) : null,
    TSB: d.tsb != null ? +d.tsb.toFixed(1) : null,
    Carga: d.daily_load != null ? +d.daily_load.toFixed(1) : null,
    ACWR: d.acwr != null ? +d.acwr.toFixed(3) : null,
  }));

  return (
    <main className="min-h-screen">
      <header className="flex items-center justify-between border-b border-brand-border px-6 py-4">
        <Logo />
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="text-brand-muted hover:text-brand-accent">Dashboard</Link>
          <Link href="/profile" className="text-brand-muted hover:text-brand-accent">Perfil</Link>
          <button onClick={() => { clearToken(); router.push("/login"); }} className="text-brand-accent hover:underline">
            Sair
          </button>
        </nav>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Métricas de Carga</h1>
          <div className="flex gap-1">
            {DAY_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded-md border px-3 py-1 text-sm transition-colors ${
                  days === d
                    ? "border-brand-accent bg-brand-accent text-white"
                    : "border-brand-border text-brand-muted hover:border-brand-accent hover:text-brand-accent"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* cards de resumo */}
        {latest && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard
              label="Forma Crônica (CTL)"
              value={latest.ctl?.toFixed(1) ?? "–"}
              sublabel="Fitness base (42d)"
              color="#2f81f7"
            />
            <SummaryCard
              label="Forma Aguda (ATL)"
              value={latest.atl?.toFixed(1) ?? "–"}
              sublabel="Fadiga recente (7d)"
              color="#f85149"
            />
            <SummaryCard
              label="Forma (TSB)"
              value={latest.tsb != null ? (latest.tsb > 0 ? "+" : "") + latest.tsb.toFixed(1) : "–"}
              sublabel={latest.tsb != null
                ? latest.tsb > 5 ? "✓ Pronto para treino duro"
                : latest.tsb < -30 ? "⚠ Muito cansado"
                : "Moderado"
                : ""}
              color={latest.tsb != null && latest.tsb > 0 ? "#3fb950" : latest.tsb != null && latest.tsb < -20 ? "#f85149" : "#e3b341"}
            />
            <SummaryCard
              label="ACWR"
              value={latest.acwr?.toFixed(2) ?? "–"}
              sublabel={latest.acwr != null
                ? latest.acwr > 1.5 ? "⚠ Risco de lesão"
                : latest.acwr < 0.8 ? "↓ Subutilizado"
                : "✓ Zona segura"
                : ""}
              color={latest.acwr != null && latest.acwr > 1.5 ? "#f85149" : latest.acwr != null && latest.acwr < 0.8 ? "#e3b341" : "#3fb950"}
            />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-brand-danger/40 bg-brand-danger/10 p-3 text-sm text-brand-danger">
            {error}
          </div>
        )}

        {/* gráfico CTL/ATL/TSB */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-muted">
            Evolução CTL / ATL / TSB
          </h2>
          {loading ? (
            <div className="h-72 animate-pulse rounded-lg bg-brand-surface" />
          ) : (
            <div className="rounded-lg border border-brand-border bg-brand-surface p-4">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                  <XAxis
                    dataKey="date"
                    stroke="#8b949e"
                    fontSize={11}
                    tickFormatter={(v) => {
                      const d = new Date(v + "T12:00:00");
                      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
                    }}
                    interval="preserveStartEnd"
                  />
                  <YAxis stroke="#8b949e" fontSize={11} />
                  <Tooltip
                    contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 6 }}
                    labelFormatter={(l) => {
                      const d = new Date(String(l) + "T12:00:00");
                      return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
                    }}
                  />
                  <Legend />
                  <ReferenceLine y={0} stroke="#30363d" strokeDasharray="4 2" />
                  <Line type="monotone" dataKey="CTL" stroke="#2f81f7" strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="ATL" stroke="#f85149" strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="TSB" stroke="#3fb950" strokeWidth={1.5} dot={false} strokeDasharray="5 3" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* gráfico ACWR */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-muted">
            ACWR — Risco de Lesão (7d / 28d)
          </h2>
          {loading ? (
            <div className="h-52 animate-pulse rounded-lg bg-brand-surface" />
          ) : (
            <div className="rounded-lg border border-brand-border bg-brand-surface p-4">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                  <XAxis
                    dataKey="date"
                    stroke="#8b949e"
                    fontSize={11}
                    tickFormatter={(v) => {
                      const d = new Date(v + "T12:00:00");
                      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
                    }}
                    interval="preserveStartEnd"
                  />
                  <YAxis stroke="#8b949e" fontSize={11} domain={[0, "auto"]} />
                  <Tooltip
                    contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 6 }}
                    labelFormatter={(l) => {
                      const d = new Date(String(l) + "T12:00:00");
                      return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
                    }}
                    formatter={(v) => [Number(v).toFixed(2), "ACWR"]}
                  />
                  <ReferenceLine y={1.5} stroke="#f85149" strokeDasharray="4 2" label={{ value: "1.5 risco", fill: "#f85149", fontSize: 10 }} />
                  <ReferenceLine y={0.8} stroke="#e3b341" strokeDasharray="4 2" label={{ value: "0.8 mín", fill: "#e3b341", fontSize: 10 }} />
                  <Line type="monotone" dataKey="ACWR" stroke="#e3b341" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* heatmap */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-muted">
            Heatmap de treinos (últimas 16 semanas)
          </h2>
          {loading ? (
            <div className="h-24 animate-pulse rounded-lg bg-brand-surface" />
          ) : (
            <div className="rounded-lg border border-brand-border bg-brand-surface p-4">
              <TrainingHeatmap data={heatmap} />
              <div className="mt-3 flex items-center gap-3 text-xs text-brand-muted">
                <span>Menos</span>
                {["#21262d", "#2f81f755", "#2f81f799", "#2f81f7cc", "#2f81f7"].map((c, i) => (
                  <div key={i} className="h-3 w-3 rounded-sm" style={{ backgroundColor: c }} />
                ))}
                <span>Mais</span>
              </div>
            </div>
          )}
        </section>

        {/* info sobre TSS */}
        <section className="rounded-lg border border-brand-border bg-brand-surface p-5 text-sm text-brand-muted">
          <h2 className="mb-2 font-medium text-brand-text">Como o TSS é calculado</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Ciclismo com potência e FTP configurado: TSS clássico (Coggan)</li>
            <li>Qualquer modalidade com FC e FC Máxima configurada: TSS_hr = h × (FC/FCmax)² × 100</li>
            <li>Sem dados de FC ou potência: estimativa de 50 TSS/hora</li>
          </ul>
          <p className="mt-3">
            Para métricas mais precisas, configure sua <Link href="/profile" className="text-brand-accent hover:underline">FC Máxima e FTP no perfil</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  sublabel,
  color,
}: {
  label: string;
  value: string;
  sublabel: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-brand-border bg-brand-surface p-4">
      <p className="text-xs text-brand-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="mt-1 text-xs text-brand-muted">{sublabel}</p>
    </div>
  );
}
