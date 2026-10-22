"use client";

import { useState, type ReactNode } from "react";

import { editWorkout, type PlannedWorkout, type WorkoutEdit } from "@/lib/api";
import { coachErrorMessage } from "@/lib/coachErrors";

const INK = "#14171A";
const MUTED = "#5A625A";

/** Campo claro (o calendário é claro); 16 px no celular para o iPhone não dar zoom ao tocar. */
const FIELD = "w-full rounded-lg bg-white px-2.5 py-2 text-base outline-none focus:ring-2 focus:ring-[#0A8A43]/40 sm:text-[0.82rem]";
const FIELD_STYLE = { color: INK, boxShadow: "inset 0 0 0 1px #D3D9D1" };

const TIPOS = ["rodagem leve", "regenerativo", "longão", "progressivo", "limiar", "intervalado", "fartlek", "ritmo de prova"];

const SPORTS: { value: NonNullable<WorkoutEdit["sport"]>; label: string }[] = [
  { value: "run", label: "Corrida" },
  { value: "trail_run", label: "Trilha" },
  { value: "treadmill", label: "Esteira" },
];

/** "6,5" → 6500 m; vazio → null; texto inválido → undefined (erro). */
function parseKm(text: string): number | null | undefined {
  const t = text.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= 200 ? Math.round(n * 1000) : undefined;
}

/** "40" ou "1:05" (h:mm) → segundos; vazio → null; inválido → undefined. */
function parseMin(text: string): number | null | undefined {
  const t = text.trim().replace(",", ".");
  if (!t) return null;
  const hm = /^(\d+):(\d{1,2})$/.exec(t);
  const min = hm ? Number(hm[1]) * 60 + Number(hm[2]) : Number(t);
  return Number.isFinite(min) && min >= 0 && min <= 1440 ? Math.round(min * 60) : undefined;
}

