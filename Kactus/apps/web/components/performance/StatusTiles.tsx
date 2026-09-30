"use client";

import { Panel, Skeleton } from "@/components/ui/primitives";
import type { DailyMetric, RiskAssessment } from "@/lib/api";
import { ctlTrend, formFromTsb, latestMetric } from "@/lib/athlete";
import { C } from "@/lib/theme";

// Mesma fonte dos alertas do dashboard (/predictions/overview): antes Carga e Previsoes
// mostravam o risco calculado de dois jeitos diferentes.
const RISK: Record<RiskAssessment["level"], { label: string; color: string }> = {
  low: { label: "Baixo", color: C.accent },
  moderate: { label: "Moderado", color: C.warning },
  high: { label: "Alto", color: C.danger },
  unknown: { label: "Sem dados", color: C.muted },
};

/** Como o corpo esta, sem siglas: forma, risco de lesao e condicionamento (siglas so no title). */
export function StatusTiles({ metrics, risk, loading }: { metrics: DailyMetric[]; risk: RiskAssessment | null; loading: boolean }) {
  const latest = latestMetric(metrics);
  const form = formFromTsb(latest?.tsb ?? null);
  const trend = ctlTrend(metrics);
  const r = RISK[risk?.level ?? "unknown"];

  const tiles = [
    { k: "Forma", v: form.label, c: form.color, s: form.hint, t: latest?.tsb != null ? `Disposição (TSB) ${latest.tsb.toFixed(1)}` : undefined, busy: loading },
    { k: "Risco de lesão", v: r.label, c: r.color, s: risk?.reasons[0] ?? risk?.recommendation, t: latest?.acwr != null ? `Salto de carga (ACWR) ${latest.acwr.toFixed(2)}` : undefined, busy: !risk },
    { k: "Condicionamento", v: trend.label, c: trend.color, s: trend.hint, t: trend.delta != null ? `CTL ${trend.delta > 0 ? "+" : ""}${trend.delta.toFixed(1)} em 14 dias` : undefined, busy: loading },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {tiles.map((t) => (
        <Panel key={t.k} variant="flush" className="flex items-center gap-4 !rounded-card px-5 py-4" style={{ boxShadow: `inset 0 0 0 1px ${t.c}22` }}>
          <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: t.c, boxShadow: `0 0 12px ${t.c}` }} />
          <div className="min-w-0" title={t.t}>
            <div className="od-metric-label">{t.k}</div>
            {t.busy ? <Skeleton className="mt-1 h-6 w-28" /> : (
              <div className="od-num text-[1.35rem] uppercase leading-tight" style={{ color: t.c }}>{t.v}</div>
            )}
            <div className="text-[0.72rem] text-brand-muted">{t.s ?? "—"}</div>
          </div>
        </Panel>
      ))}
    </div>
  );
}
