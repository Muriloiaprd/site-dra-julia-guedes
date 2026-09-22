"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { kindLabel, MemoryPanel, whenLabel } from "@/components/coach/MemoryPanel";
import { AiOrb } from "@/components/dashboard/CoachCard";
import { SportTile } from "@/components/SportIcon";
import { Markdown } from "@/components/ui/Markdown";
import { Alert, PageContainer, Panel, Skeleton, StatusDot } from "@/components/ui/primitives";
import {
  CoachApiError,
  createMemory,
  fetchCoachHistory,
  fetchMemories,
  fetchCoachPlan,
  fetchLoadMetrics,
  fetchMe,
  fetchPredictionsOverview,
  postCoachAnalyze,
  postCoachChat,
  postCoachGeneratePlan,
  type AthleteMemory,
  type CoachChatMessage,
  type DailyMetric,
  type MemorySuggestion,
  type PlannedWorkout,
  type PredictionsOverview,
} from "@/lib/api";
import { formFromTsb, latestMetric, parseLocalDate, riskFromAcwr, toISODate, WEEK_LABELS } from "@/lib/athlete";
import { formatDuration, sportLabel } from "@/lib/utils";

function errorMessage(e: unknown): { title: string; detail: string } {
  if (e instanceof CoachApiError) {
    switch (e.detail.error) {
      case "not_configured":
        return {
          title: "A Duni ainda não está configurada",
          detail:
            "Falta a chave do Gemini: gere uma grátis em aistudio.google.com/apikey e coloque em GEMINI_API_KEY no Ondilow/.env. Depois reinicie a API.",
        };
      case "quota_exceeded":
        return {
          title: "Limite gratuito do Gemini atingido",
          detail: "A cota grátis acabou por agora. Volta a funcionar sozinho mais tarde (a cota diária renova todo dia) — não adianta insistir agora.",
        };
      case "invalid_key":
        return { title: "Chave do Gemini inválida", detail: "Confira a GEMINI_API_KEY no Ondilow/.env (sem espaços nem aspas) e reinicie a API." };
      case "model_not_found":
        return { title: "Modelo do Gemini não encontrado", detail: "O modelo em GEMINI_MODEL não existe mais ou não está no plano grátis." };
      case "llm_unavailable":
        return { title: "Gemini sobrecarregado", detail: "Os modelos grátis do Gemini estão com muita demanda agora. Tente de novo em alguns minutos." };
      case "llm_timeout":
        return { title: "O Gemini demorou demais", detail: "A fila do plano grátis está lenta agora e a resposta não chegou a tempo. Tente de novo em alguns minutos." };
      case "insufficient_data":
        return {
          title: "Ainda não há dados suficientes",
          detail: `Você tem ${e.detail.weeks_available ?? 0} semana(s) de atividades — são necessárias pelo menos 2 semanas para uma análise confiável.`,
        };
      case "invalid_plan_response":
        return { title: "Não consegui gerar um plano válido", detail: "Tente gerar de novo." };
      case "invalid_response":
        return { title: "A resposta veio num formato inválido", detail: "Acontece às vezes com o modelo grátis. Mande a mensagem de novo." };
    }
  }
  return { title: "Erro", detail: e instanceof Error ? e.message : "Erro desconhecido" };
}

/** O que a Duni realmente le do seu contexto (ai/coach_service.build_context). */
const ANALYSIS_STEPS = [
  "Volume de 7, 14 e 28 dias",
  "Tendência de 8 semanas",
  "Sinais de fadiga",
  "Check-ins e memórias",
  "Plano feito × pulado",
];

const SUGGESTIONS = [
  "Como está minha recuperação esta semana?",
  "Posso fazer um treino intenso amanhã?",
  "Estou evoluindo nas corridas parecidas?",
  "Minha carga está segura para aumentar o volume?",
];

