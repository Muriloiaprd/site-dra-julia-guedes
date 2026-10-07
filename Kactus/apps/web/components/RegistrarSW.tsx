"use client";

import { useEffect } from "react";

/** Registra o public/sw.js, que so troca a tela branca por "Kactus desligado". Fora do `next dev`. */
export function RegistrarSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
