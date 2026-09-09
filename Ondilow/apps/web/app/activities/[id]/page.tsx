"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { SportBadge } from "@/components/SportBadge";
import {
  fetchActivity,
  fetchSplits,
  fetchZones,
  type ActivityDetail,
  type Split,
  type ZoneBucket,
} from "@/lib/api";
import {
  formatDate,
  formatDistance,
  formatDuration,
  formatPace,
  formatTime,
} from "@/lib/utils";

const ActivityMap = dynamic(
  () => import("@/components/ActivityMap").then((m) => m.ActivityMap),
  { ssr: false, loading: () => <div className="h-80 animate-pulse rounded-lg bg-brand-surface" /> }
);

const ZONE_COLORS: Record<number, string> = {
  1: "#58a6ff",
  2: "#3fb950",
  3: "#e3b341",
  4: "#f0883e",
  5: "#f85149",
};

export default function ActivityPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [splits, setSplits] = useState<Split[]>([]);
  const [zones, setZones] = useState<ZoneBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.allSettled([
      fetchActivity(id),
      fetchSplits(id),
      fetchZones(id),
    ]).then(([actRes, splRes, zonRes]) => {
      if (actRes.status === "rejected") {
        setError(actRes.reason instanceof Error ? actRes.reason.message : "Atividade não encontrada");
      } else {
        setActivity(actRes.value);
      }
      if (splRes.status === "fulfilled") setSplits(splRes.value);
      if (zonRes.status === "fulfilled") setZones(zonRes.value);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-5xl px-4 py-8 space-y-4">
          <div className="h-8 w-48 animate-pulse rounded bg-brand-surface" />
          <div className="h-80 animate-pulse rounded-lg bg-brand-surface" />
          <div className="h-64 animate-pulse rounded-lg bg-brand-surface" />
        </div>
      </main>
    );
  }

  if (error || !activity) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-brand-danger">{error ?? "Atividade não encontrada"}</p>
        <button onClick={() => router.push("/dashboard")} className="text-brand-accent hover:underline text-sm">
          ← Voltar ao dashboard
        </button>
      </main>
    );
  }

  // dados para gráficos
  const chartData = activity.points
    .filter((_, i) => i % 3 === 0) // subsample para performance
    .map((p) => ({
      t: p.elapsed_time_s,
      distKm: p.distance_m != null ? +(p.distance_m / 1000).toFixed(2) : null,
      hr: p.hr,
      alt: p.altitude_m != null ? +p.altitude_m.toFixed(1) : null,
      pace:
        p.speed_ms != null && p.speed_ms > 0
          ? +(1000 / p.speed_ms / 60).toFixed(2)
          : null,
    }));

  const hasPace = activity.avg_pace_s_per_km != null;
  const hasHr = activity.avg_hr != null;
  const hasAlt = activity.elevation_gain_m != null;

  return (
    <main className="min-h-screen">
      {/* header */}
      <header className="border-b border-brand-border px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <Link href="/dashboard" className="text-sm text-brand-muted hover:text-brand-accent">
            ← Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <SportBadge sport={activity.sport} />
            <span className="text-sm text-brand-muted">
              {formatDate(activity.start_time)} · {formatTime(activity.start_time)}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        {/* título e métricas */}
        <section>
          <h1 className="text-xl font-semibold mb-4">
            {activity.title ?? `${formatDistance(activity.distance_m)} — ${formatDuration(activity.duration_s)}`}
          </h1>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            <Stat label="Distância" value={formatDistance(activity.distance_m)} />
            <Stat label="Duração" value={formatDuration(activity.duration_s)} />
            {activity.avg_pace_s_per_km != null && (
              <Stat label="Pace Médio" value={formatPace(activity.avg_pace_s_per_km)} />
            )}
            {activity.avg_speed_kmh != null && (
              <Stat label="Vel. Média" value={`${activity.avg_speed_kmh.toFixed(1)} km/h`} />
            )}
            {activity.avg_hr != null && (
              <Stat label="FC Média" value={`${activity.avg_hr} bpm`} />
            )}
            {activity.max_hr != null && (
              <Stat label="FC Máx" value={`${activity.max_hr} bpm`} />
            )}
            {activity.elevation_gain_m != null && (
              <Stat label="Elevação" value={`+${Math.round(activity.elevation_gain_m)}m`} />
            )}
            {activity.calories != null && (
              <Stat label="Calorias" value={`${activity.calories} kcal`} />
            )}
          </div>
        </section>

        {/* mapa */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-muted">Mapa</h2>
          <ActivityMap points={activity.points} height="360px" />
        </section>

        {/* gráfico elevação */}
        {hasAlt && chartData.some((d) => d.alt != null) && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-muted">Elevação</h2>
            <div className="rounded-lg border border-brand-border bg-brand-surface p-4">
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                  <XAxis dataKey="distKm" stroke="#8b949e" fontSize={12} tickFormatter={(v) => `${v}km`} />
                  <YAxis stroke="#8b949e" fontSize={12} tickFormatter={(v) => `${v}m`} />
                  <Tooltip
                    contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 6 }}
                    formatter={(v) => [`${v}m`, "Altitude"]}
                    labelFormatter={(l) => `${l} km`}
                  />
                  <Area type="monotone" dataKey="alt" stroke="#2f81f7" fill="#2f81f722" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* gráfico pace/HR */}
        {(hasPace || hasHr) && chartData.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-muted">
              {hasPace ? "Pace" : "Velocidade"} &amp; FC
            </h2>
            <div className="rounded-lg border border-brand-border bg-brand-surface p-4">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                  <XAxis dataKey="distKm" stroke="#8b949e" fontSize={12} tickFormatter={(v) => `${v}km`} />
                  <YAxis
                    yAxisId="left"
                    stroke="#8b949e"
                    fontSize={12}
                    reversed={hasPace}
                    tickFormatter={(v) => hasPace ? `${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, "0")}` : `${v}km/h`}
                  />
                  <YAxis yAxisId="right" orientation="right" stroke="#8b949e" fontSize={12} tickFormatter={(v) => `${v}bpm`} />
                  <Tooltip
                    contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 6 }}
                    labelFormatter={(l) => `${l} km`}
                  />
                  <Legend />
                  {hasPace && (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="pace"
                      name="Pace (min/km)"
                      stroke="#2f81f7"
                      dot={false}
                      strokeWidth={1.5}
                      connectNulls
                    />
                  )}
                  {hasHr && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="hr"
                      name="FC (bpm)"
                      stroke="#f85149"
                      dot={false}
                      strokeWidth={1.5}
                      connectNulls
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* zonas FC */}
        {zones.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-muted">Zonas de FC</h2>
            <div className="rounded-lg border border-brand-border bg-brand-surface p-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={zones}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                  <XAxis dataKey="zone" stroke="#8b949e" fontSize={12} tickFormatter={(v) => `Z${v}`} />
                  <YAxis stroke="#8b949e" fontSize={12} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 6 }}
                    formatter={(v, _, props) => [
                      `${(props.payload as ZoneBucket).percent.toFixed(1)}% (${formatDuration((props.payload as ZoneBucket).seconds)})`,
                      `Zona ${(props.payload as ZoneBucket).zone}`,
                    ]}
                  />
                  <Bar dataKey="percent" radius={[4, 4, 0, 0]}>
                    {zones.map((z) => (
                      <Cell key={z.zone} fill={ZONE_COLORS[z.zone] ?? "#8b949e"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* tabela de splits */}
        {splits.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-muted">Splits por km</h2>
            <div className="rounded-lg border border-brand-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-brand-surface text-brand-muted">
                  <tr>
                    <th className="px-4 py-2 text-left">km</th>
                    <th className="px-4 py-2 text-right">Pace</th>
                    <th className="px-4 py-2 text-right">Tempo</th>
                    <th className="px-4 py-2 text-right">FC</th>
                    <th className="px-4 py-2 text-right">Elevação</th>
                  </tr>
                </thead>
                <tbody>
                  {splits.map((s, i) => (
                    <tr
                      key={s.index}
                      className={`border-t border-brand-border ${i % 2 === 1 ? "bg-brand-surface/50" : ""}`}
                    >
                      <td className="px-4 py-2">{s.index}</td>
                      <td className="px-4 py-2 text-right font-medium text-brand-accent">
                        {s.pace_s_per_km != null ? formatPace(s.pace_s_per_km) : "–"}
                      </td>
                      <td className="px-4 py-2 text-right">{formatDuration(s.duration_s)}</td>
                      <td className="px-4 py-2 text-right">{s.avg_hr != null ? `${s.avg_hr} bpm` : "–"}</td>
                      <td className="px-4 py-2 text-right">
                        {s.elevation_gain_m != null ? `+${Math.round(s.elevation_gain_m)}m` : "–"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-brand-border bg-brand-surface p-3">
      <p className="text-xs text-brand-muted">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  );
}
