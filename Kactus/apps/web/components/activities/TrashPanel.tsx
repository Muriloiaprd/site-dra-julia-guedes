"use client";

import { useState } from "react";

import { SportTile } from "@/components/SportIcon";
import { Panel } from "@/components/ui/primitives";
import { emptyTrash, restoreActivity, type TrashItem } from "@/lib/api";
import { formatDistance, formatDuration, sportLabel } from "@/lib/utils";

function when(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Lixeira das atividades: cada uma pode voltar (Restaurar) ou tudo sai de vez
 * (Limpar lixeira, com confirmacao na propria tela — o confirm() nativo nao
 * combina com o resto do app).
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

  return (
    <Panel className="mb-4 space-y-4" aria-label="Lixeira">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="od-label">Lixeira</h2>
          <p className="mt-1 text-xs text-brand-muted">
            Atividades excluídas. Restaurar devolve o treino e recalcula carga e recordes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {items.length > 0 && !confirming && (
            <button type="button" onClick={() => setConfirming(true)} disabled={busy !== null} className="od-btn od-btn-ghost od-btn-sm !text-brand-danger">
              Limpar lixeira
            </button>
          )}
          <button type="button" onClick={onClose} className="od-btn od-btn-ghost od-btn-sm">Fechar</button>
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
    </Panel>
  );
}
