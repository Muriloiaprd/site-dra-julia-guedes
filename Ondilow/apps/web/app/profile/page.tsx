"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  fetchMe,
  fetchProfile,
  updateProfile,
  type Profile,
} from "@/lib/api";

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<Profile>({
    full_name: null,
    max_hr: null,
    ftp_watts: null,
    css_pace_s_per_100m: null,
    weight_kg: null,
    resting_hr: null,
  });

  useEffect(() => {
    Promise.all([fetchMe(), fetchProfile()]).then(([user, profile]) => {
      if (!user) { router.push("/login"); return; }
      setForm(profile);
      setLoading(false);
    }).catch(() => router.push("/login"));
  }, [router]);

  function set(field: keyof Profile, raw: string) {
    const num = raw === "" ? null : Number(raw);
    if (field === "full_name") {
      setForm((f) => ({ ...f, full_name: raw || null }));
    } else {
      setForm((f) => ({ ...f, [field]: num }));
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateProfile(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center text-brand-muted">Carregando…</main>;
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="text-xl font-semibold mb-6">Perfil do Atleta</h1>

        <form onSubmit={handleSave} className="space-y-6">
          <section className="rounded-lg border border-brand-border bg-brand-surface p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-brand-muted">Dados Pessoais</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome completo">
                <input
                  type="text"
                  value={form.full_name ?? ""}
                  onChange={(e) => set("full_name", e.target.value)}
                  className="input"
                  placeholder="Seu nome"
                />
              </Field>
              <Field label="Peso (kg)">
                <input
                  type="number"
                  step="0.1"
                  value={form.weight_kg ?? ""}
                  onChange={(e) => set("weight_kg", e.target.value)}
                  className="input"
                  placeholder="70.5"
                />
              </Field>
            </div>
          </section>

          <section className="rounded-lg border border-brand-border bg-brand-surface p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-brand-muted">Zonas de Treino</h2>
            <p className="mb-4 text-sm text-brand-muted">
              FC máxima é usada para calcular zonas e distribuição de esforço nas atividades.
              FTP e CSS habilitam métricas de carga para ciclismo e natação.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="FC Repouso (bpm)">
                <input
                  type="number"
                  value={form.resting_hr ?? ""}
                  onChange={(e) => set("resting_hr", e.target.value)}
                  className="input"
                  placeholder="55"
                />
              </Field>
              <Field label="FC Máxima (bpm)">
                <input
                  type="number"
                  value={form.max_hr ?? ""}
                  onChange={(e) => set("max_hr", e.target.value)}
                  className="input"
                  placeholder="190"
                />
              </Field>
              <Field label="FTP – Ciclismo (W)">
                <input
                  type="number"
                  value={form.ftp_watts ?? ""}
                  onChange={(e) => set("ftp_watts", e.target.value)}
                  className="input"
                  placeholder="250"
                />
              </Field>
              <Field label="CSS – Natação (s/100m)">
                <input
                  type="number"
                  step="0.1"
                  value={form.css_pace_s_per_100m ?? ""}
                  onChange={(e) => set("css_pace_s_per_100m", e.target.value)}
                  className="input"
                  placeholder="95"
                />
              </Field>
            </div>
          </section>

          {error && (
            <div className="rounded-lg border border-brand-danger/40 bg-brand-danger/10 p-3 text-sm text-brand-danger">
              {error}
            </div>
          )}

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-brand-accent px-6 py-2 text-sm font-bold text-black hover:bg-brand-accentHover disabled:opacity-50 transition-colors"
            >
              {saving ? "Salvando…" : "Salvar Perfil"}
            </button>
            {saved && <span className="text-sm text-brand-success">✓ Salvo com sucesso!</span>}
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-brand-muted">{label}</span>
      {children}
    </label>
  );
}
