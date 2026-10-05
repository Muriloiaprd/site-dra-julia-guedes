"use client";

import { useState } from "react";

import { AiOrb } from "@/components/dashboard/CoachCard";
import { applyWorkoutReview, reviewWorkout, type PlannedWorkout, type WorkoutReview as Review } from "@/lib/api";
import { coachErrorMessage } from "@/lib/coachErrors";
import { formatDuration } from "@/lib/utils";

const VERDICT: Record<Review["verdict"], { label: string; color: string; icon: string }> = {
  manter: { label: "Pode manter", color: "#00FF66", icon: "✓" },
  ajustar: { label: "Sugere ajustar", color: "#FFC145", icon: "↻" },
  descanso: { label: "Sugere descansar", color: "#00BFFF", icon: "☾" },
};

const PHASE: Record<string, string> = { aquecimento: "Aquecimento", principal: "Principal", desaquecimento: "Desaquecimento" };

/**
 * "Analisar este treino": a Duni olha o treino do dia contra os dados de agora e
 * diz se mantem, ajusta ou descansa. Nada muda ate o atleta aplicar a sugestao.
 */
export function WorkoutReview({
  w, onDone, onClose,
}: {
  w: PlannedWorkout;
  onDone: (notice?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState<"analyze" | "apply" | null>(null);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);

  async function analyze() {
    setBusy("analyze");
    setError(null);
    try {
      setReview(await reviewWorkout(w.id, question.trim() || undefined));
    } catch (e) {
      setError(coachErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function apply(verdict: "ajustar" | "descanso") {
    if (!review) return;
    setBusy("apply");
    setError(null);
    try {
      await applyWorkoutReview(w.id, verdict, verdict === "ajustar" ? review.suggestion : null, review.explanation);
      await onDone(verdict === "descanso" ? `Dia de descanso: ${review.explanation}` : `Treino ajustado: ${review.explanation}`);
    } catch (e) {
      setError(coachErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const v = review ? VERDICT[review.verdict] : null;
  const p = review?.preview;

  return (
    <div className="space-y-3 rounded-2xl p-3.5" style={{ background: "rgba(0,191,255,0.04)", boxShadow: "inset 0 0 0 1px rgba(0,191,255,0.2)" }}>
      {!review && (
        <>
          <div className="flex items-center gap-2.5">
            <AiOrb size={28} active={busy === "analyze"} />
            <p className="text-[0.8rem] text-brand-textSecondary">
              A Duni confere este treino com o seu último mês, dor, check-ins e a fase do plano.
            </p>
          </div>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder='Discorda de algo? Conte (opcional). Ex.: "acho leve demais", "a lombar está doendo"'
            className="od-input od-input-sm resize-none"
            aria-label="O que você não concordou no treino"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={analyze} disabled={busy !== null} className="od-btn od-btn-primary od-btn-sm">
              {busy === "analyze" ? "A Duni está analisando…" : "Analisar"}
            </button>
            <button type="button" onClick={onClose} disabled={busy !== null} className="od-btn od-btn-ghost od-btn-sm">Cancelar</button>
          </div>
        </>
      )}

      {error && (
        <p className="text-xs text-brand-danger"><span className="font-semibold">{error.title}.</span> {error.detail}</p>
      )}

      {review && v && (
        <div className="animate-od-fade-up space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold" style={{ color: v.color, background: `${v.color}1a` }}>{v.icon}</span>
            <span className="font-display text-[0.95rem] font-bold" style={{ color: v.color }}>{v.label}</span>
          </div>
          <p className="text-[0.84rem] leading-snug">{review.explanation}</p>
          {review.points.length > 0 && (
            <ul className="space-y-1 text-[0.78rem] text-brand-textSecondary">
              {review.points.map((pt, i) => <li key={i} className="flex gap-1.5"><span className="text-brand-muted">•</span>{pt}</li>)}
            </ul>
          )}

          {p && (
            <div className="rounded-xl bg-black/25 px-3 py-2.5">
              <div className="od-metric-label mb-1" style={{ color: v.color }}>Sugestão da Duni</div>
              <div className="text-[0.9rem] font-semibold">{p.title}</div>
              <div className="text-[0.74rem] text-brand-textSecondary">
                {[
                  p.targets?.tipo,
                  p.target_distance_m ? `${(Number(p.target_distance_m) / 1000).toFixed(1).replace(".", ",")} km` : null,
                  p.target_duration_s ? formatDuration(p.target_duration_s) : null,
                  p.target_intensity,
                ].filter(Boolean).join(" · ")}
              </div>
              {(p.targets?.ritmo || p.targets?.zona_fc) && (
                <div className="mt-1 text-[0.74rem]">
                  {p.targets?.ritmo && <span><span className="text-brand-muted">Ritmo </span>{p.targets.ritmo}</span>}
                  {p.targets?.ritmo && p.targets?.zona_fc && " · "}
                  {p.targets?.zona_fc && <span><span className="text-brand-muted">FC </span>{p.targets.zona_fc}</span>}
                </div>
              )}
              {p.steps && p.steps.length > 0 && (
                <ol className="mt-2 space-y-0.5 text-[0.72rem] text-brand-textSecondary">
                  {p.steps.map((s, i) => (
                    <li key={i}>
                      <span className="font-semibold text-white">{PHASE[s.fase] ?? s.fase}:</span> {s.descricao}
                      {[s.distancia_km ? `${s.distancia_km} km` : null, s.ritmo, s.zona_fc].filter(Boolean).map((x) => ` · ${x}`).join("")}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {review.verdict === "ajustar" && review.suggestion && (
              <button type="button" onClick={() => apply("ajustar")} disabled={busy !== null} className="od-btn od-btn-primary od-btn-sm">
                {busy === "apply" ? "Trocando…" : "Trocar por este"}
              </button>
            )}
            {review.verdict === "descanso" && (
              <button type="button" onClick={() => apply("descanso")} disabled={busy !== null} className="od-btn od-btn-primary od-btn-sm">
                {busy === "apply" ? "Salvando…" : "Descansar neste dia"}
              </button>
            )}
            <button type="button" onClick={onClose} disabled={busy !== null} className="od-btn od-btn-ghost od-btn-sm">
              {review.verdict === "manter" ? "Ok" : "Manter o meu treino"}
            </button>
            <button type="button" onClick={() => setReview(null)} disabled={busy !== null} className="od-btn od-btn-ghost od-btn-sm">
              Perguntar outra coisa
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
