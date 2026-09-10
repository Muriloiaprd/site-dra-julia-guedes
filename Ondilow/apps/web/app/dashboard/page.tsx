"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";

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

const PERIODS = [
  { value: "", label: "Sempre" },
  { value: "7", label: "7d" },
  { value: "30", label: "30d" },
  { value: "90", label: "90d" },
  { value: "365", label: "1 ano" },
];

const PAGE_SIZE = 20;

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [sport, setSport] = useState("");
  const [period, setPeriod] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<TrainingRecommendation | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

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
        fetchActivities(PAGE_SIZE, offset, sport || undefined, period || undefined),
        fetchRecords(),
      ]);
      setActivities(acts);
      setRecords(recs.slice(0, 6));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [sport, period, offset]);

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

  async function processFile(file: File) {
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
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-8">
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

        {/* zona de import drag-and-drop */}
        <div
          ref={dropRef}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className="mb-8 relative rounded-2xl transition-all duration-200"
          style={{
            background: dragOver ? "rgba(0,255,102,0.06)" : "rgba(17,17,17,0.9)",
            border: dragOver ? "2px dashed rgba(0,255,102,0.7)" : "2px dashed rgba(0,255,102,0.2)",
            boxShadow: dragOver ? "0 0 30px rgba(0,255,102,0.12)" : "none",
          }}
        >
          {/* linha de brilho no topo */}
          <div className="absolute left-0 right-0 top-0 h-px rounded-t-2xl"
            style={{ background: "linear-gradient(90deg, transparent, rgba(0,255,102,0.4), transparent)" }} />

          <div className="flex flex-col items-center justify-center gap-4 px-8 py-10 text-center">
            {/* ícone upload */}
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-xl" style={{ background: "rgba(0,255,102,0.15)" }} />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ background: "rgba(0,255,102,0.08)", border: "1px solid rgba(0,255,102,0.2)" }}>
                {uploading ? (
                  <svg className="animate-spin" width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <circle cx="14" cy="14" r="10" stroke="rgba(0,255,102,0.2)" strokeWidth="3"/>
                    <path d="M14 4 A10 10 0 0 1 24 14" stroke="#00FF66" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00FF66" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                )}
              </div>
            </div>

            <div>
              <p className="text-base font-bold text-white" style={{ fontFamily: "'Poppins', sans-serif" }}>
                {uploading ? "Processando arquivo…" : "Arraste seu arquivo aqui"}
              </p>
              <p className="mt-1 text-sm" style={{ color: "#888" }}>
                {uploading ? "Aguarde um momento" : "ou clique para selecionar"}
              </p>
            </div>

            {uploadMsg ? (
              <div className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
                style={{ background: "rgba(0,255,102,0.08)", border: "1px solid rgba(0,255,102,0.2)", color: "#00FF66" }}>
                ✓ {uploadMsg}
              </div>
            ) : (
              <label className="cursor-pointer rounded-xl px-6 py-2.5 text-sm font-bold text-black transition-all"
                style={{ background: "linear-gradient(90deg, #00FF66, #C6FF00)" }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 0 20px rgba(0,255,102,0.35)")}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
              >
                {uploading ? "Enviando…" : "Escolher arquivo"}
                <input
                  type="file"
                  className="hidden"
                  accept=".fit,.gpx,.tcx,.csv"
                  onChange={handleUpload}
                  disabled={uploading}
                />
              </label>
            )}

            <p className="text-xs" style={{ color: "#555" }}>
              FIT · GPX · TCX · CSV — nada é enviado a servidores externos
            </p>
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
        <div className="mb-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {SPORTS.map((s) => (
              <button
                key={s.value}
                onClick={() => { setSport(s.value); setOffset(0); }}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  sport === s.value
                    ? "border-brand-accent bg-brand-accent text-black font-semibold"
                    : "border-brand-border text-brand-muted hover:border-brand-accent hover:text-brand-accent"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-brand-muted">Período:</span>
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => { setPeriod(p.value); setOffset(0); }}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  period === p.value
                    ? "border-brand-accent bg-brand-accent text-black font-semibold"
                    : "border-brand-border text-brand-muted hover:border-brand-accent hover:text-brand-accent"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
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
