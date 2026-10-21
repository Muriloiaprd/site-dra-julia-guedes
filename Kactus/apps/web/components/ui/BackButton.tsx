"use client";

import { useRouter } from "next/navigation";

/**
 * "← Voltar" no topo da tela: volta para a tela anterior. No iPhone, aberto como app
 * (Tela de Início), não existe o voltar do navegador. Sem tela anterior (aberto direto
 * pelo endereço), vai para `fallback`.
 */
export function BackButton({ fallback = "/dashboard" }: { fallback?: string }) {
  const router = useRouter();
  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push(fallback);
  }
  return (
    <button type="button" onClick={goBack} className="od-btn od-btn-ghost od-btn-sm mb-3 -ml-2">
      <span aria-hidden>←</span> Voltar
    </button>
  );
}
