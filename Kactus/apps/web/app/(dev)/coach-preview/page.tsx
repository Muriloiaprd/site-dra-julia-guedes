"use client";

/**
 * Ferramenta só-de-desenvolvimento: abre a página da Duni com dados de exemplo,
 * sem login e sem chamar a API (nem a IA). Serve pra conferir o layout da
 * /coach. Troca o `fetch` da janela por respostas fixas só enquanto esta
 * página está aberta. Uso: /coach-preview
 */

import { useEffect, useState } from "react";

import CoachPage from "@/app/coach/page";
import type {
  AthleteMemory,
  CoachChatMessage,
  CoachReport,
  DailyMetric,
  PlannedWorkout,
  WeeklyPlanResponse,
} from "@/lib/api";
import { getMonday, toISODate } from "@/lib/athlete";

function day(offset: number) {
  const d = getMonday();
  d.setDate(d.getDate() + offset);
  return toISODate(d);
}

const NOW = new Date().toISOString();

function workout(p: Partial<PlannedWorkout> & Pick<PlannedWorkout, "id" | "date" | "title">): PlannedWorkout {
  return {
    sport: "run", description: null, target_duration_s: null, target_distance_m: null, target_tss: null,
    target_intensity: "leve", status: "planned", activity_id: null, ...p,
  };
}

const WORKOUTS: PlannedWorkout[] = [
  workout({
    id: "w1", date: day(0), title: "Rodagem leve", status: "done", target_distance_m: 6000, target_duration_s: 2160,
    objective: "Manter o volume aeróbico sem cansar.", reason: "Você vem de um longão no domingo.",
    targets: { tipo: "Rodagem", ritmo: "6:00–6:20/km", zona_fc: "Z2" },
  }),
  workout({
    id: "w2", date: day(2), title: "Intervalado 6×800 m", target_intensity: "forte", target_distance_m: 9000, target_duration_s: 3000,
    objective: "Subir a velocidade no ritmo de 5 km.", reason: "Sua forma está boa e a carga caiu na semana passada.",
    steps: [
      { fase: "aquecimento", descricao: "Trote bem leve", duracao_min: 15, distancia_km: null, repeticoes: null, ritmo: "6:30/km", zona_fc: "Z1–Z2", pse: null, recuperacao: null },
      { fase: "principal", descricao: "Tiros de 800 m", duracao_min: 25, distancia_km: null, repeticoes: 6, ritmo: "4:35/km", zona_fc: "Z4", pse: "8/10", recuperacao: "2 min trotando" },
      { fase: "desaquecimento", descricao: "Trote solto", duracao_min: 10, distancia_km: null, repeticoes: null, ritmo: null, zona_fc: "Z1", pse: null, recuperacao: null },
    ],
    targets: { tipo: "Intervalado", ritmo: "4:35/km nos tiros", zona_fc: "Z4", pse: "8/10", cadencia: "175–180 ppm", metrica_prioritaria: "PSE", observacoes: "Se o 5º tiro passar de 4:45, pare no 5º." },
  }),
  workout({
    id: "w3", date: day(3), title: "Regenerativo", target_distance_m: 5000, target_duration_s: 1950,
    objective: "Recuperar do intervalado.", targets: { tipo: "Regenerativo", ritmo: "6:30/km", zona_fc: "Z1–Z2" },
  }),
  workout({
    id: "w4", date: day(4), title: "Fortalecimento", sport: "strength", target_duration_s: 2400,
    objective: "Proteger joelho e quadril.", targets: { tipo: "Força", observacoes: "Agachamento, ponte, prancha." },
  }),
  workout({
    id: "w5", date: day(6), title: "Longão progressivo", target_intensity: "moderado", target_distance_m: 14000, target_duration_s: 5040,
    objective: "Resistência para a meia maratona.", reason: "Faltam 8 semanas para a prova.",
    steps: [
      { fase: "aquecimento", descricao: "Começo bem leve", duracao_min: null, distancia_km: 3, repeticoes: null, ritmo: "6:20/km", zona_fc: "Z2", pse: null, recuperacao: null },
      { fase: "principal", descricao: "Progressivo", duracao_min: null, distancia_km: 10, repeticoes: null, ritmo: "6:00 → 5:30/km", zona_fc: "Z2–Z3", pse: "6/10", recuperacao: null },
      { fase: "desaquecimento", descricao: "Solta", duracao_min: null, distancia_km: 1, repeticoes: null, ritmo: null, zona_fc: "Z1", pse: null, recuperacao: null },
    ],
    targets: { tipo: "Longão", ritmo: "6:00 → 5:30/km", zona_fc: "Z2–Z3", terreno: "Plano" },
  }),
];

