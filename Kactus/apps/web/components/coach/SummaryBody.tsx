"use client";

import type { CoachSummary } from "@/lib/api";
import { WEEKLY_STATUS } from "@/lib/athlete";

const POINT_STYLE: Record<CoachSummary["pontos"][number]["tipo"], { icon: string; color: string; label: string }> = {
  bom: { icon: "✓", color: "#00FF66", label: "Ponto positivo" },
  atencao: { icon: "!", color: "#FFC145", label: "Atenção" },
  risco: { icon: "⚠", color: "#F85149", label: "Risco" },
};

/**
 * Resumo da semana da Duni em pedacos curtos: status, o que ela viu e o que fazer.
 * Sem moldura: fica dentro do quadro "Resumo da Duni" da pagina, abaixo dos indicadores.
 */
export function SummaryBody({
  summary, onAnswer,
}: {
  summary: CoachSummary;
  onAnswer: (question: string) => void;
}) {
  const st = WEEKLY_STATUS[summary.status] ?? WEEKLY_STATUS.amarelo;

  return (
    <div className="animate-od-fade-up space-y-4">
      <div className="flex flex-col gap-2 rounded-xl p-4 sm:flex-row sm:items-center sm:gap-4" style={{ background: `${st.color}0d`, boxShadow: `inset 0 0 0 1px ${st.color}40` }}>
        <div className="shrink-0 font-display text-lg font-bold" style={{ color: st.color }}>{st.emoji} {st.label}</div>
        <p className="text-sm sm:border-l sm:border-white/10 sm:pl-4">{summary.status_frase}</p>
      </div>

      <p className="text-sm text-brand-textSecondary">{summary.semana}</p>

      <div className="grid gap-4 md:grid-cols-2">
        {summary.pontos.length > 0 && (
          <div>
            <div className="od-metric-label mb-2">O que eu vi</div>
            <ul className="space-y-2">
              {summary.pontos.map((p, i) => {
                const ps = POINT_STYLE[p.tipo] ?? POINT_STYLE.atencao;
                return (
                  <li key={i} className="flex gap-2.5 text-sm">
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold"
                      style={{ color: ps.color, background: `${ps.color}1a` }}
                      aria-label={ps.label}
                    >
                      {ps.icon}
                    </span>
                    <span>{p.texto}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {summary.acoes.length > 0 && (
          <div>
            <div className="od-metric-label mb-2">O que fazer</div>
            <ol className="space-y-2">
              {summary.acoes.map((a, i) => (
                <li key={i} className="flex gap-2.5 text-sm">
                  <span className="od-num mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[0.7rem] text-brand-accent">{i + 1}</span>
                  <span>{a}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {summary.pergunta && (
        <div className="flex flex-col gap-2 rounded-xl bg-white/[0.03] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm"><span className="text-brand-muted">A Duni pergunta: </span>{summary.pergunta}</p>
          <button type="button" onClick={() => onAnswer(summary.pergunta!)} className="od-btn od-btn-secondary od-btn-sm shrink-0">
            Responder no chat
          </button>
        </div>
      )}
    </div>
  );
}
