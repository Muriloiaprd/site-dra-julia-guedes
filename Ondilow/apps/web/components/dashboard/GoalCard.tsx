"use client";

import Link from "next/link";
import { Panel, Skeleton } from "@/components/ui/primitives";
import type { RacePrediction } from "@/lib/api";
import { formatClock } from "@/lib/utils";

const RACE_SHORT: Record<string, string> = { "5k": "5K", "10k": "10K", "21k": "21K", "42k": "42K" };

/**
 * Ainda nao existe feature de meta/prova-alvo no backend. Em vez de simular
 * progresso, o card convida a definir o desafio e mostra o potencial atual
 * real (previsoes VDOT/Riegel).
 */
export function GoalCard({ predictions, loading, className = "" }: { predictions: RacePrediction[]; loading: boolean; className?: string }) {
  return (
    <Panel variant="accent" className={`flex flex-col overflow-hidden ${className}`} aria-label="Meta principal">
      <svg className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 opacity-40" viewBox="0 0 100 100" fill="none" aria-hidden>
        {[44, 34, 24, 14].map((r, k) => (
          <circle key={r} cx="50" cy="50" r={r} stroke="#00FF66" strokeOpacity={0.12 + k * 0.08} strokeDasharray={k % 2 ? "2 4" : undefined} />
        ))}
        <circle cx="50" cy="50" r="4" fill="#00FF66" fillOpacity="0.8" />
      </svg>

      <h2 className="od-label od-label-accent relative">Meta principal</h2>

      <h3 className="relative mt-4 font-display text-[1.35rem] font-extrabold uppercase leading-[1.05] tracking-tight">
        Defina seu<br /><span className="text-brand-accent">próximo desafio</span>
      </h3>
      <p className="relative mt-2 text-[0.8rem] leading-relaxed text-brand-muted">
        Escolha uma prova e deixe o ONDILOW acompanhar sua evolução.
      </p>

      <div className="relative mt-4 flex-1">
        {loading ? (
          <Skeleton className="h-28" />
        ) : predictions.length > 0 ? (
          <div className="od-tile p-3">
            <div className="od-metric-label mb-2 flex items-center justify-between">
              <span>Seu potencial hoje</span>
              <span className="normal-case tracking-normal text-brand-textTertiary">VDOT {predictions[0].vdot}</span>
            </div>
            <ul className="space-y-1.5">
              {predictions.map((p) => (
                <li key={p.distance} className="flex items-center justify-between gap-2">
                  <span className="w-9 text-[0.7rem] font-bold text-brand-textSecondary">{RACE_SHORT[p.distance] ?? p.distance}</span>
                  <span className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                  <span className="od-num text-[0.95rem]">{formatClock(p.predicted_s)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="od-tile p-3 text-xs text-brand-muted">Importe corridas para o ONDILOW estimar seu potencial em 5K, 10K, 21K e 42K.</div>
        )}
      </div>

      <Link href="/predictions" className="od-btn od-btn-secondary relative mt-4 w-full">
        Ver previsões de prova <span aria-hidden>→</span>
      </Link>
    </Panel>
  );
}
