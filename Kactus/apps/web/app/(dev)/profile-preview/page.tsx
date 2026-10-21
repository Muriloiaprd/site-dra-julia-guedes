"use client";

/**
 * Ferramenta só-de-desenvolvimento: o Perfil (abas Dados, Treino, Importar, Conta) com
 * dados de exemplo, sem login e sem API (fetch interceptado; salvar só devolve o que
 * foi enviado). Uso: /profile-preview (ou /profile-preview?aba=treino)
 */

import { useEffect, useState } from "react";

import ProfilePage from "@/app/profile/page";

const PROFILE = {
  full_name: "Atleta de Exemplo", avatar_data_url: null, logo_data_url: null, dob: null, sex: "M", height_cm: null,
  max_hr: 188, hr_zones: null, ftp_watts: null, css_pace_s_per_100m: null, weight_kg: 74.5, resting_hr: 52,
  vo2max_estimated: null, weekly_km_goal: 30,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let installed = false;

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const real = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes("/api/")) return real(input, init);
    if (url.includes("/auth/me")) return json({ id: "preview", email: "preview@kactus" });
    if (/\/profile$/.test(url)) return json(init?.method === "PUT" ? JSON.parse(String(init.body)) : PROFILE);
    if (url.includes("/push/")) return json({ subscribed: false, prefs: {}, public_key: null });
    return json({});
  };
}

export default function ProfilePreview() {
  // fetchMe só chama a API com token: um falso, apagado ao fechar a aba
  const [fakeToken] = useState(() => {
    install();
    try {
      if (localStorage.getItem("kactus_token")) return false;
      localStorage.setItem("kactus_token", "preview");
      return true;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (!fakeToken) return;
    const clear = () => { try { localStorage.removeItem("kactus_token"); } catch { /* ignore */ } };
    window.addEventListener("pagehide", clear);
    return () => window.removeEventListener("pagehide", clear);
  }, [fakeToken]);
  return <ProfilePage />;
}
