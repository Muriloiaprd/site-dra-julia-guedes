"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  fetchMe,
  fetchPredictionsOverview,
  simulateTsb,
  type PredictionsOverview,
  type SimulatedDay,
} from "@/lib/api";
import { formatDuration } from "@/lib/utils";

const RACE_LABELS: Record<string, string> = {
  "5k": "5 km",
  "10k": "10 km",
  "21k": "Meia Maratona",
  "42k": "Maratona",
};

function confidenceLabel(c: number): string {
  if (c >= 1.0) return "Tempo real";
  if (c >= 0.75) return "Alta confiança";
  return "Estimado";
}

function confidenceColor(c: number): string {
  if (c >= 1.0) return "text-brand-success";
  if (c >= 0.75) return "text-brand-warning";
  return "text-brand-muted";
}

const RISK_COLORS: Record<string, string> = {
  low: "#00FF66",
  moderate: "#C6FF00",
  high: "#f85149",
  unknown: "#888888",
};

const RISK_LABELS: Record<string, string> = {
  low: "Baixo",
  moderate: "Moderado",
  high: "Alto",
  unknown: "Sem dados",
};

const DAYS_OPTIONS = [7, 14, 21, 30];

export default function PredictionsPage() {
  const router = useRouter();
  const [data, setData] = useState<PredictionsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Simulacao de TSB
  const [simDays, setSimDays] = useState(14);
  const [simTss, setSimTss] = useState("60");
  const [simData, setSimData] = useState<SimulatedDay[]>([]);
  const [simLoading, setSimLoading] = useState(false);

  useEffect(() => {
    fetchMe().then((u) => {
      if (!u) { router.push("/login"); return; }
    });
  }, [router]);

  useEffect(() => {
    setLoading(true);
    fetchPredictionsOverview()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Erro"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSimulate() {
    const tssValue = parseFloat(simTss) || 60;
    const planned = Array.from({ length: simDays }, () => tssValue);
    setSimLoading(true);
    try {
      const result = await simulateTsb(planned);
      setSimData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro na simulação");
    } finally {
      setSimLoading(false);
    }
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-8 space-y-8">
        <h1 className="text-xl font-semibold">Previsões & Análise</h1>

        {error && (
          <div className="rounded-lg border border-brand-danger/40 bg-brand-danger/10 p-3 text-sm text-brand-danger">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            <div className="h-32 animate-pulse rounded-lg bg-brand-surface" />
            <div className="h-48 animate-pulse rounded-lg bg-brand-surface" />
          </div>
        ) : data ? (
          <>
            {/* Recomendação de hoje */}
            <section
              className="rounded-lg border p-5"
              style={{ borderColor: data.recommendation.color + "40", backgroundColor: data.recommendation.color + "10" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted mb-1">
                Recomendação para Hoje
              </p>
              <p className="text-xl font-bold" style={{ color: data.recommendation.color }}>
                {data.recommendation.label}
              </p>
              {data.recommendation.detail && (
                <p className="mt-1 text-sm text-brand-muted">{data.recommendation.detail}</p>
              )}
            </section>

            {/* Risco de lesão */}
            <section className="rounded-lg border border-brand-border bg-brand-surface p-5">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-muted">
                  Risco de Lesão / Overtraining
                </h2>
                <span
                  className="rounded-full px-3 py-0.5 text-xs font-bold text-black"
                  style={{ backgroundColor: RISK_COLORS[data.risk.level] }}
                >
                  {RISK_LABELS[data.risk.level]}
                </span>
              </div>
              <ul className="text-sm space-y-1 mb-3">
                {data.risk.reasons.map((r, i) => (
                  <li key={i} className="text-brand-muted">• {r}</li>
                ))}
              </ul>
              <p className="text-sm font-medium" style={{ color: RISK_COLORS[data.risk.level] }}>
                {data.risk.recommendation}
              </p>
            </section>

            {/* Previsões de prova */}
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-muted">
                Previsões de Prova (Fórmula de Riegel)
              </h2>
              {data.race_predictions.length === 0 ? (
                <div className="rounded-lg border border-brand-border bg-brand-surface p-8 text-center text-brand-muted">
                  <p>Nenhum recorde de corrida encontrado.</p>
                  <p className="mt-1 text-sm">Importe atividades de corrida para gerar previsões.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {data.race_predictions.map((p) => (
                    <div key={p.distance} className="rounded-lg border border-brand-border bg-brand-surface p-4">
                      <p className="text-xs text-brand-muted">{RACE_LABELS[p.distance] || p.distance}</p>
                      <p className="mt-1 text-2xl font-bold text-brand-accent">
                        {formatDuration(p.predicted_s)}
                      </p>
                      <p className={`mt-1 text-xs ${confidenceColor(p.confidence)}`}>
                        {confidenceLabel(p.confidence)}
                      </p>
                      <p className="mt-1 text-xs text-brand-muted">VDOT {p.vdot}</p>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-2 text-xs text-brand-muted">
                Baseado nos seus melhores esforços de corrida. Para mais precisão, configure seu perfil e acumule histórico.
              </p>
            </section>
          </>
        ) : null}

        {/* Simulador de TSB */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-muted">
            Simulador de Forma Futura (TSB)
          </h2>
          <div className="rounded-lg border border-brand-border bg-brand-surface p-5">
            <div className="flex flex-wrap items-end gap-4 mb-5">
              <div>
                <label className="block text-xs text-brand-muted mb-1">Período (dias)</label>
                <div className="flex gap-1">
                  {DAYS_OPTIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setSimDays(d)}
                      className={`rounded-md border px-3 py-1 text-sm transition-colors ${
                        simDays === d
                          ? "border-brand-accent bg-brand-accent text-black font-semibold"
                          : "border-brand-border text-brand-muted hover:border-brand-accent"
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-brand-muted mb-1">TSS diário planejado</label>
                <input
                  type="number"
                  value={simTss}
                  onChange={(e) => setSimTss(e.target.value)}
                  className="input w-24"
                  min="0"
                  max="300"
                  step="5"
                />
              </div>
              <button
                onClick={handleSimulate}
                disabled={simLoading}
                className="rounded-xl bg-brand-accent px-4 py-2 text-sm font-bold text-black hover:bg-brand-accentHover disabled:opacity-50 transition-colors"
              >
                {simLoading ? "Calculando…" : "Simular"}
              </button>
            </div>

            {simData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={simData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                  <XAxis
                    dataKey="date"
                    stroke="#888"
                    fontSize={11}
                    tickFormatter={(v) => {
                      const d = new Date(v + "T12:00:00");
                      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
                    }}
                    interval="preserveStartEnd"
                  />
                  <YAxis stroke="#888" fontSize={11} />
                  <Tooltip
                    contentStyle={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 8 }}
                    labelFormatter={(l) => {
                      const d = new Date(String(l) + "T12:00:00");
                      return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
                    }}
                  />
                  <Legend />
                  <ReferenceLine y={0} stroke="#2a2a2a" strokeDasharray="4 2" />
                  <Line type="monotone" dataKey="ctl" stroke="#00FF66" strokeWidth={2} dot={false} name="CTL" />
                  <Line type="monotone" dataKey="atl" stroke="#f85149" strokeWidth={2} dot={false} name="ATL" />
                  <Line type="monotone" dataKey="tsb" stroke="#C6FF00" strokeWidth={1.5} dot={false} strokeDasharray="5 3" name="TSB" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-sm text-brand-muted py-8">
                Configure o TSS diário e clique em Simular para projetar sua forma.
              </p>
            )}
          </div>
        </section>

        {/* Legenda das fórmulas */}
        <section className="rounded-lg border border-brand-border bg-brand-surface p-5 text-sm text-brand-muted">
          <h2 className="mb-2 font-medium text-brand-text">Como as previsões são calculadas</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Fórmula de Riegel</strong>: T2 = T1 × (D2/D1)^1.06 — extrapolação científica entre distâncias</li>
            <li><strong>VDOT</strong> (Jack Daniels): estimativa de VO2max com base no seu melhor tempo recente</li>
            <li><strong>Risco de lesão</strong>: ACWR {">"} 1.5 ou TSB {"<"} −30 por 3+ dias = alerta</li>
            <li><strong>Simulação de TSB</strong>: projeta CTL/ATL/TSB assumindo TSS constante por dia</li>
          </ul>
          <p className="mt-3">
            Para previsões mais precisas, configure <Link href="/profile" className="text-brand-accent hover:underline">FC Máxima, FTP e CSS no perfil</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}
