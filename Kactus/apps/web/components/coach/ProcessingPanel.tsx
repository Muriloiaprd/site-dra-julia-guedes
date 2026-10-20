"use client";

import { useEffect, useState, type ReactNode } from "react";

import { AiOrb } from "@/components/dashboard/CoachCard";
import { Panel } from "@/components/ui/primitives";

/** O que a Duni realmente le do seu contexto (ai/coach_service.build_context). */
const ANALYSIS_STEPS = [
  "Volume de 7, 14 e 28 dias",
  "Tendência de 8 semanas",
  "Sinais de fadiga",
  "Check-ins e memórias",
  "Plano feito × pulado",
];

/** Quadro "Duni analisando…" enquanto ela gera o relatório ou um plano. */
export function ProcessingPanel({ title }: { title: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, ANALYSIS_STEPS.length - 1)), 1400);
    return () => clearInterval(t);
  }, []);
  return (
    <Panel variant="hero" className="overflow-hidden" aria-live="polite">
      <div className="od-scanline" />
      <div className="relative flex items-center gap-4">
        <AiOrb size={56} />
        <div>
          <div className="font-mono text-[0.62rem] tracking-[0.18em] text-brand-accent">DUNI · ANALISANDO</div>
          <p className="mt-1 font-display text-xl font-bold">{title}</p>
        </div>
      </div>
      <ul className="relative mt-5 grid gap-2 sm:grid-cols-5">
        {ANALYSIS_STEPS.map((s, i) => {
          const state = i < step ? "done" : i === step ? "active" : "wait";
          return (
            <li key={s} className="od-tile flex items-center gap-2 px-3 py-2.5 text-xs transition-all duration-300"
              style={state === "active" ? { boxShadow: "inset 0 0 0 1px rgba(0,255,102,0.4)", background: "rgba(0,255,102,0.06)" } : undefined}>
              {state === "done"
                ? <span className="text-brand-accent">✓</span>
                : state === "active"
                  ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-accent/25 border-t-brand-accent" />
                  : <span className="h-1.5 w-1.5 rounded-full bg-white/15" />}
              <span className={state === "wait" ? "text-brand-textTertiary" : "text-brand-textSecondary"}>{s}</span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/** Botão grande colorido das ações da Duni (relatório, plano da semana, plano do objetivo). */
export function ActionButton({ onClick, disabled, color, title, text, icon }: {
  onClick: () => void;
  disabled: boolean;
  color: string;
  title: string;
  text: string;
  icon: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group relative overflow-hidden rounded-2xl p-4 text-left transition-all duration-200 enabled:hover:-translate-y-1 disabled:opacity-50 sm:p-5"
      style={{
        background: `radial-gradient(220px 120px at 0% 0%, ${color}30, transparent 70%), linear-gradient(160deg, ${color}1c, ${color}08)`,
        boxShadow: `inset 0 0 0 1.5px ${color}70, 0 14px 40px -18px ${color}`,
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#041a0b] transition-transform duration-200 group-enabled:group-hover:scale-110"
          style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)`, boxShadow: `0 0 22px -4px ${color}` }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>{icon}</svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-[1.05rem] font-bold leading-tight text-white">{title}</span>
            <span className="text-lg transition-transform duration-200 group-enabled:group-hover:translate-x-1" style={{ color }} aria-hidden>→</span>
          </div>
          <p className="mt-1 text-[0.78rem] leading-snug text-brand-textSecondary">{text}</p>
        </div>
      </div>
    </button>
  );
}
