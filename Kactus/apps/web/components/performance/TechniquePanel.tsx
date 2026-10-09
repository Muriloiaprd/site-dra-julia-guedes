"use client";

import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartTooltipBox } from "@/components/ui/charts";
import { EmptyState, Panel, Skeleton } from "@/components/ui/primitives";
import { fetchTechnique, type TechniqueEvolution, type TechniqueLevel, type TechniqueMetric } from "@/lib/api";
import { axisProps, C, gridProps, withAlpha } from "@/lib/theme";
import { formatPaceShort } from "@/lib/utils";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// cores das faixas como no Garmin Connect (roxo = excelente … vermelho = baixa)
const LEVEL_COLOR: Record<TechniqueLevel, string> = {
  excelente: "#B388FF", boa: C.info, "média": C.accent, abaixo: C.warning, baixa: C.danger,
};

type Band = [number, number, TechniqueLevel];
const METRICS: { key: TechniqueMetric; nome: string; unidade: string; decimais: number; maiorMelhor: boolean; dica: string; faixas: Band[] | null }[] = [
  { key: "cadencia", nome: "Cadência", unidade: "ppm", decimais: 0, maiorMelhor: true, dica: "Passos por minuto. Mais alta costuma vir com passada mais curta e menos impacto.",
    faixas: [[183, 260, "excelente"], [174, 183, "boa"], [164, 174, "média"], [153, 164, "abaixo"], [0, 153, "baixa"]] },
  { key: "contato_ms", nome: "Contato com o solo", unidade: "ms", decimais: 0, maiorMelhor: false, dica: "Tempo do pé no chão a cada passo. Menos é mais elástico; cai sozinho quando o ritmo sobe.",
    faixas: [[0, 208, "excelente"], [208, 240, "boa"], [240, 272, "média"], [272, 305, "abaixo"], [305, 600, "baixa"]] },
  { key: "oscilacao_mm", nome: "Oscilação vertical", unidade: "cm", decimais: 1, maiorMelhor: false, dica: "Quanto o tronco sobe e desce a cada passo. Menos é energia indo para a frente.",
    faixas: [[0, 64, "excelente"], [64, 81, "boa"], [81, 97, "média"], [97, 115, "abaixo"], [115, 300, "baixa"]] },
  { key: "razao_vertical_pct", nome: "Razão vertical", unidade: "%", decimais: 1, maiorMelhor: false, dica: "Oscilação dividida pela passada. Quanto menor, mais eficiente.",
    faixas: [[0, 6.1, "excelente"], [6.1, 7.4, "boa"], [7.4, 8.6, "média"], [8.6, 10.1, "abaixo"], [10.1, 30, "baixa"]] },
  { key: "passada_m", nome: "Passada", unidade: "m", decimais: 2, maiorMelhor: true, dica: "Distância de cada passo. Cresce com a velocidade: compare meses de ritmo parecido.", faixas: null },
];