function ProcessingPanel({ title }: { title: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, ANALYSIS_STEPS.length - 1)), 1400);
    return () => clearInterval(t);
  }, []);
  return (
    <Panel variant="hero" className="overflow-hidden" aria-live="polite">
      <div className="od-scanline" />
      <div className="relative flex items-center gap-4">
        <AiOrb size={56} />
        <div>
          <div className="font-mono text-[0.62rem] tracking-[0.18em] text-brand-accent">DUNI · ANALISANDO</div>
          <p className="mt-1 font-display text-xl font-bold">{title}</p>
        </div>
      </div>
      <ul className="relative mt-5 grid gap-2 sm:grid-cols-5">
        {ANALYSIS_STEPS.map((s, i) => {
          const state = i < step ? "done" : i === step ? "active" : "wait";
          return (
            <li key={s} className="od-tile flex items-center gap-2 px-3 py-2.5 text-xs transition-all duration-300"
              style={state === "active" ? { boxShadow: "inset 0 0 0 1px rgba(0,255,102,0.4)", background: "rgba(0,255,102,0.06)" } : undefined}>
              {state === "done"
                ? <span className="text-brand-accent">✓</span>
                : state === "active"
                  ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-accent/25 border-t-brand-accent" />
                  : <span className="h-1.5 w-1.5 rounded-full bg-white/15" />}
              <span className={state === "wait" ? "text-brand-textTertiary" : "text-brand-textSecondary"}>{s}</span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function dayLabel(iso: string) {
  const today = toISODate(new Date());
  const tm = new Date(); tm.setDate(tm.getDate() + 1);
  if (iso === today) return "Hoje";
  if (iso === toISODate(tm)) return "Amanhã";
  const d = parseLocalDate(iso);
  return `${WEEK_LABELS[(d.getDay() + 6) % 7]} ${d.getDate()}`;
}

/** Mensagem na tela: as sugestoes de memoria so existem na sessao (nao voltam no historico). */
type ChatMessage = CoachChatMessage & { suggestions?: (MemorySuggestion & { state?: "saved" | "dismissed" })[] };

export default function CoachPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [memories, setMemories] = useState<AthleteMemory[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [reportMeta, setReportMeta] = useState<{ model: string; at: string } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [planCount, setPlanCount] = useState<number | null>(null);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const [overview, setOverview] = useState<PredictionsOverview | null>(null);
  const [metrics, setMetrics] = useState<DailyMetric[]>([]);
  const [plan, setPlan] = useState<PlannedWorkout[] | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMe().then((u) => { if (!u) router.push("/login"); });
    fetchCoachHistory().then(setMessages).catch(() => {});
    fetchPredictionsOverview().then(setOverview).catch(() => {});
    fetchLoadMetrics(30).then(setMetrics).catch(() => {});
    fetchCoachPlan(14).then(setPlan).catch(() => setPlan([]));
    fetchMemories().then(setMemories).catch(() => {});
  }, [router]);

  function setSuggestionState(msgIndex: number, sIndex: number, state: "saved" | "dismissed") {
    setMessages((ms) => ms.map((m, i) => i !== msgIndex || !m.suggestions ? m : {
      ...m,
      suggestions: m.suggestions.map((s, j) => (j === sIndex ? { ...s, state } : s)),
    }));
  }

  async function acceptSuggestion(msgIndex: number, sIndex: number, s: MemorySuggestion) {
    try {
      const saved = await createMemory({ kind: s.kind, content: s.content, event_date: s.event_date, source: "duni" });
      setMemories((ms) => [...ms, saved]);
      setSuggestionState(msgIndex, sIndex, "saved");
    } catch (e) {
      handleError(e);
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, sending]);

  function handleError(e: unknown) {
    if (e instanceof CoachApiError && e.detail.error === "not_configured") setNotConfigured(true);
    setError(errorMessage(e));
  }

  async function handleSend(text?: string) {
    const message = (text ?? input).trim();
    if (!message || sending) return;
    setInput("");
    setError(null);
    setMessages((m) => [...m, { role: "user", content: message, created_at: new Date().toISOString() }]);
    setSending(true);
    try {
      const { reply, memory_suggestions } = await postCoachChat(message);
      setMessages((m) => [...m, { role: "assistant", content: reply, created_at: new Date().toISOString(), suggestions: memory_suggestions }]);
    } catch (e) {
      handleError(e);
    } finally {
      setSending(false);
    }
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    setError(null);
    setReport(null);
    try {
      const { report, model_used, generated_at } = await postCoachAnalyze();
      setReport(report);
      setReportMeta({ model: model_used, at: generated_at });
    } catch (e) {
      handleError(e);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleGeneratePlan() {
    setGenerating(true);
    setError(null);
    setPlanCount(null);
    try {
      const workouts = await postCoachGeneratePlan(7);
      setPlanCount(workouts.length);
      fetchCoachPlan(14).then(setPlan).catch(() => {});
    } catch (e) {
      handleError(e);
    } finally {
      setGenerating(false);
    }
  }

  const latest = latestMetric(metrics);
  const form = formFromTsb(latest?.tsb ?? null);
  const risk = riskFromAcwr(latest?.acwr ?? null);
  const upcoming = (plan ?? []).filter((w) => w.date >= toISODate(new Date()));
  const busy = analyzing || generating;

  const insights = [
    {
      k: "Recomendação",
      v: overview?.recommendation.label ?? "—",
      s: overview?.recommendation.detail ?? "Baseada em TSB e ACWR",
      c: overview?.recommendation.color ?? "#888",
    },
    { k: "Forma", v: form.label, s: latest?.tsb != null ? `TSB ${latest.tsb > 0 ? "+" : ""}${latest.tsb.toFixed(1)}` : "Sem métricas de carga", c: form.color },
    { k: "Risco", v: risk.label, s: latest?.acwr != null ? `ACWR ${latest.acwr.toFixed(2)} · ${risk.zone}` : "Sem dados", c: risk.color },
    { k: "Plano ativo", v: plan == null ? "—" : `${upcoming.length} treino${upcoming.length === 1 ? "" : "s"}`, s: "Próximos 14 dias", c: upcoming.length ? "#00FF66" : "#888" },
  ];

  return (
    <PageContainer>
      {/* ───────── Hero ───────── */}
      <Panel variant="hero" className="mb-4 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage: "radial-gradient(rgba(0,255,102,0.14) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
            maskImage: "radial-gradient(ellipse 45% 80% at 12% 50%, #000, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse 45% 80% at 12% 50%, #000, transparent 75%)",
          }}
        />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <AiOrb size={76} active={!notConfigured} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 font-mono text-[0.62rem] tracking-[0.2em]">
                <span className="text-brand-accent">ONDILOW · TREINADORA DE IA</span>
                <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5" style={{ color: notConfigured ? "#FFC145" : "#00FF66", background: notConfigured ? "rgba(255,193,69,0.08)" : "rgba(0,255,102,0.06)", boxShadow: `inset 0 0 0 1px ${notConfigured ? "rgba(255,193,69,0.3)" : "rgba(0,255,102,0.22)"}` }}>
                  <StatusDot color={notConfigured ? "#FFC145" : "#00FF66"} pulse={!notConfigured} size={5} />
                  {busy ? "ANALISANDO" : notConfigured ? "NÃO CONFIGURADO" : "PRONTO"}
                </span>
              </div>
              <h1 className="mt-2 font-display text-[1.7rem] font-extrabold leading-tight tracking-tight sm:text-[2.1rem]">
                <span className="text-brand-accent">Duni</span>, sua treinadora
              </h1>
              <p className="mt-1.5 max-w-xl text-sm text-brand-muted">
                Treinadora de corrida de rua. Direta e exigente, mas sem jargão: lê seu histórico real antes de mandar qualquer treino.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["Carga", "Fadiga", "Evolução", "Check-ins", "Memórias", "Aderência"].map((c) => (
                  <span key={c} className="od-badge od-badge-muted !normal-case !tracking-normal">{c}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid shrink-0 gap-2 sm:grid-cols-2 lg:w-[420px]">
            <button onClick={handleAnalyze} disabled={busy} className="od-tile group p-4 text-left transition-all duration-200 enabled:hover:-translate-y-0.5 enabled:hover:shadow-[inset_0_0_0_1px_rgba(0,255,102,0.35)] disabled:opacity-50">
              <div className="flex items-center gap-2 text-brand-accent">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 6-6" /></svg>
                <span className="text-sm font-bold text-white">{analyzing ? "Analisando…" : "Gerar relatório"}</span>
              </div>
              <p className="mt-1.5 text-xs leading-snug text-brand-muted">Resumo da semana: status, carga, fadiga, evolução e próximos passos.</p>
            </button>
            <button onClick={handleGeneratePlan} disabled={busy} className="od-tile group p-4 text-left transition-all duration-200 enabled:hover:-translate-y-0.5 enabled:hover:shadow-[inset_0_0_0_1px_rgba(0,255,102,0.35)] disabled:opacity-50">
              <div className="flex items-center gap-2 text-brand-lime">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="m9 16 2 2 4-4" /></svg>
                <span className="text-sm font-bold text-white">{generating ? "Gerando…" : "Gerar plano (7 dias)"}</span>
              </div>
              <p className="mt-1.5 text-xs leading-snug text-brand-muted">Treinos da semana, ajustados à sua carga, recuperação e objetivo.</p>
            </button>
          </div>
        </div>
      </Panel>

      <div className="space-y-4">
        {/* ───────── Insights ───────── */}
        <div className="od-stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
          {insights.map((it) => (
            <Panel key={it.k} className="!p-4">
              <div className="flex items-center gap-2">
                <StatusDot color={it.c} size={6} />
                <span className="od-metric-label">{it.k}</span>
              </div>
              <div className="od-num mt-2 truncate text-[1.25rem] leading-tight" style={{ color: it.c === "#888" || it.c === "#888888" ? "#fff" : it.c }}>{it.v}</div>
              <p className="mt-1 line-clamp-2 text-[0.72rem] leading-snug text-brand-muted">{it.s}</p>
            </Panel>
          ))}
        </div>

        {error && (
          <Alert tone="danger" title={error.title}>{error.detail}</Alert>
        )}

        {analyzing && <ProcessingPanel title="Analisando sua semana…" />}
        {generating && <ProcessingPanel title="Montando seu plano de 7 dias…" />}

        {planCount !== null && (
          <Alert tone="accent" title={`Plano gerado com ${planCount} treino(s)`}>
            Já disponível abaixo e no card da Duni no <Link href="/dashboard" className="underline">dashboard</Link>.
          </Alert>
        )}

        {report && (
          <Panel variant="accent" className="animate-od-fade-up">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="od-label od-label-accent">Resumo da Duni</h2>
              {reportMeta && (
                <span className="font-mono text-[0.62rem] tracking-wider text-brand-muted">
                  {new Date(reportMeta.at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · {reportMeta.model}
                </span>
              )}
            </div>
            <Markdown text={report} />
          </Panel>
        )}

        {/* ───────── Chat + plano ───────── */}
        <div className="grid gap-4 xl:grid-cols-12">
          <Panel className="flex flex-col !p-0 xl:col-span-8" style={{ height: 600 }}>
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-3.5">
              <h2 className="od-label">Conversa com a Duni</h2>
              <span className="text-[0.68rem] text-brand-muted">{messages.length} mensagens</span>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <AiOrb size={52} />
                  <p className="max-w-sm text-sm text-brand-muted">Pergunte à Duni sobre seus treinos, carga ou recuperação. Conte também seu objetivo e suas provas.</p>
                  <div className="flex max-w-lg flex-wrap justify-center gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} onClick={() => handleSend(s)} disabled={sending} className="od-chip">{s}</button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md px-4 py-2.5 text-sm text-white" style={{ background: "linear-gradient(135deg, rgba(0,255,102,0.16), rgba(0,255,102,0.07))", boxShadow: "inset 0 0 0 1px rgba(0,255,102,0.22)" }}>
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="mt-0.5"><AiOrb size={26} active={false} /></div>
                    <div className="max-w-[88%] space-y-2">
                      <div className="od-tile rounded-2xl rounded-tl-md px-4 py-3">
                        <Markdown text={m.content} />
                      </div>
                      {m.suggestions && m.suggestions.some((s) => s.state !== "dismissed") && (
                        <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(0,255,102,0.04)", boxShadow: "inset 0 0 0 1px rgba(0,255,102,0.16)" }}>
                          <p className="mb-1.5 text-[0.68rem] font-semibold uppercase tracking-wider text-brand-accent">Guardar para as próximas conversas?</p>
                          <ul className="space-y-1.5">
                            {m.suggestions.map((s, j) => s.state === "dismissed" ? null : (
                              <li key={j} className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="od-badge od-badge-muted !normal-case !tracking-normal">{kindLabel(s.kind)}</span>
                                <span className="min-w-0 flex-1 text-brand-textSecondary">
                                  {s.content}{s.event_date && <span className="text-brand-muted"> · {whenLabel(s.event_date)}</span>}
                                </span>
                                {s.state === "saved" ? (
                                  <span className="text-brand-accent">✓ Guardado</span>
                                ) : (
                                  <span className="flex gap-1">
                                    <button type="button" onClick={() => acceptSuggestion(i, j, s)} className="od-btn od-btn-primary od-btn-sm !px-2 !py-1">Guardar</button>
                                    <button type="button" onClick={() => setSuggestionState(i, j, "dismissed")} className="od-btn od-btn-ghost od-btn-sm !px-2 !py-1">Ignorar</button>
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )
              ))}
              {sending && (
                <div className="flex items-center gap-2.5">
                  <AiOrb size={26} />
                  <div className="od-tile flex items-center gap-1 rounded-2xl rounded-tl-md px-4 py-3" aria-label="Pensando">
                    {[0, 1, 2].map((k) => (
                      <span key={k} className="h-1.5 w-1.5 rounded-full bg-brand-accent" style={{ animation: `od-typing 1.2s ${k * 0.15}s infinite` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-white/5 p-3">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                  placeholder="Pergunte à Duni…"
                  className="od-input flex-1"
                  aria-label="Mensagem para a Duni"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={sending || !input.trim()}
                  className="od-btn od-btn-primary !px-4"
                  aria-label="Enviar"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
                  <span className="hidden sm:inline">Enviar</span>
                </button>
              </div>
            </div>
          </Panel>

          <Panel className="flex flex-col xl:col-span-4" style={{ maxHeight: 600 }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="od-label">Plano ativo</h2>
              <Link href="/dashboard" className="od-link-action">Dashboard <span aria-hidden>→</span></Link>
            </div>
            {plan == null ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
            ) : upcoming.length === 0 ? (
              <div className="od-tile flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="text-sm text-brand-muted">Nenhum treino planejado para os próximos dias.</p>
                <button onClick={handleGeneratePlan} disabled={busy} className="od-btn od-btn-secondary">Gerar plano →</button>
              </div>
            ) : (
              <ol className="relative flex-1 space-y-2 overflow-y-auto pr-1">
                {upcoming.map((w) => {
                  const today = w.date === toISODate(new Date());
                  const parts: string[] = [];
                  if (w.target_distance_m) parts.push(`${(w.target_distance_m / 1000).toFixed(1)} km`);
                  if (w.target_duration_s) parts.push(formatDuration(w.target_duration_s));
                  if (w.target_intensity) parts.push(w.target_intensity);
                  return (
                    <li key={w.id} className="od-tile flex items-center gap-3 p-3" style={today ? { boxShadow: "inset 0 0 0 1px rgba(0,255,102,0.4)", background: "rgba(0,255,102,0.05)" } : undefined}>
                      <div className="w-12 shrink-0 text-center">
                        <div className="text-[0.62rem] font-bold uppercase tracking-wider" style={{ color: today ? "#00FF66" : "#888" }}>{dayLabel(w.date)}</div>
                      </div>
                      <SportTile sport={w.sport} size={32} radius={9} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{w.title}</div>
                        <div className="truncate text-[0.7rem] text-brand-muted">{sportLabel(w.sport)}{parts.length ? ` · ${parts.join(" · ")}` : ""}</div>
                      </div>
                      {w.status !== "planned" && <span className={`od-badge ${w.status === "done" ? "" : "od-badge-muted"}`}>{w.status === "done" ? "Feito" : "Pulado"}</span>}
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>
        </div>

        {/* ───────── Memorias ───────── */}
        <MemoryPanel memories={memories} onChange={setMemories} />
      </div>
    </PageContainer>
  );
}
