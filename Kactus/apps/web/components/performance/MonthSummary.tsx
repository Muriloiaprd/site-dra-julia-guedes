"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { MonthStory } from "@/components/share/MonthStory";
import { EmptyState, Panel, Skeleton, TrendBadge } from "@/components/ui/primitives";
import { fetchMonthSummary, type MonthSummary as Month } from "@/lib/api";
import { formatClock, formatPaceShort, recordLabel } from "@/lib/utils";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const TIPO: Record<string, string> = {
  run: "Corrida", walk: "Caminhada", bike: "Bike", swim: "Natação", strength: "Musculação", pilates: "Pilates", other: "Outros",
};

const num = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

function shift(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function recordValue(r: Month["recordes"][number]): string {
  if (r.unidade === "seconds") return formatClock(r.valor);
  if (r.unidade === "meters") return r.valor >= 1000 ? `${num(r.valor / 1000)} km` : `${Math.round(r.valor)} m`;
  if (r.unidade === "watts") return `${Math.round(r.valor)} W`;
  if (r.unidade === "bpm") return `${Math.round(r.valor)} bpm`;
  return String(r.valor);
}

/** Resumo do mês em Desempenho: totais, esportes, destaques, recordes e o Story do mês. */
export function MonthSummary() {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [mes, setMes] = useState(thisMonth);
  const [data, setData] = useState<Month | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [story, setStory] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchMonthSummary(mes)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar o mês"))
      .finally(() => setLoading(false));
  }, [mes]);

  const [y, m] = mes.split("-").map(Number);
  const first = data?.meses_disponiveis[0];
  const maxKm = Math.max(1, ...(data?.esportes.map((e) => e.km) ?? [0]));

  return (
    <Panel aria-label="Resumo do mês">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="od-label">Resumo do mês</h2>
        <div className="flex items-center gap-1">
          <button type="button" className="od-icon-btn !h-8 !w-8 !rounded-lg" onClick={() => setMes(shift(mes, -1))} disabled={!!first && mes <= first} aria-label="Mês anterior">‹</button>
          <span className="min-w-[132px] text-center text-sm font-semibold">{MESES[m - 1]} {y}</span>
          <button type="button" className="od-icon-btn !h-8 !w-8 !rounded-lg" onClick={() => setMes(shift(mes, 1))} disabled={mes >= thisMonth} aria-label="Próximo mês">›</button>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-48" />
      ) : error ? (
        <p className="text-sm text-brand-danger">{error}</p>
      ) : !data || data.total.treinos === 0 ? (
        <EmptyState title="Nenhum treino neste mês" description="Escolha outro mês nas setas ou importe seus treinos." />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { k: "Distância", v: `${num(data.total.km)}`, u: "km", pct: data.variacao.km_pct },
              { k: "Tempo", v: num(data.total.horas), u: "h", pct: data.variacao.horas_pct },
              { k: "Treinos", v: String(data.total.treinos), u: "", delta: data.variacao.treinos },
              { k: "Dias ativos", v: String(data.total.dias), u: "" },
            ].map((t) => (
              <div key={t.k} className="od-tile p-3.5">
                <div className="od-metric-label">{t.k}</div>
                <div className="od-num mt-1 text-[1.5rem] leading-none">{t.v}{t.u && <span className="ml-1 font-sans text-xs text-brand-muted">{t.u}</span>}</div>
                <div className="mt-1.5 text-[0.7rem]">
                  {"pct" in t && t.pct != null ? <TrendBadge pct={t.pct} suffix=" vs mês anterior" /> : null}
                  {"delta" in t && t.delta != null && t.delta !== 0 ? <span className="text-brand-muted">{t.delta > 0 ? "+" : ""}{t.delta} vs mês anterior</span> : null}
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <ul className="space-y-2.5" aria-label="Por esporte">
              {data.esportes.map((e) => (
                <li key={e.tipo}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="font-semibold">{TIPO[e.tipo] ?? e.tipo}</span>
                    <span className="text-xs text-brand-muted">{e.km > 0 ? `${num(e.km)} km · ` : ""}{e.treinos} treino{e.treinos === 1 ? "" : "s"} · {num(e.horas)} h</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                    <div className="h-full rounded-full bg-brand-accent" style={{ width: `${Math.max(3, (e.km / maxKm) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="space-y-2 text-sm">
              {data.corrida?.pace_medio_s_km && (
                <p className="text-brand-textSecondary">Ritmo médio da corrida: <strong className="od-num text-white">{formatPaceShort(data.corrida.pace_medio_s_km)}/km</strong> em {num(data.corrida.km)} km</p>
              )}
              {data.maior_treino && (
                <p className="text-brand-textSecondary">
                  Maior treino: <Link href={`/activities/${data.maior_treino.id}`} className="font-semibold text-white hover:text-brand-accent">{data.maior_treino.titulo ?? TIPO[data.maior_treino.sport] ?? "treino"} · {num(data.maior_treino.km)} km</Link>
                </p>
              )}
              {data.recordes.length > 0 && (
                <div>
                  <p className="od-metric-label mb-1.5">Recordes do mês</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {data.recordes.map((r) => (
                      <li key={`${r.tipo}-${r.data}`} className="od-badge od-badge-gold !normal-case !tracking-normal">{recordLabel(r.tipo)} · {recordValue(r)}</li>
                    ))}
                  </ul>
                </div>
              )}
              <button type="button" onClick={() => setStory(true)} className="od-btn od-btn-secondary od-btn-sm mt-2">📤 Story do mês</button>
            </div>
          </div>
        </div>
      )}

      {story && data && <MonthStory month={data} onClose={() => setStory(false)} />}
    </Panel>
  );
}
