export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}m`;
  return `${m}m${String(s).padStart(2, "0")}s`;
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
    other: "Outro",
  };
  return labels[sport] ?? sport;
}

export function sportColor(sport: string): string {
  const colors: Record<string, string> = {
    run: "#2f81f7",
    trail_run: "#3fb950",
    treadmill: "#58a6ff",
    bike: "#f0883e",
    mtb: "#d29922",
    gravel: "#bc8cff",
    indoor_bike: "#e3b341",
    swim: "#39c5cf",
    open_water_swim: "#20b2aa",
    multisport: "#ff7b72",
    other: "#8b949e",
  };
  return colors[sport] ?? "#8b949e";
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
