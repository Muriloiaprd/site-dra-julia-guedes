"use client";

import { Panel, Skeleton } from "@/components/ui/primitives";
import type { LoadSummary } from "@/lib/api";

/** "O que fazer": recomendacao de hoje + faixa segura de corrida para 7 dias + ultimos 7 dias x media, num painel so. */
export function TodayPanel({ summary }: { summary: LoadSummary | null }) {
  const safe = summary?.faixa_segura;
  const week = summary?.semana;
  const avg = summary?.media_4_semanas;
  const meta = summary?.meta_semanal;

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
          {meta && (
            <div className="mt-3 rounded-xl bg-white/[0.03] px-3.5 py-2.5 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-brand-textSecondary">Sua meta: <strong className="text-white">{meta.km} km</strong> por semana</span>
                <span className="text-[0.75rem] text-brand-muted">
                  {meta.falta_km > 0 ? `faltam ${meta.falta_km} km nesta semana` : "meta da semana batida ✓"}
                </span>
              </div>
              {meta.situacao === "acima_da_faixa" && (
                <p className="mt-1 text-[0.78rem] text-brand-warning">Acima da faixa segura de agora: suba aos poucos, até uns 10% por semana, para não dar salto de carga.</p>
              )}
              {meta.situacao === "abaixo_da_faixa" && (
                <p className="mt-1 text-[0.78rem] text-brand-muted">Abaixo da faixa de agora: dá para manter a meta, mas o condicionamento tende a cair um pouco.</p>
              )}
            </div>
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
