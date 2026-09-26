"use client";

import Link from "next/link";
import { Panel, Skeleton, StatusDot } from "@/components/ui/primitives";
import { SportTile } from "@/components/SportIcon";
import { parseLocalDate, toISODate, WEEK_LABELS } from "@/lib/athlete";
import type { PlannedWorkout, TrainingRecommendation } from "@/lib/api";
import { formatDuration, sportLabel } from "@/lib/utils";

export function AiOrb({ size = 48, active = true }: { size?: number; active?: boolean }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden>
      <div
        className={`absolute inset-0 rounded-full ${active ? "animate-od-breathe" : ""}`}
        style={{ background: active ? "radial-gradient(circle, rgba(0,255,102,0.38), rgba(0,255,102,0.02) 70%)" : "radial-gradient(circle, rgba(255,255,255,0.12), transparent 70%)" }}
      />
      <svg className="absolute inset-0" viewBox="0 0 48 48" style={active ? { animation: "od-orbit 9s linear infinite" } : undefined}>
        <circle cx="24" cy="24" r="21.5" fill="none" stroke={active ? "rgba(0,255,102,0.45)" : "rgba(255,255,255,0.15)"} strokeWidth="1" strokeDasharray="1.5 4.5" />
      </svg>
      <svg className="absolute inset-0" viewBox="0 0 48 48" style={active ? { animation: "od-orbit 5s linear infinite reverse" } : undefined}>
        <circle cx="24" cy="24" r="15" fill="none" stroke={active ? "rgba(198,255,0,0.55)" : "rgba(255,255,255,0.12)"} strokeWidth="1.2" strokeDasharray="14 9" strokeLinecap="round" />
      </svg>
      <div
        className="absolute rounded-full"
        style={{
          inset: size * 0.36,
          background: active ? "radial-gradient(circle at 35% 35%, #C6FF00, #00FF66)" : "#444",
          boxShadow: active ? "0 0 16px rgba(0,255,102,0.8)" : undefined,
        }}
      />
    </div>
  );
}

function dayLabel(iso: string): string {
  const today = toISODate(new Date());
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  if (iso === today) return "Hoje";
  if (iso === toISODate(tomorrow)) return "Amanhã";
  const d = parseLocalDate(iso);
  return `${WEEK_LABELS[(d.getDay() + 6) % 7]} · ${d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}`;
}

export function CoachCard({
  workouts, planState, recommendation, className = "",
}: {
  workouts: PlannedWorkout[];
  planState: "loading" | "ok" | "error";
  recommendation: TrainingRecommendation | null;
  className?: string;
}) {
  const todayIso = toISODate(new Date());
  const upcoming = workouts.filter((w) => w.status === "planned" && w.date >= todayIso);
  const next = upcoming[0] ?? null;
  const weekAhead = new Date(); weekAhead.setDate(weekAhead.getDate() + 7);
  const countWeek = upcoming.filter((w) => w.date <= toISODate(weekAhead)).length;
  const online = planState === "ok";

  return (
    <Panel variant="accent" className={`flex flex-col overflow-hidden ${className}`} aria-label="Duni, sua treinadora">
      {online && <div className="od-scanline" />}

      <div className="relative flex items-center justify-between gap-3">
        <h2 className="od-label od-label-accent whitespace-nowrap">Duni · sua treinadora</h2>
        <span
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[0.56rem] font-semibold tracking-[0.08em]"
          style={{ color: online ? "#00FF66" : "#888", background: online ? "rgba(0,255,102,0.06)" : "rgba(255,255,255,0.04)", boxShadow: `inset 0 0 0 1px ${online ? "rgba(0,255,102,0.22)" : "rgba(255,255,255,0.08)"}` }}
        >
          AI ANALYSIS <StatusDot color={online ? "#00FF66" : "#666"} pulse={online} size={5} /> {planState === "loading" ? "SYNC" : online ? "ACTIVE" : "OFFLINE"}
        </span>
      </div>

      <div className="relative mt-5 flex items-center gap-3.5">
        <AiOrb active={planState !== "error"} />
        <p className="font-display text-[1.15rem] font-bold leading-snug">
          {planState === "loading"
            ? "Carregando seu plano…"
            : planState === "error"
              ? "A Duni está indisponível agora."
              : next
                ? <>Seu próximo treino <span className="text-brand-accent">está pronto.</span></>
                : "Nenhum plano ativo."}
        </p>
      </div>

      <div className="relative mt-5 flex-1">
        {planState === "loading" ? (
          <Skeleton className="h-36" />
        ) : next ? (
          <div className="od-tile p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="od-badge">{dayLabel(next.date)}</span>
                <h3 className="mt-2.5 truncate font-display text-[1.3rem] font-extrabold leading-tight">{next.title}</h3>
                <p className="mt-0.5 text-xs text-brand-muted">{sportLabel(next.sport)}</p>
              </div>
              <SportTile sport={next.sport} size={42} radius={12} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/5 pt-3.5">
              <div>
                <div className="od-metric-label">Distância</div>
                <div className="od-num mt-1 text-[1.15rem]">
                  {next.target_distance_m ? <>{(next.target_distance_m / 1000).toFixed(1)}<span className="ml-0.5 font-sans text-[0.7rem] text-brand-muted">km</span></> : "—"}
                </div>
              </div>
              <div>
                <div className="od-metric-label">Duração</div>
                <div className="od-num mt-1 text-[1.15rem]">{next.target_duration_s ? formatDuration(next.target_duration_s) : "—"}</div>
              </div>
              <div>
                <div className="od-metric-label">Intensidade</div>
                <div className="od-num mt-1 truncate text-[1.15rem] text-brand-lime">{next.target_intensity || "—"}</div>
              </div>
            </div>
            {next.description && <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-brand-muted">{next.description}</p>}
          </div>
        ) : (
          <div className="od-tile p-4 text-sm text-brand-muted">
            {planState === "error"
              ? "Não foi possível falar com a Duni. Verifique a configuração da API."
              : "Peça à Duni um plano semanal baseado na sua carga, recuperação e histórico recente."}
          </div>
        )}
      </div>

      {recommendation && recommendation.type !== "unknown" && (
        <div className="relative mt-3 flex items-center gap-2 text-xs text-brand-textSecondary">
          <StatusDot color={recommendation.color} size={6} />
          <span className="truncate">Recomendação de hoje: <strong className="font-semibold" style={{ color: recommendation.color }}>{recommendation.label}</strong></span>
        </div>
      )}

      <div className="relative mt-4 flex items-center gap-3">
        <Link href="/coach" className="od-btn od-btn-primary flex-1">
          {next ? "Ver treino" : "Falar com a Duni"} <span aria-hidden>→</span>
        </Link>
        {online && countWeek > 0 && (
          <span className="text-[0.7rem] leading-tight text-brand-muted"><strong className="text-white">{countWeek}</strong> treinos<br />nos próx. 7 dias</span>
        )}
      </div>
    </Panel>
  );
}
