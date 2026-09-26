"use client";

import { useState } from "react";

import { Alert, Panel } from "@/components/ui/primitives";
import { putCheckin, type ActivityDetail, type CheckinInput, type Feeling } from "@/lib/api";

/** PSE (escala de Borg CR10) explicada na pratica, sem jargao. */
export const RPE_SCALE: { label: string; hint: string }[] = [
  { label: "Repouso", hint: "Parado, nenhum esforço." },
  { label: "Muito, muito leve", hint: "Quase sem esforço." },
  { label: "Muito leve", hint: "Passeio tranquilo." },
  { label: "Leve", hint: "Dá para conversar sem perder o fôlego." },
  { label: "Leve a moderado", hint: "Conversa fácil, respiração um pouco mais funda." },
  { label: "Moderado", hint: "Ainda conversa, mas em frases curtas." },
  { label: "Um pouco forte", hint: "Falar já cansa; você prefere ficar quieto." },
  { label: "Forte", hint: "Só algumas palavras por vez." },
  { label: "Muito forte", hint: "Mal consegue falar; ritmo difícil de manter." },
  { label: "Quase máximo", hint: "Aguentaria só mais um pouquinho." },
  { label: "Máximo", hint: "Tudo o que tinha. Não dava para ir mais forte." },
];

const FEELINGS: { value: Feeling; label: string }[] = [
  { value: "otimo", label: "Ótimo" },
  { value: "bem", label: "Bem" },
  { value: "normal", label: "Normal" },
  { value: "cansado", label: "Cansado" },
  { value: "pernas_pesadas", label: "Pernas pesadas" },
  { value: "sem_energia", label: "Sem energia" },
];

const PAIN_SPOTS = ["Pé", "Tornozelo", "Canela", "Panturrilha", "Joelho", "Posterior da coxa", "Frente da coxa", "Quadril", "Lombar"];

/** Verde (leve) → vermelho (maximo), igual para PSE e dor. */
function levelColor(n: number): string {
  if (n <= 3) return "#00FF66";
  if (n <= 5) return "#C6FF00";
  if (n <= 6) return "#FFC145";
  if (n <= 8) return "#FF8A3D";
  return "#f85149";
}

function feelingLabel(f: Feeling | null): string | null {
  return FEELINGS.find((x) => x.value === f)?.label ?? null;
}

function toForm(a: ActivityDetail): CheckinInput {
  return {
    rpe: a.rpe,
    pain_level: a.pain_level,
    pain_location: a.pain_location,
    feeling: a.feeling,
    notes: a.checkin_notes,
  };
}

