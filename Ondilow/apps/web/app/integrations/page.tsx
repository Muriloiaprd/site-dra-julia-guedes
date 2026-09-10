"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  fetchGarminStatus,
  fetchMe,
  removeGarminCredentials,
  saveGarminCredentials,
  triggerGarminSync,
  type IntegrationStatus,
  type SyncResult,
} from "@/lib/api";
import { formatDate } from "@/lib/utils";

const STATUS_COLOR: Record<string, string> = {
  success: "#00FF66",
  error: "#f85149",
};
const STATUS_LABEL: Record<string, string> = {
  success: "Sincronizado",
  error: "Erro",
};

export default function IntegrationsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // form de credenciais
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // sync
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncLimit, setSyncLimit] = useState(25);

  useEffect(() => {
    fetchMe().then((u) => {
      if (!u) { router.push("/login"); return; }
    });
  }, [router]);

  useEffect(() => {
    fetchGarminStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const s = await saveGarminCredentials(email, password);
      setStatus(s);
      setSaveMsg("Credenciais salvas com segurança.");
      setEmail("");
      setPassword("");
    } catch (err: unknown) {
      setSaveMsg(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await triggerGarminSync(syncLimit);
      setSyncResult(result);
      const s = await fetchGarminStatus();
      setStatus(s);
    } catch (err: unknown) {
      setSyncResult({ imported: 0, skipped: 0, errors: [err instanceof Error ? err.message : "Erro"] });
    } finally {
      setSyncing(false);
    }
  }

  async function handleRemove() {
    await removeGarminCredentials();
    setStatus(null);
    setSyncResult(null);
    setSaveMsg("Credenciais removidas.");
    setLoading(false);
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-2xl px-6 py-8 space-y-8">
        <h1 className="text-xl font-semibold">Integrações</h1>

        {/* Garmin Connect */}
        <section className="rounded-lg border border-brand-border bg-brand-surface p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#00B7E4]/10 flex items-center justify-center text-xl">
              ⌚
            </div>
            <div>
              <h2 className="font-semibold">Garmin Connect</h2>
              <p className="text-sm text-brand-muted">Sincronize suas atividades automaticamente</p>
            </div>
          </div>

          {/* Status atual */}
          {!loading && status?.has_credentials && (
            <div className="flex items-center justify-between rounded-lg border border-brand-border p-3 text-sm">
              <div>
                <p className="text-brand-muted">Último sync</p>
                <p className="font-medium">
                  {status.last_sync_at ? formatDate(status.last_sync_at) : "Nunca sincronizado"}
                </p>
                {status.last_sync_error && (
                  <p className="text-xs text-brand-danger mt-1">{status.last_sync_error}</p>
                )}
              </div>
              {status.last_sync_status && (
                <span
                  className="rounded-full px-3 py-1 text-xs font-bold text-black"
                  style={{ backgroundColor: STATUS_COLOR[status.last_sync_status] || "#888" }}
                >
                  {STATUS_LABEL[status.last_sync_status] || status.last_sync_status}
                </span>
              )}
            </div>
          )}

          {/* Formulário de credenciais */}
          {!status?.has_credentials ? (
            <form onSubmit={handleSave} className="space-y-4">
              <p className="text-sm text-brand-muted">
                Informe seu email e senha do Garmin Connect. As credenciais são criptografadas com Fernet antes de serem salvas — nunca ficam em texto puro.
              </p>
              <div>
                <label className="block text-xs text-brand-muted mb-1">Email do Garmin Connect</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input w-full"
                  placeholder="seuemail@exemplo.com"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-brand-muted mb-1">Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input w-full"
                  placeholder="••••••••"
                  required
                />
              </div>
              {saveMsg && (
                <p className="text-sm text-brand-success">{saveMsg}</p>
              )}
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-brand-accent px-4 py-2 text-sm font-bold text-black hover:bg-brand-accentHover disabled:opacity-50 transition-colors"
              >
                {saving ? "Salvando…" : "Salvar credenciais"}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-brand-muted">
                Credenciais cadastradas. Clique em Sincronizar para importar suas últimas atividades do Garmin Connect.
              </p>

              {/* Controle de quantas atividades buscar */}
              <div className="flex items-center gap-3">
                <label className="text-xs text-brand-muted whitespace-nowrap">Buscar últimas</label>
                <select
                  value={syncLimit}
                  onChange={(e) => setSyncLimit(Number(e.target.value))}
                  className="input py-1 text-sm"
                >
                  <option value={10}>10 atividades</option>
                  <option value={25}>25 atividades</option>
                  <option value={50}>50 atividades</option>
                  <option value={100}>100 atividades</option>
                </select>
              </div>

              {/* Resultado do sync */}
              {syncResult && (
                <div className={`rounded-lg border p-3 text-sm ${syncResult.errors.length > 0 && syncResult.imported === 0 ? "border-brand-danger/40 bg-brand-danger/10" : "border-brand-success/40 bg-brand-success/10"}`}>
                  <p><strong>{syncResult.imported}</strong> importada(s) · <strong>{syncResult.skipped}</strong> duplicata(s) ignorada(s)</p>
                  {syncResult.errors.length > 0 && (
                    <ul className="mt-2 text-xs text-brand-danger space-y-1">
                      {syncResult.errors.slice(0, 5).map((e, i) => (
                        <li key={i}>• {e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="rounded-xl bg-brand-accent px-4 py-2 text-sm font-bold text-black hover:bg-brand-accentHover disabled:opacity-50 transition-colors"
                >
                  {syncing ? "Sincronizando…" : "Sincronizar agora"}
                </button>
                <button
                  onClick={handleRemove}
                  className="rounded-md border border-brand-danger/40 px-4 py-2 text-sm text-brand-danger hover:bg-brand-danger/10"
                >
                  Remover credenciais
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Info de segurança */}
        <section className="rounded-lg border border-brand-border bg-brand-surface p-5 text-sm text-brand-muted">
          <h3 className="mb-2 font-medium text-brand-text">Segurança</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Credenciais são criptografadas com Fernet (AES-128 CBC + HMAC) antes de salvar</li>
            <li>Nunca ficam em texto puro no banco de dados</li>
            <li>O sync usa a biblioteca <code>garminconnect</code> (não-oficial) — as credenciais são usadas apenas para autenticar no Garmin Connect</li>
            <li>Nenhum dado é enviado para terceiros além do próprio Garmin</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
