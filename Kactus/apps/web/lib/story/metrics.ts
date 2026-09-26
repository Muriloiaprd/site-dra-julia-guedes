import type { ActivityDetail } from "@/lib/api";
import { distanceParts, formatDuration, formatPaceShort, isBikeSport } from "@/lib/utils";

export interface StoryMetric {
  key: "distance" | "duration" | "pace" | "hr" | "elevation";
  label: string;
  value: string;
  unit?: string;
}

/**
 * Resolve rótulo e valor por esporte — mesmo padrão de
 * `components/dashboard/LastActivity.tsx` (pace vs. velocidade). Só devolve
 * métricas com dado disponível na atividade.
 */
export function resolveStoryMetrics(activity: ActivityDetail): StoryMetric[] {
  const metrics: StoryMetric[] = [];
  const dist = distanceParts(activity.distance_m);
  metrics.push({ key: "distance", label: "Distância", value: dist.value, unit: dist.unit });
  metrics.push({ key: "duration", label: "Tempo", value: formatDuration(activity.duration_s) });

  if (isBikeSport(activity.sport)) {
    if (activity.avg_speed_kmh != null) {
      metrics.push({
        key: "pace",
        label: "Velocidade média",
        value: activity.avg_speed_kmh.toFixed(1),
        unit: "km/h",
      });
    }
  } else if (activity.avg_pace_s_per_km != null) {
    metrics.push({
      key: "pace",
      label: "Ritmo médio",
      value: formatPaceShort(activity.avg_pace_s_per_km),
      unit: "/km",
    });
  }

  if (activity.avg_hr != null) {
    metrics.push({ key: "hr", label: "FC média", value: String(activity.avg_hr), unit: "bpm" });
  }
  if (activity.elevation_gain_m != null) {
    metrics.push({
      key: "elevation",
      label: "Elevação",
      value: `+${Math.round(activity.elevation_gain_m)}`,
      unit: "m",
    });
  }
  return metrics;
}

export function metricByKey(metrics: StoryMetric[], key: StoryMetric["key"]): StoryMetric | undefined {
  return metrics.find((m) => m.key === key);
}