const fmt = (v: number, d: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
/** Oscilação vem em mm e aparece em cm. */
const show = (key: TechniqueMetric, v: number) => (key === "oscilacao_mm" ? v / 10 : v);
const monthLabel = (mes: string) => { const [y, m] = mes.split("-"); return `${MESES[Number(m) - 1]}/${y.slice(2)}`; };

/** Técnica de corrida em Desempenho: média dos últimos 3 meses por métrica (faixa do Garmin) e a evolução mês a mês. */
export function TechniquePanel() {
  const [data, setData] = useState<TechniqueEvolution | null>(null);
  const [error, setError] = useState(false);
  const [metric, setMetric] = useState<TechniqueMetric>("cadencia");

  useEffect(() => {
    fetchTechnique().then(setData).catch(() => setError(true));
  }, []);

  const cfg = METRICS.find((m) => m.key === metric)!;
  const series = useMemo(
    () => (data?.meses ?? []).map((m) => ({ ...m, label: monthLabel(m.mes), v: m[metric] == null ? null : show(metric, m[metric]!) })),
    [data, metric],
  );
  const domain = useMemo<[number, number]>(() => {
    const vs = series.map((s) => s.v).filter((v): v is number => v != null);
    if (!vs.length) return [0, 1];
    const lo = Math.min(...vs), hi = Math.max(...vs), pad = Math.max((hi - lo) * 0.35, hi * 0.03);
    return [Number((lo - pad).toFixed(2)), Number((hi + pad).toFixed(2))];
  }, [series]);

  if (error) return null;

  return (
    <Panel aria-label="Técnica de corrida">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="od-label">Técnica de corrida</h2>
        <span className="text-[0.7rem] text-brand-muted">Dinâmica de corrida do relógio · corridas de 3 km+</span>
      </div>
      {!data ? (
        <Skeleton className="mt-3 h-64" />
      ) : !data.atual || data.meses.length < 2 ? (
        <EmptyState title="Sem dinâmica de corrida suficiente" description="Cadência, contato com o solo e oscilação vêm do arquivo .FIT de um relógio Garmin com dinâmica de corrida. São necessários treinos em pelo menos 2 meses." />
      ) : (
        <>
          <p className="mb-3 text-xs text-brand-muted">Média dos últimos 3 meses ({data.atual.corridas} corridas, ritmo {data.atual.pace_s_km ? `${formatPaceShort(data.atual.pace_s_km)}/km` : "—"}){data.comparacao ? <> e a mudança desde {monthLabel(data.comparacao.de)}</> : null}. Toque numa métrica para ver mês a mês.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="tablist" aria-label="Métrica">
            {METRICS.map((m) => {
              const v = data.atual![m.key];
              const lvl = data.atual!.faixas[m.key];
              const diff = data.comparacao?.[m.key];
              const melhor = diff != null && diff !== 0 && (diff > 0) === m.maiorMelhor;
              const ativo = m.key === metric;
              return (
                <button
                  key={m.key}
                  type="button"
                  role="tab"
                  aria-selected={ativo}
                  onClick={() => setMetric(m.key)}
                  className={`od-tile px-3 py-2.5 text-left transition-colors ${ativo ? "!border-brand-accent/60 bg-brand-accent/[0.06]" : "hover:!border-white/20"}`}
                >
                  <div className="od-metric-label truncate">{m.nome}</div>
                  <div className="od-num mt-1 text-base">{v == null ? "—" : fmt(show(m.key, v), m.decimais)}<span className="ml-1 font-sans text-[0.65rem] text-brand-muted">{m.unidade}</span></div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[0.66rem]">
                    {lvl && <span style={{ color: LEVEL_COLOR[lvl] }}>● {lvl}</span>}
                    {diff != null && diff !== 0 && (
                      <span className={melhor ? "text-brand-accent" : "text-brand-warning"}>{diff > 0 ? "▲" : "▼"} {fmt(Math.abs(show(m.key, diff)), m.decimais)}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <p className="mt-4 text-sm text-brand-textSecondary">{cfg.dica}</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={series} margin={{ top: 12, right: 10, left: -6, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              {cfg.faixas?.map(([lo, hi, lvl]) => (
                <ReferenceArea key={lvl} y1={show(metric, lo)} y2={show(metric, hi)} fill={withAlpha(LEVEL_COLOR[lvl], 0.07)} stroke="none" ifOverflow="hidden" />
              ))}
              <XAxis {...axisProps} dataKey="label" interval="preserveStartEnd" minTickGap={12} />
              <YAxis {...axisProps} width={46} domain={domain} allowDataOverflow tickFormatter={(v: number) => fmt(v, cfg.decimais)} />
              <Tooltip
                cursor={{ stroke: "rgba(255,255,255,0.2)", strokeDasharray: "3 4" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as (typeof series)[number];
                  return (
                    <ChartTooltipBox
                      title={`${p.label} · ${p.corridas} corrida${p.corridas === 1 ? "" : "s"} · ${fmt(p.km, 1)} km`}
                      rows={[
                        { label: cfg.nome, value: p.v == null ? "—" : `${fmt(p.v, cfg.decimais)} ${cfg.unidade}`, color: C.accent },
                        ...(p.pace_s_km ? [{ label: "Ritmo", value: `${formatPaceShort(p.pace_s_km)}/km`, color: C.textSecondary }] : []),
                      ]}
                    />
                  );
                }}
              />
              <Line type="monotone" dataKey="v" stroke={C.accent} strokeWidth={2.25} dot={{ r: 3.5, fill: C.accent, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-2 text-[0.7rem] text-brand-textTertiary">
            Fundo colorido: faixas do Garmin Connect (<span style={{ color: LEVEL_COLOR.excelente }}>excelente</span> · <span style={{ color: LEVEL_COLOR.boa }}>boa</span> · <span style={{ color: LEVEL_COLOR["média"] }}>média</span> · <span style={{ color: LEVEL_COLOR.abaixo }}>abaixo</span> · <span style={{ color: LEVEL_COLOR.baixa }}>baixa</span>). Mês com poucas corridas ou ritmo diferente pode destoar.
          </p>
        </>
      )}
    </Panel>
  );
}
