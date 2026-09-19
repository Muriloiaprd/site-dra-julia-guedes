"use client";

import { useEffect, useState } from "react";

/** Aviso discreto quando a API demora (cold start); evita skeleton infinito sem explicacao. */
export function WakingBanner() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    // Varias requisicoes simultaneas emitem true/false independentes: conta em vez de booleano.
    const onWaking = (e: Event) => setCount((c) => Math.max(0, c + ((e as CustomEvent<boolean>).detail ? 1 : -1)));
    window.addEventListener("ondilow:waking", onWaking);
    return () => window.removeEventListener("ondilow:waking", onWaking);
  }, []);
  if (count === 0) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[90] bg-brand-accent/90 px-4 py-1.5 text-center text-xs font-semibold text-black">
      Acordando o servidor… pode levar alguns segundos.
    </div>
  );
}
