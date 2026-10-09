"use client";

import { useEffect, useState } from "react";

import { Panel, Skeleton } from "@/components/ui/primitives";
import {
  fetchPushConfig,
  removePushSubscription,
  savePushSubscription,
  sendPushTest,
  updatePushPrefs,
  type PushConfig,
  type PushPrefs,
} from "@/lib/api";
import { currentSubscription, deviceName, pushSupport, subscribe, type PushSupport } from "@/lib/push";

const TIPOS: { key: keyof PushPrefs; nome: string; quando: string }[] = [
  { key: "treino_hoje", nome: "Treino de hoje", quando: "De manhã (a partir das 7h), o treino planejado pela Duni para o dia." },
  { key: "recorde", nome: "Recorde novo", quando: "Quando um treino recente bate um recorde pessoal." },
  { key: "sem_treino", nome: "Dias sem treinar", quando: "No fim da tarde, depois de 3 dias sem nenhum treino." },
];

function msg(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

/** Perfil → Notificações: ativar neste aparelho, escolher os avisos e mandar um teste. */
export function NotificationsPanel() {
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [config, setConfig] = useState<PushConfig | null>(null);
  const [here, setHere] = useState<PushSubscription | null>(null);
  const [perm, setPerm] = useState<NotificationPermission | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = pushSupport();
    setSupport(s);
    if (s === "ok") {
      setPerm(Notification.permission);
      currentSubscription().then(setHere).catch(() => {});
    }
    fetchPushConfig().then(setConfig).catch((e) => setError(msg(e, "Não foi possível carregar as notificações")));
  }, []);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError(null);
    setInfo(null);
    try {
      await fn();
    } catch (e) {
      setError(msg(e, "Algo deu errado"));
    } finally {
      setBusy(null);
    }
  }

  const ativar = () => run("ativar", async () => {
    if (!config) return;
    try {
      const sub = await subscribe(config.public_key);
      setHere(sub);
      setConfig(await savePushSubscription(sub.toJSON(), deviceName()));
      setInfo("Pronto: este aparelho vai receber os avisos.");
    } catch (e) {
      if (e instanceof Error && e.message === "denied") {
        setPerm("denied");
        throw new Error("As notificações estão bloqueadas para o Kactus. Libere nos Ajustes do aparelho e tente de novo.");
      }
      if (e instanceof Error && e.message === "dismissed") throw new Error("A permissão não foi dada. Toque em Ativar de novo e escolha Permitir.");
      throw e;
    } finally {
      setPerm(Notification.permission);
    }
  });

  const desativar = () => run("desativar", async () => {
    if (!here) return;
    const endpoint = here.endpoint;
    await here.unsubscribe().catch(() => false);
    setHere(null);
    setConfig(await removePushSubscription(endpoint));
    setInfo("Este aparelho não recebe mais os avisos.");
  });

  const testar = () => run("testar", async () => {
    const r = await sendPushTest();
    setInfo(r.delivered ? `Aviso de teste enviado para ${r.delivered} aparelho${r.delivered === 1 ? "" : "s"}.` : "Nenhum aparelho recebeu. Desative e ative de novo neste aparelho.");
  });

  const trocar = (key: keyof PushPrefs, value: boolean) => run(key, async () => {
    if (config) setConfig({ ...config, prefs: { ...config.prefs, [key]: value } });
    setConfig(await updatePushPrefs({ [key]: value }));
  });

  return (
    <Panel aria-label="Notificações">
      <h2 className="od-label mb-2">Notificações</h2>
      <p className="mb-4 text-sm text-brand-muted">
        Avisos no celular mesmo com o Kactus fechado. Saem do PC: só chegam com ele ligado e o Kactus rodando.
      </p>

      {support === null || !config ? (
        error ? <p className="text-xs text-brand-danger">{error}</p> : <Skeleton className="h-28" />
      ) : (
        <div className="space-y-5">
          <div className="od-tile p-4">
            {support === "ios-browser" ? (
              <p className="text-sm text-brand-textSecondary">
                No iPhone, as notificações só funcionam com o Kactus aberto pelo ícone da Tela de Início:
                no Safari, toque em <strong className="text-white">Compartilhar → Adicionar à Tela de Início</strong>, abra por lá e volte aqui.
              </p>
            ) : support === "unsupported" ? (
              <p className="text-sm text-brand-textSecondary">Este navegador não recebe notificações. No iPhone, precisa do iOS 16.4 ou mais novo.</p>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    Neste aparelho ({deviceName()}): {here ? <span className="text-brand-accent">ligadas</span> : perm === "denied" ? <span className="text-brand-danger">bloqueadas</span> : "desligadas"}
                  </p>
                  {perm === "denied" && !here && (
                    <p className="text-xs text-brand-warning">Bloqueadas no aparelho. No iPhone: Ajustes → Notificações → Kactus → Permitir; depois volte aqui.</p>
                  )}
                  <p className="text-xs text-brand-muted">
                    {config.devices === 0 ? "Nenhum aparelho recebe ainda." : `${config.devices} aparelho${config.devices === 1 ? "" : "s"} recebe${config.devices === 1 ? "" : "m"} os avisos.`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {here ? (
                    <>
                      <button type="button" onClick={testar} disabled={!!busy} className="od-btn od-btn-secondary od-btn-sm">{busy === "testar" ? "Enviando…" : "Enviar teste"}</button>
                      <button type="button" onClick={desativar} disabled={!!busy} className="od-btn od-btn-ghost od-btn-sm">{busy === "desativar" ? "Desativando…" : "Desativar neste aparelho"}</button>
                    </>
                  ) : (
                    <button type="button" onClick={ativar} disabled={!!busy || perm === "denied"} className="od-btn od-btn-primary od-btn-sm">{busy === "ativar" ? "Ativando…" : "Ativar neste aparelho"}</button>
                  )}
                </div>
              </div>
            )}
          </div>

          <fieldset>
            <legend className="od-metric-label mb-2">O que avisar</legend>
            <ul className="space-y-2">
              {TIPOS.map((t) => (
                <li key={t.key}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl px-1 py-1.5">
                    <input
                      type="checkbox"
                      checked={config.prefs[t.key]}
                      disabled={busy === t.key}
                      onChange={(e) => trocar(t.key, e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[#00FF66]"
                    />
                    <span>
                      <span className="block text-sm font-semibold">{t.nome}</span>
                      <span className="block text-xs text-brand-muted">{t.quando}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          {info && <p className="text-xs text-brand-accent" role="status">{info}</p>}
          {error && <p className="text-xs text-brand-danger" role="alert">{error}</p>}
        </div>
      )}
    </Panel>
  );
}
