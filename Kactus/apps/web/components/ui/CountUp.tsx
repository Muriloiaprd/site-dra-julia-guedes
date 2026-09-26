"use client";

import { useEffect, useRef, useState } from "react";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Anima um numero de 0 (ou do valor anterior) ate `value`. */
export function useCountUp(value: number, duration = 900): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(0);

  useEffect(() => {
    if (!Number.isFinite(value)) { setDisplay(value); return; }
    if (prefersReducedMotion()) { setDisplay(value); fromRef.current = value; return; }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return display;
}

export function CountUp({
  value, decimals = 0, duration, format,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  format?: (v: number) => string;
}) {
  const v = useCountUp(value, duration);
  return <>{format ? format(v) : v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>;
}
