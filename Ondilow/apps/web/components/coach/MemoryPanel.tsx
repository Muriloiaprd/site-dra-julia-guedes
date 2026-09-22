"use client";

import { useState } from "react";

import { Alert, Panel } from "@/components/ui/primitives";
import {
  createMemory,
  deleteMemory,
  fetchMemories,
  updateMemory,
  type AthleteMemory,
  type MemoryKind,
} from "@/lib/api";
import { parseLocalDate } from "@/lib/athlete";

export const MEMORY_KINDS: { value: MemoryKind; label: string; placeholder: string; dated: boolean }[] = [
  { value: "objetivo", label: "Objetivo", placeholder: "Ex.: baixar a meia maratona para 1h45", dated: false },
  { value: "prova", label: "Prova", placeholder: "Ex.: Meia Maratona do Rio", dated: true },
  { value: "lesao", label: "Lesão / dor", placeholder: "Ex.: canelite na perna esquerda, piora em descida", dated: true },
  { value: "disponibilidade", label: "Disponibilidade", placeholder: "Ex.: não treino às quartas; longão só no domingo", dated: false },
  { value: "preferencia", label: "Preferência", placeholder: "Ex.: prefiro treinar de manhã; odeio esteira", dated: false },
  { value: "outro", label: "Outro", placeholder: "Qualquer coisa que a Duni deva saber", dated: false },
];

