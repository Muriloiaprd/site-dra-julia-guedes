export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}m`;
  return `${m}m${String(s).padStart(2, "0")}s`;
}

/** Tempo em formato de relogio: 23:33 ou 1:45:20 (recordes, previsoes). */
export function formatClock(seconds: number): string {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Pace sem sufixo: 5:28 */
export function formatPaceShort(sPerKm: number): string {
  const m = Math.floor(sPerKm / 60);
  const s = Math.round(sPerKm % 60);
  if (s === 60) return `${m + 1}:00`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Distancia em km sem sufixo, para metricas grandes: 36.01 */
export function formatKm(meters: number | null, decimals = 2): string {
  if (meters == null) return "–";
  return (meters / 1000).toFixed(decimals);
}

/** Distancia separada em valor/unidade para metricas de destaque: 700 m, 36.01 km */
export function distanceParts(meters: number | null, decimals = 2): { value: string; unit: string } {
  if (meters == null) return { value: "–", unit: "" };
  if (meters < 1000) return { value: String(Math.round(meters)), unit: "m" };
  return { value: (meters / 1000).toFixed(decimals), unit: "km" };
}

/** "hoje", "ontem", "há 3 dias", "há 2 sem." */
export function relativeDay(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const a = new Date(d); a.setHours(0, 0, 0, 0);
  const b = new Date(); b.setHours(0, 0, 0, 0);
  const days = Math.round((b.getTime() - a.getTime()) / 86400000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 14) return `há ${days} dias`;
  if (days < 60) return `há ${Math.floor(days / 7)} sem.`;
  if (days >= 365) {
    const years = Math.floor(days / 365);
    return years === 1 ? "há 1 ano" : `há ${years} anos`;
  }
  return `há ${Math.floor(days / 30)} meses`;
}

export function isBikeSport(sport: string): boolean {
  return ["bike", "mtb", "gravel", "indoor_bike"].includes(sport);
}

export function sportGroup(sport: string): "run" | "bike" | "swim" | "other" {
  if (["run", "trail_run", "treadmill"].includes(sport)) return "run";
  if (isBikeSport(sport)) return "bike";
  if (["swim", "open_water_swim"].includes(sport)) return "swim";
  return "other";
}

/** Esportes em que cadencia e GAP fazem sentido (passos, nao pedaladas). */
export function isStepSport(sport: string): boolean {
  return ["run", "trail_run", "treadmill", "walk"].includes(sport);
}

export function formatPace(sPerKm: number): string {
  const m = Math.floor(sPerKm / 60);
  const s = Math.round(sPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

export function formatDistance(meters: number | null): string {
  if (meters == null) return "–";
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(2)}km`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function sportLabel(sport: string): string {
  const labels: Record<string, string> = {
    run: "Corrida",
    trail_run: "Trail Run",
    treadmill: "Esteira",
    bike: "Ciclismo",
    mtb: "MTB",
    gravel: "Gravel",
    indoor_bike: "Bike Indoor",
    swim: "Natação",
    open_water_swim: "Natação Águas Abertas",
    multisport: "Multiesporte",
    walk: "Caminhada",
    strength: "Musculação",
    pilates: "Pilates",
    other: "Outro",
  };
  return labels[sport] ?? sport;
}

export function sportColor(sport: string): string {
  const colors: Record<string, string> = {
    run: "#00FF66",
    trail_run: "#00CC50",
    treadmill: "#00FF66",
    bike: "#C6FF00",
    mtb: "#99CC00",
    gravel: "#AADD00",
    indoor_bike: "#C6FF00",
    swim: "#00CFFF",
    open_water_swim: "#0099CC",
    multisport: "#FF6B6B",
    walk: "#7FD8BE",
    strength: "#FFB347",
    pilates: "#C9A0FF",
    other: "#888888",
  };
  return colors[sport] ?? "#888888";
}

export function recordLabel(type: string): string {
  const labels: Record<string, string> = {
    fastest_1k: "1km",
    fastest_5k: "5km",
    fastest_10k: "10km",
    fastest_21k: "Meia Maratona",
    fastest_42k: "Maratona",
    longest_run: "Mais Longa (corrida)",
    longest_ride: "Mais Longa (bike)",
    longest_swim: "Mais Longa (natação)",
    fastest_100m_swim: "100m nado",
    fastest_400m_swim: "400m nado",
    max_hr_recorded: "FC Máxima",
    max_power_1s: "Potência Máx (1s)",
    best_power_5min: "Melhor Potência (5min)",
    best_power_20min: "Melhor Potência (20min)",
    best_power_60min: "Melhor Potência (60min)",
  };
  return labels[type] ?? type;
}

export function formatRecordValue(value: number, unit: string): string {
  switch (unit) {
    case "seconds":
      return formatDuration(Math.round(value));
    case "meters":
      return formatDistance(value);
    case "watts":
      return `${Math.round(value)}W`;
    case "bpm":
      return `${Math.round(value)} bpm`;
    default:
      return `${value.toFixed(1)} ${unit}`;
  }
}
