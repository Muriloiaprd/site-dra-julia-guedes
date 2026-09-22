"use client";

import { useEffect, useState } from "react";

import { AiOrb } from "@/components/dashboard/CoachCard";
import { Markdown } from "@/components/ui/Markdown";
import { Alert, Panel, Skeleton } from "@/components/ui/primitives";
import { fetchActivityComment, postActivityComment, type ActivityComment, type ActivityDetail } from "@/lib/api";
import { coachErrorMessage } from "@/lib/coachErrors";

/**
 * "Comentario da Duni" sobre um treino. So pede a IA quando o atleta clica
 * (nunca no import: um import em lote queimaria a cota gratis do Gemini).
 */
export function DuniComment({ activity }: { activity: ActivityDetail }) {
  const [data, setData] = useState<ActivityComment | null>(null);
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchActivityComment(activity.id)
      .then(setData)
      .catch(() => setData({ comment: null }))
      .finally(() => setLoading(false));
  }, [activity.id]);

  async function ask() {
    setAsking(true);
    setError(null);
    try {
      setData(await postActivityComment(activity.id));
    } catch (e) {
      setError(coachErrorMessage(e));
    } finally {
      setAsking(false);
    }
  }

  const hasCheckin = activity.rpe != null;
  const comment = data?.comment;

  return (
    <Panel variant="accent" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AiOrb size={34} active={asking} />
          <div>
            <h2 className="od-label od-label-accent">Comentário da Duni</h2>
            {comment && data?.generated_at && (
              <p className="mt-0.5 font-mono text-[0.62rem] tracking-wider text-brand-muted">
                {new Date(data.generated_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                {data.model_used ? ` · ${data.model_used}` : ""}
              </p>
            )}
          </div>
        </div>
        {!loading && (
          <button type="button" onClick={ask} disabled={asking} className={`od-btn od-btn-sm ${comment ? "od-btn-ghost" : "od-btn-primary"}`}>
            {asking ? "A Duni está lendo o treino…" : comment ? "Pedir de novo" : "Pedir comentário"}
          </button>
        )}
      </div>

      {error && <div className="mt-3"><Alert tone="danger" title={error.title}>{error.detail}</Alert></div>}

      <div className="mt-3">
        {loading ? (
          <Skeleton className="h-16" />
        ) : asking && !comment ? (
          <Skeleton className="h-24" />
        ) : comment ? (
          <Markdown text={comment} />
        ) : (
          <p className="text-sm text-brand-muted">
            A Duni lê as voltas, a FC, a deriva, o seu check-in e o que estava planejado para o dia, e compara com treinos parecidos.
            {!hasCheckin && " Preencha o check-in acima antes: sem PSE e dor ela só vê o relógio."}
          </p>
        )}
        {comment && !hasCheckin && (
          <p className="mt-2 text-xs text-brand-warning">Sem check-in neste treino. Preencha acima e peça de novo para ela considerar a PSE e a dor.</p>
        )}
      </div>
    </Panel>
  );
}
