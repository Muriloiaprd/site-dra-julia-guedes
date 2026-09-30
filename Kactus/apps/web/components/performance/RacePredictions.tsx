"use client";

import Link from "next/link";

import { EmptyState, Panel, ProgressBar, Skeleton } from "@/components/ui/primitives";
import type { RacePrediction } from "@/lib/api";
import { C } from "@/lib/theme";
import { formatClock, formatPace } from "@/lib/utils";

const RACE_LABELS: Record<string, { short: string; name: string }> = {
  "5k": { short: "5K", name: "5 km" },
  "10k": { short: "10K", name: "10 km" },
  "21k": { short: "21K", name: "Meia maratona" },
  "42k": { short: "42K", name: "Maratona" },
};

function confidenceLabel(c: number): string {
  if (c >= 1.0) return "Tempo real";
  if (c >= 0.75) return "Alta confiança";
  return "Estimado";
}

function confidenceColor(c: number): string {
  if (c >= 1.0) return C.accent;
  if (c >= 0.75) return C.lime;
  return C.warning;
}

/** Previsoes de prova em cards compactos (ancora #provas, usada pelo GoalCard do dashboard). */
export function RacePredictions({ predictions, loading }: { predictions: RacePrediction[] | null; loading: boolean }) {
  return (
    <section id="provas" className="scroll-mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
        <h2 className="od-label">Previsões de prova</h2>
        <span className="text-[0.7rem] text-brand-muted">Pelos seus melhores esforços de corrida</span>
      </div>
      {loading ? (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : !predictions || predictions.length === 0 ? (
        <Panel>
          <EmptyState
            title="Nenhum recorde de corrida encontrado"
            description="Importe atividades de corrida para gerar previsões."
            action={<Link href="/import" className="od-btn od-btn-secondary">Importar atividades →</Link>}
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {predictions.map((p) => {
            const meta = RACE_LABELS[p.distance];
            const cc = confidenceColor(p.confidence);
            return (
              <Panel key={p.distance} className="overflow-hidden !p-4" aria-label={`Previsão ${meta?.name ?? p.distance}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="od-num text-sm text-brand-accent">{meta?.short ?? p.distance}</span>
                  <span className="text-[0.66rem] text-brand-muted" title="VDOT (Jack Daniels)">VDOT {p.vdot}</span>
                </div>
                <div className="od-num mt-2 text-[1.6rem] leading-none">{formatClock(p.predicted_s)}</div>
                <div className="mt-1 text-[0.7rem] text-brand-muted">{formatPace(p.predicted_s / (p.distance_m / 1000))} médio</div>
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-[0.64rem]">
                    <span className="font-semibold" style={{ color: cc }}>{confidenceLabel(p.confidence)}</span>
                    <span className="tabular-nums text-brand-muted">{Math.round(Math.min(1, p.confidence) * 100)}%</span>
                  </div>
                  <ProgressBar value={Math.min(1, p.confidence) * 100} height={3} color={cc} />
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </section>
  );
}
