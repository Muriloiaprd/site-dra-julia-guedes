"use client";

import { useEffect, useRef, useState } from "react";
import { domToBlob } from "modern-screenshot";

// o Safari do iPhone recusa canvas acima de ~16,7 milhoes de pixels; abaixo disso a escala cai
const MAX_PIXELS = 16_000_000;

type Estado =
  | { fase: "gerando" }
  | { fase: "pronto"; file: File; blob: Blob }
  | { fase: "salvo"; nome: string }
  | { fase: "erro"; msg: string };

const isAbort = (e: unknown) => e instanceof Error && e.name === "AbortError";

/** Baixa um blob como arquivo. No iPhone vai para o app Arquivos (a galeria e pelo Compartilhar). */
function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  // revogar na hora corta o download no Safari
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** "Calendário" -> "calendario"; "Duni · treinadora" -> "duni-treinadora". */
function slug(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tela";
}

function hoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Print Tela: imagem PNG da aba aberta inteira (de cima ate embaixo, nao so o que cabe na tela),
 * na largura do aparelho. So o conteudo (#conteudo), sem o menu. No computador baixa direto;
 * no celular abre o Compartilhar num segundo toque, porque o Safari so deixa compartilhar
 * logo depois de um toque e a captura leva alguns segundos.
 */
export function usePrintTela(nomeDaAba: string) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const ocupado = useRef(false);

  useEffect(() => {
    if (estado?.fase !== "salvo" && estado?.fase !== "erro") return;
    const t = setTimeout(() => setEstado(null), estado.fase === "erro" ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [estado]);

  async function gerar() {
    const alvo = document.getElementById("conteudo");
    if (!alvo || ocupado.current) return;
    ocupado.current = true;
    setEstado({ fase: "gerando" });
    try {
      await document.fonts.ready;
      const w = alvo.scrollWidth;
      const h = alvo.scrollHeight;
      // 2x deixa o texto nitido mesmo vindo de tela comum; abas muito longas caem para caber no limite
      const scale = Math.min(2, Math.sqrt(MAX_PIXELS / (w * h)));
      const fundo = getComputedStyle(document.documentElement).getPropertyValue("--od-bg").trim() || "#0A0A0A";
      const blob = await domToBlob(alvo, { width: w, height: h, scale, backgroundColor: fundo, type: "image/png" });
      if (!blob) throw new Error("Não foi possível gerar a imagem");
      const nome = `kactus_${slug(nomeDaAba)}_${hoje()}.png`;
      const file = new File([blob], nome, { type: "image/png" });
      const celular = window.matchMedia("(hover: none)").matches;
      if (celular && navigator.canShare?.({ files: [file] })) {
        setEstado({ fase: "pronto", file, blob });
      } else {
        downloadBlob(blob, nome);
        setEstado({ fase: "salvo", nome });
      }
    } catch (e) {
      setEstado({ fase: "erro", msg: e instanceof Error && e.message ? e.message : "Não foi possível gerar a imagem" });
    } finally {
      ocupado.current = false;
    }
  }

  async function compartilhar() {
    if (estado?.fase !== "pronto") return;
    const { file, blob } = estado;
    try {
      // sem nenhum await antes do share: e o que o Safari do iPhone exige
      await navigator.share({ files: [file], title: "Kactus" });
      setEstado(null);
    } catch (e) {
      if (isAbort(e)) return;
      downloadBlob(blob, file.name);
      setEstado({ fase: "salvo", nome: file.name });
    }
  }

  // centralizado pelo container: a animacao de entrada usa transform e anularia um translate-x
  const aviso = estado && (
    <div className="pointer-events-none fixed inset-x-3 z-50 flex justify-center md:!bottom-6 md:left-[76px] lg:left-60" style={{ bottom: "calc(76px + env(safe-area-inset-bottom))" }}>
      <div
        role="status"
        aria-live="polite"
        className="od-panel od-panel-glass pointer-events-auto flex min-w-0 items-center gap-3 whitespace-nowrap !px-4 !py-2.5 text-[0.78rem] animate-od-fade-up"
      >
        {estado.fase === "gerando" && <span className="text-brand-muted">Gerando print da tela…</span>}
        {estado.fase === "salvo" && <span className="truncate text-white">Print salvo · <span className="text-brand-muted">{estado.nome}</span></span>}
        {estado.fase === "erro" && <span className="truncate text-brand-danger">{estado.msg}</span>}
        {estado.fase === "pronto" && (
          <>
            <span className="text-white">Print pronto</span>
            <button onClick={compartilhar} className="rounded-full bg-brand-accent px-3 py-1 text-[0.74rem] font-bold text-black">
              Salvar imagem
            </button>
            <button onClick={() => setEstado(null)} aria-label="Fechar" className="text-brand-muted">✕</button>
          </>
        )}
      </div>
    </div>
  );

  return { gerar, gerando: estado?.fase === "gerando", aviso };
}
