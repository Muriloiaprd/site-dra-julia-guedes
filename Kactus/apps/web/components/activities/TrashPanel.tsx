"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";

import { SportTile } from "@/components/SportIcon";
import { emptyTrash, restoreActivity, type TrashItem } from "@/lib/api";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { formatDistance, formatDuration, sportLabel } from "@/lib/utils";

function when(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Lixeira das atividades, num popup por cima da lista: cada uma pode voltar
 * (Restaurar) ou tudo sai de vez (Limpar lixeira, com confirmacao dentro do
 * popup — o confirm() nativo nao combina com o resto do app). Fecha no ✕, no
 * Esc ou tocando fora; o foco volta ao botao Lixeira.
 */
export function TrashPanel({
  items, onRestored, onEmptied, onClose,
}: {
  items: TrashItem[];
  onRestored: (item: TrashItem) => void;
  onEmptied: () => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true, onClose);

  async function restore(item: TrashItem) {
    setBusy(item.id);
    setError(null);
    try {
      await restoreActivity(item.id);
      onRestored(item);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não consegui restaurar");
    } finally {
      setBusy(null);
    }
  }

  async function empty() {
    setBusy("all");
    setError(null);
    try {
      await emptyTrash();
      setConfirming(false);
      onEmptied();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não consegui limpar a lixeira");
    } finally {
      setBusy(null);
    }
  }

  // no body: um pai com transform (animação de entrada) prenderia o "fixed" a ele em vez da tela
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lixeira-titulo"
        onClick={(e) => e.stopPropagation()}
        className="od-panel relative max-h-[85vh] w-full animate-od-fade-up space-y-4 overflow-y-auto !rounded-b-none sm:max-h-[80vh] sm:max-w-[600px] sm:!rounded-2xl"
        style={{ background: "#0F110F", boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 30px 80px -20px rgba(0,0,0,0.9)", paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="lixeira-titulo" className="od-label">Lixeira</h2>
          <p className="mt-1 text-xs text-brand-muted">
            Atividades excluídas. Restaurar devolve o treino e recalcula carga e recordes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {items.length > 0 && !confirming && (
            <button type="button" onClick={() => setConfirming(true)} disabled={busy !== null} className="od-btn od-btn-ghost od-btn-sm !text-brand-danger">
              Limpar lixeira
            </button>
          )}
          <button type="button" onClick={onClose} className="od-icon-btn !h-9 !w-9 !rounded-full" aria-label="Fechar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {confirming && (
        <div className="flex flex-col gap-2 rounded-xl px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ background: "rgba(248,81,73,0.06)", boxShadow: "inset 0 0 0 1px rgba(248,81,73,0.3)" }}>
          <p className="text-sm">
            Apagar de vez {items.length} atividade{items.length === 1 ? "" : "s"}, com mapa e voltas?{" "}
            <span className="text-brand-muted">Não dá para desfazer.</span>
          </p>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={empty} disabled={busy !== null} className="od-btn od-btn-sm !px-3" style={{ color: "#fff", background: "#F85149" }}>
              {busy === "all" ? "Apagando…" : "Apagar de vez"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={busy !== null} className="od-btn od-btn-ghost od-btn-sm">Cancelar</button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-brand-danger">{error}</p>}

      {items.length === 0 ? (
        <p className="py-2 text-center text-sm text-brand-muted">A lixeira está vazia.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((a) => (
            <li key={a.id} className="od-tile flex items-center gap-3 px-3 py-2.5">
              <SportTile sport={a.sport} size={30} radius={9} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{a.title || sportLabel(a.sport)}</div>
                <div className="truncate text-[0.72rem] text-brand-muted">
                  {when(a.start_time)}
                  {a.distance_m ? ` · ${formatDistance(a.distance_m)}` : ""}
                  {` · ${formatDuration(a.duration_s)}`}
                  {` · excluída em ${when(a.deleted_at)}`}
                </div>
              </div>
              <button type="button" onClick={() => restore(a)} disabled={busy !== null} className="od-btn od-btn-secondary od-btn-sm shrink-0">
                {busy === a.id ? "Restaurando…" : "Restaurar"}
              </button>
            </li>
          ))}
        </ul>
      )}
      </div>
    </div>,
    document.body,
  );
}
