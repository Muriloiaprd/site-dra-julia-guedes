"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { SportTile } from "@/components/SportIcon";
import { ChartTooltipBox, LegendDot } from "@/components/ui/charts";
import { Alert, EmptyState, PageContainer, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";
import { fetchActivity, fetchSplits, type ActivityDetail, type ActivityPoint, type Split } from "@/lib/api";
import { axisProps, C, gridProps } from "@/lib/theme";
import { activeSeconds, formatDate, formatDistance, formatDuration, formatPaceShort, isBikeSport, sportLabel } from "@/lib/utils";

const COR = { a: C.accent, b: C.info } as const;
const MAX_PACE_S = 15 * 60; // mais lento que 15 min/km = parado ou GPS perdido

interface Lado { act: ActivityDetail; splits: Split[] }
interface SeriePonto { km: number; v: number | null; hr: number | null }

/** Ritmo (s/km) ou velocidade (km/h) e FC por distância, em blocos e suavizado, para sobrepor dois treinos. */
function serie(points: ActivityPoint[], bike: boolean): SeriePonto[] {
  const comDist = points.filter((p) => p.distance_m != null);
  if (comDist.length < 10) return [];
  const total = comDist[comDist.length - 1].distance_m!;
  const passo = Math.max(50, total / 300);
  const blocos: { s: number; ns: number; hr: number; nh: number }[] = [];
  for (let i = 0; i < comDist.length; i++) {
    const p = comDist[i];
    let v = p.speed_ms;
    if (v == null && i > 0) {
      const q = comDist[i - 1], dt = p.elapsed_time_s - q.elapsed_time_s;
      v = dt > 0 ? (p.distance_m! - q.distance_m!) / dt : null;
    }
    const k = Math.floor(p.distance_m! / passo);
    const b = (blocos[k] ??= { s: 0, ns: 0, hr: 0, nh: 0 });
    if (v != null && v > 0) { b.s += v; b.ns++; }
    if (p.hr) { b.hr += p.hr; b.nh++; }
  }
  const crus = Array.from(blocos, (b, k) => ({
    km: ((k + 0.5) * passo) / 1000,
    speed: b && b.ns ? b.s / b.ns : null,
    hr: b && b.nh ? b.hr / b.nh : null,
  }));
  const media = (i: number, key: "speed" | "hr") => {
    const vs = crus.slice(Math.max(0, i - 2), i + 3).map((c) => c[key]).filter((x): x is number => x != null);
    return vs.length ? vs.reduce((s, x) => s + x, 0) / vs.length : null;
  };
  return crus.map((c, i) => {
    const sp = media(i, "speed");
    let v: number | null = null;
    if (sp != null) v = bike ? +(sp * 3.6).toFixed(1) : 1000 / sp <= MAX_PACE_S ? Math.round(1000 / sp) : null;
    const hr = media(i, "hr");
    return { km: +c.km.toFixed(2), v, hr: hr == null ? null : Math.round(hr) };
  });
}

type Linha = { nome: string; a: number | null; b: number | null; fmt: (v: number) => string; diff?: (d: number) => string; menorMelhor?: boolean };

function linhas(a: ActivityDetail, b: ActivityDetail, bike: boolean): Linha[] {
  const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const sinal = (d: number, s: string) => `${d > 0 ? "+" : d < 0 ? "−" : ""}${s}`;
  const ritmo = (d: number) => sinal(d, `${Math.abs(Math.round(d))} s/km`);
  const todas: Linha[] = [
    { nome: "Distância", a: a.distance_m, b: b.distance_m, fmt: formatDistance, diff: (d) => sinal(d, `${n(Math.abs(d) / 1000)} km`) },
    { nome: "Tempo em movimento", a: activeSeconds(a), b: activeSeconds(b), fmt: formatDuration, diff: (d) => sinal(d, formatDuration(Math.abs(d))) },
    bike
      ? { nome: "Velocidade média", a: a.avg_speed_kmh, b: b.avg_speed_kmh, fmt: (v) => `${n(v)} km/h`, diff: (d) => sinal(d, `${n(Math.abs(d))} km/h`) }
      : { nome: "Ritmo médio", a: a.avg_pace_s_per_km, b: b.avg_pace_s_per_km, fmt: (v) => `${formatPaceShort(v)}/km`, diff: ritmo, menorMelhor: true },
    { nome: "Ritmo ajustado (GAP)", a: bike ? null : a.gap_pace_s_per_km, b: bike ? null : b.gap_pace_s_per_km, fmt: (v) => `${formatPaceShort(v)}/km`, diff: ritmo, menorMelhor: true },
    { nome: "FC média", a: a.avg_hr, b: b.avg_hr, fmt: (v) => `${v} bpm`, diff: (d) => sinal(d, `${Math.abs(d)} bpm`) },
    { nome: "FC máxima", a: a.max_hr, b: b.max_hr, fmt: (v) => `${v} bpm`, diff: (d) => sinal(d, `${Math.abs(d)} bpm`) },
    { nome: "Deriva cardíaca", a: a.hr_decoupling_pct, b: b.hr_decoupling_pct, fmt: (v) => `${n(v)}%`, diff: (d) => sinal(d, `${n(Math.abs(d))} pts`), menorMelhor: true },
    { nome: "Subida", a: a.elevation_gain_m, b: b.elevation_gain_m, fmt: (v) => `${Math.round(v)} m`, diff: (d) => sinal(d, `${Math.abs(Math.round(d))} m`) },
    { nome: "Cadência", a: a.avg_cadence, b: b.avg_cadence, fmt: (v) => `${Math.round(v)} ppm`, diff: (d) => sinal(d, `${Math.abs(Math.round(d))} ppm`) },
    { nome: "Potência média", a: a.avg_power_w, b: b.avg_power_w, fmt: (v) => `${v} W`, diff: (d) => sinal(d, `${Math.abs(d)} W`) },
    { nome: "Contato com o solo", a: a.avg_stance_time_ms, b: b.avg_stance_time_ms, fmt: (v) => `${Math.round(v)} ms`, diff: (d) => sinal(d, `${Math.abs(Math.round(d))} ms`), menorMelhor: true },
    { nome: "Temperatura", a: a.avg_temperature_c, b: b.avg_temperature_c, fmt: (v) => `${n(v)} °C`, diff: (d) => sinal(d, `${n(Math.abs(d))} °C`) },
    { nome: "Efeito aeróbico", a: a.training_effect_aerobic, b: b.training_effect_aerobic, fmt: (v) => n(v), diff: (d) => sinal(d, n(Math.abs(d))) },
    { nome: "Carga (PSE × min)", a: a.srpe, b: b.srpe, fmt: (v) => String(Math.round(v)), diff: (d) => sinal(d, String(Math.abs(Math.round(d)))) },
    { nome: "Calorias", a: a.calories, b: b.calories, fmt: (v) => `${v} kcal`, diff: (d) => sinal(d, `${Math.abs(d)} kcal`) },
  ];
  return todas.filter((l) => l.a != null || l.b != null);
}

function lerIds(): [string | null, string | null] {
  if (typeof window === "undefined") return [null, null];
  const q = new URLSearchParams(window.location.search);
  return [q.get("a"), q.get("b")];
}

/** Dois treinos lado a lado: métricas, curvas de ritmo e FC sobrepostas e parciais por km. */
export default function CompareActivitiesPage() {
  const [lados, setLados] = useState<[Lado, Lado] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [faltaId, setFaltaId] = useState(false);

  useEffect(() => {
    const [a, b] = lerIds();
    if (!a || !b) { setFaltaId(true); return; }
    const carrega = (id: string) => Promise.all([fetchActivity(id), fetchSplits(id).catch(() => [] as Split[])]).then(([act, splits]) => ({ act, splits }));
    Promise.all([carrega(a), carrega(b)])
      .then(([la, lb]) => setLados([la, lb]))
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar os treinos"));
  }, []);

  const bike = lados ? isBikeSport(lados[0].act.sport) && isBikeSport(lados[1].act.sport) : false;
  const series = useMemo(() => (lados ? lados.map((l) => serie(l.act.points, bike)) as [SeriePonto[], SeriePonto[]] : null), [lados, bike]);

  const header = (
    <PageHeader
      kicker="Atividades"
      title="Comparar treinos"
      description="Dois treinos lado a lado: números, curvas de ritmo e FC e as parciais."
      actions={<Link href="/activities?comparar=1" className="od-btn od-btn-ghost">Escolher outros</Link>}
    />
  );

  if (faltaId) {
    return (
      <PageContainer>
        {header}
        <Panel><EmptyState title="Escolha dois treinos" description="Em Atividades, toque em ⇄ Comparar e marque os dois treinos." action={<Link href="/activities?comparar=1" className="od-btn od-btn-primary">Ir para Atividades</Link>} /></Panel>
      </PageContainer>
    );
  }
  if (error) return <PageContainer>{header}<Alert tone="danger">{error}</Alert></PageContainer>;
  if (!lados || !series) {
    return <PageContainer>{header}<div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-72" /><Skeleton className="h-64" /></div></PageContainer>;
  }

  const [A, B] = lados;
  const tabela = linhas(A.act, B.act, bike);
  const temRitmo = series.some((s) => s.some((p) => p.v != null));
  const temFc = series.some((s) => s.some((p) => p.hr != null));
  const nSplits = Math.max(A.splits.length, B.splits.length);

  return (
    <PageContainer>
      {header}

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {([["a", A], ["b", B]] as const).map(([k, l]) => (
          <Link key={k} href={`/activities/${l.act.id}`} className="od-panel od-interactive flex items-center gap-3 !p-4" style={{ boxShadow: `inset 3px 0 0 ${COR[k]}` }}>
            <SportTile sport={l.act.sport} size={40} radius={11} />
            <div className="min-w-0 flex-1">
              <div className="text-[0.66rem] font-bold uppercase tracking-[0.14em]" style={{ color: COR[k] }}>Treino {k.toUpperCase()}</div>
              <div className="truncate font-semibold">{l.act.title ?? sportLabel(l.act.sport)}</div>
              <div className="text-[0.72rem] text-brand-muted">{formatDate(l.act.start_time)} · {formatDistance(l.act.distance_m)}</div>
            </div>
          </Link>
        ))}
      </div>

      <Panel className="mb-4 overflow-hidden !p-0" aria-label="Números">
        <div className="overflow-x-auto">
          <table className="od-table">
            <thead>
              <tr>
                <th className="text-left">Métrica</th>
                <th className="text-right" style={{ color: COR.a }}>A</th>
                <th className="text-right" style={{ color: COR.b }}>B</th>
                <th className="text-right">B − A</th>
              </tr>
            </thead>
            <tbody>
              {tabela.map((l) => {
                const d = l.a != null && l.b != null ? l.b - l.a : null;
                const cor = d == null || d === 0 || l.menorMelhor == null ? undefined : (d < 0) === l.menorMelhor ? C.accent : C.warning;
                return (
                  <tr key={l.nome}>
                    <td className="text-brand-textSecondary">{l.nome}</td>
                    <td className="od-num text-right">{l.a == null ? "—" : l.fmt(l.a)}</td>
                    <td className="od-num text-right">{l.b == null ? "—" : l.fmt(l.b)}</td>
                    <td className="text-right text-xs" style={{ color: cor ?? C.textSecondary }}>{d == null || !l.diff ? "—" : d === 0 ? "igual" : l.diff(d)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {(temRitmo || temFc) && (
        <Panel className="mb-4" aria-label="Curvas sobrepostas">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="od-label">Curvas por distância</h2>
            <div className="flex gap-3 text-xs"><LegendDot color={COR.a} label="A" /><LegendDot color={COR.b} label="B" /></div>
          </div>
          {temRitmo && <Curva titulo={bike ? "Velocidade" : "Ritmo"} series={series} campo="v" bike={bike} />}
          {temFc && <Curva titulo="Frequência cardíaca" series={series} campo="hr" bike={bike} />}
          <p className="mt-2 text-[0.7rem] text-brand-textTertiary">Médias a cada {series[0].length > 1 ? Math.round((series[0][1].km - series[0][0].km) * 1000) : 50} m, suavizadas. Passe o dedo ou o mouse para ver os dois no mesmo ponto.</p>
        </Panel>
      )}

      {nSplits > 0 && (
        <Panel className="overflow-hidden !p-0" aria-label="Parciais por km">
          <h2 className="od-label px-5 pt-5">Parciais por km</h2>
          <div className="overflow-x-auto">
            <table className="od-table">
              <thead>
                <tr>
                  <th className="text-left">km</th>
                  <th className="text-right" style={{ color: COR.a }}>{bike ? "Tempo A" : "Ritmo A"}</th>
                  <th className="text-right" style={{ color: COR.b }}>{bike ? "Tempo B" : "Ritmo B"}</th>
                  <th className="text-right">B − A</th>
                  <th className="text-right" style={{ color: COR.a }}>FC A</th>
                  <th className="text-right" style={{ color: COR.b }}>FC B</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: nSplits }, (_, i) => {
                  const sa = A.splits[i], sb = B.splits[i];
                  const va = bike ? sa?.duration_s : sa?.pace_s_per_km, vb = bike ? sb?.duration_s : sb?.pace_s_per_km;
                  const d = va != null && vb != null ? Math.round(vb - va) : null;
                  const show = (v: number | null | undefined) => (v == null ? "—" : bike ? formatDuration(v) : `${formatPaceShort(v)}`);
                  return (
                    <tr key={i}>
                      <td className="text-brand-muted">{i + 1}{(sa ?? sb) && (sa ?? sb)!.distance_m < 990 ? <span className="text-[0.65rem]"> ({Math.round((sa ?? sb)!.distance_m)} m)</span> : null}</td>
                      <td className="od-num text-right">{show(va)}</td>
                      <td className="od-num text-right">{show(vb)}</td>
                      <td className="text-right text-xs" style={{ color: d == null || d === 0 ? C.textSecondary : d < 0 ? C.accent : C.warning }}>{d == null ? "—" : d === 0 ? "igual" : `${d > 0 ? "+" : "−"}${Math.abs(d)} s`}</td>
                      <td className="text-right text-brand-textSecondary">{sa?.avg_hr ?? "—"}</td>
                      <td className="text-right text-brand-textSecondary">{sb?.avg_hr ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </PageContainer>
  );
}

function Curva({ titulo, series, campo, bike }: { titulo: string; series: [SeriePonto[], SeriePonto[]]; campo: "v" | "hr"; bike: boolean }) {
  const ritmo = campo === "v" && !bike;
  const fmt = (v: number) => (campo === "hr" ? `${v} bpm` : ritmo ? `${formatPaceShort(v)}/km` : `${v.toLocaleString("pt-BR")} km/h`);
  // as duas curvas no mesmo eixo de km: para o tooltip mostrar A e B no mesmo ponto
  const dados = useMemo(() => {
    const mapa = new Map<number, { km: number; a?: number | null; b?: number | null }>();
    series.forEach((s, i) => s.forEach((p) => {
      const km = Math.round(p.km * 10) / 10;
      const row = mapa.get(km) ?? { km };
      const v = p[campo];
      if (v != null) row[i === 0 ? "a" : "b"] = v;
      mapa.set(km, row);
    }));
    return [...mapa.values()].sort((x, y) => x.km - y.km);
  }, [series, campo]);

  return (
    <div className="mb-3">
      <p className="od-metric-label mb-1">{titulo}</p>
      <ResponsiveContainer width="100%" height={190}>
        <LineChart data={dados} margin={{ top: 6, right: 8, left: -6, bottom: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis {...axisProps} type="number" dataKey="km" domain={[0, "dataMax"]} tickFormatter={(v: number) => `${v.toLocaleString("pt-BR")} km`} />
          <YAxis {...axisProps} width={46} reversed={ritmo} domain={["auto", "auto"]} tickFormatter={(v: number) => (ritmo ? formatPaceShort(v) : String(Math.round(v)))} />
          <Tooltip
            cursor={{ stroke: "rgba(255,255,255,0.2)", strokeDasharray: "3 4" }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as { a?: number; b?: number };
              return (
                <ChartTooltipBox
                  title={`${Number(label).toLocaleString("pt-BR")} km`}
                  rows={[
                    { label: "A", value: row.a != null ? fmt(row.a) : "—", color: COR.a },
                    { label: "B", value: row.b != null ? fmt(row.b) : "—", color: COR.b },
                  ]}
                />
              );
            }}
          />
          <Line type="monotone" dataKey="a" stroke={COR.a} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
          <Line type="monotone" dataKey="b" stroke={COR.b} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
