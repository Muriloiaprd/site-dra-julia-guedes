"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { PulseLine, RadialGauge } from "@/components/ui/charts";
import { CountUp } from "@/components/ui/CountUp";
import { Panel, ProgressBar, SegmentBar, Skeleton } from "@/components/ui/primitives";
import {
  duniDiverges, readinessColor, riskFromAcwr, statusHeadline, statusSubtitle,
  WEEK_HOURS_GOAL, WEEK_SESSION_GOAL, WEEKLY_STATUS, type Readiness, type Tone,
} from "@/lib/athlete";
import type { TrainingRecommendation, WeeklyPlan } from "@/lib/api";

function readinessTag(v: number | null): string {
  if (v == null) return "Sem dados";
  if (v >= 80) return "Alta";
  if (v >= 60) return "Boa";
  if (v >= 40) return "Moderada";
  return "Baixa";
}

function Stat({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="relative p-3.5 sm:p-4" style={{ background: "rgba(8,11,9,0.72)" }}>
      <div className="mb-2 flex items-center gap-1.5 text-brand-accent">
        {icon}
        <span className="od-metric-label !text-brand-textSecondary">{label}</span>
      </div>
      {children}
    </div>
  );
}

const i = (d: ReactNode) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
);

export function AthleteStatus({
  readiness, recommendation, weekHours, recovery, recoveryTrend, sessions, loading, duni = null, className = "",
}: {
  readiness: Readiness;
  recommendation: TrainingRecommendation | null;
  weekHours: number;
  recovery: Tone;
  recoveryTrend: { text: string; color: string };
  sessions: number;
  loading: boolean;
  /** Plano semanal vigente da Duni (status salvo com o plano). */
  duni?: WeeklyPlan | null;
  className?: string;
}) {
  const v = readiness.value;
  const color = readinessColor(v);
  const risk = riskFromAcwr(readiness.acwr);
  const sourceNote = readiness.source === "load"
    ? `TSB ${readiness.tsb! > 0 ? "+" : ""}${readiness.tsb!.toFixed(1)}${readiness.acwr != null ? ` · ACWR ${readiness.acwr.toFixed(2)}` : ""}`
    : readiness.source === "recommendation" ? "Baseado na recomendação do dia" : "Sem métricas de carga";

  return (
    <Panel variant="hero" className={className} aria-label="Status do atleta">
      {/* monitor: pulso + grade */}
      <PulseLine className="absolute right-0 top-8 hidden h-16 w-[40%] opacity-70 xl:block" color={color} />
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage: "radial-gradient(rgba(0,255,102,0.12) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
          maskImage: "radial-gradient(ellipse 50% 60% at 85% 30%, #000, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse 50% 60% at 85% 30%, #000, transparent 70%)",
        }}
      />

      <div className="relative flex items-center justify-between gap-3">
        <h2 className="od-label od-label-accent">Status do atleta</h2>
        <Link href="/predictions" className="od-link-action">Análise completa <span aria-hidden>→</span></Link>
      </div>

      <div className="relative mt-5 flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
        {loading ? (
          <Skeleton className="!rounded-full" style={{ width: 156, height: 156 }} />
        ) : (
          <RadialGauge value={v ?? 0} size={156} color={color}>
            <div className="od-num text-[2.6rem] leading-none" style={{ color: v == null ? "#888" : "#fff" }}>
              {v == null ? "—" : <CountUp value={v} />}
              {v != null && <span className="ml-0.5 font-sans text-base font-semibold text-brand-muted">%</span>}
            </div>
            <div className="od-metric-label mt-1.5">Prontidão</div>
          </RadialGauge>
        )}

        <div className="w-full min-w-0 flex-1 text-center sm:text-left">
          <span className="od-badge" style={{ color, boxShadow: `inset 0 0 0 1px ${color}44`, background: `${color}14` }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
            Readiness {readinessTag(v)}
          </span>
          <h3 className="mt-3 font-display text-[1.65rem] font-extrabold uppercase leading-[1.02] tracking-tight sm:text-[2.1rem]">
            {loading ? "Analisando…" : statusHeadline(v)}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-brand-textSecondary sm:mx-0">
            {loading ? "Lendo carga, recuperação e histórico recente." : statusSubtitle(v, recommendation)}
          </p>
          <div className="mt-5 max-w-md">
            <ProgressBar value={v ?? 0} height={7} color={v != null && v < 60 ? color : undefined} />
            <div className="mt-1.5 flex justify-between text-[0.68rem] text-brand-muted">
              <span>Readiness</span>
              <span className="tabular-nums">{sourceNote}</span>
            </div>
          </div>
          {duni && (
            <Link href="/coach" className="mt-3 block max-w-md rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-white/[0.03]" style={{ boxShadow: `inset 0 0 0 1px ${WEEKLY_STATUS[duni.status].color}33` }}>
              <span className="text-brand-muted">Status da Duni · {new Date(duni.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}: </span>
              <strong style={{ color: WEEKLY_STATUS[duni.status].color }}>{WEEKLY_STATUS[duni.status].emoji} {WEEKLY_STATUS[duni.status].label}</strong>
              {duniDiverges(v, duni.status) && (
                <span className="mt-1 block text-brand-textSecondary">
                  A prontidão acima olha só a carga (TSB/ACWR). A Duni também pesa fadiga, check-ins e tendência, por isso a leitura dela é diferente.
                </span>
              )}
            </Link>
          )}
        </div>
      </div>

      <div className="relative mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-tile sm:grid-cols-4" style={{ background: "rgba(255,255,255,0.06)" }}>
        <Stat label="Carga" icon={i(<><line x1="6" y1="20" x2="6" y2="14" /><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="6" /></>)}>
          <div className="od-num text-[1.35rem] leading-none">
            {weekHours.toFixed(1)}<span className="ml-1 font-sans text-xs font-semibold text-brand-muted">/ {WEEK_HOURS_GOAL}h</span>
          </div>
          <ProgressBar value={(weekHours / WEEK_HOURS_GOAL) * 100} height={4} className="mt-2.5" />
        </Stat>
        <Stat label="Recuperação" icon={i(<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" />)}>
          <div className="od-num text-[1.35rem] leading-none" style={{ color: recovery.color === "#888888" ? "#fff" : recovery.color }}>{recovery.label}</div>
          <div className="mt-2 text-[0.7rem] font-semibold" style={{ color: recoveryTrend.color }}>{recoveryTrend.text}</div>
        </Stat>
        <Stat label="ACWR" icon={i(<path d="M3 12h4l3 8 4-16 3 8h4" />)}>
          <div className="od-num text-[1.35rem] leading-none" style={{ color: readiness.acwr != null ? risk.color : "#fff" }}>
            {readiness.acwr != null ? readiness.acwr.toFixed(2) : "—"}
          </div>
          <div className="mt-2 text-[0.7rem] font-semibold" style={{ color: risk.color }}>{risk.zone}</div>
        </Stat>
        <Stat label="Treinos" icon={i(<><circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.5 2.5 5-5" /></>)}>
          <div className="od-num text-[1.35rem] leading-none">
            {sessions}<span className="ml-1 font-sans text-xs font-semibold text-brand-muted">/ {WEEK_SESSION_GOAL}</span>
          </div>
          <div className="mt-2.5"><SegmentBar total={WEEK_SESSION_GOAL} filled={Math.min(sessions, WEEK_SESSION_GOAL)} height={4} /></div>
        </Stat>
      </div>
    </Panel>
  );
}
