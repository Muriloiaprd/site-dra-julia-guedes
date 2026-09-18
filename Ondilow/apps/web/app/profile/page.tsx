"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Alert, PageContainer, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";
import {
  deleteAllActivities,
  fetchMe,
  fetchProfile,
  getToken,
  updateProfile,
  type Profile,
} from "@/lib/api";

const DELETE_CONFIRM_WORD = "EXCLUIR";

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

/** Igual ao avatar, mas sem recorte quadrado (mantém proporção) e em PNG,
 * pra preservar transparência — usada nos cards/stories compartilháveis. */
function resizeLogoToPngDataUrl(file: File, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("canvas indisponível")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("falha ao carregar imagem")); };
    img.src = objectUrl;
  });
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const [form, setForm] = useState<Profile>({
    full_name: null,
    avatar_data_url: null,
    logo_data_url: null,
    max_hr: null,
    ftp_watts: null,
    css_pace_s_per_100m: null,
    weight_kg: null,
    resting_hr: null,
  });
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  const [showDanger, setShowDanger] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const [clearResult, setClearResult] = useState<number | null>(null);

  const load = useCallback(() => {
    setAuthError(false);
    Promise.all([fetchMe(), fetchProfile()]).then(([user, profile]) => {
      if (!user) {
        if (getToken()) { setAuthError(true); return; }
        router.push("/login");
        return;
      }
      setEmail(user.email);
      setForm(profile);
      setLoading(false);
    }).catch(() => {
      if (getToken()) { setAuthError(true); return; }
      router.push("/login");
    });
  }, [router]);

  useEffect(() => { load(); }, [load]);

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

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLogoError(null);
    if (file.type !== "image/png") {
      setLogoError("Selecione um arquivo PNG (com fundo transparente, se quiser)");
      return;
    }
    try {
      const dataUrl = await resizeLogoToPngDataUrl(file, 512);
      if (dataUrl.length > 700 * 1024) {
        setLogoError("Imagem muito grande mesmo após redimensionar — tente um PNG mais simples");
        return;
      }
      setForm((f) => ({ ...f, logo_data_url: dataUrl }));
    } catch {
      setLogoError("Não foi possível processar essa imagem");
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

  async function handleClearActivities() {
    if (confirmText !== DELETE_CONFIRM_WORD) return;
    setClearing(true);
    setClearError(null);
    try {
      const { deleted } = await deleteAllActivities();
      setClearResult(deleted);
      setShowDanger(false);
      setConfirmText("");
    } catch (err: unknown) {
      setClearError(err instanceof Error ? err.message : "Erro ao limpar atividades");
    } finally {
      setClearing(false);
    }
  }

  if (authError) {
    return (
      <PageContainer width="medium">
        <Alert tone="danger">
          Não foi possível carregar seu perfil agora.
          <button type="button" onClick={load} className="od-btn od-btn-ghost ml-3 !py-1 !px-3">
            Tentar de novo
          </button>
        </Alert>
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <PageContainer width="medium">
        <Skeleton className="mb-6 h-12 w-64" />
        <div className="grid gap-4 lg:grid-cols-12">
          <Skeleton className="h-80 lg:col-span-4" />
          <Skeleton className="h-80 lg:col-span-8" />
        </div>
      </PageContainer>
    );
  }

  // mesmas faixas de metrics/basic.py::default_hr_zones (Z1 <60%, ..., Z5 >90% da FC max)
  const zones = form.max_hr
    ? [0, 0.6, 0.7, 0.8, 0.9].map((lo, i, arr) => {
        const from = Math.round(form.max_hr! * lo);
        const to = Math.round(form.max_hr! * (arr[i + 1] ?? 1));
        return { z: i + 1, range: i === 0 ? `<${to}` : i === 4 ? `>${from}` : `${from}–${to}` };
      })
    : null;
  const initial = (form.full_name ?? email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <PageContainer width="medium">
      <PageHeader
        kicker="Atleta"
        title="Perfil do atleta"
        description="Seus dados fisiológicos alimentam zonas, carga (TSS), previsões e o Treinador IA."
      />

      <form onSubmit={handleSave} className="grid gap-4 lg:grid-cols-12">
        {/* identidade */}
        <Panel variant="hero" className="lg:col-span-4">
          <div className="relative flex flex-col items-center text-center">
            <label className="group relative block h-28 w-28 shrink-0 cursor-pointer rounded-full" style={{ boxShadow: "0 0 0 3px #0A0A0A, 0 0 0 4px rgba(0,255,102,0.45), 0 0 40px -8px rgba(0,255,102,0.55)" }}>
              <span className="block h-full w-full overflow-hidden rounded-full bg-black/40">
                {form.avatar_data_url ? (
                  <img src={form.avatar_data_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center font-display text-4xl font-extrabold text-black" style={{ background: "linear-gradient(135deg, #00FF66, #C6FF00)" }}>
                    {initial}
                  </span>
                )}
              </span>
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/65 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                Trocar foto
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </label>
            <h2 className="mt-4 font-display text-xl font-extrabold">{form.full_name || email?.split("@")[0] || "Atleta"}</h2>
            {email && <p className="text-xs text-brand-muted">{email}</p>}
            <p className="mt-2 text-[0.7rem] text-brand-textTertiary">Clique na foto para escolher uma imagem.</p>
            {avatarError && <p className="mt-1 text-xs text-brand-danger">{avatarError}</p>}
          </div>

          <div className="relative mt-6 grid grid-cols-2 gap-2">
            {[
              { k: "FC repouso", v: form.resting_hr, u: "bpm" },
              { k: "FC máxima", v: form.max_hr, u: "bpm" },
              { k: "FTP", v: form.ftp_watts, u: "W" },
              { k: "Peso", v: form.weight_kg, u: "kg" },
            ].map((m) => (
              <div key={m.k} className="od-tile p-3" style={{ background: "rgba(8,11,9,0.6)" }}>
                <div className="od-metric-label">{m.k}</div>
                <div className="od-num mt-1 text-lg" style={{ color: m.v == null ? "#7C7C7C" : "#fff" }}>
                  {m.v ?? "—"}{m.v != null && <span className="ml-0.5 font-sans text-[0.65rem] text-brand-muted">{m.u}</span>}
                </div>
              </div>
            ))}
          </div>

          {zones && (
            <div className="relative mt-4">
              <div className="od-metric-label mb-2">Zonas de FC (% da máxima)</div>
              <div className="flex h-2 overflow-hidden rounded-full">
                {["#00BFFF", "#00FF66", "#C6FF00", "#FFC145", "#F85149"].map((c) => <div key={c} className="flex-1" style={{ background: c, opacity: 0.8 }} />)}
              </div>
              <div className="mt-1.5 grid grid-cols-5 text-center text-[0.6rem] tabular-nums text-brand-muted">
                {zones.map((z) => <span key={z.z}>Z{z.z}<br />{z.range}</span>)}
              </div>
            </div>
          )}
        </Panel>

        <div className="space-y-4 lg:col-span-8">
          <Panel>
            <h2 className="od-label mb-5">Dados pessoais</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome completo">
                <input
                  type="text"
                  value={form.full_name ?? ""}
                  onChange={(e) => set("full_name", e.target.value)}
                  className="od-input"
                  placeholder="Seu nome"
                />
              </Field>
              <Field label="Peso (kg)">
                <input
                  type="number"
                  step="0.1"
                  value={form.weight_kg ?? ""}
                  onChange={(e) => set("weight_kg", e.target.value)}
                  className="od-input"
                  placeholder="70.5"
                />
              </Field>
            </div>
          </Panel>

          <Panel>
            <h2 className="od-label mb-2">Logo para compartilhamento</h2>
            <p className="mb-5 text-sm text-brand-muted">
              Aparece nos cards e stories que você exporta das suas atividades. Envie um PNG — de
              preferência com fundo transparente.
            </p>
            <div className="flex items-center gap-4">
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-tile"
                style={{
                  backgroundImage:
                    "repeating-conic-gradient(#2a2a2a 0% 25%, #1a1a1a 0% 50%)",
                  backgroundSize: "12px 12px",
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
                }}
              >
                {form.logo_data_url ? (
                  <img src={form.logo_data_url} alt="Sua logo" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="px-2 text-center text-[0.6rem] text-brand-textTertiary">Sem logo</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className="od-btn od-btn-secondary od-btn-sm w-fit cursor-pointer">
                  {form.logo_data_url ? "Trocar logo" : "Enviar logo"}
                  <input type="file" accept="image/png" className="hidden" onChange={handleLogoChange} />
                </label>
                {form.logo_data_url && (
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, logo_data_url: null }))}
                    className="od-btn od-btn-ghost od-btn-sm w-fit"
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>
            {logoError && <p className="mt-2 text-xs text-brand-danger">{logoError}</p>}
          </Panel>

          <Panel>
            <h2 className="od-label mb-2">Zonas de treino</h2>
            <p className="mb-5 text-sm text-brand-muted">
              FC máxima é usada para calcular zonas e distribuição de esforço nas atividades.
              FTP e CSS habilitam métricas de carga para ciclismo e natação.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="FC Repouso (bpm)">
                <input
                  type="number"
                  value={form.resting_hr ?? ""}
                  onChange={(e) => set("resting_hr", e.target.value)}
                  className="od-input"
                  placeholder="55"
                />
              </Field>
              <Field label="FC Máxima (bpm)">
                <input
                  type="number"
                  value={form.max_hr ?? ""}
                  onChange={(e) => set("max_hr", e.target.value)}
                  className="od-input"
                  placeholder="190"
                />
              </Field>
              <Field label="FTP – Ciclismo (W)">
                <input
                  type="number"
                  value={form.ftp_watts ?? ""}
                  onChange={(e) => set("ftp_watts", e.target.value)}
                  className="od-input"
                  placeholder="250"
                />
              </Field>
              <Field label="CSS – Natação (s/100m)">
                <input
                  type="number"
                  step="0.1"
                  value={form.css_pace_s_per_100m ?? ""}
                  onChange={(e) => set("css_pace_s_per_100m", e.target.value)}
                  className="od-input"
                  placeholder="95"
                />
              </Field>
            </div>
          </Panel>

          {error && <Alert tone="danger">{error}</Alert>}

          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" disabled={saving} className="od-btn od-btn-primary !px-6">
              {saving ? "Salvando…" : "Salvar perfil"}
            </button>
            {saved && <span className="animate-od-fade-up text-sm font-medium text-brand-success">✓ Salvo com sucesso!</span>}
          </div>
        </div>
      </form>

      <section className="mt-8 rounded-card p-5 sm:p-6" style={{ background: "rgba(248,81,73,0.035)", boxShadow: "inset 0 0 0 1px rgba(248,81,73,0.25)" }}>
        <h2 className="mb-2 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-brand-danger">Zona de perigo</h2>
        <p className="mb-4 max-w-2xl text-sm text-brand-muted">
          Apaga permanentemente todas as suas atividades — incluindo rotas GPS, recordes pessoais,
          métricas de carga (CTL/ATL/TSB) e o histórico de aderência ao plano do treinador. Perfil,
          login e o histórico de chat com o treinador não são afetados. <strong className="text-brand-danger">Não pode ser desfeito.</strong>
        </p>

        {clearResult !== null && (
          <p className="mb-4 text-sm text-brand-success">
            {clearResult} atividade(s) apagada(s) com sucesso.
          </p>
        )}
        {clearError && (
          <p className="mb-4 text-sm text-brand-danger">{clearError}</p>
        )}

        {!showDanger ? (
          <button
            type="button"
            onClick={() => { setShowDanger(true); setClearResult(null); setClearError(null); }}
            className="od-btn od-btn-danger"
          >
            Limpar todas as atividades
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-brand-text">
              Pra confirmar, digite <strong>{DELETE_CONFIRM_WORD}</strong> abaixo:
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={DELETE_CONFIRM_WORD}
                className="od-input max-w-[200px]"
                autoFocus
              />
              <button
                type="button"
                onClick={handleClearActivities}
                disabled={confirmText !== DELETE_CONFIRM_WORD || clearing}
                className="od-btn od-btn-danger-solid"
              >
                {clearing ? "Apagando…" : "Apagar tudo, sem volta"}
              </button>
              <button
                type="button"
                onClick={() => { setShowDanger(false); setConfirmText(""); }}
                className="od-btn od-btn-ghost"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>
    </PageContainer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="od-field-label">{label}</span>
      {children}
    </label>
  );
}
