"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { SportTile } from "@/components/SportIcon";
import { ChartTooltipBox, LegendDot } from "@/components/ui/charts";
import { Alert, Metric, PageContainer, Panel, Skeleton } from "@/components/ui/primitives";
import {
  deleteActivity,
  fetchActivity,
  fetchSplits,
  fetchZones,
  getToken,
  updateActivity,
  type ActivityDetail,
  type Split,
  type ZoneBucket,
} from "@/lib/api";
import { axisProps, C, gridProps } from "@/lib/theme";
import {
  distanceParts,
  formatDate,
  formatDuration,
  formatPace,
  formatPaceShort,
  formatTime,
  sportColor,
  sportLabel,
} from "@/lib/utils";

const ActivityMap = dynamic(
  () => import("@/components/ActivityMap").then((m) => m.ActivityMap),
  { ssr: false, loading: () => <div className="od-skeleton h-[420px]" /> }
);

const ZONE_COLORS: Record<number, string> = {
  1: "#00BFFF",
  2: "#00FF66",
  3: "#C6FF00",
  4: "#FFC145",
  5: "#f85149",
};

const ZONE_NAMES: Record<number, string> = {
  1: "Recuperação",
  2: "Aeróbico",
  3: "Tempo",
  4: "Limiar",
  5: "VO2 máx",
};

const SPORTS = [
  "run", "trail_run", "treadmill", "bike", "mtb", "gravel",
  "indoor_bike", "swim", "open_water_swim", "multisport", "other",
];