const kmField = (m: number | null) => (m ? String(Number((m / 1000).toFixed(2))).replace(".", ",") : "");
const minField = (s: number | null) => (s ? String(Math.round(s / 60)) : "");

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? "col-span-2" : ""}`}>
      <span className="mb-1 block text-[0.62rem] font-bold uppercase tracking-wider" style={{ color: MUTED }}>{label}</span>
      {children}
    </label>
  );
}

/**
 * Editar o treino planejado no dia do calendário: tipo, título, esporte, distância, duração,
 * intensidade, ritmo, FC, descrição e observações. Só manda o que mudou.
 */
export function WorkoutEditForm({ w, onSaved, onCancel }: {
  w: PlannedWorkout;
  onSaved: (updated: PlannedWorkout) => void;
  onCancel: () => void;
}) {
  const sportEditable = SPORTS.some((s) => s.value === w.sport);
  const [f, setF] = useState({
    tipo: w.targets?.tipo ?? "",
    title: w.title,
    sport: w.sport,
    km: kmField(w.target_distance_m),
    min: minField(w.target_duration_s),
    intensity: w.target_intensity ?? "",
    ritmo: w.targets?.ritmo ?? "",
    zona_fc: w.targets?.zona_fc ?? "",
    objective: w.objective ?? w.description ?? "",
    observacoes: w.targets?.observacoes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function save() {
    const km = parseKm(f.km);
    const sec = parseMin(f.min);
    if (km === undefined) return setError("Distância inválida. Use km, ex.: 6,5.");
    if (sec === undefined) return setError("Duração inválida. Use minutos (40) ou h:mm (1:05).");
    if (!f.title.trim()) return setError("O treino precisa de um título.");
    const text = (v: string) => v.trim() || null;
    const next: WorkoutEdit = {
      title: f.title.trim(),
      tipo: text(f.tipo),
      target_distance_m: km,
      target_duration_s: sec,
      target_intensity: (f.intensity || null) as WorkoutEdit["target_intensity"],
      ritmo: text(f.ritmo),
      zona_fc: text(f.zona_fc),
      objective: text(f.objective),
      observacoes: text(f.observacoes),
      ...(sportEditable ? { sport: f.sport as WorkoutEdit["sport"] } : {}),
    };
    // só o que mudou: o resto do treino (passo a passo, motivo da Duni) fica como está
    const before: WorkoutEdit = {
      title: w.title, tipo: w.targets?.tipo ?? null, target_distance_m: w.target_distance_m ? Math.round(w.target_distance_m) : null,
      target_duration_s: w.target_duration_s, target_intensity: (w.target_intensity ?? null) as WorkoutEdit["target_intensity"],
      ritmo: w.targets?.ritmo ?? null, zona_fc: w.targets?.zona_fc ?? null, objective: w.objective ?? w.description ?? null,
      observacoes: w.targets?.observacoes ?? null, ...(sportEditable ? { sport: w.sport as WorkoutEdit["sport"] } : {}),
    };
    const changed = Object.fromEntries(
      Object.entries(next).filter(([k, v]) => v !== before[k as keyof WorkoutEdit]),
    ) as WorkoutEdit;
    if (Object.keys(changed).length === 0) return onCancel();
    setSaving(true);
    setError(null);
    try {
      onSaved(await editWorkout(w.id, changed));
    } catch (e) {
      setError(coachErrorMessage(e).detail);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => { e.preventDefault(); save(); }}
      aria-label={`Editar ${w.title}`}
    >
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Tipo">
          <input value={f.tipo} onChange={set("tipo")} list="tipos-treino" className={FIELD} style={FIELD_STYLE} placeholder="rodagem leve" />
          <datalist id="tipos-treino">{TIPOS.map((t) => <option key={t} value={t} />)}</datalist>
        </Field>
        {sportEditable ? (
          <Field label="Onde">
            <select value={f.sport} onChange={set("sport")} className={FIELD} style={FIELD_STYLE}>
              {SPORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
        ) : <span />}
        <Field label="Título" wide>
          <input value={f.title} onChange={set("title")} maxLength={200} className={FIELD} style={FIELD_STYLE} required />
        </Field>
        <Field label="Distância (km)">
          <input value={f.km} onChange={set("km")} inputMode="decimal" className={FIELD} style={FIELD_STYLE} placeholder="6,5" />
        </Field>
        <Field label="Duração (min)">
          <input value={f.min} onChange={set("min")} inputMode="numeric" className={FIELD} style={FIELD_STYLE} placeholder="40" />
        </Field>
        <Field label="Intensidade">
          <select value={f.intensity} onChange={set("intensity")} className={FIELD} style={FIELD_STYLE}>
            <option value="">—</option>
            <option value="leve">Leve</option>
            <option value="moderado">Moderado</option>
            <option value="forte">Forte</option>
          </select>
        </Field>
        <Field label="Ritmo">
          <input value={f.ritmo} onChange={set("ritmo")} maxLength={60} className={FIELD} style={FIELD_STYLE} placeholder="6:10/km" />
        </Field>
        <Field label="FC" wide>
          <input value={f.zona_fc} onChange={set("zona_fc")} maxLength={80} className={FIELD} style={FIELD_STYLE} placeholder="Zona 2 (128-150 bpm)" />
        </Field>
        <Field label="Descrição" wide>
          <textarea value={f.objective} onChange={set("objective")} maxLength={500} rows={2} className={FIELD} style={FIELD_STYLE} />
        </Field>
        <Field label="Observações" wide>
          <textarea value={f.observacoes} onChange={set("observacoes")} maxLength={500} rows={2} className={FIELD} style={FIELD_STYLE} />
        </Field>
      </div>
      {error && <p role="alert" className="text-[0.75rem] font-semibold" style={{ color: "#A8261F" }}>{error}</p>}
      <p className="text-[0.68rem] leading-snug" style={{ color: MUTED }}>
        Se mudar a distância ou a duração, o passo a passo da Duni vira um bloco só com o novo volume.
      </p>
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-brand-accent py-2.5 text-[0.82rem] font-bold text-black transition-[filter] hover:brightness-95 disabled:opacity-60">
          {saving ? "Salvando…" : "Salvar"}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className="od-btn od-btn-ghost od-btn-sm !rounded-xl !px-4">Cancelar</button>
      </div>
    </form>
  );
}
