"use client";

import { Panel, Skeleton } from "@/components/ui/primitives";
import type { LoadSummary } from "@/lib/api";

/** "O que fazer": recomendacao de hoje + faixa segura de corrida para 7 dias + ultimos 7 dias x media, num painel so. */
export function TodayPanel({ summary }: { summary: LoadSummary | null }) {
  const safe = summary?.faixa_segura;
  const week = summary?.semana;
  const avg = summary?.media_4_semanas;

  return (
    <Panel variant="accent">
      <div className="grid gap-5 lg:grid-cols-2 lg:gap-8">
        <div>
          <div className="od-metric-label">Hoje</div>
          {!summary ? <Skeleton className="mt-2 h-8 w-48" /> : (
            <>
              <div className="mt-1 font-display text-2xl font-bold" style={{ color: summary.hoje.color }}>{summary.hoje.label}</div>
              <p className="mt-1 text-sm text-brand-textSecondary">{summary.hoje.detail}</p>
            </>
          )}
        </div>

        <div className="border-t border-white/5 pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <div className="od-metric-label">Corrida nos próximos 7 dias</div>
          {!safe ? <Skeleton className="mt-2 h-8 w-48" /> : safe.disponivel ? (
            <>
              <div className="od-num mt-1 text-2xl">{safe.min_km}–{safe.max_km} km</div>
              <p className="mt-1 text-sm text-brand-textSecondary">Faixa segura pela sua carga das últimas 4 semanas.</p>
            </>
          ) : (
            <>
              <div className="mt-1 font-display text-xl font-bold">{safe.motivo === "base_baixa" ? "Volte aos poucos" : "Sem corridas recentes"}</div>
              <p className="mt-1 text-sm text-brand-textSecondary">
                {safe.motivo === "base_baixa"
                  ? "Pouco treino nas últimas 4 semanas para calcular uma faixa. Comece com 2 ou 3 corridas leves e curtas."
                  : "Sem corrida nas últimas 4 semanas para calcular a faixa em km."}
              </p>
            </>
          )}
          {week && avg && (
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem] text-brand-muted">
              <span>Últimos 7 dias:</span>
              <span><strong className="text-white">{week.corrida_km} km</strong> (média {avg.corrida_km})</span>
              <span><strong className="text-white">{week.horas} h</strong> (média {avg.horas})</span>
              <span><strong className="text-white">{week.treinos} treino{week.treinos === 1 ? "" : "s"}</strong> (média {avg.treinos})</span>
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}
