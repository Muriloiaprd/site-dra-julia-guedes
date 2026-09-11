"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SportBadge } from "@/components/SportBadge";
import { fetchActivities, type ActivitySummary } from "@/lib/api";
import { formatDistance, formatDuration, formatPace, sportColor, sportLabel } from "@/lib/utils";

const SPORTS = [
  "run", "trail_run", "treadmill", "bike", "mtb", "gravel",
  "indoor_bike", "swim", "open_water_swim", "multisport", "other",
];

const SOURCE_LABEL: Record<string, string> = {
  fit: "FIT", gpx: "GPX", tcx: "TCX", csv: "CSV",
  garmin_api: "Garmin", strava_api: "Strava", manual: "Manual",
};

const PERIODS = [
  { key: "7D", label: "7 dias", days: 7 },
  { key: "30D", label: "30 dias", days: 30 },
  { key: "3M", label: "3 meses", days: 90 },
  { key: "6M", label: "6 meses", days: 180 },
  { key: "1A", label: "1 ano", days: 365 },
  { key: "TUDO", label: "Tudo", days: null as number | null },
  { key: "CUSTOM", label: "Personalizado", days: null as number | null },
] as const;

type PeriodKey = (typeof PERIODS)[number]["key"];

interface RangeState {
  min: string;
  max: string;
}

const EMPTY_RANGE: RangeState = { min: "", max: "" };

