"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchActivities, fetchActivity, fetchCoachPlan, fetchLoadMetrics, fetchMe, fetchPredictionsOverview, fetchProfile, fetchRecords, getToken,
  type ActivityDetail, type ActivitySummary, type DailyMetric, type PersonalRecord, type PlannedWorkout,
  type PredictionsOverview, type Profile, type User,
} from "@/lib/api";
import {
  calcWeekStats, computeReadiness, metricDaysAgo, nameFromEmail, recoveryFromTsb, toISODate, WEEK_HOURS_GOAL, type Tone,
} from "@/lib/athlete";
import { C } from "@/lib/theme";
import { formatClock, recordLabel } from "@/lib/utils";
import { Alert, PageContainer } from "@/components/ui/primitives";
import { ActivityModal } from "@/components/dashboard/ActivityModal";
import { AthleteStatus } from "@/components/dashboard/AthleteStatus";
import { CoachCard } from "@/components/dashboard/CoachCard";
import { DashboardHeader, type HeaderAlert } from "@/components/dashboard/DashboardHeader";
import { GoalCard } from "@/components/dashboard/GoalCard";
import { LastActivity } from "@/components/dashboard/LastActivity";
import { MonthCalendar } from "@/components/dashboard/MonthCalendar";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { RecentActivities } from "@/components/dashboard/RecentActivities";
import { Records } from "@/components/dashboard/Records";
import { WeekStrip } from "@/components/dashboard/WeekStrip";

const RECENT_COUNT = 5;