export default function ActivityPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [splits, setSplits] = useState<Split[]>([]);
  const [zones, setZones] = useState<ZoneBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"card" | "story" | "sticker" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", description: "", sport: "run" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
      <PageContainer>
        <div className="space-y-4">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-40" />
          <Skeleton className="h-[420px]" />
        </div>
      </PageContainer>
    );
  }

  if (error || !activity) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-brand-danger">{error ?? "Atividade não encontrada"}</p>
        <button onClick={() => router.push("/dashboard")} className="od-btn od-btn-secondary">
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
  const color = sportColor(activity.sport);
  const dist = distanceParts(activity.distance_m);

  async function handleExport(template: "card" | "story" | "sticker", layout: "route" | "stats" | "full" = "full") {
    setExporting(template);
    setExportError(null);
    try {
      const token = getToken();
      const qs = template === "sticker" ? `template=sticker&layout=${layout}` : `template=${template}`;
      const res = await fetch(`/api/activities/${id}/export?${qs}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Erro ao gerar imagem");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ondilow_${template}_${id}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      // antes o erro era silenciado e o botao simplesmente "nao fazia nada"
      setExportError(e instanceof Error ? e.message : "Não foi possível gerar a imagem");
    } finally {
      setExporting(null);
    }
  }

  function openEdit() {
    setEditForm({
      title: activity!.title ?? "",
      description: "",
      sport: activity!.sport,
    });
    setSaveError(null);
    setEditing(true);
  }

  async function handleSaveEdit() {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateActivity(id, {
        title: editForm.title.trim() || null,
        description: editForm.description.trim() || null,
        sport: editForm.sport,
      });
      setActivity(updated);
      setEditing(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Excluir esta atividade? Esta ação não pode ser desfeita.")) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteActivity(id);
      router.push("/activities");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Erro ao excluir atividade");
      setDeleting(false);
    }
  }

  const paceFmt = (v: number) => `${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, "0")}`;
  const splitPaces = splits.map((s) => s.pace_s_per_km).filter((p): p is number => p != null);
  const fastest = splitPaces.length ? Math.min(...splitPaces) : null;
  const slowest = splitPaces.length ? Math.max(...splitPaces) : null;

  const secondary: { label: string; value: string | number; unit?: string }[] = [];
  if (activity.moving_time_s != null) secondary.push({ label: "Em movimento", value: formatDuration(activity.moving_time_s) });
  if (activity.max_hr != null) secondary.push({ label: "FC máx", value: activity.max_hr, unit: "bpm" });
  if (activity.elevation_gain_m != null) secondary.push({ label: "Elevação", value: `+${Math.round(activity.elevation_gain_m)}`, unit: "m" });
  if (activity.avg_speed_kmh != null && hasPace) secondary.push({ label: "Vel. média", value: activity.avg_speed_kmh.toFixed(1), unit: "km/h" });
  if (activity.avg_cadence != null) secondary.push({ label: "Cadência", value: activity.avg_cadence, unit: "spm" });
  if (activity.avg_power_w != null) secondary.push({ label: "Potência", value: activity.avg_power_w, unit: "W" });
  if (activity.calories != null) secondary.push({ label: "Calorias", value: activity.calories, unit: "kcal" });

  return (
    <PageContainer>
      {/* breadcrumb */}
      <nav className="mb-5 flex items-center gap-2 text-xs text-brand-muted" aria-label="Navegação">
        <Link href="/dashboard" className="hover:text-brand-accent">Dashboard</Link>
        <span className="text-brand-textTertiary">/</span>
        <Link href="/activities" className="hover:text-brand-accent">Atividades</Link>
        <span className="text-brand-textTertiary">/</span>
        <span className="truncate text-brand-textSecondary">{activity.title ?? sportLabel(activity.sport)}</span>
      </nav>

      {/* hero */}
      <Panel variant="hero" className="mb-4">
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-4">
            <SportTile sport={activity.sport} size={56} radius={16} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="od-badge" style={{ color, background: `${color}14`, boxShadow: `inset 0 0 0 1px ${color}44` }}>{sportLabel(activity.sport)}</span>
                <span className="text-xs capitalize text-brand-muted">{formatDate(activity.start_time)} · {formatTime(activity.start_time)}</span>
              </div>
              <h1 className="mt-2 font-display text-[1.6rem] font-extrabold leading-tight tracking-tight sm:text-[2rem]">
                {activity.title ?? `${dist.value} ${dist.unit} — ${formatDuration(activity.duration_s)}`}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 hidden text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-brand-muted sm:inline">Compartilhar</span>
            <button onClick={() => handleExport("card")} disabled={exporting !== null} className="od-btn od-btn-ghost od-btn-sm" title="Card 1080x1080">
              {exporting === "card" ? "Gerando…" : "📷 Card"}
            </button>
            <button onClick={() => handleExport("story")} disabled={exporting !== null} className="od-btn od-btn-ghost od-btn-sm" title="Story 1080x1920">
              {exporting === "story" ? "Gerando…" : "📱 Story"}
            </button>
            <button onClick={() => handleExport("sticker", "full")} disabled={exporting !== null} className="od-btn od-btn-secondary od-btn-sm" title="Sticker transparente — sobreponha em qualquer foto">
              {exporting === "sticker" ? "Gerando…" : "🏷️ Sticker"}
            </button>
            <span className="mx-1 hidden h-4 w-px bg-white/10 sm:block" />
            <button onClick={openEdit} disabled={editing} className="od-btn od-btn-ghost od-btn-sm">
              ✏️ Editar
            </button>
            <button onClick={handleDelete} disabled={deleting} className="od-btn od-btn-danger od-btn-sm">
              {deleting ? "Excluindo…" : "🗑️ Excluir"}
            </button>
          </div>
        </div>

        {exportError && <div className="relative mt-4"><Alert tone="danger" title="Falha ao exportar">{exportError}</Alert></div>}
        {deleteError && <div className="relative mt-4"><Alert tone="danger" title="Falha ao excluir">{deleteError}</Alert></div>}

        {editing && (
          <div className="relative mt-5 space-y-3 border-t border-white/5 pt-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="od-field-label">Título</span>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder={sportLabel(activity.sport)}
                  className="od-input"
                />
              </label>
              <label>
                <span className="od-field-label">Modalidade</span>
                <select
                  value={editForm.sport}
                  onChange={(e) => setEditForm((f) => ({ ...f, sport: e.target.value }))}
                  className="od-input"
                >
                  {SPORTS.map((s) => (
                    <option key={s} value={s}>{sportLabel(s)}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="od-field-label">Descrição</span>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="od-input resize-none"
              />
            </label>
            {saveError && <Alert tone="danger">{saveError}</Alert>}
            <div className="flex gap-2">
              <button onClick={handleSaveEdit} disabled={saving} className="od-btn od-btn-primary od-btn-sm">
                {saving ? "Salvando…" : "Salvar"}
              </button>
              <button onClick={() => setEditing(false)} disabled={saving} className="od-btn od-btn-ghost od-btn-sm">
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="relative mt-6 grid grid-cols-2 gap-5 border-t border-white/5 pt-5 sm:grid-cols-4">
          <Metric size="xl" value={dist.value} unit={dist.unit} label="Distância" />
          <Metric size="lg" value={formatDuration(activity.duration_s)} label="Duração" />
          {hasPace
            ? <Metric size="lg" value={formatPaceShort(activity.avg_pace_s_per_km!)} unit="/km" label="Pace médio" />
            : activity.avg_speed_kmh != null
              ? <Metric size="lg" value={activity.avg_speed_kmh.toFixed(1)} unit="km/h" label="Vel. média" />
              : <Metric size="lg" value="—" label="Pace médio" />}
          <Metric size="lg" value={activity.avg_hr ?? "—"} unit={activity.avg_hr ? "bpm" : undefined} label="FC média" color={activity.avg_hr ? "#fff" : undefined} />
        </div>

        {secondary.length > 0 && (
          <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {secondary.map((s) => (
              <div key={s.label} className="od-tile px-3 py-2.5">
                <Metric size="sm" value={s.value} unit={s.unit} label={s.label} />
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="od-stagger grid gap-4 xl:grid-cols-12">
        {/* mapa */}
        <Panel className={zones.some((z) => z.seconds > 0) ? "xl:col-span-8" : "xl:col-span-12"}>
          <h2 className="od-label mb-4">Rota</h2>
          <ActivityMap points={activity.points} height="420px" />
        </Panel>

        {/* zonas FC */}
        {zones.some((z) => z.seconds > 0) && (
          <Panel className="xl:col-span-4">
            <h2 className="od-label mb-5">Zonas de frequência cardíaca</h2>
            <ul className="space-y-3.5">
              {[...zones].sort((a, b) => b.zone - a.zone).map((z) => (
                <li key={z.zone}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <span className="flex items-baseline gap-2">
                      <span className="od-num text-sm" style={{ color: ZONE_COLORS[z.zone] }}>Z{z.zone}</span>
                      <span className="text-xs text-brand-muted">{ZONE_NAMES[z.zone]}</span>
                    </span>
                    <span className="text-xs tabular-nums text-brand-textSecondary">
                      <strong className="od-num text-white">{z.percent.toFixed(0)}%</strong> · {formatDuration(z.seconds)}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.05]">
                    <div
                      className="h-full rounded-full transition-[width] duration-700"
                      style={{ width: `${Math.max(1, z.percent)}%`, background: ZONE_COLORS[z.zone] ?? "#888", boxShadow: `0 0 10px ${ZONE_COLORS[z.zone]}88` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[0.7rem] text-brand-textTertiary">Calculado a partir da sua FC máxima configurada no perfil.</p>
          </Panel>
        )}

        {/* gráfico elevação */}
        {hasAlt && chartData.some((d) => d.alt != null) && (
          <Panel className="xl:col-span-12">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="od-label">Perfil de elevação</h2>
              <span className="text-xs text-brand-muted">+{Math.round(activity.elevation_gain_m ?? 0)} m{activity.elevation_loss_m != null ? ` · −${Math.round(activity.elevation_loss_m)} m` : ""}</span>
            </div>
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="alt-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.accent} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={C.accent} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis {...axisProps} dataKey="distKm" tickFormatter={(v) => `${v}km`} minTickGap={40} />
                <YAxis {...axisProps} width={46} tickFormatter={(v) => `${v}m`} domain={["auto", "auto"]} />
                <Tooltip
                  cursor={{ stroke: "rgba(0,255,102,0.3)", strokeDasharray: "3 4" }}
                  content={({ active, payload, label }) => active && payload?.length
                    ? <ChartTooltipBox title={`${label} km`} rows={[{ label: "Altitude", value: `${payload[0].value} m`, color: C.accent }]} />
                    : null}
                />
                <Area type="monotone" dataKey="alt" stroke={C.accent} fill="url(#alt-fill)" strokeWidth={1.8} dot={false} activeDot={{ r: 4, fill: C.accent }} />
              </AreaChart>
            </ResponsiveContainer>
          </Panel>
        )}

        {/* gráfico pace/HR */}
        {(hasPace || hasHr) && chartData.length > 0 && (
          <Panel className="xl:col-span-12">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="od-label">{hasPace ? "Pace" : "Velocidade"} &amp; frequência cardíaca</h2>
              <div className="flex gap-4">
                {hasPace && <LegendDot color={C.accent} label="Pace (min/km)" />}
                {hasHr && <LegendDot color={C.danger} label="FC (bpm)" />}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 0, left: -8, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis {...axisProps} dataKey="distKm" tickFormatter={(v) => `${v}km`} minTickGap={40} />
                <YAxis
                  {...axisProps}
                  yAxisId="left"
                  width={46}
                  reversed={hasPace}
                  domain={["auto", "auto"]}
                  tickFormatter={(v) => hasPace ? paceFmt(v) : `${v}km/h`}
                />
                <YAxis {...axisProps} yAxisId="right" orientation="right" width={40} domain={["auto", "auto"]} tickFormatter={(v) => `${v}`} />
                <Tooltip
                  cursor={{ stroke: "rgba(255,255,255,0.2)", strokeDasharray: "3 4" }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload as (typeof chartData)[number];
                    const rows: { label: string; value: string; color: string }[] = [];
                    if (hasPace && row.pace != null) rows.push({ label: "Pace", value: `${paceFmt(row.pace)}/km`, color: C.accent });
                    if (hasHr && row.hr != null) rows.push({ label: "FC", value: `${row.hr} bpm`, color: C.danger });
                    return <ChartTooltipBox title={`${label} km · ${formatDuration(row.t)}`} rows={rows} />;
                  }}
                />
                {hasPace && (
                  <Line yAxisId="left" type="monotone" dataKey="pace" name="Pace (min/km)" stroke={C.accent} dot={false} strokeWidth={1.6} connectNulls activeDot={{ r: 4, fill: C.accent }} />
                )}
                {hasHr && (
                  <Line yAxisId="right" type="monotone" dataKey="hr" name="FC (bpm)" stroke={C.danger} strokeOpacity={0.85} dot={false} strokeWidth={1.4} connectNulls activeDot={{ r: 4, fill: C.danger }} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </Panel>
        )}

        {/* tabela de splits */}
        {splits.length > 0 && (
          <Panel className="overflow-hidden !p-0 xl:col-span-12">
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-2 pt-5 sm:px-6">
              <h2 className="od-label">Splits por km</h2>
              {fastest != null && slowest != null && (
                <span className="text-xs text-brand-muted">
                  Mais rápido <strong className="od-num text-brand-accent">{formatPaceShort(fastest)}</strong> · mais lento <strong className="od-num text-brand-textSecondary">{formatPaceShort(slowest)}</strong>
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="od-table">
                <thead>
                  <tr>
                    <th className="text-left">km</th>
                    <th className="text-left">Pace</th>
                    <th className="text-right">Tempo</th>
                    <th className="text-right">FC</th>
                    <th className="text-right">Elevação</th>
                  </tr>
                </thead>
                <tbody>
                  {splits.map((s) => {
                    const isFast = s.pace_s_per_km != null && s.pace_s_per_km === fastest;
                    // barra: mais rapido = mais longa
                    const width = s.pace_s_per_km != null && fastest != null && slowest != null
                      ? slowest === fastest ? 100 : 35 + (65 * (slowest - s.pace_s_per_km)) / (slowest - fastest)
                      : 0;
                    return (
                      <tr key={s.index}>
                        <td className="od-num w-14 text-brand-muted">{s.index}</td>
                        <td className="min-w-[200px]">
                          <div className="flex items-center gap-3">
                            <span className="od-num w-12 shrink-0" style={{ color: isFast ? C.accent : "#fff" }}>
                              {s.pace_s_per_km != null ? formatPaceShort(s.pace_s_per_km) : "–"}
                            </span>
                            <div className="h-1.5 max-w-[240px] flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                              <div className="h-full rounded-full" style={{ width: `${width}%`, background: isFast ? "linear-gradient(90deg,#00FF66,#C6FF00)" : "rgba(0,255,102,0.4)", boxShadow: isFast ? "0 0 8px rgba(0,255,102,0.6)" : undefined }} />
                            </div>
                            {isFast && <span className="od-badge !px-1.5 !py-0 !text-[0.55rem]">Melhor</span>}
                          </div>
                        </td>
                        <td className="text-right text-brand-textSecondary">{formatDuration(s.duration_s)}</td>
                        <td className="text-right text-brand-textSecondary">{s.avg_hr != null ? `${s.avg_hr} bpm` : "–"}</td>
                        <td className="text-right text-brand-textSecondary">
                          {s.elevation_gain_m != null ? `+${Math.round(s.elevation_gain_m)}m` : "–"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="px-5 pb-4 pt-2 text-[0.7rem] text-brand-textTertiary sm:px-6">Pace médio geral: {hasPace ? formatPace(activity.avg_pace_s_per_km!) : "—"}</p>
          </Panel>
        )}
      </div>
    </PageContainer>
  );
}