function LevelPicker({
  value, onChange, label, zeroLabel,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  label: string;
  zeroLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-6 gap-1.5 sm:grid-cols-11">
      {Array.from({ length: 11 }, (_, n) => {
        const active = value === n;
        const c = levelColor(n);
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={n === 0 && zeroLabel ? `${n} (${zeroLabel})` : `${n} de 10`}
            onClick={() => onChange(active ? null : n)}
            className="od-num rounded-[10px] py-2 text-sm transition-all duration-150"
            style={{
              color: active ? "#0A0A0A" : c,
              background: active ? c : `${c}12`,
              boxShadow: active ? `0 0 14px -4px ${c}` : `inset 0 0 0 1px ${c}33`,
              fontWeight: active ? 800 : 600,
            }}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

export function CheckinPanel({ activity, onSaved }: { activity: ActivityDetail; onSaved: (a: ActivityDetail) => void }) {
  const hasCheckin = activity.checkin_at != null;
  const [editing, setEditing] = useState(!hasCheckin);
  const [form, setForm] = useState<CheckinInput>(() => toForm(activity));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof CheckinInput>(k: K, v: CheckinInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function save(data: CheckinInput) {
    setSaving(true);
    setError(null);
    try {
      const updated = await putCheckin(activity.id, data);
      onSaved(updated);
      setForm(toForm(updated));
      setEditing(updated.checkin_at == null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const empty: CheckinInput = { rpe: null, pain_level: null, pain_location: null, feeling: null, notes: null };
  const rpeInfo = form.rpe != null ? RPE_SCALE[form.rpe] : null;
  const hurts = (form.pain_level ?? 0) > 0;

  return (
    <div id="checkin" className="scroll-mt-6">
      <Panel>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="od-label">Como foi o treino?</h2>
            <p className="mt-1 text-xs text-brand-muted">
              Opcional. O relógio não sabe como você se sentiu — isso ajuda a Duni a separar cansaço de verdade de um dia ruim.
            </p>
          </div>
          {hasCheckin && !editing && (
            <button type="button" onClick={() => setEditing(true)} className="od-btn od-btn-ghost od-btn-sm">Editar</button>
          )}
        </div>

        {error && <div className="mb-3"><Alert title="Não consegui salvar">{error}</Alert></div>}

        {!editing ? (
          <CheckinSummary activity={activity} />
        ) : (
          <div className="space-y-5">
            {/* PSE */}
            <fieldset>
              <legend className="od-metric-label mb-2">Esforço percebido (PSE) · 0 a 10</legend>
              <LevelPicker value={form.rpe} onChange={(v) => set("rpe", v)} label="Esforço percebido" />
              <p className="mt-2 min-h-[1.25rem] text-xs text-brand-textSecondary" aria-live="polite">
                {rpeInfo ? (
                  <><strong style={{ color: levelColor(form.rpe!) }}>{form.rpe} · {rpeInfo.label}.</strong> {rpeInfo.hint}</>
                ) : (
                  "Toque no número que representa o quanto o treino pareceu difícil no geral."
                )}
              </p>
            </fieldset>

            {/* Sensacao */}
            <fieldset>
              <legend className="od-metric-label mb-2">Como o corpo respondeu</legend>
              <div className="flex flex-wrap gap-2">
                {FEELINGS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={form.feeling === f.value}
                    onClick={() => set("feeling", form.feeling === f.value ? null : f.value)}
                    className={`od-chip ${form.feeling === f.value ? "is-active" : ""}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Dor */}
            <fieldset>
              <legend className="od-metric-label mb-2">Dor ou desconforto · 0 = nenhum</legend>
              <LevelPicker value={form.pain_level} onChange={(v) => set("pain_level", v)} label="Nível de dor" zeroLabel="sem dor" />
              {hurts && (
                <div className="mt-3 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {PAIN_SPOTS.map((spot) => (
                      <button
                        key={spot}
                        type="button"
                        aria-pressed={form.pain_location === spot}
                        onClick={() => set("pain_location", form.pain_location === spot ? null : spot)}
                        className={`od-chip !py-1 !text-[0.72rem] ${form.pain_location === spot ? "is-active" : ""}`}
                      >
                        {spot}
                      </button>
                    ))}
                  </div>
                  <input
                    value={form.pain_location ?? ""}
                    onChange={(e) => set("pain_location", e.target.value)}
                    maxLength={100}
                    placeholder="Onde? (ex.: joelho direito, por fora)"
                    className="od-input od-input-sm max-w-md"
                    aria-label="Local da dor"
                  />
                  {(form.pain_level ?? 0) >= 5 && (
                    <p className="text-xs text-brand-warning">
                      Dor forte, que piora durante a corrida ou que muda seu jeito de correr: vale procurar um fisioterapeuta ou médico.
                    </p>
                  )}
                </div>
              )}
            </fieldset>

            {/* Notas */}
            <div>
              <label htmlFor="checkin-notes" className="od-metric-label mb-2 block">Observações</label>
              <textarea
                id="checkin-notes"
                value={form.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
                maxLength={2000}
                rows={2}
                placeholder="Calor, dormiu mal, tênis novo, ritmo travou no km 6…"
                className="od-input resize-y text-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => save(form)} disabled={saving} className="od-btn od-btn-primary od-btn-sm">
                {saving ? "Salvando…" : "Salvar check-in"}
              </button>
              {hasCheckin && (
                <>
                  <button type="button" onClick={() => { setForm(toForm(activity)); setEditing(false); }} disabled={saving} className="od-btn od-btn-ghost od-btn-sm">
                    Cancelar
                  </button>
                  <button type="button" onClick={() => save(empty)} disabled={saving} className="od-btn od-btn-ghost od-btn-sm !text-brand-danger">
                    Apagar check-in
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

function CheckinSummary({ activity: a }: { activity: ActivityDetail }) {
  const items: { k: string; v: string; sub?: string; color?: string }[] = [];
  if (a.rpe != null) items.push({ k: "Esforço (PSE)", v: `${a.rpe}/10`, sub: RPE_SCALE[a.rpe].label, color: levelColor(a.rpe) });
  if (a.srpe != null) items.push({ k: "Carga interna", v: `${Math.round(a.srpe)}`, sub: "PSE × minutos" });
  const feeling = feelingLabel(a.feeling);
  if (feeling) items.push({ k: "Sensação", v: feeling });
  if (a.pain_level != null) {
    items.push(a.pain_level === 0
      ? { k: "Dor", v: "Nenhuma", color: "#00FF66" }
      : { k: "Dor", v: `${a.pain_level}/10`, sub: a.pain_location ?? undefined, color: levelColor(a.pain_level) });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((it) => (
          <div key={it.k} className="od-tile px-3 py-2.5">
            <div className="od-metric-label">{it.k}</div>
            <div className="od-num mt-1 text-base" style={it.color ? { color: it.color } : undefined}>{it.v}</div>
            {it.sub && <div className="mt-0.5 truncate text-[0.7rem] text-brand-muted">{it.sub}</div>}
          </div>
        ))}
      </div>
      {a.checkin_notes && <p className="whitespace-pre-wrap text-sm text-brand-textSecondary">“{a.checkin_notes}”</p>}
    </div>
  );
}
