"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";

import { ChartTooltipBox } from "@/components/ui/charts";
import { EmptyState, Panel, Skeleton } from "@/components/ui/primitives";
import { fetchHeat, type HeatAnalysis } from "@/lib/api";
import { axisProps, C, gridProps } from "@/lib/theme";
import { formatPaceShort } from "@/lib/utils";

const MIN_RUNS = 5;

/** Cor do ponto pela temperatura: azul no frio, verde no ameno, laranja/vermelho no calor. */
function tempColor(t: number): string {
  if (t < 15) return "#00BFFF";
  if (t < 20) return "#00FF66";
  if (t < 25) return "#C6FF00";
  if (t < 30) return "#FFC145";
  return "#F85149";
}

/** Ritmo × calor em Desempenho: pontos temperatura × ritmo, faixas e a frase de quanto o calor pesa. */
export function HeatPanel() {
  const router = useRouter();
  const [data, setData] = useState<HeatAnalysis | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchHeat().then(setData).catch(() => setError(true));
  }, []);

  if (error) return null;
  const c = data?.comparacao;

  return (
    <Panel aria-label="Ritmo × calor">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="od-label">Ritmo × calor</h2>
        <span className="text-[0.7rem] text-brand-muted">Corridas ao ar livre de 3 km+ do último ano</span>
      </div>
      {!data ? (
        <Skeleton className="mt-3 h-56" />
      ) : data.corridas < MIN_RUNS ? (
        <EmptyState title="Poucas corridas com temperatura" description={`São necessárias ${MIN_RUNS} corridas ao ar livre de 3 km ou mais com a temperatura do relógio (tem ${data.corridas}).`} />
      ) : (
        <>
          <p className="mb-3 text-sm text-brand-textSecondary">
            {c
              ? c.pace_diff_s_km > 0
                ? <>Na faixa <strong className="text-white">{c.quente}</strong> você corre em média <strong className="text-white">{c.pace_diff_s_km} s/km mais devagar</strong> que em <strong className="text-white">{c.fria}</strong>{c.fc_diff != null ? <>, com a FC <strong className="text-white">{c.fc_diff > 0 ? `${c.fc_diff} bpm mais alta` : `${-c.fc_diff} bpm mais baixa`}</strong></> : null}.</>
                : <>O calor quase não mudou seu ritmo: na faixa {c.quente} você foi {-c.pace_diff_s_km} s/km mais rápido que em {c.fria}.</>
              : "Ainda não há corridas suficientes em faixas diferentes de temperatura para comparar."}
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <ScatterChart margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis {...axisProps} type="number" dataKey="temp_c" name="Temperatura" unit=" °C" domain={["dataMin - 2", "dataMax + 2"]} tickFormatter={(v: number) => `${Math.round(v)}°`} />
              <YAxis {...axisProps} type="number" dataKey="pace_s_km" name="Ritmo" reversed width={46} domain={["auto", "auto"]} tickFormatter={(v: number) => formatPaceShort(v)} />
              <Tooltip
                cursor={{ stroke: "rgba(255,255,255,0.2)", strokeDasharray: "3 4" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as HeatAnalysis["pontos"][number];
                  return (
                    <ChartTooltipBox
                      title={`${new Date(p.data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })} · ${p.km} km`}
                      rows={[
                        { label: "Temperatura", value: `${p.temp_c} °C`, color: tempColor(p.temp_c) },
                        { label: "Ritmo", value: `${formatPaceShort(p.pace_s_km)}/km`, color: C.accent },
                        ...(p.fc ? [{ label: "FC", value: `${p.fc} bpm`, color: C.danger }] : []),
                      ]}
                      footer={<span className="text-brand-accent">clique para abrir</span>}
                    />
                  );
                }}
              />
              <Scatter
                data={data.pontos}
                onClick={(p: { id?: string }) => p?.id && router.push(`/activities/${p.id}`)}
                shape={(props: { cx?: number; cy?: number; payload?: { temp_c: number } }) => (
                  <circle cx={props.cx} cy={props.cy} r={5} fill={tempColor(props.payload?.temp_c ?? 20)} fillOpacity={0.85} style={{ cursor: "pointer" }} />
                )}
              />
            </ScatterChart>
          </ResponsiveContainer>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {data.faixas.map((f) => (
              <div key={f.faixa} className="od-tile px-3 py-2.5" style={{ opacity: f.corridas ? 1 : 0.45 }}>
                <div className="od-metric-label truncate">{f.faixa}</div>
                <div className="od-num mt-1 text-base">{f.pace_s_km ? `${formatPaceShort(f.pace_s_km)}/km` : "—"}</div>
                <div className="text-[0.68rem] text-brand-muted">{f.corridas} corrida{f.corridas === 1 ? "" : "s"}{f.fc ? ` · FC ${f.fc}` : ""}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[0.7rem] text-brand-textTertiary">Temperatura medida no relógio: o calor do pulso puxa a leitura alguns graus para cima.</p>
        </>
      )}
    </Panel>
  );
}