export function kindLabel(kind: MemoryKind): string {
  return MEMORY_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

/** "30 de nov. · faltam 70 dias" (ou "foi há N dias"). */
export function whenLabel(iso: string): string {
  const d = parseLocalDate(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
  if (days === 0) return `${date} · hoje`;
  return days > 0 ? `${date} · faltam ${days} dia${days === 1 ? "" : "s"}` : `${date} · foi há ${-days} dia${days === -1 ? "" : "s"}`;
}

type Draft = { kind: MemoryKind; content: string; event_date: string };
const EMPTY: Draft = { kind: "objetivo", content: "", event_date: "" };

export function MemoryPanel({ memories, onChange }: { memories: AthleteMemory[]; onChange: (m: AthleteMemory[]) => void }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archived, setArchived] = useState<AthleteMemory[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  const refreshArchived = async () => setArchived((await fetchMemories(true)).filter((m) => !m.active));

  function save() {
    if (!draft || !draft.content.trim()) return;
    const dated = MEMORY_KINDS.find((k) => k.value === draft.kind)?.dated;
    const data = { kind: draft.kind, content: draft.content.trim(), event_date: dated && draft.event_date ? draft.event_date : null };
    run(async () => {
      if (editingId) {
        const updated = await updateMemory(editingId, data);
        onChange(memories.map((m) => (m.id === editingId ? updated : m)));
      } else {
        onChange([...memories, await createMemory(data)]);
      }
      setDraft(null);
      setEditingId(null);
    });
  }

  function archive(m: AthleteMemory) {
    run(async () => {
      await updateMemory(m.id, { active: false });
      onChange(memories.filter((x) => x.id !== m.id));
      if (showArchived) await refreshArchived();
    });
  }

  function restore(m: AthleteMemory) {
    run(async () => {
      const updated = await updateMemory(m.id, { active: true });
      setArchived((a) => a.filter((x) => x.id !== m.id));
      onChange([...memories, updated]);
    });
  }

  function remove(m: AthleteMemory) {
    if (!confirm(`Apagar de vez "${m.content}"?`)) return;
    run(async () => {
      await deleteMemory(m.id);
      setArchived((a) => a.filter((x) => x.id !== m.id));
    });
  }

  function toggleArchived() {
    const next = !showArchived;
    setShowArchived(next);
    if (next) run(refreshArchived);
  }

  const kindInfo = draft ? MEMORY_KINDS.find((k) => k.value === draft.kind)! : null;
  const grouped = MEMORY_KINDS.map((k) => ({ ...k, items: memories.filter((m) => m.kind === k.value) })).filter((g) => g.items.length);
  const hasGoal = memories.some((m) => m.kind === "objetivo");

  return (
    <Panel>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="od-label">O que a Duni sabe de você</h2>
          <p className="mt-1 text-xs text-brand-muted">Ela usa isso em toda conversa e em todo plano. Você pode editar ou arquivar quando quiser.</p>
        </div>
        {!draft && (
          <button type="button" onClick={() => { setDraft({ ...EMPTY, kind: hasGoal ? "prova" : "objetivo" }); setEditingId(null); }} className="od-btn od-btn-secondary od-btn-sm">
            + Adicionar
          </button>
        )}
      </div>

      {error && <div className="mb-3"><Alert title="Não consegui salvar">{error}</Alert></div>}

      {!hasGoal && !draft && (
        <p className="mb-3 rounded-xl px-3 py-2 text-xs text-brand-warning" style={{ background: "rgba(255,193,69,0.06)", boxShadow: "inset 0 0 0 1px rgba(255,193,69,0.2)" }}>
          Nenhum objetivo cadastrado. Sem ele, a Duni monta semanas de base aeróbica em vez de treinar para algo específico.
        </p>
      )}

      {draft && kindInfo && (
        <div className="od-tile mb-3 space-y-2.5 p-3">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tipo">
            {MEMORY_KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                role="radio"
                aria-checked={draft.kind === k.value}
                onClick={() => setDraft({ ...draft, kind: k.value })}
                className={`od-chip !py-1 !text-[0.72rem] ${draft.kind === k.value ? "is-active" : ""}`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <input
            value={draft.content}
            onChange={(e) => setDraft({ ...draft, content: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") save(); }}
            maxLength={500}
            placeholder={kindInfo.placeholder}
            className="od-input od-input-sm"
            aria-label="O que a Duni deve lembrar"
            autoFocus
          />
          {kindInfo.dated && (
            <label className="flex items-center gap-2 text-xs text-brand-muted">
              {draft.kind === "prova" ? "Data da prova" : "Desde quando (opcional)"}
              <input type="date" value={draft.event_date} onChange={(e) => setDraft({ ...draft, event_date: e.target.value })} className="od-input od-input-sm !w-auto" />
            </label>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={busy || !draft.content.trim()} className="od-btn od-btn-primary od-btn-sm">
              {busy ? "Salvando…" : editingId ? "Salvar" : "Adicionar"}
            </button>
            <button type="button" onClick={() => { setDraft(null); setEditingId(null); }} disabled={busy} className="od-btn od-btn-ghost od-btn-sm">Cancelar</button>
          </div>
        </div>
      )}

      {memories.length === 0 && !draft ? (
        <p className="py-3 text-center text-sm text-brand-muted">
          Nada ainda. Conte à Duni no chat sobre seu objetivo, provas ou lesões — ela sugere o que guardar.
        </p>
      ) : (
        <div className="space-y-3">
          {grouped.map((g) => (
            <div key={g.value}>
              <div className="od-metric-label mb-1.5">{g.label}</div>
              <ul className="space-y-1.5">
                {g.items.map((m) => (
                  <li key={m.id} className="od-tile group flex items-start gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{m.content}</p>
                      <p className="mt-0.5 text-[0.68rem] text-brand-muted">
                        {m.event_date && <>{whenLabel(m.event_date)} · </>}
                        {m.source === "duni" ? "sugerido pela Duni" : "adicionado por você"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => { setEditingId(m.id); setDraft({ kind: m.kind, content: m.content, event_date: m.event_date ?? "" }); }}
                        className="od-btn od-btn-ghost od-btn-sm !px-2"
                        aria-label={`Editar ${m.content}`}
                      >
                        Editar
                      </button>
                      <button type="button" onClick={() => archive(m)} disabled={busy} className="od-btn od-btn-ghost od-btn-sm !px-2" aria-label={`Arquivar ${m.content}`}>
                        Arquivar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <button type="button" onClick={toggleArchived} className="mt-3 text-[0.72rem] text-brand-muted hover:text-white">
        {showArchived ? "Esconder arquivadas" : "Ver arquivadas"}
      </button>
      {showArchived && (
        archived.length === 0 ? (
          <p className="mt-2 text-xs text-brand-textTertiary">Nenhuma memória arquivada.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {archived.map((m) => (
              <li key={m.id} className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs text-brand-muted" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)" }}>
                <span className="min-w-0 flex-1 truncate">{kindLabel(m.kind)} · {m.content}</span>
                <button type="button" onClick={() => restore(m)} disabled={busy} className="hover:text-white">Reativar</button>
                <button type="button" onClick={() => remove(m)} disabled={busy} className="text-brand-danger hover:underline">Apagar</button>
              </li>
            ))}
          </ul>
        )
      )}
    </Panel>
  );
}
