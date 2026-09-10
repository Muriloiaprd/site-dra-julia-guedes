"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchMe, uploadActivity, type UploadResult } from "@/lib/api";
import { formatDistance, sportLabel } from "@/lib/utils";

const ACCEPTED_EXT = [".fit", ".gpx", ".tcx", ".csv"];

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

  async function processQueue(items: QueueItem[]) {
    setProcessing(true);
    for (const item of items) {
      setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "uploading" } : q)));
      try {
        const result = await uploadActivity(item.file);
        setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "done", result } : q)));
      } catch (e) {
        setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "error", error: e instanceof Error ? e.message : "Erro ao importar" } : q)));
      }
    }
    setProcessing(false);
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
        acc.imported += q.result.imported.filter((x) => !x.duplicate).length;
        acc.duplicates += q.result.imported.filter((x) => x.duplicate).length;
      }
      if (q.status === "error") acc.errors += 1;
      return acc;
    },
    { imported: 0, duplicates: 0, errors: 0 }
  );

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-1 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Importar Atividades</h1>
          <Link href="/dashboard" className="text-sm text-brand-muted hover:text-brand-text transition-colors">
            ← Dashboard
          </Link>
        </div>
        <p className="mb-6 text-sm text-brand-muted">
          Exporte suas atividades do Garmin Connect, Strava, Polar, COROS ou qualquer relógio/app compatível e importe os arquivos aqui.
        </p>

        {/* Dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-colors"
          style={{
            borderColor: dragOver ? "#00FF66" : "#1e1e1e",
            background: dragOver ? "rgba(0,255,102,0.06)" : "#111111",
          }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXT.join(",")}
            className="hidden"
            onChange={handleInputChange}
          />
          <div className="mb-3 flex justify-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#00FF66" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p className="font-medium">Arraste arquivos aqui ou clique para selecionar</p>
          <p className="mt-1 text-xs text-brand-muted">.fit · .gpx · .tcx · .csv — pode selecionar vários de uma vez</p>
        </div>

        {/* Resumo */}
        {queue.length > 0 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="flex gap-4 text-sm">
              <span><strong className="text-brand-accent">{totals.imported}</strong> importada(s)</span>
              <span className="text-brand-muted"><strong>{totals.duplicates}</strong> duplicata(s)</span>
              {totals.errors > 0 && <span className="text-brand-danger"><strong>{totals.errors}</strong> erro(s)</span>}
            </div>
            {!processing && (
              <button onClick={clearFinished} className="text-xs text-brand-muted hover:text-brand-text transition-colors">
                Limpar lista
              </button>
            )}
          </div>
        )}

        {/* Fila de arquivos */}
        {queue.length > 0 && (
          <div className="mt-4 space-y-2">
            {queue.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg border border-brand-border bg-brand-surface px-4 py-3">
                <StatusIcon status={item.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.file.name}</p>
                  <p className="truncate text-xs text-brand-muted">
                    {item.status === "pending" && "Aguardando…"}
                    {item.status === "uploading" && "Enviando…"}
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
              </div>
            ))}
          </div>
        )}

        {queue.length === 0 && (
          <div className="mt-10 rounded-xl border border-brand-border bg-brand-surface p-5">
            <h3 className="mb-2 text-sm font-semibold">Como exportar do Garmin Connect</h3>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-brand-muted">
              <li>Acesse connect.garmin.com e abra a atividade desejada</li>
              <li>Clique no ícone de engrenagem no canto da atividade</li>
              <li>Selecione &quot;Exportar Original&quot; (.fit) ou &quot;Exportar GPX&quot;</li>
              <li>Arraste o arquivo baixado para a área acima</li>
            </ol>
          </div>
        )}
      </div>
    </main>
  );
}

function StatusIcon({ status }: { status: QueueStatus }) {
  if (status === "done") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-accent/15 text-brand-accent text-sm">✓</span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-danger/15 text-brand-danger text-sm">✕</span>
    );
  }
  if (status === "uploading") {
    return <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-brand-accent/30 border-t-brand-accent" />;
  }
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-brand-border text-brand-muted text-xs">···</span>
  );
}
