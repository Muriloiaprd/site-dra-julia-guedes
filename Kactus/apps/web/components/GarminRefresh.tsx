"use client";

import { useEffect, useState } from "react";
import { syncGarminNow, type GarminSyncResult } from "@/lib/api";

/** Mesmo texto do Kactus Controle (apps/controle/kactus_controle/garmin.py: texto_sync). */
export function garminSyncText(r: GarminSyncResult): string {
  const n = r.imported;
  const partes = [n ? `${n} treino${n !== 1 ? "s" : ""} novo${n !== 1 ? "s" : ""} do Garmin` : "Nada novo no Garmin"];
  if (r.failed) partes.push(`${r.failed} com erro`);
  if (r.stopped) partes.push(`parou no meio: ${r.stopped}`);
  return partes.join(" · ");
}

type Aviso = { tone: "ok" | "erro"; text: string };

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg className={spinning ? "animate-spin" : undefined} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" /><path d="M3 21v-5h5" />
      <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" /><path d="M21 3v5h-5" />
    </svg>
  );
}

/**
 * Botao Atualizar: busca no Garmin na hora (sem esperar as 3 h do Controle).
 * `onImported` roda quando entrou treino novo, para a tela recarregar a lista.
 */
export function GarminRefreshButton({ variant = "text", onImported }: {
  variant?: "text" | "icon";
  onImported: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), aviso.tone === "erro" ? 10_000 : 6_000);
    return () => clearTimeout(t);
  }, [aviso]);

  async function atualizar() {
    if (busy) return;
    setBusy(true);
    setAviso(null);
    try {
      const r = await syncGarminNow();
      setAviso({ tone: r.failed || r.stopped ? "erro" : "ok", text: garminSyncText(r) });
      if (r.imported) onImported();
    } catch (e) {
      setAviso({ tone: "erro", text: e instanceof Error ? e.message : "Não consegui buscar no Garmin" });
    } finally {
      setBusy(false);
    }
  }

  const label = busy ? "Buscando no Garmin…" : "Atualizar: buscar treino novo no Garmin";

  return (
    <>
      {variant === "icon" ? (
        <button type="button" className="od-icon-btn" onClick={atualizar} disabled={busy} aria-label={label} title={label} aria-busy={busy}>
          <RefreshIcon spinning={busy} />
        </button>
      ) : (
        <button type="button" className="od-btn od-btn-ghost" onClick={atualizar} disabled={busy} title={label} aria-busy={busy}>
          <RefreshIcon spinning={busy} />
          {busy ? "Buscando…" : "Atualizar"}
        </button>
      )}

      {aviso && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 sm:bottom-6">
          <button
            type="button"
            onClick={() => setAviso(null)}
            role="status"
            className="od-panel od-panel-glass pointer-events-auto flex max-w-md animate-od-fade-up items-center gap-2.5 !px-4 !py-3 text-left text-sm"
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: aviso.tone === "ok" ? "#00FF66" : "#FFC145" }} />
            <span className="whitespace-pre-line text-white">{aviso.text}</span>
          </button>
        </div>
      )}
    </>
  );
}
