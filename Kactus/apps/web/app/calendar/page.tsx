"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { TrainingCalendar } from "@/components/calendar/TrainingCalendar";
import { AdherencePanel } from "@/components/coach/AdherencePanel";
import { GoalPlanPanel } from "@/components/coach/GoalPlanPanel";
import { ActionButton, ProcessingPanel } from "@/components/coach/ProcessingPanel";
import { WeekPlans } from "@/components/coach/WeekPlans";
import { BackButton } from "@/components/ui/BackButton";
import { Alert, PageContainer, PageHeader, Segmented } from "@/components/ui/primitives";
import {
  applyFreeWeek,
  fetchActivities,
  fetchFreeWeek,
  fetchGoalPlan,
  fetchMe,
  fetchPlanRange,
  fetchWeekPlan,
  postCoachGeneratePlan,
  postFreeWeekGenerate,
  postGoalPlanGenerate,
  type ActivitySummary,
  type FreeWeekResponse,
  type GoalPlanResponse,
  type PlannedWorkout,
  type WeeklyPlanResponse,
} from "@/lib/api";
import { toISODate } from "@/lib/athlete";
import { coachErrorMessage } from "@/lib/coachErrors";

const PAGE = 500;

/** Todas as atividades, em páginas de 500 (o calendário anda por qualquer mês). */
async function fetchAllActivities(): Promise<ActivitySummary[]> {
  const all: ActivitySummary[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const batch = await fetchActivities(PAGE, offset);
    all.push(...batch);
    if (batch.length < PAGE) return all;
  }
}

type Aba = "calendario" | "plano";

const ABAS = [
  { value: "calendario", label: "Calendário" },
  { value: "plano", label: "Plano" },
] as const;

// useSearchParams pede Suspense no build do Next
export default function CalendarPage() {
  return <Suspense><CalendarScreen /></Suspense>;
}

