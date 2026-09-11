"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  fetchMe,
  fetchProfile,
  updateProfile,
  type Profile,
} from "@/lib/api";

function resizeImageToDataUrl(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("canvas indisponível")); return; }
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("falha ao carregar imagem")); };
    img.src = objectUrl;
  });
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<Profile>({
    full_name: null,
    avatar_data_url: null,
    max_hr: null,
    ftp_watts: null,
    css_pace_s_per_100m: null,
    weight_kg: null,
    resting_hr: null,
  });
  const [avatarError, setAvatarError] = useState<string | null>(null);

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

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarError(null);
    if (!file.type.startsWith("image/")) {
      setAvatarError("Selecione um arquivo de imagem");
      return;
    }
    try {
      const dataUrl = await resizeImageToDataUrl(file, 256);
      setForm((f) => ({ ...f, avatar_data_url: dataUrl }));
    } catch {
      setAvatarError("Não foi possível processar essa imagem");
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
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-brand-muted">Foto de Perfil</h2>
            <div className="flex items-center gap-4">
              <label className="group relative block h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-full border border-brand-border bg-black/30">
                {form.avatar_data_url ? (
                  <img src={form.avatar_data_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-brand-accent">
                    {(form.full_name ?? "?").trim().charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[0.65rem] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                  Trocar
                </span>
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </label>
              <div className="text-sm text-brand-muted">
                <p>Clique na foto para escolher uma imagem.</p>
                {avatarError && <p className="mt-1 text-brand-danger">{avatarError}</p>}
              </div>
            </div>
          </section>

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
