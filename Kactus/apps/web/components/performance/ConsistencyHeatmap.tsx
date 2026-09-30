"use client";

import { EmptyState, Panel, Skeleton } from "@/components/ui/primitives";
import type { HeatmapDay } from "@/lib/api";

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
                title={`${fmtDayLong(cell.date)}${cell.load > 0 ? ` — carga ${cell.load.toFixed(0)}` : " — sem treino"}`}
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

/** Constancia: um quadradinho por dia nas ultimas 16 semanas, colorido pela carga e pelo esporte. */
export function ConsistencyHeatmap({ data, loading }: { data: HeatmapDay[]; loading: boolean }) {
  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="od-label">Constância · últimas 16 semanas</h2>
        <div className="flex items-center gap-1.5 text-[0.68rem] text-brand-muted">
          <span>Menos</span>
          {["#161616", "#00FF6640", "#00FF6680", "#00FF66c0", "#00FF66"].map((c, i) => (
            <div key={i} className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: c }} />
          ))}
          <span>Mais carga</span>
        </div>
      </div>
      {loading ? <Skeleton className="h-36" /> : data.length === 0 ? (
        <EmptyState title="Sem treinos nas últimas 16 semanas" description="Importe atividades para ver sua constância." />
      ) : (
        <div className="overflow-x-auto pb-1">
          <div className="min-w-[420px]"><TrainingHeatmap data={data} /></div>
        </div>
      )}
    </Panel>
  );
}