type LoadState = "loading" | "ok" | "error";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [syncState, setSyncState] = useState<LoadState>("loading");
  const [overview, setOverview] = useState<PredictionsOverview | null>(null);
  const [loadMetrics, setLoadMetrics] = useState<DailyMetric[]>([]);
  const [plan, setPlan] = useState<PlannedWorkout[]>([]);
  const [planState, setPlanState] = useState<LoadState>("loading");
  const [modalActivity, setModalActivity] = useState<ActivitySummary | null>(null);
  const [recentDetails, setRecentDetails] = useState<Record<string, ActivityDetail>>({});
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    fetchMe().then((u) => {
      if (!u) {
        if (getToken()) { setAuthError(true); return; }
        router.push("/login");
        return;
      }
      setUser(u);
    });
    fetchProfile().then(setProfile).catch(() => {});
  }, [router]);

  const load = useCallback(async () => {
    setSyncState("loading");
    try {
      const [acts, recs] = await Promise.all([fetchActivities(500, 0, undefined, "365"), fetchRecords()]);
      setActivities(acts);
      setRecords(recs);
      setSyncState("ok");
    } catch {
      // antes uma falha de rede caia no mesmo estado vazio de usuario novo
      setSyncState("error");
    }
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  useEffect(() => {
    if (!user) return;
    fetchPredictionsOverview().then(setOverview).catch(() => {});
    fetchLoadMetrics(60).then(setLoadMetrics).catch(() => {});
    fetchCoachPlan(35)
      .then((p) => { setPlan(p); setPlanState("ok"); })
      .catch(() => setPlanState("error"));
  }, [user]);

  useEffect(() => {
    const ids = activities.slice(0, RECENT_COUNT).map((a) => a.id).filter((id) => !recentDetails[id]);
    if (ids.length === 0) return;
    Promise.all(ids.map((id) => fetchActivity(id).then((d) => [id, d] as const).catch(() => null)))
      .then((results) => {
        const next: Record<string, ActivityDetail> = {};
        for (const r of results) if (r) next[r[0]] = r[1];
        if (Object.keys(next).length) setRecentDetails((prev) => ({ ...prev, ...next }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities]);

  const stats = useMemo(() => calcWeekStats(activities), [activities]);
  const recommendation = overview?.recommendation ?? null;
  const readiness = useMemo(() => computeReadiness(loadMetrics, recommendation), [loadMetrics, recommendation]);
  const weekHours = stats.cur.duration / 3600;

  const { recovery, recoveryTrend } = useMemo((): { recovery: Tone; recoveryTrend: { text: string; color: string } } => {
    if (readiness.tsb != null) {
      const past = metricDaysAgo(loadMetrics, 7);
      const delta = past?.tsb != null ? readiness.tsb - past.tsb : null;
      return {
        recovery: recoveryFromTsb(readiness.tsb),
        recoveryTrend: delta == null ? { text: "—", color: C.muted }
          : delta > 2 ? { text: "↑ melhorando", color: C.accent }
          : delta < -2 ? { text: "↓ em queda", color: C.warning }
          : { text: "estável", color: C.textSecondary },
      };
    }
    // sem metricas de carga: estimativa pelo volume da semana (comportamento anterior)
    const pct = (h: number) => Math.max(15, 100 - Math.min(100, Math.round((h / WEEK_HOURS_GOAL) * 100)));
    const cur = pct(weekHours);
    const prev = pct(stats.prev.duration / 3600);
    const tag = cur >= 70 ? { label: "Boa", color: C.accent } : cur >= 45 ? { label: "Moderada", color: C.warning } : { label: "Baixa", color: C.danger };
    const d = stats.prev.count > 0 ? cur - prev : null;
    return {
      recovery: tag,
      recoveryTrend: d == null ? { text: "—", color: C.muted } : d > 0 ? { text: "↑ melhorando", color: C.accent } : d < 0 ? { text: "↓ em queda", color: C.warning } : { text: "estável", color: C.textSecondary },
    };
  }, [readiness.tsb, loadMetrics, weekHours, stats]);

  const alerts = useMemo(() => {
    const out: HeaderAlert[] = [];
    const risk = overview?.risk;
    if (risk?.level === "high") out.push({ id: "risk", tone: "danger", title: "Risco de lesão elevado", detail: risk.reasons[0] ?? risk.recommendation, href: "/predictions" });
    else if (risk?.level === "moderate") out.push({ id: "risk", tone: "warning", title: "Atenção à carga de treino", detail: risk.reasons[0] ?? risk.recommendation, href: "/metrics" });
    const todayPlan = plan.find((w) => w.date === toISODate(new Date()) && w.status === "planned");
    if (todayPlan) out.push({ id: "today", tone: "accent", title: `Treino de hoje: ${todayPlan.title}`, detail: todayPlan.description ?? undefined, href: "/coach" });
    if (syncState === "ok" && activities[0]) {
      const days = Math.floor((Date.now() - new Date(activities[0].start_time).getTime()) / 86400000);
      if (days >= 7) out.push({ id: "idle", tone: "warning", title: `Sem atividades há ${days} dias`, detail: "Importe seus treinos recentes para manter as métricas atualizadas.", href: "/import" });
    }
    records
      .filter((r) => Date.now() - new Date(r.achieved_at).getTime() < 7 * 86400000)
      .slice(0, 2)
      .forEach((r) => out.push({
        id: `pr-${r.record_type}`, tone: "accent", title: `Novo recorde: ${recordLabel(r.record_type)}`,
        detail: r.unit === "seconds" ? formatClock(r.value) : undefined,
        href: r.activity_id ? `/activities/${r.activity_id}` : undefined,
      }));
    return out;
  }, [overview, plan, records, activities, syncState]);

  if (authError) return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="text-sm text-brand-danger">Não foi possível verificar sua sessão — verifique sua conexão.</span>
      <button onClick={() => window.location.reload()} className="od-btn od-btn-secondary">Tentar de novo</button>
    </div>
  );

  if (!user) return (
    <div className="flex min-h-[70vh] items-center justify-center gap-3 text-brand-muted">
      <span className="h-2 w-2 rounded-full bg-brand-accent animate-od-pulse" /> Carregando centro de comando…
    </div>
  );

  const name = profile?.full_name?.trim().split(/\s+/)[0] || nameFromEmail(user.email);
  const loading = syncState === "loading";
  const openById = (id: string) => { const a = activities.find((x) => x.id === id); if (a) setModalActivity(a); };

  return (
    <PageContainer>
      <DashboardHeader
        name={name}
        avatarUrl={profile?.avatar_data_url ?? null}
        syncState={syncState}
        lastActivityIso={activities[0]?.start_time ?? null}
        alerts={alerts}
      />

      {syncState === "error" && (
        <div className="mb-4">
          <Alert tone="danger" title="Não foi possível carregar suas atividades" action={<button onClick={load} className="od-btn od-btn-ghost od-btn-sm">Tentar de novo</button>}>
            Verifique sua conexão ou se a API está rodando. Os dados abaixo podem estar incompletos.
          </Alert>
        </div>
      )}

      <div className="od-stagger grid grid-cols-1 gap-4 md:grid-cols-6 xl:grid-cols-12">
        {/* 1. Como estou? */}
        <AthleteStatus
          className="md:col-span-6 xl:col-span-8"
          readiness={readiness}
          recommendation={recommendation}
          weekHours={weekHours}
          recovery={recovery}
          recoveryTrend={recoveryTrend}
          sessions={stats.cur.count}
          loading={loading}
        />
        {/* 4. O que devo fazer? */}
        <CoachCard className="md:col-span-6 xl:col-span-4" workouts={plan} planState={planState} recommendation={recommendation} />

        {/* 3. O que fiz esta semana */}
        <WeekStrip className="md:col-span-6 xl:col-span-12" activities={stats.curActs} plan={plan} loading={loading} cur={stats.cur} prevToDate={stats.prevToDate} />

        {/* 2. Estou evoluindo? */}
        <PerformanceChart className="md:col-span-6 xl:col-span-8" activities={activities} loading={loading} onSelect={openById} />
        <LastActivity
          className="md:col-span-6 xl:col-span-4"
          activity={activities[0] ?? null}
          detail={activities[0] ? recentDetails[activities[0].id] : undefined}
          activities={activities}
          loading={loading}
          onOpen={setModalActivity}
        />

        {/* conquistas, meta, calendario */}
        <Records className="md:col-span-6 xl:col-span-5" records={records} loading={loading} />
        <GoalCard className="md:col-span-3 xl:col-span-3" predictions={overview?.race_predictions ?? []} loading={!overview && loading} />
        <MonthCalendar className="md:col-span-3 xl:col-span-4" activities={activities} plan={plan} loading={loading} onSelect={setModalActivity} />

        <RecentActivities
          className="md:col-span-6 xl:col-span-12"
          activities={activities.slice(0, RECENT_COUNT)}
          details={recentDetails}
          records={records}
          loading={loading}
          onSelect={setModalActivity}
        />
      </div>

      {modalActivity && (
        <ActivityModal
          activity={modalActivity}
          activities={activities}
          detail={recentDetails[modalActivity.id]}
          onClose={() => setModalActivity(null)}
        />
      )}
    </PageContainer>
  );
}