function num(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function inRange(value: number | null | undefined, range: RangeState): boolean {
  const min = num(range.min);
  const max = num(range.max);
  if (min === null && max === null) return true;
  if (value == null) return false;
  if (min !== null && value < min) return false;
  if (max !== null && value > max) return false;
  return true;
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selectedSports, setSelectedSports] = useState<Set<string>>(new Set());
  const [period, setPeriod] = useState<PeriodKey>("TUDO");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [distance, setDistance] = useState<RangeState>(EMPTY_RANGE);
  const [duration, setDuration] = useState<RangeState>(EMPTY_RANGE);
  const [hr, setHr] = useState<RangeState>(EMPTY_RANGE);
  const [pace, setPace] = useState<RangeState>(EMPTY_RANGE);
  const [elevation, setElevation] = useState<RangeState>(EMPTY_RANGE);

  const PAGE_SIZE = 100;

  async function loadPage(offset: number) {
    const batch = await fetchActivities(PAGE_SIZE, offset);
    setHasMore(batch.length === PAGE_SIZE);
    return batch;
  }

  useEffect(() => {
    setLoading(true);
    setError(null);
    loadPage(0)
      .then((batch) => setActivities(batch))
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar atividades"))
      .finally(() => setLoading(false));
  }, []);

  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      const batch = await loadPage(activities.length);
      setActivities((prev) => [...prev, ...batch]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar mais atividades");
    } finally {
      setLoadingMore(false);
    }
  }

  function toggleSport(sport: string) {
    setSelectedSports((prev) => {
      const next = new Set(prev);
      if (next.has(sport)) next.delete(sport);
      else next.add(sport);
      return next;
    });
  }

  function clearFilters() {
    setSearch("");
    setSelectedSports(new Set());
    setPeriod("TUDO");
    setCustomFrom("");
    setCustomTo("");
    setDistance(EMPTY_RANGE);
    setDuration(EMPTY_RANGE);
    setHr(EMPTY_RANGE);
    setPace(EMPTY_RANGE);
    setElevation(EMPTY_RANGE);
  }

  const hasActiveFilters =
    search.trim() !== "" ||
    selectedSports.size > 0 ||
    period !== "TUDO" ||
    [distance, duration, hr, pace, elevation].some((r) => r.min !== "" || r.max !== "");

  const periodBounds = useMemo(() => {
    if (period === "CUSTOM") {
      const from = customFrom ? new Date(customFrom) : null;
      const to = customTo ? new Date(customTo + "T23:59:59") : null;
      return { from, to };
    }
    const def = PERIODS.find((p) => p.key === period);
    if (!def?.days) return { from: null, to: null };
    const from = new Date();
    from.setDate(from.getDate() - def.days);
    return { from, to: null };
  }, [period, customFrom, customTo]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activities.filter((a) => {
      if (q) {
        const haystack = `${a.title ?? ""} ${sportLabel(a.sport)}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      if (selectedSports.size > 0 && !selectedSports.has(a.sport)) return false;

      const start = new Date(a.start_time);
      if (periodBounds.from && start < periodBounds.from) return false;
      if (periodBounds.to && start > periodBounds.to) return false;

      const distKm = a.distance_m != null ? a.distance_m / 1000 : null;
      if (!inRange(distKm, distance)) return false;

      const durMin = a.duration_s / 60;
      if (!inRange(durMin, duration)) return false;

      if (!inRange(a.avg_hr, hr)) return false;

      const paceMin = a.avg_pace_s_per_km != null ? a.avg_pace_s_per_km / 60 : null;
      if (!inRange(paceMin, pace)) return false;

      if (!inRange(a.elevation_gain_m, elevation)) return false;

      return true;
    });
  }, [activities, search, selectedSports, periodBounds, distance, duration, hr, pace, elevation]);

  const totals = useMemo(() => {
    const distance_m = filtered.reduce((s, a) => s + (a.distance_m ?? 0), 0);
    const duration_s = filtered.reduce((s, a) => s + a.duration_s, 0);
    return { count: filtered.length, distance_m, duration_s };
  }, [filtered]);

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {/* header */}
        <div>
          <h1 className="text-xl font-semibold">Todas as Atividades</h1>
          <p className="mt-1 text-sm text-brand-muted">
            {loading
              ? "Carregando…"
              : `${totals.count} atividade${totals.count === 1 ? "" : "s"} · ${formatDistance(totals.distance_m)} · ${formatDuration(totals.duration_s)}`}
          </p>
        </div>

        {/* filtros */}
        <section className="space-y-4 rounded-lg border border-brand-border bg-brand-surface p-4">
          {/* busca */}
          <div className="relative">
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-brand-accent"
              style={{ textShadow: "0 0 6px rgba(0,255,102,0.6)" }}
            >
              &gt;_
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="buscar_atividade..."
              spellCheck={false}
              className="w-full rounded-md border border-brand-border bg-black/40 py-2.5 pl-10 pr-9 font-mono text-sm tracking-wide text-white placeholder:text-brand-muted transition-shadow duration-200 focus:border-brand-accent focus:outline-none focus:shadow-[0_0_0_1px_rgba(0,255,102,0.4),0_0_16px_rgba(0,255,102,0.25)]"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-brand-muted hover:text-brand-accent"
                aria-label="Limpar busca"
              >
                ✕
              </button>
            )}
          </div>

          {/* tipo de atividade */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-muted">Tipo de atividade</p>
            <div className="flex flex-wrap gap-2">
              {SPORTS.map((s) => {
                const active = selectedSports.has(s);
                const color = sportColor(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggleSport(s)}
                    className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                    style={
                      active
                        ? { backgroundColor: `${color}22`, borderColor: color, color }
                        : { backgroundColor: "transparent", borderColor: "#2a2a2a", color: "#888" }
                    }
                  >
                    {sportLabel(s)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* periodo */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-muted">Período</p>
            <div className="flex flex-wrap items-center gap-2">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className="rounded-full border px-3 py-1 text-xs font-medium"
                  style={
                    period === p.key
                      ? { background: "rgba(0,255,102,0.1)", borderColor: "rgba(0,255,102,0.4)", color: "#00FF66" }
                      : { background: "transparent", borderColor: "#2a2a2a", color: "#888" }
                  }
                >
                  {p.label}
                </button>
              ))}
              {period === "CUSTOM" && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="rounded border border-brand-border bg-transparent px-2 py-1 text-xs"
                  />
                  <span className="text-xs text-brand-muted">até</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="rounded border border-brand-border bg-transparent px-2 py-1 text-xs"
                  />
                </div>
              )}
            </div>
          </div>

          {/* distancia / duracao / esforco */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <RangeFilter label="Distância (km)" range={distance} onChange={setDistance} step={0.5} />
            <RangeFilter label="Duração (min)" range={duration} onChange={setDuration} step={5} />
            <RangeFilter label="FC média (bpm)" range={hr} onChange={setHr} step={5} />
            <RangeFilter label="Pace (min/km)" range={pace} onChange={setPace} step={0.5} />
            <RangeFilter label="Elevação (m)" range={elevation} onChange={setElevation} step={50} />
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-brand-muted hover:text-brand-accent"
            >
              ✕ Limpar filtros
            </button>
          )}
        </section>

        {/* lista */}
        {error && <p className="text-sm text-brand-danger">{error}</p>}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-brand-surface" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-brand-border bg-brand-surface py-16">
            <p className="text-sm text-brand-muted">Nenhuma atividade encontrada com esses filtros.</p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="rounded-md border border-brand-border px-3 py-1.5 text-xs hover:border-brand-accent hover:text-brand-accent"
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-brand-border">
            <table className="w-full text-sm">
              <thead className="bg-brand-surface text-brand-muted">
                <tr>
                  <th className="px-4 py-3.5 text-left">Atividade</th>
                  <th className="px-4 py-3.5 text-left">Data</th>
                  <th className="px-4 py-3.5 text-right">Distância</th>
                  <th className="px-4 py-3.5 text-right">Duração</th>
                  <th className="px-4 py-3.5 text-right">Pace/Vel.</th>
                  <th className="px-4 py-3.5 text-right">FC</th>
                  <th className="px-4 py-3.5 text-right">Elevação</th>
                  <th className="px-4 py-3.5 text-right">Fonte</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, i) => {
                  const isBike = ["bike", "mtb", "gravel", "indoor_bike"].includes(a.sport);
                  return (
                    <tr key={a.id} className={`border-t border-brand-border ${i % 2 === 1 ? "bg-brand-surface/50" : ""} hover:bg-brand-surface`}>
                      <td className="px-4 py-3.5">
                        <Link href={`/activities/${a.id}`} className="flex items-center gap-2 hover:text-brand-accent">
                          <SportBadge sport={a.sport} />
                          <span className="max-w-[220px] truncate">{a.title ?? sportLabel(a.sport)}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-brand-muted">
                        {new Date(a.start_time).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3.5 text-right">{formatDistance(a.distance_m)}</td>
                      <td className="px-4 py-3.5 text-right">{formatDuration(a.duration_s)}</td>
                      <td className="px-4 py-3.5 text-right">
                        {isBike
                          ? a.avg_speed_kmh != null ? `${a.avg_speed_kmh.toFixed(1)} km/h` : "–"
                          : a.avg_pace_s_per_km != null ? formatPace(a.avg_pace_s_per_km) : "–"}
                      </td>
                      <td className="px-4 py-3.5 text-right">{a.avg_hr != null ? `${a.avg_hr} bpm` : "–"}</td>
                      <td className="px-4 py-3.5 text-right">
                        {a.elevation_gain_m != null ? `+${Math.round(a.elevation_gain_m)}m` : "–"}
                      </td>
                      <td className="px-4 py-3.5 text-right text-brand-muted">{SOURCE_LABEL[a.source] ?? a.source}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && hasMore && (
          <div className="flex justify-center">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="rounded-md border border-brand-border px-4 py-2 text-xs hover:border-brand-accent hover:text-brand-accent disabled:opacity-50"
            >
              {loadingMore ? "Carregando…" : "Carregar mais atividades"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function RangeFilter({
  label, range, onChange, step,
}: {
  label: string; range: RangeState; onChange: (r: RangeState) => void; step?: number;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-muted">{label}</p>
      <div className="flex items-center gap-1">
        <input
          type="number"
          step={step}
          placeholder="mín"
          value={range.min}
          onChange={(e) => onChange({ ...range, min: e.target.value })}
          className="w-full min-w-0 rounded border border-brand-border bg-transparent px-2 py-1 text-xs"
        />
        <span className="text-brand-muted">–</span>
        <input
          type="number"
          step={step}
          placeholder="máx"
          value={range.max}
          onChange={(e) => onChange({ ...range, max: e.target.value })}
          className="w-full min-w-0 rounded border border-brand-border bg-transparent px-2 py-1 text-xs"
        />
      </div>
    </div>
  );
}
