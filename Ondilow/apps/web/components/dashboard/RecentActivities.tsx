"use client";

import dynamic from "next/dynamic";
import { EmptyState, LinkAction, Panel, Skeleton } from "@/components/ui/primitives";
import { SportIcon, SportTile } from "@/components/SportIcon";
import type { ActivityDetail, ActivitySummary, PersonalRecord } from "@/lib/api";
import { distanceParts, formatDuration, formatPaceShort, isBikeSport, sportColor, sportLabel } from "@/lib/utils";

const ActivityMiniMap = dynamic(
  () => import("@/components/ActivityMiniMap").then((m) => m.ActivityMiniMap),
  { ssr: false, loading: () => <div className="od-skeleton h-full !rounded-none" /> },
);

function distanceBadge(distanceM: number | null): string | null {
  if (!distanceM) return null;
  const km = distanceM / 1000;
  if (km >= 20) return "Longão";
  if (km >= 10) return "10K+";
  if (km >= 5) return "5K+";
  return null;
}

function Mini({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-brand-textTertiary">{label}</div>
      <div className="od-num mt-0.5 truncate text-[0.85rem]">
        {value}{unit && <span className="ml-0.5 font-sans text-[0.62rem] font-medium text-brand-muted">{unit}</span>}
      </div>
    </div>
  );
}

export function RecentActivities({
  activities, details, records, loading, onSelect, className = "",
}: {
  activities: ActivitySummary[];
  details: Record<string, ActivityDetail>;
  records: PersonalRecord[];
  loading: boolean;
  onSelect: (a: ActivitySummary) => void;
  className?: string;
}) {
  return (
    <Panel className={className} aria-label="Atividades recentes">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="od-label">Atividades recentes</h2>
        <LinkAction href="/activities">Ver todas</LinkAction>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[300px]" />)}
        </div>
      ) : activities.length === 0 ? (
        <EmptyState
          icon={<SportIcon sport="run" size="60%" />}
          title="Nenhuma atividade ainda"
          description="Use Importar para adicionar seus treinos."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {activities.map((a) => {
            const color = sportColor(a.sport);
            const points = details[a.id]?.points ?? [];
            const hasRoute = points.filter((p) => p.lat != null && p.lon != null).length >= 2;
            const isPR = records.some((r) => r.activity_id === a.id);
            const badge = isPR ? "PR" : distanceBadge(a.distance_m);
            const dist = distanceParts(a.distance_m);
            const bike = isBikeSport(a.sport);
            const d = new Date(a.start_time);
            return (
              <article
                key={a.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(a)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(a); } }}
                className="od-interactive group flex flex-col overflow-hidden rounded-tile"
                style={{ background: "rgba(255,255,255,0.02)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05)", border: "1px solid transparent" }}
              >
                <div className="relative h-32 overflow-hidden" style={{ background: `radial-gradient(ellipse at 50% 40%, ${color}1a, #0c0e0d 75%)` }}>
                  {hasRoute ? (
                    <ActivityMiniMap points={points} height="100%" color={color} />
                  ) : (
                    <div className="flex h-full items-center justify-center opacity-40"><SportIcon sport={a.sport} size="40px" /></div>
                  )}
                  <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 45%, rgba(13,13,13,0.95) 100%)" }} />
                  <div className="pointer-events-none absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-black/55 py-0.5 pl-0.5 pr-2 backdrop-blur">
                    <SportTile sport={a.sport} size={20} radius={999} />
                    <span className="text-[0.62rem] font-semibold" style={{ color }}>{sportLabel(a.sport)}</span>
                  </div>
                  {badge && (
                    <span className={`od-badge pointer-events-none absolute right-2.5 top-2.5 ${isPR ? "od-badge-gold" : "!bg-black/55 backdrop-blur"}`}>
                      {isPR && "🏆 "}{badge}
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-3.5">
                  <h3 className="truncate text-[0.85rem] font-semibold">{a.title ?? sportLabel(a.sport)}</h3>
                  <p className="text-[0.68rem] capitalize text-brand-muted">
                    {d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })} · {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>

                  <div className="mt-3 flex items-end justify-between gap-2">
                    <div className="od-num text-[1.6rem] leading-none">
                      {dist.value}<span className="ml-1 font-sans text-xs font-semibold text-brand-muted">{dist.unit}</span>
                    </div>
                    <div className="od-num text-[0.95rem] text-brand-textSecondary">{formatDuration(a.duration_s)}</div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/5 pt-3">
                    {bike && a.avg_speed_kmh != null
                      ? <Mini label="Vel." value={a.avg_speed_kmh.toFixed(1)} unit="km/h" />
                      : <Mini label="Pace" value={a.avg_pace_s_per_km != null ? formatPaceShort(a.avg_pace_s_per_km) : "—"} unit={a.avg_pace_s_per_km != null ? "/km" : undefined} />}
                    <Mini label="FC" value={a.avg_hr ?? "—"} unit={a.avg_hr ? "bpm" : undefined} />
                    <Mini label="Elev." value={a.elevation_gain_m != null ? Math.round(a.elevation_gain_m) : "—"} unit={a.elevation_gain_m != null ? "m" : undefined} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
