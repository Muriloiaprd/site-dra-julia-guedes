"use client";

import { useEffect, useRef } from "react";

/*
 * Plano de treinos em todas as telas. Calendário, Dashboard e Duni buscam o plano cada um
 * por conta própria (a mesma tabela na API); quando um treino muda — a Duni no chat,
 * "Pedir outro treino", a análise, mover, editar no dia, gerar a semana —, quem mudou
 * chama notifyPlanChanged() e toda tela aberta busca de novo. Vale entre abas do
 * navegador também (evento "storage") e ao voltar para o app (iPhone).
 */

const EVENT = "kactus:plan-changed";
const STORAGE_KEY = "kactus_plan_changed_at";

export function notifyPlanChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT));
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now())); // outras abas
  } catch {
    /* sem localStorage: só esta aba atualiza */
  }
}

/** Chama `onChange` quando o plano muda (nesta aba ou em outra) e quando a tela volta a ficar visível. */
export function usePlanChanged(onChange: () => void, enabled = true): void {
  const ref = useRef(onChange);
  ref.current = onChange;

  useEffect(() => {
    if (!enabled) return;
    const run = () => ref.current();
    const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) run(); };
    const onVisible = () => { if (document.visibilityState === "visible") run(); };
    window.addEventListener(EVENT, run);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(EVENT, run);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);
}
