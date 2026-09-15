"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SportTile } from "@/components/SportIcon";
import { Alert, EmptyState, PageContainer, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";
import { deleteActivity, fetchActivities, type ActivitySummary } from "@/lib/api";
import { formatDistance, formatDuration, formatPace, formatPaceShort, isBikeSport, sportColor, sportLabel } from "@/lib/utils";

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
  const router = useRouter();
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  async function handleDelete(id: string) {
    if (!confirm("Excluir atividade? Esta ação não pode ser desfeita.")) return;
    setDeletingId(id);
    try {
      await deleteActivity(id);
      setActivities((prev) => prev.filter((a) => a.id !== id));
    } catch {
      setError("Erro ao excluir atividade");
    } finally {
      setDeletingId(null);
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

  const advancedCount = [distance, duration, hr, pace, elevation].filter((r) => r.min !== "" || r.max !== "").length;
  const hasActiveFilters =
    search.trim() !== "" ||
    selectedSports.size > 0 ||
    period !== "TUDO" ||
    advancedCount > 0;

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
    const elevation_m = filtered.reduce((s, a) => s + (a.elevation_gain_m ?? 0), 0);
    return { count: filtered.length, distance_m, duration_s, elevation_m };
  }, [filtered]);

  return (
    <PageContainer>
      <PageHeader
        kicker="Histórico"
        title="Atividades"
        description="Todos os seus treinos importados, com filtros por modalidade, período e esforço."
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M3 12h4l3 8 4-16 3 8h4" /></svg>}
        actions={<Link href="/import" className="od-btn od-btn-secondary">+ Importar</Link>}
      />

      {/* totais do filtro */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          // "+" = ainda ha paginas nao carregadas; totais refletem so o que esta carregado
          { k: "Atividades", v: loading ? null : `${totals.count}${hasMore ? "+" : ""}`, u: "" },
          { k: "Distância", v: loading ? null : (totals.distance_m / 1000).toFixed(0), u: "km" },
          { k: "Tempo total", v: loading ? null : formatDuration(totals.duration_s), u: "" },
          { k: "Elevação", v: loading ? null : Math.round(totals.elevation_m).toLocaleString("pt-BR"), u: "m" },
        ].map((t) => (
          <Panel key={t.k} className="!p-4">
            <div className="od-metric-label">{t.k}</div>
            {t.v == null ? <Skeleton className="mt-2 h-7 w-20" /> : (
              <div className="od-num mt-1.5 text-[1.6rem] leading-none">{t.v}{t.u && <span className="ml-1 font-sans text-xs font-semibold text-brand-muted">{t.u}</span>}</div>
            )}
          </Panel>
        ))}
      </div>

      {/* filtros */}
      <Panel className="mb-4 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou modalidade…"
              spellCheck={false}
              className="od-input !pl-10 !pr-9"
              aria-label="Buscar atividade"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-brand-muted hover:text-brand-accent"
                aria-label="Limpar busca"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAdvanced((s) => !s)} className={`od-btn od-btn-ghost ${showAdvanced || advancedCount ? "!text-brand-accent" : ""}`} aria-expanded={showAdvanced}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M4 6h16M7 12h10M10 18h4" /></svg>
              Filtros avançados{advancedCount ? ` (${advancedCount})` : ""}
            </button>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="od-btn od-btn-ghost">✕ Limpar</button>
            )}
          </div>
        </div>

        <div>
          <p className="od-metric-label mb-2">Modalidade</p>
          <div className="flex flex-wrap gap-2">
            {SPORTS.map((s) => {
              const active = selectedSports.has(s);
              const color = sportColor(s);
              return (
                <button
                  key={s}
                  onClick={() => toggleSport(s)}
                  aria-pressed={active}
                  className="od-chip"
                  style={active ? { color, background: `${color}18`, boxShadow: `inset 0 0 0 1px ${color}88, 0 0 14px -6px ${color}` } : undefined}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: color, opacity: active ? 1 : 0.5 }} />
                  {sportLabel(s)}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="od-metric-label mb-2">Período</p>
          <div className="flex flex-wrap items-center gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                aria-pressed={period === p.key}
                className={`od-chip ${period === p.key ? "is-active" : ""}`}
              >
                {p.label}
              </button>
            ))}
            {period === "CUSTOM" && (
              <div className="flex items-center gap-2">
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="od-input od-input-sm !w-auto" aria-label="De" />
                <span className="text-xs text-brand-muted">até</span>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="od-input od-input-sm !w-auto" aria-label="Até" />
              </div>
            )}
          </div>
        </div>

        {showAdvanced && (
          <div className="grid animate-od-fade-up grid-cols-2 gap-4 border-t border-white/5 pt-5 sm:grid-cols-3 lg:grid-cols-5">
            <RangeFilter label="Distância (km)" range={distance} onChange={setDistance} step={0.5} />
            <RangeFilter label="Duração (min)" range={duration} onChange={setDuration} step={5} />
            <RangeFilter label="FC média (bpm)" range={hr} onChange={setHr} step={5} />
            <RangeFilter label="Pace (min/km)" range={pace} onChange={setPace} step={0.5} />
            <RangeFilter label="Elevação (m)" range={elevation} onChange={setElevation} step={50} />
          </div>
        )}
      </Panel>

      {error && <div className="mb-4"><Alert tone="danger">{error}</Alert></div>}

      {loading ? (
        <Panel className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
        </Panel>
      ) : filtered.length === 0 ? (
        <Panel>
          <EmptyState
            title="Nenhuma atividade encontrada com esses filtros."
            action={hasActiveFilters ? <button onClick={clearFilters} className="od-btn od-btn-secondary">Limpar filtros</button> : <Link href="/import" className="od-btn od-btn-primary">Importar atividades →</Link>}
          />
        </Panel>
      ) : (
        <>
          {/* desktop: tabela */}
          <Panel className="hidden overflow-hidden !p-0 md:block">
            <div className="overflow-x-auto">
              <table className="od-table">
                <thead>
                  <tr>
                    <th className="text-left">Atividade</th>
                    <th className="text-left">Data</th>
                    <th className="text-right">Distância</th>
                    <th className="text-right">Duração</th>
                    <th className="text-right">Pace/Vel.</th>
                    <th className="text-right">FC</th>
                    <th className="text-right">Elevação</th>
                    <th className="text-right">Fonte</th>
                    <th className="text-right" aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => {
                    const isBike = isBikeSport(a.sport);
                    return (
                      <tr key={a.id} className="group cursor-pointer" onClick={() => router.push(`/activities/${a.id}`)}>
                        <td>
                          <Link href={`/activities/${a.id}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                            <SportTile sport={a.sport} size={32} radius={9} />
                            <span className="min-w-0">
                              <span className="block max-w-[260px] truncate font-medium text-white transition-colors group-hover:text-brand-accent">{a.title ?? sportLabel(a.sport)}</span>
                              <span className="block text-[0.7rem]" style={{ color: sportColor(a.sport) }}>{sportLabel(a.sport)}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-brand-muted">
                          {new Date(a.start_time).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                        <td className="od-num text-right">{formatDistance(a.distance_m)}</td>
                        <td className="text-right text-brand-textSecondary">{formatDuration(a.duration_s)}</td>
                        <td className="text-right text-brand-textSecondary">
                          {isBike
                            ? a.avg_speed_kmh != null ? `${a.avg_speed_kmh.toFixed(1)} km/h` : "–"
                            : a.avg_pace_s_per_km != null ? formatPace(a.avg_pace_s_per_km) : "–"}
                        </td>
                        <td className="text-right text-brand-textSecondary">{a.avg_hr != null ? `${a.avg_hr} bpm` : "–"}</td>
                        <td className="text-right text-brand-textSecondary">
                          {a.elevation_gain_m != null ? `+${Math.round(a.elevation_gain_m)}m` : "–"}
                        </td>
                        <td className="text-right"><span className="od-badge od-badge-muted">{SOURCE_LABEL[a.source] ?? a.source}</span></td>
                        <td className="text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleDelete(a.id)}
                            disabled={deletingId === a.id}
                            className="od-btn od-btn-danger od-btn-sm"
                            aria-label="Excluir atividade"
                          >
                            {deletingId === a.id ? "…" : "Excluir"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* mobile: cards */}
          <ul className="space-y-2 md:hidden">
            {filtered.map((a) => {
              const isBike = isBikeSport(a.sport);
              return (
                <li key={a.id} className="flex items-center gap-2">
                  <Link href={`/activities/${a.id}`} className="od-panel od-interactive flex min-w-0 flex-1 items-center gap-3 !p-3.5">
                    <SportTile sport={a.sport} size={40} radius={11} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{a.title ?? sportLabel(a.sport)}</div>
                      <div className="text-[0.7rem] text-brand-muted">
                        {new Date(a.start_time).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })} · {formatDuration(a.duration_s)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="od-num text-base">{formatDistance(a.distance_m)}</div>
                      <div className="text-[0.68rem] text-brand-muted">
                        {isBike
                          ? a.avg_speed_kmh != null ? `${a.avg_speed_kmh.toFixed(1)} km/h` : ""
                          : a.avg_pace_s_per_km != null ? `${formatPaceShort(a.avg_pace_s_per_km)}/km` : ""}
                      </div>
                    </div>
                  </Link>
                  <button
                    onClick={() => handleDelete(a.id)}
                    disabled={deletingId === a.id}
                    aria-label="Excluir atividade"
                    className="od-btn od-btn-danger od-btn-sm shrink-0 !px-2.5"
                  >
                    {deletingId === a.id ? "…" : "🗑"}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {!loading && hasMore && (
        <div className="mt-5 flex justify-center">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="od-btn od-btn-ghost"
          >
            {loadingMore ? "Carregando…" : "Carregar mais atividades"}
          </button>
        </div>
      )}
    </PageContainer>
  );
}

function RangeFilter({
  label, range, onChange, step,
}: {
  label: string; range: RangeState; onChange: (r: RangeState) => void; step?: number;
}) {
  return (
    <div>
      <p className="od-field-label">{label}</p>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          step={step}
          placeholder="mín"
          value={range.min}
          onChange={(e) => onChange({ ...range, min: e.target.value })}
          className="od-input od-input-sm min-w-0"
          aria-label={`${label} mínimo`}
        />
        <span className="text-brand-textTertiary">–</span>
        <input
          type="number"
          step={step}
          placeholder="máx"
          value={range.max}
          onChange={(e) => onChange({ ...range, max: e.target.value })}
          className="od-input od-input-sm min-w-0"
          aria-label={`${label} máximo`}
        />
      </div>
    </div>
  );
}
