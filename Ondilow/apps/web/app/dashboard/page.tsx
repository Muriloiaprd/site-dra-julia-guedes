"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";


import { Logo } from "@/components/Logo";
import { SportBadge } from "@/components/SportBadge";
import {
  clearToken,
  fetchActivities,
  fetchMe,
  fetchPredictionsOverview,
  fetchRecords,
  uploadActivity,
  type ActivitySummary,
  type PersonalRecord,
  type TrainingRecommendation,
  type User,
} from "@/lib/api";
import {
  formatDate,
  formatDistance,
  formatDuration,
  formatPace,
  formatRecordValue,
  recordLabel,
  sportLabel,
} from "@/lib/utils";

const SPORTS = [
  { value: "", label: "Todos" },
  { value: "run", label: "Corrida" },
  { value: "trail_run", label: "Trail Run" },
  { value: "bike", label: "Ciclismo" },
  { value: "mtb", label: "MTB" },
  { value: "swim", label: "Natação" },
  { value: "other", label: "Outro" },
];

const PAGE_SIZE = 20;

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [sport, setSport] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<TrainingRecommendation | null>(null);

  // carrega usuário
  useEffect(() => {
    fetchMe().then((u) => {
      if (!u) { router.push("/login"); return; }
      setUser(u);
    });
  }, [router]);

  // carrega atividades e recordes quando filtro ou página muda
  const loadActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [acts, recs] = await Promise.all([
        fetchActivities(PAGE_SIZE, offset, sport || undefined),
        fetchRecords(),
      ]);
      setActivities(acts);
      setRecords(recs.slice(0, 6));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [sport, offset]);

  useEffect(() => {
    if (user) loadActivities();
  }, [user, loadActivities]);

  useEffect(() => {
    if (user) {
      fetchPredictionsOverview()
        .then((d) => setRecommendation(d.recommendation))
        .catch(() => { /* silencia — nao bloqueia o dashboard */ });
    }
  }, [user]);

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const result = await uploadActivity(file);
      const imported = result.imported.filter((r) => !r.duplicate);
      const dups = result.imported.filter((r) => r.duplicate);
      let msg = "";
      if (imported.length > 0) msg += `${imported.length} atividade(s) importada(s). `;
      if (dups.length > 0) msg += `${dups.length} duplicata(s) ignorada(s).`;
      setUploadMsg(msg || "Arquivo processado.");
      loadActivities();
    } catch (e: unknown) {
      setUploadMsg(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <main className="min-h-screen">
      {/* header */}
      <header className="flex items-center justify-between border-b border-brand-border px-6 py-4">
        <Logo />
        <div className="flex items-center gap-4 text-sm">
          <Link href="/metrics" className="text-brand-muted hover:text-brand-accent">Carga</Link>
          <Link href="/predictions" className="text-brand-muted hover:text-brand-accent">Previsões</Link>
          <Link href="/integrations" className="text-brand-muted hover:text-brand-accent">Garmin</Link>
          <Link href="/profile" className="text-brand-muted hover:text-brand-accent">Perfil</Link>
          <span className="text-brand-muted hidden sm:inline">{user?.email}</span>
          <button onClick={handleLogout} className="text-brand-accent hover:underline">
            Sair
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* card de recomendação de hoje */}
        {recommendation && (
          <Link
            href="/predictions"
            className="mb-6 flex items-center justify-between rounded-lg border p-4 transition-opacity hover:opacity-90"
            style={{ borderColor: recommendation.color + "40", backgroundColor: recommendation.color + "12" }}
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Hoje</p>
              <p className="font-medium" style={{ color: recommendation.color }}>{recommendation.label}</p>
              {recommendation.detail && (
                <p className="text-xs text-brand-muted mt-0.5">{recommendation.detail}</p>
              )}
            </div>
            <span className="text-xs text-brand-muted">Ver previsões →</span>
          </Link>
        )}

        {/* upload banner */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-brand-border bg-brand-surface p-4">
          <div>
            <p className="font-medium">Importar Atividade</p>
            <p className="text-sm text-brand-muted">FIT, GPX, TCX ou CSV histórico</p>
          </div>
          <div className="flex items-center gap-3">
            {uploadMsg && (
              <span className="text-sm text-brand-success">{uploadMsg}</span>
            )}
            <label className="cursor-pointer rounded-md bg-brand-accent px-4 py-2 text-sm font-medium text-white hover:bg-brand-accentHover">
              {uploading ? "Enviando…" : "Selecionar arquivo"}
              <input
                type="file"
                className="hidden"
                accept=".fit,.gpx,.tcx,.csv"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          </div>
        </div>

        {/* recordes */}
        {records.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-muted">
              Recordes Pessoais
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {records.map((r) => (
                <div
                  key={`${r.sport}-${r.record_type}`}
                  className="flex items-center justify-between rounded-lg border border-brand-border bg-brand-surface px-4 py-3"
                >
                  <div>
                    <p className="text-xs text-brand-muted">{sportLabel(r.sport)}</p>
                    <p className="text-sm font-medium">{recordLabel(r.record_type)}</p>
                  </div>
                  <span className="text-brand-accent font-semibold">
                    {formatRecordValue(r.value, r.unit)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* filtros */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {SPORTS.map((s) => (
            <button
              key={s.value}
              onClick={() => { setSport(s.value); setOffset(0); }}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                sport === s.value
                  ? "border-brand-accent bg-brand-accent text-white"
                  : "border-brand-border text-brand-muted hover:border-brand-accent hover:text-brand-accent"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* lista de atividades */}
        {error && (
          <div className="mb-4 rounded-lg border border-brand-danger/40 bg-brand-danger/10 p-3 text-sm text-brand-danger">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-brand-surface" />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="rounded-lg border border-brand-border bg-brand-surface p-12 text-center text-brand-muted">
            <p className="text-4xl mb-3">🏃</p>
            <p className="font-medium">Nenhuma atividade encontrada</p>
            <p className="mt-1 text-sm">Faça upload de um arquivo FIT, GPX ou TCX para começar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activities.map((a) => (
              <Link
                key={a.id}
                href={`/activities/${a.id}`}
                className="flex items-center justify-between rounded-lg border border-brand-border bg-brand-surface px-4 py-3 transition-colors hover:border-brand-accent"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <SportBadge sport={a.sport} />
                      {a.title && <span className="text-sm font-medium truncate">{a.title}</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-brand-muted">
                      {formatDate(a.start_time)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm text-right shrink-0">
                  <div>
                    <p className="font-medium">{formatDistance(a.distance_m)}</p>
                    <p className="text-xs text-brand-muted">distância</p>
                  </div>
                  <div>
                    <p className="font-medium">{formatDuration(a.duration_s)}</p>
                    <p className="text-xs text-brand-muted">duração</p>
                  </div>
                  {a.avg_pace_s_per_km != null && (
                    <div className="hidden sm:block">
                      <p className="font-medium">{formatPace(a.avg_pace_s_per_km)}</p>
                      <p className="text-xs text-brand-muted">pace</p>
                    </div>
                  )}
                  {a.avg_hr != null && (
                    <div className="hidden md:block">
                      <p className="font-medium">{a.avg_hr} bpm</p>
                      <p className="text-xs text-brand-muted">FC média</p>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* paginação */}
        {!loading && (
          <div className="mt-6 flex justify-between">
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
              className="rounded-md border border-brand-border px-4 py-2 text-sm disabled:opacity-30 hover:border-brand-accent hover:text-brand-accent"
            >
              ← Anterior
            </button>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={activities.length < PAGE_SIZE}
              className="rounded-md border border-brand-border px-4 py-2 text-sm disabled:opacity-30 hover:border-brand-accent hover:text-brand-accent"
            >
              Próxima →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
