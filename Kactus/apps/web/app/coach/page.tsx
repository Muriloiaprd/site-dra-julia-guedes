"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { kindLabel, MemoryPanel, whenLabel } from "@/components/coach/MemoryPanel";
import { AdherencePanel } from "@/components/coach/AdherencePanel";
import { SummaryBody } from "@/components/coach/SummaryBody";
import { GoalPlanPanel } from "@/components/coach/GoalPlanPanel";
import { WeekPlans } from "@/components/coach/WeekPlans";
import { AiOrb } from "@/components/dashboard/CoachCard";
import { Markdown } from "@/components/ui/Markdown";
import { Alert, PageContainer, Panel, StatusDot } from "@/components/ui/primitives";
import {
  applyFreeWeek,
  CoachApiError,
  clearCoachHistory,
  createMemory,
  fetchCoachHistory,
  fetchMemories,
  fetchCoachPlan,
  fetchLoadMetrics,
  fetchMe,
  fetchPredictionsOverview,
  fetchFreeWeek,
  fetchGoalPlan,
  fetchWeekPlan,
  fetchLastCoachReport,
  postCoachAnalyze,
  postCoachChat,
  postCoachGeneratePlan,
  postFreeWeekGenerate,
  postGoalPlanGenerate,
  type AthleteMemory,
  type CoachChatMessage,
  type CoachSummary,
  type DailyMetric,
  type MemorySuggestion,
  type PlannedWorkout,
  type PredictionsOverview,
  type FreeWeekResponse,
  type GoalPlanResponse,
  type WeeklyPlanResponse,
} from "@/lib/api";
import { coachErrorMessage } from "@/lib/coachErrors";
import { formFromTsb, latestMetric, riskFromAcwr, toISODate } from "@/lib/athlete";

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

/** "14:32" da mensagem. */
function msgTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Moldura de celular para a conversa: a Duni e lida como um app de mensagens. */
function PhoneFrame({ children }: { children: ReactNode }) {
  const [now, setNow] = useState("");
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="relative mx-auto w-full max-w-[400px] rounded-[2.9rem] p-[11px]"
      style={{
        background: "linear-gradient(150deg, #2c2f2d, #121413 35%, #1d201e 70%, #0d0f0e)",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.09), 0 0 0 1px #000, 0 40px 90px -40px rgba(0,255,102,0.45)",
      }}
    >
      {/* botoes laterais */}
      <span className="absolute -left-[3px] top-28 h-8 w-[3px] rounded-l bg-[#2a2d2b]" aria-hidden />
      <span className="absolute -left-[3px] top-40 h-14 w-[3px] rounded-l bg-[#2a2d2b]" aria-hidden />
      <span className="absolute -right-[3px] top-36 h-20 w-[3px] rounded-r bg-[#2a2d2b]" aria-hidden />

      <div className="relative flex h-[680px] flex-col overflow-hidden rounded-[2.25rem] bg-[#070807] sm:h-[720px]">
        {/* barra de status + ilha */}
        <div className="relative flex h-11 shrink-0 items-center justify-between px-7 text-[0.74rem] font-semibold">
          <span className="od-num">{now}</span>
          <span className="absolute left-1/2 top-2.5 h-[26px] w-[96px] -translate-x-1/2 rounded-full bg-black" aria-hidden />
          <span className="flex items-center gap-1.5 text-white/90" aria-hidden>
            <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="1" /><rect x="4.3" y="5" width="3" height="6" rx="1" /><rect x="8.6" y="2.5" width="3" height="8.5" rx="1" /><rect x="12.9" y="0" width="3" height="11" rx="1" /></svg>
            <svg width="22" height="11" viewBox="0 0 22 11" fill="none"><rect x="0.5" y="0.5" width="18" height="10" rx="3" stroke="currentColor" opacity="0.5" /><rect x="2" y="2" width="13" height="7" rx="1.6" fill="currentColor" /><rect x="19.5" y="3.5" width="1.6" height="4" rx="0.8" fill="currentColor" opacity="0.5" /></svg>
          </span>
        </div>
        {children}
        {/* barra de inicio */}
        <div className="flex h-6 shrink-0 items-center justify-center" aria-hidden>
          <span className="h-[5px] w-32 rounded-full bg-white/35" />
        </div>
      </div>
    </div>
  );
}

