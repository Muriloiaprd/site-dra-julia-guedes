"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Prende o foco do teclado dentro de `ref` enquanto `active`: foca o primeiro
 * item ao abrir, faz Tab/Shift+Tab dar a volta, chama `onEscape` no Esc e
 * devolve o foco a quem o tinha (ou a `returnTo`) ao fechar.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape: () => void,
  returnTo?: RefObject<HTMLElement | null>,
) {
  // Ref para o handler não reiniciar o trap (e roubar o foco) a cada render do pai.
  const escRef = useRef(onEscape);
  escRef.current = onEscape;

  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(container?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((el) => el.offsetParent !== null);
    (focusables()[0] ?? container)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { escRef.current(); return; }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      const current = document.activeElement;
      if (!container?.contains(current)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && current === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && current === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      (returnTo?.current ?? previous)?.focus();
    };
  }, [active, ref, returnTo]);
}
