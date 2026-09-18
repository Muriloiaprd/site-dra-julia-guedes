"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchMe, uploadActivitiesBatch, type UploadResult } from "@/lib/api";
import { formatDistance, sportLabel } from "@/lib/utils";
import { PageContainer, PageHeader, Panel, ProgressBar, StatusDot } from "@/components/ui/primitives";
import { CountUp } from "@/components/ui/CountUp";

const ACCEPTED_EXT = [".fit", ".gpx", ".tcx", ".csv", ".gz"];

type QueueStatus = "pending" | "uploading" | "done" | "error";

interface QueueItem {
  id: string;
  file: File;
  status: QueueStatus;
  result?: UploadResult;
  error?: string;
}

export default function ImportPage() {
  const router = useRouter();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMe().then((u) => { if (!u) router.push("/login"); });
  }, [router]);

  useEffect(() => {
    if (!processing) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [processing]);

  function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((f) => {
      const ext = "." + (f.name.split(".").pop() ?? "").toLowerCase();
      return ACCEPTED_EXT.includes(ext);
    });
    if (files.length === 0) return;
    const items: QueueItem[] = files.map((f) => ({
      id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2)}`,
      file: f,
      status: "pending",
    }));
    setQueue((prev) => [...prev, ...items]);
    processQueue(items);
  }

  // Lotes pequenos em vez de um so gigante: uma requisicao com muitos arquivos
  // fica exposta a um timeout de ~30s do proxy (Next.js -> API) e perde tudo
  // de uma vez se estourar. O tempo por arquivo varia com a maquina (CPU,
  // tamanho do arquivo), entao nao existe um tamanho de pedaço "seguro" fixo
  // -- por isso, se um pedaço falhar, ele e dividido pela metade e tentado
  // de novo automaticamente, ate achar um tamanho que passe dentro do tempo.
  const CHUNK_SIZE = 15;
  const MIN_CHUNK_SIZE = 2;

  async function uploadChunkWithRetry(chunk: QueueItem[]): Promise<void> {
    const ids = new Set(chunk.map((it) => it.id));
    setQueue((prev) => prev.map((q) => (ids.has(q.id) ? { ...q, status: "uploading" } : q)));
    try {
      const results = await uploadActivitiesBatch(chunk.map((it) => it.file));
      setQueue((prev) => {
        const byId = new Map(chunk.map((it, i) => [it.id, results[i]]));
        return prev.map((q) => {
          const result = byId.get(q.id);
          if (!result) return q;
          if (result.error) return { ...q, status: "error", error: result.error };
          return { ...q, status: "done", result };
        });
      });
    } catch (e) {
      if (chunk.length > MIN_CHUNK_SIZE) {
        const mid = Math.ceil(chunk.length / 2);
        await uploadChunkWithRetry(chunk.slice(0, mid));
        await uploadChunkWithRetry(chunk.slice(mid));
      } else {
        const message = e instanceof Error ? e.message : "Erro ao importar";
        setQueue((prev) => prev.map((q) => (ids.has(q.id) ? { ...q, status: "error", error: message } : q)));
      }
    }
  }

  async function processQueue(items: QueueItem[]) {
    setProcessing(true);
    for (let start = 0; start < items.length; start += CHUNK_SIZE) {
      await uploadChunkWithRetry(items.slice(start, start + CHUNK_SIZE));
    }
    setProcessing(false);
  }

  function retryFailed() {
    const failed = queue.filter((q) => q.status === "error");
    if (failed.length === 0 || processing) return;
    setQueue((prev) => prev.map((q) => (q.status === "error" ? { ...q, status: "pending", error: undefined } : q)));
    processQueue(failed);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = "";
  }

  function clearFinished() {
    setQueue((prev) => prev.filter((q) => q.status === "pending" || q.status === "uploading"));
  }

  const totals = queue.reduce(
    (acc, q) => {
      if (q.status === "done" && q.result) {
        const fresh = q.result.imported.filter((x) => !x.duplicate);
        acc.imported += fresh.length;
        acc.duplicates += q.result.imported.filter((x) => x.duplicate).length;
        acc.distance += fresh.reduce((s, x) => s + (x.distance_m ?? 0), 0);
        acc.points += fresh.reduce((s, x) => s + x.points_stored, 0);
      }
      if (q.status === "error") acc.errors += 1;
      if (q.status === "done" || q.status === "error") acc.finished += 1;
      return acc;
    },
    { imported: 0, duplicates: 0, errors: 0, distance: 0, points: 0, finished: 0 }
  );
  const progress = queue.length ? (totals.finished / queue.length) * 100 : 0;
  const allDone = queue.length > 0 && !processing && totals.finished === queue.length;

  return (
    <PageContainer width="medium">
      <PageHeader
        kicker="Central de dados"
        title="Importar atividades"
        description="Exporte suas atividades do Garmin Connect, Strava, Polar, COROS ou qualquer relógio/app compatível e importe os arquivos aqui."
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>}
        actions={<Link href="/dashboard" className="od-btn od-btn-ghost od-btn-sm">← Dashboard</Link>}
      />

      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
        role="button"
        tabIndex={0}
        aria-label="Área de importação: arraste arquivos ou pressione Enter para selecionar"
        className="group relative cursor-pointer overflow-hidden rounded-card px-6 py-12 text-center transition-all duration-300 sm:py-16"
        style={{
          background: dragOver
            ? "radial-gradient(ellipse at 50% 40%, rgba(0,255,102,0.14), rgba(0,255,102,0.02) 70%), #0e120f"
            : "radial-gradient(ellipse at 50% 35%, rgba(0,255,102,0.06), transparent 65%), #0f0f0f",
          boxShadow: dragOver
            ? "inset 0 0 0 1.5px rgba(0,255,102,0.7), 0 0 60px -20px rgba(0,255,102,0.6)"
            : "inset 0 0 0 1px rgba(255,255,255,0.07)",
        }}
      >
        {/* moldura tecnica: cantos + grade */}
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            maskImage: "radial-gradient(ellipse 60% 70% at 50% 50%, #000, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse 60% 70% at 50% 50%, #000, transparent 80%)",
          }}
        />
        {["left-3 top-3 border-l-2 border-t-2", "right-3 top-3 border-r-2 border-t-2", "left-3 bottom-3 border-l-2 border-b-2", "right-3 bottom-3 border-r-2 border-b-2"].map((c) => (
          <span key={c} className={`pointer-events-none absolute h-5 w-5 rounded-[3px] transition-colors duration-300 ${c} ${dragOver ? "border-brand-accent" : "border-white/15 group-hover:border-brand-accent/60"}`} />
        ))}
        {(processing || dragOver) && <div className="od-scanline" />}

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXT.join(",")}
          className="hidden"
          onChange={handleInputChange}
        />

        <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center">
          <div className={`absolute inset-0 rounded-full ${processing ? "animate-od-breathe" : ""}`} style={{ background: "radial-gradient(circle, rgba(0,255,102,0.22), transparent 70%)" }} />
          <svg className="absolute inset-0" viewBox="0 0 80 80" style={processing || dragOver ? { animation: "od-orbit 6s linear infinite" } : undefined} aria-hidden>
            <circle cx="40" cy="40" r="37" fill="none" stroke="rgba(0,255,102,0.35)" strokeDasharray="2 6" />
          </svg>
          <div className="od-icon-tile !h-14 !w-14 !rounded-2xl transition-transform duration-300 group-hover:-translate-y-1">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
        </div>

        <p className="relative font-display text-xl font-bold">{dragOver ? "Solte para importar" : "Arraste seus arquivos aqui"}</p>
        <p className="relative my-3 text-xs uppercase tracking-[0.2em] text-brand-textTertiary">ou</p>
        <span className="od-btn od-btn-primary relative">Selecionar arquivos</span>
        <div className="relative mt-6 flex flex-wrap items-center justify-center gap-1.5">
          <span className="mr-1 text-[0.68rem] text-brand-muted">Formatos aceitos</span>
          {ACCEPTED_EXT.map((e) => (
            <span key={e} className="od-badge od-badge-muted font-mono">{e.slice(1)}</span>
          ))}
        </div>
        <p className="relative mt-2 text-[0.7rem] text-brand-textTertiary">Pode selecionar vários de uma vez</p>
      </div>

      {/* Processamento */}
      {queue.length > 0 && (
        <Panel className="mt-4" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <StatusDot color={processing ? "#FFC145" : totals.errors > 0 ? "#F85149" : "#00FF66"} pulse={processing} />
              <span className="text-sm font-semibold">
                {processing ? "Processando dados…" : totals.errors > 0 ? "Importação concluída com erros" : "Dados sincronizados"}
              </span>
            </div>
            {!processing && (
              <div className="flex items-center gap-2">
                {totals.errors > 0 && (
                  <button onClick={retryFailed} className="od-btn od-btn-secondary od-btn-sm">
                    ↻ Tentar novamente ({totals.errors})
                  </button>
                )}
                <button onClick={clearFinished} className="od-btn od-btn-ghost od-btn-sm">
                  Limpar lista
                </button>
              </div>
            )}
          </div>

          <div className="mt-4">
            <ProgressBar value={progress} height={6} />
            <div className="mt-1.5 flex justify-between text-[0.7rem] tabular-nums text-brand-muted">
              <span>{totals.finished} de {queue.length} arquivo(s)</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </div>

          {processing && (
            <div className="mt-4">
              <p className="od-alert od-alert-warning !py-2 text-[0.8rem]">⏳ Importando — não feche nem navegue para outra página até terminar.</p>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="od-tile p-3.5">
              <div className="od-metric-label">Importadas</div>
              <div className="od-num mt-1 text-[1.6rem] leading-none text-brand-accent"><CountUp value={totals.imported} /></div>
              <div className="mt-1 text-[0.66rem] text-brand-muted">atividades processadas</div>
            </div>
            <div className="od-tile p-3.5">
              <div className="od-metric-label">Distância</div>
              <div className="od-num mt-1 text-[1.6rem] leading-none"><CountUp value={totals.distance / 1000} decimals={0} /><span className="ml-1 font-sans text-xs text-brand-muted">km</span></div>
              <div className="mt-1 text-[0.66rem] text-brand-muted">analisados</div>
            </div>
            <div className="od-tile p-3.5">
              <div className="od-metric-label">Duplicadas</div>
              <div className="od-num mt-1 text-[1.6rem] leading-none text-brand-textSecondary"><CountUp value={totals.duplicates} /></div>
              <div className="mt-1 text-[0.66rem] text-brand-muted">ignoradas</div>
            </div>
            <div className="od-tile p-3.5">
              <div className="od-metric-label">Erros</div>
              <div className="od-num mt-1 text-[1.6rem] leading-none" style={{ color: totals.errors ? "#F85149" : "#7C7C7C" }}>{totals.errors}</div>
              <div className="mt-1 text-[0.66rem] text-brand-muted">{totals.points > 0 ? `${totals.points.toLocaleString("pt-BR")} pontos GPS` : "arquivos com falha"}</div>
            </div>
          </div>

          {allDone && totals.imported > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
              <p className="text-sm text-brand-textSecondary">
                <span className="text-brand-accent">✓</span> {totals.imported} atividade(s) · {formatDistance(totals.distance)} prontas para análise.
              </p>
              <Link href="/dashboard" className="od-btn od-btn-primary od-btn-sm">Ver no dashboard →</Link>
            </div>
          )}

          {/* Fila de arquivos */}
          <ul className="mt-4 max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
            {queue.map((item) => {
              const ext = (item.file.name.split(".").pop() ?? "").toUpperCase();
              return (
                <li key={item.id} className="od-tile flex items-center gap-3 px-3.5 py-2.5">
                  <StatusIcon status={item.status} />
                  <span className="hidden w-11 shrink-0 text-center font-mono text-[0.6rem] font-bold text-brand-muted sm:block">{ext}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.82rem] font-medium">{item.file.name}</p>
                    <p className="truncate text-[0.7rem] text-brand-muted">
                      {item.status === "pending" && "Aguardando…"}
                      {item.status === "uploading" && <span className="text-brand-warning">Enviando e processando…</span>}
                      {item.status === "done" && item.result && (
                        item.result.imported.length === 0
                          ? "Nenhuma atividade encontrada no arquivo"
                          : item.result.imported.map((r, i) => (
                              <span key={i}>
                                {i > 0 && " · "}
                                {r.duplicate ? "Duplicada (ignorada)" : `${sportLabel(r.sport)}${r.distance_m ? ` · ${formatDistance(r.distance_m)}` : ""}`}
                              </span>
                            ))
                      )}
                      {item.status === "error" && <span className="text-brand-danger">{item.error}</span>}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {queue.length === 0 && (
        <Panel className="mt-4">
          <h3 className="od-label mb-4">Como exportar do Garmin Connect</h3>
          <ol className="grid gap-3 sm:grid-cols-2">
            {[
              "Acesse connect.garmin.com e abra a atividade desejada",
              "Clique no ícone de engrenagem no canto da atividade",
              <>Selecione &quot;Exportar Original&quot; (.fit) ou &quot;Exportar GPX&quot;</>,
              "Arraste o arquivo baixado para a área acima",
            ].map((step, i) => (
              <li key={i} className="od-tile flex items-start gap-3 p-3.5 text-sm text-brand-textSecondary">
                <span className="od-num flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs text-brand-accent" style={{ boxShadow: "inset 0 0 0 1px rgba(0,255,102,0.35)" }}>{i + 1}</span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </Panel>
      )}
    </PageContainer>
  );
}

function StatusIcon({ status }: { status: QueueStatus }) {
  if (status === "done") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-accent/15 text-sm text-brand-accent" style={{ boxShadow: "0 0 10px rgba(0,255,102,0.3)" }}>✓</span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-danger/15 text-sm text-brand-danger">✕</span>
    );
  }
  if (status === "uploading") {
    return <span className="m-1 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-brand-accent/30 border-t-brand-accent" />;
  }
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs text-brand-muted" style={{ boxShadow: "inset 0 0 0 1px #2a2a2a" }}>···</span>
  );
}
