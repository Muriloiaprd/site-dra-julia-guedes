"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Sparkline } from "@/components/ui/charts";
import { TrendBadge } from "@/components/ui/primitives";
import { SportTile } from "@/components/SportIcon";
import { pctChange } from "@/lib/athlete";
import type { ActivitySummary } from "@/lib/api";
import { C } from "@/lib/theme";
import { formatDistance, formatDuration, formatPace, sportLabel } from "@/lib/utils";

type SparkMetric = "distance" | "duration" | "hr" | "pace" | "elevation";

function metricValue(a: ActivitySummary, metric: SparkMetric): number {
  if (metric === "distance") return (a.distance_m ?? 0) / 1000;
  if (metric === "duration") return a.duration_s / 3600;
  if (metric === "elevation") return a.elevation_gain_m ?? 0;
  if (metric === "hr") return a.avg_hr ?? 0;
  return a.avg_pace_s_per_km ?? 0;
}

export function ActivityModal({ activity, activities, onClose }: {
  activity: ActivitySummary; activities: ActivitySummary[]; onClose: () => void;
}) {
  const idx = activities.findIndex((a) => a.id === activity.id);
  const prev = idx >= 0 ? activities[idx + 1] : undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [onClose]);

  function series(metric: SparkMetric): number[] {
    const start = idx >= 0 ? idx : 0;
    return activities.slice(start, start + 8).reverse().map((a) => metricValue(a, metric)).filter((v) => v > 0);
  }

  const metrics: { label: string; value: string; trend: number | null; spark: number[]; color: string; inv?: boolean }[] = [
    { label: "Distância", value: activity.distance_m != null ? formatDistance(activity.distance_m) : "—", trend: pctChange(activity.distance_m, prev?.distance_m), spark: series("distance"), color: C.accent },
    { label: "Tempo", value: formatDuration(activity.duration_s), trend: pctChange(activity.duration_s, prev?.duration_s), spark: series("duration"), color: C.lime },
    { label: "Pace médio", value: activity.avg_pace_s_per_km != null ? formatPace(activity.avg_pace_s_per_km) : "—", trend: pctChange(activity.avg_pace_s_per_km, prev?.avg_pace_s_per_km), spark: series("pace"), color: C.info, inv: true },
    { label: "FC média", value: activity.avg_hr != null ? `${activity.avg_hr} bpm` : "—", trend: pctChange(activity.avg_hr, prev?.avg_hr), spark: series("hr"), color: "#FF6B35", inv: true },
    { label: "Elevação", value: activity.elevation_gain_m != null ? `${Math.round(activity.elevation_gain_m)} m` : "—", trend: pctChange(activity.elevation_gain_m, prev?.elevation_gain_m), spark: series("elevation"), color: "#A78BFA" },
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
      role="dialog"
      aria-modal="true"
      aria-label={activity.title ?? sportLabel(activity.sport)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="od-panel max-h-[88vh] w-full max-w-[760px] animate-od-fade-up overflow-y-auto !rounded-b-none sm:!rounded-card"
        style={{ background: "linear-gradient(180deg, rgba(0,255,102,0.04), transparent 30%), #0e0e0e" }}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <SportTile sport={activity.sport} size={48} radius={14} />
            <div>
              <h3 className="font-display text-lg font-extrabold leading-tight">{activity.title ?? sportLabel(activity.sport)}</h3>
              <p className="mt-0.5 text-xs capitalize text-brand-muted">
                {sportLabel(activity.sport)} · {new Date(activity.start_time).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="od-icon-btn !h-8 !w-8 !rounded-full" aria-label="Fechar">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {metrics.map((m) => (
            <div key={m.label} className="od-tile p-3">
              <div className="od-metric-label mb-1.5">{m.label}</div>
              <div className="od-num mb-2 text-[1.05rem]">{m.value}</div>
              <div className="flex items-end justify-between gap-1">
                <TrendBadge pct={m.trend} invert={m.inv} />
                <Sparkline data={m.spark} color={m.color} height={22} width={56} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[0.66rem] text-brand-textTertiary">Variação vs atividade anterior · linhas mostram as últimas 8.</p>

        <div className="mt-4 flex gap-2.5">
          <div className="od-tile flex-1 px-3 py-2.5">
            <div className="od-metric-label">Fonte</div>
            <div className="mt-0.5 text-sm font-semibold uppercase">{activity.source}</div>
          </div>
          {activity.avg_speed_kmh != null && (
            <div className="od-tile flex-1 px-3 py-2.5">
              <div className="od-metric-label">Vel. média</div>
              <div className="od-num mt-0.5 text-sm">{activity.avg_speed_kmh.toFixed(1)} km/h</div>
            </div>
          )}
        </div>

        <Link href={`/activities/${activity.id}`} className="od-btn od-btn-primary mt-5 w-full">
          Ver página completa da atividade <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}