/** Calendário de treinos: o planejado (plano da semana e do objetivo) e o feito; na aba Plano, onde se gera o plano. */
function CalendarScreen() {
  const router = useRouter();
  const pathname = usePathname();
  // a aba fica na URL (?aba=plano): link direto e o voltar do navegador funcionam
  const aba: Aba = useSearchParams().get("aba") === "plano" ? "plano" : "calendario";
  function trocarAba(next: Aba) {
    router.push(next === "plano" ? `${pathname}?aba=plano` : pathname, { scroll: false });
  }
  const [ready, setReady] = useState(false);
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [actsLoading, setActsLoading] = useState(true);
  const [workouts, setWorkouts] = useState<PlannedWorkout[]>([]);
  const [planLoading, setPlanLoading] = useState(true);
  const [planVersion, setPlanVersion] = useState(0);

  const [week, setWeek] = useState<WeeklyPlanResponse | null>(null);
  const [goal, setGoal] = useState<GoalPlanResponse | null>(null);
  const [free, setFree] = useState<FreeWeekResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatingGoal, setGeneratingGoal] = useState(false);
  const [generatingFree, setGeneratingFree] = useState(false);
  const [usingFree, setUsingFree] = useState<string | null>(null);
  const [planCount, setPlanCount] = useState<number | null>(null);
  const [goalCount, setGoalCount] = useState<number | null>(null);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetchMe().then((u) => {
      if (!u) { router.push("/login"); return; }
      setReady(true);
    });
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    fetchAllActivities()
      .then(setActivities)
      .catch(() => setLoadError(true))
      .finally(() => setActsLoading(false));
    fetchWeekPlan().then(setWeek).catch(() => setWeek({ plan: null, workouts: [] }));
    fetchGoalPlan().then(setGoal).catch(() => setGoal({ plan: null, workouts: [] }));
    fetchFreeWeek().then(setFree).catch(() => setFree({ plan: null, workouts: [], comparison: null }));
  }, [ready]);

  // o planejado do mês visível; volta a buscar quando um plano novo é gerado
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    setPlanLoading(true);
    const start = toISODate(new Date(ym.year, ym.month, 1));
    const end = toISODate(new Date(ym.year, ym.month + 1, 0));
    fetchPlanRange(start, end)
      .then((w) => { if (alive) setWorkouts(w); })
      .catch(() => { if (alive) { setWorkouts([]); setLoadError(true); } })
      .finally(() => { if (alive) setPlanLoading(false); });
    return () => { alive = false; };
  }, [ready, ym, planVersion]);

  const changeMonth = useCallback((step: -1 | 0 | 1) => {
    if (step === 0) { const t = new Date(); setYm({ year: t.getFullYear(), month: t.getMonth() }); return; }
    setYm(({ year, month }) => {
      const d = new Date(year, month + step, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }, []);

  async function refreshPlans() {
    setWeek(await fetchWeekPlan());
    setPlanVersion((v) => v + 1);
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
      setError(coachErrorMessage(e));
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
      setError(coachErrorMessage(e));
    } finally {
      setGeneratingFree(false);
    }
  }

  async function handleUseFree(dates?: string[]) {
    setUsingFree(dates?.length === 1 ? dates[0] : "all");
    setError(null);
    try {
      setWeek(await applyFreeWeek(dates));
      setPlanVersion((v) => v + 1);
      fetchGoalPlan().then(setGoal).catch(() => {});
    } catch (e) {
      setError(coachErrorMessage(e));
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
      setPlanVersion((v) => v + 1);
    } catch (e) {
      setError(coachErrorMessage(e));
    } finally {
      setGenerating(false);
    }
  }

  const busy = generating || generatingGoal || generatingFree;
  const todayIso = toISODate(new Date());
  const weekEnd = toISODate(new Date(Date.now() + 6 * 86_400_000));

  return (
    <PageContainer>
      <BackButton />
      <PageHeader
        kicker="Treinos"
        title="Calendário de treinos"
        description="O que a Duni planejou e o que você fez, dia a dia."
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>}
      />

      <div className="mb-5">
        <Segmented options={ABAS} value={aba} onChange={trocarAba} size="md" ariaLabel="Seções do calendário" />
      </div>

      {loadError && (
        <div className="mb-4">
          <Alert tone="danger" title="Não consegui carregar tudo">Verifique a conexão ou se a API está rodando. O calendário pode estar incompleto.</Alert>
        </div>
      )}

      {/* as duas abas ficam montadas: trocar não perde o mês nem um plano sendo gerado */}
      <div hidden={aba !== "calendario"}>
        <TrainingCalendar
          year={ym.year}
          month={ym.month}
          activities={activities}
          workouts={workouts}
          loading={!ready || actsLoading || planLoading}
          onMonth={changeMonth}
        />
      </div>

      {/* ───────── O plano: gerar e acompanhar (veio da página da Duni) ───────── */}
      <section hidden={aba !== "plano"} className="space-y-4" aria-labelledby="plano-titulo">
        <div>
          <h2 id="plano-titulo" className="font-display text-xl font-bold">Plano de treino</h2>
          <p className="mt-1 text-sm text-brand-muted">A Duni monta os treinos; eles aparecem na aba Calendário e no resumo do dashboard.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <ActionButton
            onClick={handleGeneratePlan}
            disabled={busy || !ready}
            color="#C6FF00"
            title={generating ? "Gerando…" : "Gerar plano da semana"}
            text="Os treinos dos próximos 7 dias, do seu jeito."
            icon={<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="m9 16 2 2 4-4" /></>}
          />
          <ActionButton
            onClick={() => handleGenerateGoal(goal?.plan?.days_per_week ?? 3)}
            disabled={busy || !ready}
            color="#00BFFF"
            title={generatingGoal ? "Montando…" : "Gerar plano do objetivo"}
            text="Todos os treinos até a sua prova, em fases."
            icon={<><path d="M4 22V4" /><path d="M4 4h12l-2 4 2 4H4" /></>}
          />
        </div>

        {error && <Alert tone="danger" title={error.title}>{error.detail}</Alert>}

        {generating && <ProcessingPanel title="Montando o plano da semana…" />}
        {generatingGoal && <ProcessingPanel title="Montando o plano até a prova…" />}

        {goalCount !== null && goal?.plan && (
          <Alert tone="accent" title={`Plano até a prova pronto: ${goalCount} treinos`}>
            Veja as fases e as semanas no quadro &quot;Plano do objetivo&quot;. O passo a passo de cada semana sai no &quot;Gerar plano da semana&quot;.
          </Alert>
        )}

        {planCount !== null && (
          <Alert tone="accent" title={`Plano da semana pronto: ${planCount} treino${planCount === 1 ? "" : "s"}`}>
            Os treinos já estão na aba Calendário e no card da Duni no dashboard. O detalhe de cada um está no quadro &quot;Plano da semana&quot;.
          </Alert>
        )}

        {/* ───────── Plano do objetivo (ate a prova) ───────── */}
        {goal && <GoalPlanPanel goal={goal} onGenerate={handleGenerateGoal} generating={generatingGoal} onGoalChange={setGoal} />}

        {/* ───────── Planejado × feito ───────── */}
        {ready && <AdherencePanel days={14} />}

        {/* ───────── Plano da semana ───────── */}
        {week && (
          <WeekPlans
            week={week}
            goalWorkouts={(goal?.workouts ?? []).filter((w) => w.date >= todayIso && w.date <= weekEnd)}
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
      </section>
    </PageContainer>
  );
}