const WEEK: WeeklyPlanResponse = {
  plan: {
    id: "p1", week_start: day(0), week_end: day(6), status: "verde",
    status_reason: "Carga estável, sono bom e nenhuma dor relatada.",
    model_used: "exemplo", created_at: NOW,
    report: {
      resumo: "Semana de construção: um treino de qualidade no meio e o longão no domingo.",
      carga_semana_anterior: {
        corrida_km: 28.4, corrida_minutos: 170, corridas: 4, treinos_total: 5, longao_km: 12, ritmo_medio: "5:59/km",
        caminhada_km: null, complementar: { musculação: { sessoes: 1, minutos: 40 } }, carga_interna_srpe: null, pse_media: 5.5,
        intensidade_28d_pct: { leve_z1_z2: 78, moderado_z3: 14, forte_z4_z5: 8 },
      },
      avaliacao: { positivos: ["Constância: 4 corridas por semana"], fadiga: [], riscos: ["Volume subiu 12% em 2 semanas"], evolucao: ["Ritmo leve 10 s/km mais rápido"] },
      proxima_semana: { km_previsto: 34, sessoes: 5, estimulo_principal: "velocidade", objetivo: "Meia maratona" },
      criterios_ajuste: { manter: ["Sem dor"], reduzir: ["Sono ruim 2 noites"], acelerar: [], interromper: ["Dor no joelho"] },
      proximas_4_semanas: [
        { semana: 1, km_aproximado: 34, foco: "Velocidade" },
        { semana: 2, km_aproximado: 37, foco: "Limiar" },
        { semana: 3, km_aproximado: 30, foco: "Recuperação" },
        { semana: 4, km_aproximado: 40, foco: "Longão" },
      ],
    },
  },
  workouts: WORKOUTS,
};

const REPORT: CoachReport = {
  model_used: "exemplo",
  generated_at: NOW,
  report: null,
  summary: {
    status: "verde",
    status_frase: "Você está recuperado e pronto para um treino forte nesta semana.",
    semana: "28 km em 4 corridas, quase tudo leve. O longão de 12 km saiu no ritmo certo.",
    pontos: [
      { tipo: "bom", texto: "Você correu 4 vezes, como combinado." },
      { tipo: "atencao", texto: "O volume subiu rápido nas duas últimas semanas." },
    ],
    acoes: ["Faça o intervalado na quarta, não antes.", "Durma 7 h ou mais antes do longão."],
    pergunta: "A panturrilha ainda incomoda depois dos treinos?",
  },
};

const HISTORY: CoachChatMessage[] = [
  { role: "user", content: "Posso fazer um treino forte amanhã?", created_at: NOW },
  { role: "assistant", content: "Pode, mas na **quarta** é melhor: hoje você ainda está absorvendo o longão. Amanhã, rodagem leve.", created_at: NOW },
  { role: "user", content: "Beleza. E o longão de domingo, faço em jejum?", created_at: NOW },
  { role: "assistant", content: "Não. Coma algo leve 1 h antes, como uma banana com pão. Em jejum o ritmo cai no fim.", created_at: NOW },
];

const MEMORIES: AthleteMemory[] = [
  { id: "m1", kind: "prova", content: "Meia Maratona do Rio", event_date: day(56), active: true, source: "manual", created_at: NOW },
  { id: "m2", kind: "objetivo", content: "Baixar a meia para 1h55", event_date: null, active: true, source: "duni", created_at: NOW },
  { id: "m3", kind: "disponibilidade", content: "Longão só no domingo de manhã", event_date: null, active: true, source: "manual", created_at: NOW },
];

const METRICS: DailyMetric[] = [{ date: toISODate(new Date()), daily_load: 40, ctl: 38, atl: 35, tsb: 3.2, acwr: 1.05 }];

const ROUTES: [RegExp, unknown][] = [
  [/\/auth\/me$/, { id: "preview", email: "preview@kactus" }],
  [/\/coach\/chat\/history/, HISTORY],
  [/\/coach\/memories/, MEMORIES],
  [/\/coach\/plan\/week/, WEEK],
  [/\/coach\/plan\?/, WORKOUTS],
  [/\/coach\/analyze/, REPORT],
  [/\/metrics\/load/, METRICS],
  [/\/predictions\/overview/, {
    race_predictions: [], risk: { level: "low", reasons: [], recommendation: "" },
    recommendation: { type: "hard", label: "Treino forte", color: "#00FF66", detail: "Sua forma permite qualidade hoje" },
  }],
];

let installed = false;

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const real = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/api/")) {
      const hit = ROUTES.find(([re]) => re.test(url));
      return new Response(JSON.stringify(hit ? hit[1] : {}), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return real(input, init);
  };
}

export default function CoachPreview() {
  // Antes da pagina montar: os efeitos dela ja chamam a API no primeiro render.
  // fetchMe so chama a API se houver token; o falso sai ao fechar a pagina.
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
  // Na saida da aba, nao no desmontar: o modo dev do React desmonta e monta de novo.
  useEffect(() => {
    if (!fakeToken) return;
    const clear = () => { try { localStorage.removeItem("kactus_token"); } catch { /* ignore */ } };
    window.addEventListener("pagehide", clear);
    return () => window.removeEventListener("pagehide", clear);
  }, [fakeToken]);
  return <CoachPage />;
}
