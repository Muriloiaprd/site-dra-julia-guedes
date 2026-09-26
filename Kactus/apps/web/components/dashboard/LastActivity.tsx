"use client";

import dynamic from "next/dynamic";
import { Sparkline } from "@/components/ui/charts";
import { EmptyState, Metric, Panel, Skeleton, TrendBadge } from "@/components/ui/primitives";
import { SportIcon, SportTile } from "@/components/SportIcon";
import { compareWithRecent, paceSeries } from "@/lib/athlete";
import type { ActivityDetail, ActivitySummary } from "@/lib/api";
import { C } from "@/lib/theme";
import { distanceParts, formatDuration, formatPaceShort, isBikeSport, relativeDay, sportColor, sportLabel } from "@/lib/utils";

const ActivityMiniMap = dynamic(
  () => import("@/components/ActivityMiniMap").then((m) => m.ActivityMiniMap),
  { ssr: false, loading: () => <div className="od-skeleton h-full !rounded-none" /> },
);

export function LastActivity({
  activity, detail, activities, loading, onOpen, className = "",
}: {
  activity: ActivitySummary | null;
  detail?: ActivityDetail;
  activities: ActivitySummary[];
  loading: boolean;
  onOpen: (a: ActivitySummary) => void;
  className?: string;
}) {
  if (loading) {
    return <Panel className={className}><Skeleton className="h-full min-h-[380px]" /></Panel>;
  }
  if (!activity) {
    return (
      <Panel className={className} aria-label="Última atividade">
        <h2 className="od-label">Última atividade</h2>
        <EmptyState title="Nenhuma atividade registrada" description="Importe seus arquivos .fit, .gpx ou .tcx para começar." />
      </Panel>
    );
  }

  const color = sportColor(activity.sport);
  const points = detail?.points ?? [];
  const hasRoute = points.filter((p) => p.lat != null && p.lon != null).length >= 2;
  const pace = paceSeries(points);
  const cmp = compareWithRecent(activity, activities);
  const dist = distanceParts(activity.distance_m);
  const bike = isBikeSport(activity.sport);
  const start = new Date(activity.start_time);

  return (
    <Panel
      interactive
      className={`flex flex-col overflow-hidden !p-0 ${className}`}
      onClick={() => onOpen(activity)}
      aria-label="Última atividade"
    >
      <div className="relative h-40 overflow-hidden sm:h-44" style={{ background: `radial-gradient(ellipse at 50% 30%, ${color}18, #0c0e0d 75%)` }}>
        {hasRoute ? (
          <ActivityMiniMap points={points} height="100%" color={color} padding={22} />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl opacity-40"><SportIcon sport={activity.sport} size="56px" /></div>
        )}
        <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(17,17,17,0.55) 0%, transparent 35%, transparent 55%, #111 100%)" }} />
        <div className="pointer-events-none absolute left-4 right-4 top-4 flex items-center justify-between">
          <span className="od-label od-label-accent">Última atividade</span>
          <span className="od-badge od-badge-muted !bg-black/50 backdrop-blur">{relativeDay(activity.start_time)}</span>
        </div>
      </div>

      <div className="relative z-10 -mt-6 flex flex-1 flex-col px-5 pb-5">
        <div className="flex items-center gap-3">
          <SportTile sport={activity.sport} size={40} radius={12} />
          <div className="min-w-0">
            <h3 className="truncate font-display text-[1.05rem] font-bold leading-tight">{activity.title ?? sportLabel(activity.sport)}</h3>
            <p className="text-[0.72rem] capitalize text-brand-muted">
              {start.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })} · {start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-end justify-between gap-3">
          <Metric size="xl" value={dist.value} unit={dist.unit} label="Distância" />
          <Metric size="md" value={formatDuration(activity.duration_s)} label="Tempo" align="right" />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/5 pt-4">
          {bike && activity.avg_speed_kmh != null
            ? <Metric size="sm" value={activity.avg_speed_kmh.toFixed(1)} unit="km/h" label="Vel." />
            : <Metric size="sm" value={activity.avg_pace_s_per_km != null ? formatPaceShort(activity.avg_pace_s_per_km) : "—"} unit={activity.avg_pace_s_per_km != null ? "/km" : undefined} label="Pace" />}
          <Metric size="sm" value={activity.avg_hr ?? "—"} unit={activity.avg_hr ? "bpm" : undefined} label="FC" />
          <Metric size="sm" value={activity.elevation_gain_m != null ? Math.round(activity.elevation_gain_m) : "—"} unit={activity.elevation_gain_m != null ? "m" : undefined} label="Elev." />
        </div>

        {pace.length >= 4 && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[0.66rem] text-brand-muted">
              <span className="od-metric-label">Ritmo na atividade</span>
              <span className="tabular-nums">{formatPaceShort(Math.min(...pace))} – {formatPaceShort(Math.max(...pace))} /km</span>
            </div>
            <Sparkline data={pace} color={C.accent} height={42} responsive invert />
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
          {cmp.sample >= 2 ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] text-brand-muted">
              {!bike && cmp.pacePct != null && <span className="inline-flex items-center gap-1"><TrendBadge pct={cmp.pacePct} invert /> pace</span>}
              {cmp.distPct != null && <span className="inline-flex items-center gap-1"><TrendBadge pct={cmp.distPct} /> distância</span>}
              <span className="text-brand-textTertiary">vs média das últ. {cmp.sample}</span>
            </div>
          ) : <span />}
          <span className="text-xs font-semibold text-brand-accent">Ver detalhes →</span>
        </div>
      </div>
    </Panel>
  );
}
