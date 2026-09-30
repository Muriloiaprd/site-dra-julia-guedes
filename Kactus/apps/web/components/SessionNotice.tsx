"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchMe } from "@/lib/api";

/**
 * Aviso flutuante na landing e no login quando ja existe sessao valida: um clique leva ao painel,
 * sem digitar a senha de novo. So aparece depois que /auth/me confirma o token (token vencido nao mostra nada).
 */
export function SessionNotice() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    fetchMe().then((u) => setLoggedIn(u !== null));
  }, []);

  if (!loggedIn) return null;
  return (
    <div
      role="status"
      style={{
        position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 100,
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "center",
        maxWidth: "calc(100vw - 32px)", padding: "10px 12px 10px 18px", borderRadius: 999,
        background: "rgba(17,17,17,0.95)", border: "1px solid rgba(0,255,102,0.35)",
        boxShadow: "0 0 40px rgba(0,255,102,0.12), 0 12px 32px rgba(0,0,0,0.6)",
        color: "#E5E5E5", fontSize: 14, fontFamily: "inherit",
      }}
    >
      <span>Você já está conectado.</span>
      <Link
        href="/dashboard"
        style={{
          padding: "6px 14px", borderRadius: 999, background: "#00FF66", color: "#0A0A0A",
          fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap",
        }}
      >
        Ir para o painel →
      </Link>
    </div>
  );
}
