"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AdvancedSection } from "@/components/performance/AdvancedSection";
import { ConsistencyHeatmap } from "@/components/performance/ConsistencyHeatmap";
import { EvolutionChart } from "@/components/performance/EvolutionChart";
import { RacePredictions } from "@/components/performance/RacePredictions";
import { StatusTiles } from "@/components/performance/StatusTiles";
import { TodayPanel } from "@/components/performance/TodayPanel";
import { TrainingQuality } from "@/components/performance/TrainingQuality";
import { Alert, EmptyState, PageContainer, PageHeader, Panel } from "@/components/ui/primitives";
import {
  fetchActivities, fetchHeatmap, fetchLoadMetrics, fetchLoadSummary, fetchMe, fetchPredictionsOverview,
  type ActivitySummary, type DailyMetric, type HeatmapDay, type LoadSummary, type PredictionsOverview,
} from "@/lib/api";

/**
 * Desempenho: junta as antigas abas Carga (/metrics) e Previsoes (/predictions), que repetiam a
 * recomendacao de hoje e o risco de lesao. O tecnico fica num unico "Modo avancado" recolhido.
 */
export default function PerformancePage() {
  const router = useRouter();
  const [summary, setSummary] = useState<LoadSummary | null>(null);
  const [overview, setOverview] = useState<PredictionsOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [metrics, setMetrics] = useState<DailyMetric[]>([]);
  const [days, setDays] = useState<number>(90);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [heatmap, setHeatmap] = useState<HeatmapDay[]>([]);
  const [heatmapLoading, setHeatmapLoading] = useState(true);
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMe().then((u) => { if (!u) router.push("/login"); });
  }, [router]);

  useEffect(() => {
    fetchLoadSummary().then(setSummary).catch(() => {});
    fetchPredictionsOverview()
      .then(setOverview)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Erro ao carregar as previsões"))
      .finally(() => setOverviewLoading(false));
    fetchHeatmap(112).then(setHeatmap).catch(() => {}).finally(() => setHeatmapLoading(false));
    // sem filtro de esporte na API: o ritmo mensal agrupa corrida + trail + esteira
    fetchActivities(500, 0, undefined, "365").then(setActivities).catch(() => {}).finally(() => setActivitiesLoading(false));
  }, []);

  useEffect(() => {
    setMetricsLoading(true);
    fetchLoadMetrics(days)
      .then(setMetrics)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Erro ao carregar a carga"))
      .finally(() => setMetricsLoading(false));
  }, [days]);

  const hasData = metrics.some((d) => d.ctl != null || (d.daily_load ?? 0) > 0);

  return (
    <PageContainer>
      <PageHeader
        kicker="Seu treino"
        title="Desempenho"
        description="O que fazer hoje, como o corpo está, suas previsões de prova e a sua evolução."
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M3 20h18" /><path d="M6 16v-4M10 16V8M14 16v-6M18 16V5" /></svg>}
      />

      {error && <div className="mb-4"><Alert tone="danger" title="Erro ao carregar">{error}</Alert></div>}

      {!metricsLoading && !hasData && !error ? (
        <Panel>
          <EmptyState
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M3 12h4l3 8 4-16 3 8h4" /></svg>}
            title="Ainda não há treinos para analisar"
            description="Importe seus treinos: com algumas semanas de histórico, esta página diz o que fazer hoje, quanto dá para treinar com segurança e prevê seus tempos de prova."
            action={<Link href="/import" className="od-btn od-btn-primary">Importar atividades →</Link>}
          />
        </Panel>
      ) : (
        <div className="od-stagger space-y-4">
          <TodayPanel summary={summary} />
          <StatusTiles metrics={metrics} risk={overview?.risk ?? null} loading={metricsLoading} />
          <RacePredictions predictions={overview?.race_predictions ?? null} loading={overviewLoading} />
          <EvolutionChart weeks={summary?.semanas ?? null} activities={activities} activitiesLoading={activitiesLoading} />
          <TrainingQuality summary={summary} />
          <ConsistencyHeatmap data={heatmap} loading={heatmapLoading} />
          <AdvancedSection data={metrics} loading={metricsLoading} days={days} onDaysChange={setDays} />
        </div>
      )}
    </PageContainer>
  );
}