/** Botao grande do topo: as duas acoes principais da Duni precisam saltar aos olhos. */
function ActionButton({ onClick, disabled, color, title, text, icon }: {
  onClick: () => void;
  disabled: boolean;
  color: string;
  title: string;
  text: string;
  icon: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group relative overflow-hidden rounded-2xl p-4 text-left transition-all duration-200 enabled:hover:-translate-y-1 disabled:opacity-50 sm:p-5"
      style={{
        background: `radial-gradient(220px 120px at 0% 0%, ${color}30, transparent 70%), linear-gradient(160deg, ${color}1c, ${color}08)`,
        boxShadow: `inset 0 0 0 1.5px ${color}70, 0 14px 40px -18px ${color}`,
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#041a0b] transition-transform duration-200 group-enabled:group-hover:scale-110"
          style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)`, boxShadow: `0 0 22px -4px ${color}` }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>{icon}</svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-[1.05rem] font-bold leading-tight text-white">{title}</span>
            <span className="text-lg transition-transform duration-200 group-enabled:group-hover:translate-x-1" style={{ color }} aria-hidden>→</span>
          </div>
          <p className="mt-1 text-[0.78rem] leading-snug text-brand-textSecondary">{text}</p>
        </div>
      </div>
    </button>
  );
}

/** Mensagem na tela: as sugestoes de memoria so existem na sessao (nao voltam no historico). */
type ChatMessage = CoachChatMessage & { suggestions?: (MemorySuggestion & { state?: "saved" | "dismissed" })[] };

export default function CoachPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [memories, setMemories] = useState<AthleteMemory[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [summary, setSummary] = useState<CoachSummary | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [reportMeta, setReportMeta] = useState<{ model: string; at: string } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [goal, setGoal] = useState<GoalPlanResponse | null>(null);
  const [generatingGoal, setGeneratingGoal] = useState(false);
  const [goalCount, setGoalCount] = useState<number | null>(null);
  const [free, setFree] = useState<FreeWeekResponse | null>(null);
  const [generatingFree, setGeneratingFree] = useState(false);
  const [usingFree, setUsingFree] = useState<string | null>(null);
  const [planCount, setPlanCount] = useState<number | null>(null);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const [overview, setOverview] = useState<PredictionsOverview | null>(null);
  const [metrics, setMetrics] = useState<DailyMetric[]>([]);
  const [plan, setPlan] = useState<PlannedWorkout[] | null>(null);
  const [week, setWeek] = useState<WeeklyPlanResponse | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const analyzeRequested = useRef(false);

  useEffect(() => {
    fetchMe().then((u) => { if (!u) router.push("/login"); });
    fetchCoachHistory().then(setMessages).catch(() => {});
    fetchPredictionsOverview().then(setOverview).catch(() => {});
    fetchLoadMetrics(30).then(setMetrics).catch(() => {});
    fetchCoachPlan(14).then(setPlan).catch(() => setPlan([]));
    fetchMemories().then(setMemories).catch(() => {});
    fetchWeekPlan().then(setWeek).catch(() => setWeek({ plan: null, workouts: [] }));
    fetchGoalPlan().then(setGoal).catch(() => setGoal({ plan: null, workouts: [] }));
    fetchFreeWeek().then(setFree).catch(() => setFree({ plan: null, workouts: [], comparison: null }));
    fetchLastCoachReport()
      .then((r) => {
        // nao sobrescreve um resumo pedido enquanto este carregava
        if (!r || analyzeRequested.current) return;
        setSummary(r.summary);
        setReport(r.report);
        setReportMeta({ model: r.model_used, at: r.generated_at });
      })
      .catch(() => {});
  }, [router]);

  async function refreshPlans() {
    const [w, p] = await Promise.all([fetchWeekPlan(), fetchCoachPlan(14)]);
    setWeek(w);
    setPlan(p);
  }

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
    // rola so a caixa do chat: scrollIntoView levava a pagina inteira ate o chat ao abrir
    const el = chatRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  function handleError(e: unknown) {
    if (e instanceof CoachApiError && e.detail.error === "not_configured") setNotConfigured(true);
    setError(coachErrorMessage(e));
  }

  async function handleClear() {
    setClearing(true);
    setError(null);
    try {
      await clearCoachHistory();
      setMessages([]);
      setReplyTo(null);
      setConfirmClear(false);
    } catch {
      setError({ title: "Não consegui limpar a conversa", detail: "Tente de novo em instantes." });
    } finally {
      setClearing(false);
    }
  }

  async function handleSend(text?: string) {
    const message = (text ?? input).trim();
    if (!message || sending) return;
    setInput("");
    setReplyTo(null);
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
    analyzeRequested.current = true;
    setAnalyzing(true);
    setError(null);
    setSummary(null);
    setReport(null);
    try {
      const res = await postCoachAnalyze();
      setSummary(res.summary);
      setReport(res.report);
      setReportMeta({ model: res.model_used, at: res.generated_at });
    } catch (e) {
      handleError(e);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleGenerateGoal(daysPerWeek: number) {
    setGeneratingGoal(true);
    setError(null);
    setGoalCount(null);
    try {
      const res = await postGoalPlanGenerate(daysPerWeek);
      setGoal(res);
      setGoalCount(res.workouts.length);
      // os treinos planejados de hoje em diante mudaram
      await refreshPlans().catch(() => {});
    } catch (e) {
      handleError(e);
    } finally {
      setGeneratingGoal(false);
    }
  }

  async function handleGenerateFree() {
    setGeneratingFree(true);
    setError(null);
    try {
      setFree(await postFreeWeekGenerate());
    } catch (e) {
      handleError(e);
    } finally {
      setGeneratingFree(false);
    }
  }

  async function handleUseFree(dates?: string[]) {
    setUsingFree(dates?.length === 1 ? dates[0] : "all");
    setError(null);
    try {
      setWeek(await applyFreeWeek(dates));
      fetchCoachPlan(14).then(setPlan).catch(() => {});
      fetchGoalPlan().then(setGoal).catch(() => {});
    } catch (e) {
      handleError(e);
    } finally {
      setUsingFree(null);
    }
  }

  async function handleGeneratePlan() {
    setGenerating(true);
    setError(null);
    setPlanCount(null);
    try {
      const res = await postCoachGeneratePlan();
      setWeek(res);
      setPlanCount(res.workouts.length);
      fetchCoachPlan(14).then(setPlan).catch(() => {});
    } catch (e) {
      handleError(e);
    } finally {
      setGenerating(false);
    }
  }

  function answerInChat(question: string) {
    setReplyTo(question);
    inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    inputRef.current?.focus({ preventScroll: true });
  }

  const latest = latestMetric(metrics);
  const form = formFromTsb(latest?.tsb ?? null);
  const risk = riskFromAcwr(latest?.acwr ?? null);
  const upcoming = (plan ?? []).filter((w) => w.date >= toISODate(new Date()));
  const busy = analyzing || generating || generatingGoal || generatingFree;

  const insights = [
    {
      k: "Hoje",
      v: overview?.recommendation.label ?? "—",
      s: overview?.recommendation.detail ?? "Pela sua carga recente",
      c: overview?.recommendation.color ?? "#888",
    },
    { k: "Forma", v: form.label, s: form.hint ?? "", c: form.color, t: latest?.tsb != null ? `Disposição (TSB) ${latest.tsb.toFixed(1)}` : undefined },
    { k: "Risco de lesão", v: risk.label, s: risk.hint ?? "", c: risk.color, t: latest?.acwr != null ? `Salto de carga (ACWR) ${latest.acwr.toFixed(2)}` : undefined },
    { k: "Treinos planejados", v: plan == null ? "—" : `${upcoming.length}`, s: "Nos próximos 14 dias", c: upcoming.length ? "#00FF66" : "#888" },
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
        <div className="relative flex flex-col gap-6">
          <div className="flex items-center gap-5">
            <AiOrb size={76} active={!notConfigured} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 font-mono text-[0.62rem] tracking-[0.2em]">
                <span className="text-brand-accent">KACTUS · TREINADORA DE IA</span>
                <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5" style={{ color: notConfigured ? "#FFC145" : "#00FF66", background: notConfigured ? "rgba(255,193,69,0.08)" : "rgba(0,255,102,0.06)", boxShadow: `inset 0 0 0 1px ${notConfigured ? "rgba(255,193,69,0.3)" : "rgba(0,255,102,0.22)"}` }}>
                  <StatusDot color={notConfigured ? "#FFC145" : "#00FF66"} pulse={!notConfigured} size={5} />
                  {busy ? "ANALISANDO" : notConfigured ? "NÃO CONFIGURADO" : "PRONTO"}
                </span>
              </div>
              <h1 className="mt-2 font-display text-[1.7rem] font-extrabold leading-tight tracking-tight sm:text-[2.1rem]">
                <span className="text-brand-accent">Duni</span>, sua treinadora
              </h1>
              <p className="mt-1.5 max-w-xl text-sm text-brand-muted">
                Lê seus treinos de verdade e diz, sem enrolar, o que fazer.
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <ActionButton
              onClick={handleAnalyze}
              disabled={busy}
              color="#00FF66"
              title={analyzing ? "Analisando…" : "Gerar relatório"}
              text="Como você está e o que fazer, em 20 segundos."
              icon={<><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 6-6" /></>}
            />
            <ActionButton
              onClick={handleGeneratePlan}
              disabled={busy}
              color="#C6FF00"
              title={generating ? "Gerando…" : "Gerar plano da semana"}
              text="Os treinos dos próximos 7 dias, do seu jeito."
              icon={<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="m9 16 2 2 4-4" /></>}
            />
            <ActionButton
              onClick={() => handleGenerateGoal(goal?.plan?.days_per_week ?? 3)}
              disabled={busy}
              color="#00BFFF"
              title={generatingGoal ? "Montando…" : "Gerar plano do objetivo"}
              text="Todos os treinos até a sua prova, em fases."
              icon={<><path d="M4 22V4" /><path d="M4 4h12l-2 4 2 4H4" /></>}
            />
          </div>
        </div>
      </Panel>

      <div className="space-y-4">
        {error && (
          <Alert tone="danger" title={error.title}>{error.detail}</Alert>
        )}

        {analyzing && <ProcessingPanel title="Analisando sua semana…" />}
        {generating && <ProcessingPanel title="Montando o plano da semana…" />}
        {generatingGoal && <ProcessingPanel title="Montando o plano até a prova…" />}

        {goalCount !== null && goal?.plan && (
          <Alert tone="accent" title={`Plano até a prova pronto: ${goalCount} treinos`}>
            Veja as fases e as semanas no quadro &quot;Plano do objetivo&quot;. O passo a passo de cada semana sai no &quot;Gerar plano da semana&quot;.
          </Alert>
        )}

        {planCount !== null && (
          <Alert tone="accent" title={`Plano da semana pronto: ${planCount} treino${planCount === 1 ? "" : "s"}`}>
            Veja o status e cada treino no quadro logo abaixo. Também aparece no card da Duni no <Link href="/dashboard" className="underline">dashboard</Link>.
          </Alert>
        )}

        {/* ───────── Resumo + indicadores, no mesmo quadro ───────── */}
        <Panel variant="accent" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="od-label od-label-accent">Resumo da Duni</h2>
            {reportMeta && (
              <span className="font-mono text-[0.62rem] tracking-wider text-brand-muted">
                {new Date(reportMeta.at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>

          {/* resumo de um lado; os 4 indicadores, um embaixo do outro, do outro */}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_270px]">
            <div className="min-w-0">
              {summary ? (
                <SummaryBody summary={summary} onAnswer={answerInChat} />
              ) : report ? (
                <div className="animate-od-fade-up"><Markdown text={report} /></div>
              ) : !analyzing && (
                <div className="flex h-full flex-col items-start justify-center gap-3 rounded-xl bg-white/[0.02] px-4 py-3.5">
                  <p className="text-sm text-brand-muted">A Duni ainda não fez o resumo. Peça o relatório para ela dizer como você está e o que fazer.</p>
                  <button type="button" onClick={handleAnalyze} disabled={busy} className="od-btn od-btn-primary od-btn-sm">Gerar relatório</button>
                </div>
              )}
            </div>

            <div className="od-stagger grid content-start grid-cols-2 gap-2.5 lg:grid-cols-1">
              {insights.map((it) => (
                <div key={it.k} className="od-tile px-4 py-3" style={{ boxShadow: `inset 0 0 0 1px ${it.c}2e` }}>
                  <div className="flex items-center gap-2" title={it.t}>
                    <StatusDot color={it.c} size={6} />
                    <span className="od-metric-label">{it.k}</span>
                  </div>
                  <div className="od-num mt-1.5 truncate text-[1.2rem] leading-tight" style={{ color: it.c === "#888" || it.c === "#888888" ? "#fff" : it.c }}>{it.v}</div>
                  <p className="mt-0.5 line-clamp-2 text-[0.72rem] leading-snug text-brand-muted">{it.s}</p>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* ───────── Plano do objetivo (ate a prova) ───────── */}
        {goal && <GoalPlanPanel goal={goal} onGenerate={handleGenerateGoal} generating={generatingGoal} />}

        {/* ───────── Planejado × feito ───────── */}
        <AdherencePanel days={14} />

        {/* ───────── Plano da semana ───────── */}
        {week && (
          <WeekPlans
            week={week}
            goalWorkouts={(goal?.workouts ?? []).filter((w) => w.date >= toISODate(new Date()) && w.date <= toISODate(new Date(Date.now() + 6 * 86_400_000)))}
            hasGoal={!!goal?.plan}
            free={free}
            onRefresh={refreshPlans}
            onGenerate={handleGeneratePlan}
            generating={generating}
            onGenerateFree={handleGenerateFree}
            generatingFree={generatingFree}
            onUseFree={handleUseFree}
            usingFree={usingFree}
          />
        )}

        {/* ───────── Chat (formato celular) + o que a Duni sabe ───────── */}
        <div className="grid gap-4 lg:grid-cols-[400px_minmax(0,1fr)]">
          <PhoneFrame>
            {/* cabecalho do app de mensagens */}
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 pb-3 pt-2">
              <AiOrb size={38} active={!notConfigured} />
              <div className="min-w-0 flex-1">
                <div className="font-display text-[0.98rem] font-bold leading-tight">Duni</div>
                <div className="flex items-center gap-1.5 text-[0.7rem]" style={{ color: sending ? "#00FF66" : "#888" }}>
                  {sending ? "digitando…" : <><StatusDot color={notConfigured ? "#FFC145" : "#00FF66"} size={5} />{notConfigured ? "não configurada" : "online"}</>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                disabled={messages.length === 0 || sending || clearing}
                className="flex h-9 w-9 items-center justify-center rounded-full text-brand-muted transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label="Limpar conversa"
                title="Limpar conversa"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
              </button>
            </div>

            {/* confirmacao dentro do celular (o confirm() nativo nao combina com a tela) */}
            {confirmClear && (
              <div className="animate-od-fade-up border-b border-white/[0.06] px-4 py-3" style={{ background: "rgba(248,81,73,0.06)" }}>
                <p className="text-[0.8rem]">Apagar toda a conversa?</p>
                <p className="mt-0.5 text-[0.7rem] text-brand-muted">O que a Duni sabe de você continua guardado.</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={handleClear} disabled={clearing} className="od-btn od-btn-sm !px-3 !py-1" style={{ color: "#fff", background: "#F85149" }}>
                    {clearing ? "Limpando…" : "Limpar"}
                  </button>
                  <button type="button" onClick={() => setConfirmClear(false)} disabled={clearing} className="od-btn od-btn-ghost od-btn-sm !px-3 !py-1">Cancelar</button>
                </div>
              </div>
            )}

            <div
              ref={chatRef}
              className="flex-1 space-y-2.5 overflow-y-auto px-3 py-4"
              style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)", backgroundSize: "18px 18px" }}
            >
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-2 text-center">
                  <AiOrb size={52} />
                  <p className="text-[0.82rem] text-brand-muted">Pergunte sobre seus treinos, carga ou recuperação. Conte também seu objetivo e suas provas.</p>
                  <div className="flex w-full flex-col gap-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} onClick={() => handleSend(s)} disabled={sending} className="od-chip !justify-center !text-[0.74rem]">{s}</button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[82%] rounded-[1.15rem] rounded-br-[0.35rem] px-3.5 py-2 text-[0.86rem] text-white" style={{ background: "linear-gradient(135deg, rgba(0,255,102,0.24), rgba(0,255,102,0.11))", boxShadow: "inset 0 0 0 1px rgba(0,255,102,0.25)" }}>
                      <span className="whitespace-pre-wrap">{m.content}</span>
                      <span className="ml-2 inline-block translate-y-0.5 text-[0.6rem] text-white/50">{msgTime(m.created_at)} ✓✓</span>
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex flex-col items-start gap-1.5">
                    <div className="max-w-[88%] rounded-[1.15rem] rounded-bl-[0.35rem] px-3.5 py-2.5 text-[0.86rem]" style={{ background: "#171a18", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)" }}>
                      <Markdown text={m.content} />
                      <div className="mt-1 text-right text-[0.6rem] text-white/40">{msgTime(m.created_at)}</div>
                    </div>
                    {m.suggestions && m.suggestions.some((s) => s.state !== "dismissed") && (
                      <div className="max-w-[88%] rounded-xl px-3 py-2.5" style={{ background: "rgba(0,255,102,0.04)", boxShadow: "inset 0 0 0 1px rgba(0,255,102,0.16)" }}>
                        <p className="mb-1.5 text-[0.64rem] font-semibold uppercase tracking-wider text-brand-accent">Guardar para as próximas conversas?</p>
                        <ul className="space-y-2">
                          {m.suggestions.map((s, j) => s.state === "dismissed" ? null : (
                            <li key={j} className="space-y-1.5 text-xs">
                              <div>
                                <span className="od-badge od-badge-muted mr-1.5 !normal-case !tracking-normal">{kindLabel(s.kind)}</span>
                                <span className="text-brand-textSecondary">{s.content}</span>
                                {s.event_date && <span className="text-brand-muted"> · {whenLabel(s.event_date)}</span>}
                              </div>
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
                )
              ))}
              {sending && (
                <div className="flex w-fit items-center gap-1 rounded-[1.15rem] rounded-bl-[0.35rem] px-4 py-3" style={{ background: "#171a18" }} aria-label="Pensando">
                  {[0, 1, 2].map((k) => (
                    <span key={k} className="h-1.5 w-1.5 rounded-full bg-brand-accent" style={{ animation: `od-typing 1.2s ${k * 0.15}s infinite` }} />
                  ))}
                </div>
              )}
            </div>

            {/* barra de digitar */}
            <div className="border-t border-white/[0.06] px-3 pb-1 pt-2.5">
              {replyTo && (
                <div className="mb-2 flex items-start justify-between gap-2 rounded-lg border-l-2 border-brand-accent bg-white/[0.04] px-3 py-2 text-xs text-brand-textSecondary">
                  <span><span className="text-brand-muted">Respondendo: </span>{replyTo}</span>
                  <button type="button" onClick={() => setReplyTo(null)} className="text-brand-muted hover:text-white" aria-label="Cancelar resposta">✕</button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSend(replyTo && input.trim() ? `Sobre "${replyTo}": ${input.trim()}` : undefined); }}
                  placeholder={replyTo ? "Sua resposta…" : "Mensagem"}
                  className="min-w-0 flex-1 rounded-full bg-white/[0.06] px-4 py-2.5 text-[0.86rem] text-white outline-none ring-1 ring-white/[0.06] placeholder:text-brand-muted focus:ring-brand-accent/50"
                  aria-label="Mensagem para a Duni"
                />
                <button
                  onClick={() => handleSend(replyTo && input.trim() ? `Sobre "${replyTo}": ${input.trim()}` : undefined)}
                  disabled={sending || !input.trim()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#041a0b] transition-transform enabled:hover:scale-105 disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, #00ff66, #c6ff00)", boxShadow: "0 0 18px -4px rgba(0,255,102,0.7)" }}
                  aria-label="Enviar"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
                </button>
              </div>
            </div>
          </PhoneFrame>

          <MemoryPanel memories={memories} onChange={setMemories} className="lg:h-full" />
        </div>
      </div>
    </PageContainer>
  );
}
