"use client";

/**
 * Ferramenta só-de-desenvolvimento: Desempenho com dados de exemplo, sem login e sem
 * API (fetch interceptado). Serve pra conferir o resumo do mês (e o Story do mês),
 * ritmo × calor e a técnica de corrida. Uso: /performance-preview
 */

import { useEffect, useState } from "react";

import PerformancePage from "@/app/performance/page";

const ym = (delta: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const MONTH = (mes: string) => ({
  mes, inicio: `${mes}-01`, fim: `${mes}-30`,
  total: { treinos: 14, km: 142.6, horas: 15.4, dias: 13 },
  anterior: { treinos: 11, km: 118.0, horas: 12.9, dias: 11 },
  variacao: { km_pct: 21, horas_pct: 19, treinos: 3 },
  esportes: [
    { tipo: "run", treinos: 10, km: 98.4, horas: 9.8, dias: 10 },
    { tipo: "bike", treinos: 2, km: 44.2, horas: 2.1, dias: 2 },
    { tipo: "strength", treinos: 2, km: 0, horas: 1.5, dias: 2 },
  ],
  corrida: { km: 98.4, treinos: 10, pace_medio_s_km: 358 },
  maior_treino: { id: "a1", titulo: "Longão de domingo", sport: "run", km: 21.1, data: `${mes}-19` },
  recordes: [{ tipo: "fastest_10k", sport: "run", valor: 3420, unidade: "seconds", data: `${mes}-12`, activity_id: "a2" }],
  meses_disponiveis: [ym(-5), ym(-4), ym(-3), ym(-2), ym(-1), ym(0)],
});

const SUMMARY = {
  hoje: { type: "moderate", label: "Treino moderado", color: "#e3b341", detail: "Cansaço sob controle" },
  semana: { corrida_km: 24, horas: 3.1, treinos: 4 }, media_4_semanas: { corrida_km: 22, horas: 2.9, treinos: 3.5 },
  faixa_segura: { disponivel: true, min_km: 20, max_km: 32, feito_7d_km: 24 },
  meta_semanal: { km: 30, feito_km: 18, falta_km: 12, situacao: "dentro" },
  intensidade_28d: { disponivel: true, percentual: { leve_z1_z2: 72, moderado_z3: 18, forte_z4_z5: 10 } },
  efeito_treino_7d: null, semanas: [],
};

const LOAD = Array.from({ length: 90 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() - 89 + i);
  return { date: d.toISOString().slice(0, 10), daily_load: i % 2 ? 60 : 0, ctl: 30 + i / 6, atl: 32 + (i % 7), tsb: -2 - (i % 5), acwr: 1.05 };
});

const HEAT = (() => {
  const pontos = Array.from({ length: 28 }, (_, i) => {
    const temp = 12 + (i * 7) % 22;
    const d = new Date(); d.setDate(d.getDate() - i * 9);
    return { id: `h${i}`, data: d.toISOString().slice(0, 10), temp_c: temp, pace_s_km: Math.round(345 + (temp - 12) * 1.6 + (i % 5) * 4), fc: Math.round(142 + (temp - 12) * 0.6), km: 6 + (i % 6) };
  });
  return {
    corridas: pontos.length, pontos,
    faixas: [
      { faixa: "até 15 °C", corridas: 5, pace_s_km: 352, fc: 143 },
      { faixa: "15–20 °C", corridas: 6, pace_s_km: 357, fc: 145 },
      { faixa: "20–25 °C", corridas: 7, pace_s_km: 364, fc: 148 },
      { faixa: "25–30 °C", corridas: 6, pace_s_km: 372, fc: 151 },
      { faixa: "30 °C ou mais", corridas: 4, pace_s_km: 381, fc: 155 },
    ],
    comparacao: { fria: "até 15 °C", quente: "30 °C ou mais", pace_diff_s_km: 29, fc_diff: 12 },
  };
})();

const TECH = (() => {
  const meses = Array.from({ length: 12 }, (_, i) => ({
    mes: ym(i - 11), corridas: 8 + (i % 5), km: 70 + i * 9,
    cadencia: 161 + Math.round(i * 1.1), contato_ms: 274 - i * 2, oscilacao_mm: 96 - i, razao_vertical_pct: Number((8.8 - i * 0.05).toFixed(1)),
    passada_m: Number((1.1 - (i % 4) * 0.02).toFixed(2)), pace_s_km: 345 - i,
  }));
  return {
    corridas: 120, meses,
    atual: { cadencia: 172, contato_ms: 253, oscilacao_mm: 85, razao_vertical_pct: 8.3, passada_m: 1.05, pace_s_km: 335, corridas: 30, km: 300,
      faixas: { cadencia: "média", contato_ms: "média", oscilacao_mm: "média", razao_vertical_pct: "média", passada_m: null } },
    comparacao: { de: ym(-11), ate: ym(0), cadencia: 11, contato_ms: -21, oscilacao_mm: -11, razao_vertical_pct: -0.5, passada_m: -0.03, pace_s_km: -10 },
  };
})();

function routes(url: string): unknown {
  const month = url.match(/\/metrics\/month\?month=(\d{4}-\d{2})/);
  if (month) return MONTH(month[1]);
  if (/\/metrics\/month/.test(url)) return MONTH(ym(0));
  if (/\/metrics\/summary/.test(url)) return SUMMARY;
  if (/\/metrics\/load/.test(url)) return LOAD;
  if (/\/metrics\/heatmap/.test(url)) return [];
  if (/\/metrics\/heat$/.test(url)) return HEAT;
  if (/\/metrics\/technique/.test(url)) return TECH;
  if (/\/predictions\/overview/.test(url)) return {
    race_predictions: [], risk: { level: "low", reasons: ["Carga dentro da zona segura"], recommendation: "" },
    recommendation: SUMMARY.hoje,
  };
  if (/\/activities\?/.test(url)) return [];
  if (/\/auth\/me$/.test(url)) return { id: "preview", email: "murilo@kactus" };
  return {};
}

let installed = false;

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const real = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes("/api/")) return real(input, init);
    return new Response(JSON.stringify(routes(url)), { status: 200, headers: { "Content-Type": "application/json" } });
  };
}

export default function PerformancePreview() {
  const [fakeToken] = useState(() => {
    install();
    try {
      if (localStorage.getItem("kactus_token")) return false;
      localStorage.setItem("kactus_token", "preview");
      return true;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (!fakeToken) return;
    const clear = () => { try { localStorage.removeItem("kactus_token"); } catch { /* ignore */ } };
    window.addEventListener("pagehide", clear);
    return () => window.removeEventListener("pagehide", clear);
  }, [fakeToken]);
  return <PerformancePage />;
}
