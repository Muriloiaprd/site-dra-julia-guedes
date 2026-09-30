"use client";

import { Panel } from "@/components/ui/primitives";
import type { LoadSummary } from "@/lib/api";
import { C } from "@/lib/theme";

/** Leve x moderado x forte (28 dias) e efeito de treino do Garmin (7 dias), lado a lado. */
export function TrainingQuality({ summary }: { summary: LoadSummary | null }) {
  const intensity = summary?.intensidade_28d?.disponivel ? summary.intensidade_28d.percentual : null;
  const effect = summary?.efeito_treino_7d;
  if (!intensity && !effect) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {intensity && (
        <Panel>
          <h2 className="od-label mb-1">Leve × moderado × forte · 28 dias</h2>
          <p className="mb-4 text-[0.72rem] text-brand-muted">Tempo de corrida por intensidade, pela FC. O ideal é a maior parte leve.</p>
          <div className="flex h-4 overflow-hidden rounded-full">
            <div style={{ width: `${intensity.leve_z1_z2}%`, background: C.accent }} title={`Leve ${intensity.leve_z1_z2}%`} />
            <div style={{ width: `${intensity.moderado_z3}%`, background: C.warning }} title={`Moderado ${intensity.moderado_z3}%`} />
            <div style={{ width: `${intensity.forte_z4_z5}%`, background: C.danger }} title={`Forte ${intensity.forte_z4_z5}%`} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { k: "Leve", v: intensity.leve_z1_z2, c: C.accent },
              { k: "Moderado", v: intensity.moderado_z3, c: C.warning },
              { k: "Forte", v: intensity.forte_z4_z5, c: C.danger },
            ].map((it) => (
              <div key={it.k}>
                <div className="od-num text-lg" style={{ color: it.c }}>{it.v}%</div>
                <div className="text-[0.7rem] text-brand-muted">{it.k}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[0.78rem] text-brand-textSecondary">
            {intensity.leve_z1_z2 >= 70
              ? "Boa distribuição: a base está sendo feita no leve."
              : "Pouco tempo no leve: treinos fáceis mais fáceis ajudam a evoluir sem acumular cansaço."}
          </p>
        </Panel>
      )}
      {effect && (
        <Panel>
          <h2 className="od-label mb-1">Efeito de treino · 7 dias</h2>
          <p className="mb-4 text-[0.72rem] text-brand-muted">Do relógio Garmin: de 0 a 5, quanto os treinos puxaram o condicionamento.</p>
          <div className="flex items-baseline gap-2">
            <span className="od-num text-3xl">{effect.media_aerobico.toFixed(1)}</span>
            <span className="text-sm text-brand-muted">média em {effect.treinos} treino{effect.treinos === 1 ? "" : "s"}</span>
          </div>
          {Object.keys(effect.beneficios).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {Object.entries(effect.beneficios).map(([b, n]) => (
                <span key={b} className="od-badge od-badge-muted !normal-case !tracking-normal">{b} · {n}</span>
              ))}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
