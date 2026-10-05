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
  FreeWeekResponse,
  GoalPhase,
  GoalPlanResponse,
  WeeklyPlanResponse,
} from "@/lib/api";
import { toISODate } from "@/lib/athlete";

/** A semana do plano comeca hoje (coach_service.week_range). */
function day(offset: number) {
  const d = new Date();
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
    id: "w1", date: day(0), title: "Rodagem leve de retomada", target_distance_m: 5000, target_duration_s: 1800,
    objective: "Acostumar o corpo ao impacto com esforço baixo.", reason: "Voltar a correr após o longão cansativo e a dor lombar.",
    steps: [
      { fase: "aquecimento", descricao: "Caminhada leve e mobilidade", duracao_min: 5, distancia_km: 0.5, repeticoes: null, ritmo: null, zona_fc: null, recuperacao: null },
      { fase: "principal", descricao: "Corrida contínua em ritmo leve", duracao_min: 25, distancia_km: 4.5, repeticoes: null, ritmo: "6:00/km", zona_fc: "Zona 2 (128-142 bpm)", recuperacao: null },
      { fase: "desaquecimento", descricao: "Caminhada leve", duracao_min: null, distancia_km: null, repeticoes: null, ritmo: null, zona_fc: null, recuperacao: null },
    ],
    targets: {
      tipo: "Rodagem leve", ritmo: "6:00/km", cadencia: "173 ppm", zona_fc: "Zona 2",
      gap: "6:00/km", terreno: "plano", metrica_prioritaria: "FC", observacoes: "Se a lombar incomodar, interrompa o treino.",
    },
  }),
  workout({
    id: "w2", date: day(2), title: "Intervalado 6×800 m", target_intensity: "forte", target_distance_m: 9000, target_duration_s: 3000,
    objective: "Subir a velocidade no ritmo de 5 km.", reason: "Sua forma está boa e a carga caiu na semana passada.",
    steps: [
      { fase: "aquecimento", descricao: "Trote bem leve", duracao_min: 15, distancia_km: null, repeticoes: null, ritmo: "6:30/km", zona_fc: "Z1–Z2", recuperacao: null },
      { fase: "principal", descricao: "Tiros de 800 m", duracao_min: 25, distancia_km: null, repeticoes: 6, ritmo: "4:35/km", zona_fc: "Z4", recuperacao: "2 min trotando" },
      { fase: "desaquecimento", descricao: "Trote solto", duracao_min: 10, distancia_km: null, repeticoes: null, ritmo: null, zona_fc: "Z1", recuperacao: null },
    ],
    targets: { tipo: "Intervalado", ritmo: "4:35/km nos tiros", zona_fc: "Z4", cadencia: "175–180 ppm", metrica_prioritaria: "FC", observacoes: "Se o 5º tiro passar de 4:45, pare no 5º." },
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
      { fase: "aquecimento", descricao: "Começo bem leve", duracao_min: null, distancia_km: 3, repeticoes: null, ritmo: "6:20/km", zona_fc: "Z2", recuperacao: null },
      { fase: "principal", descricao: "Progressivo", duracao_min: null, distancia_km: 10, repeticoes: null, ritmo: "6:00 → 5:30/km", zona_fc: "Z2–Z3", recuperacao: null },
      { fase: "desaquecimento", descricao: "Solta", duracao_min: null, distancia_km: 1, repeticoes: null, ritmo: null, zona_fc: "Z1", recuperacao: null },
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

/** Plano da semana pelo estado de agora (exemplo): mais leve que o objetivo no começo. */
const FREE: FreeWeekResponse = {
  plan: { ...WEEK.plan!, id: "livre", status: "amarelo", status_reason: "Lombar doeu no sábado: começo mais leve." },
  workouts: [
    workout({ id: "livre-0", date: day(0), title: "Rodagem curta", target_distance_m: 4000, targets: { tipo: "rodagem leve", ritmo: "6:30–7:00/km", zona_fc: "Z2 (136–150 bpm)" } }),
    workout({ id: "livre-2", date: day(2), title: "Fartlek leve", target_intensity: "moderado", target_distance_m: 6000, targets: { tipo: "fartlek", ritmo: "6:30/km com estímulos a 5:30/km", zona_fc: "Z2–Z4" } }),
    workout({ id: "livre-4", date: day(4), title: "Fortalecimento", sport: "strength", target_duration_s: 2400, targets: { tipo: "Força" } }),
    workout({ id: "livre-5", date: day(5), title: "Rodagem leve", target_distance_m: 5000, targets: { tipo: "rodagem leve", ritmo: "6:30–7:00/km", zona_fc: "Z2 (136–150 bpm)" } }),
    workout({ id: "livre-6", date: day(6), title: "Longão controlado", target_intensity: "leve", target_distance_m: 12000, targets: { tipo: "longão", ritmo: "6:30–7:00/km", zona_fc: "Z2 (136–150 bpm)" } }),
  ].map((w) => ({ ...w, status: "proposta" })),
  comparison: {
    recomenda: "misturar",
    explicacao: "A lombar ainda incomoda: comece a semana pelo plano de agora e volte ao objetivo no fim de semana.",
    dias: [
      { data: day(0), escolha: "semana", motivo: "Menos volume enquanto a lombar se acalma." },
      { data: day(2), escolha: "semana", motivo: "Fartlek no lugar dos tiros: mesmo estímulo, menos impacto." },
      { data: day(6), escolha: "objetivo", motivo: "O longão de 14 km cabe se a dor sumir até sábado." },
    ],
  },
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

/** Plano do objetivo de exemplo: maratona no fim de maio de 2027, 3 dias por semana. */
function goalExample(): GoalPlanResponse {
  const race = new Date(2027, 4, 30);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const total = Math.floor((race.getTime() - start.getTime()) / (7 * 86_400_000)) + 1;
  const train = total - 3;
  const phaseOf = (i: number): GoalPhase =>
    i >= train ? "polimento" : i < Math.round(train * 0.4) ? "base" : i < Math.round(train * 0.75) ? "construcao" : "pico";
  let top = 19;
  const weeks = Array.from({ length: total }, (_, i) => {
    const ini = new Date(start);
    ini.setDate(ini.getDate() + 7 * i);
    const fim = new Date(ini);
    fim.setDate(fim.getDate() + 6);
    const fase = phaseOf(i);
    const alivio = fase !== "polimento" && i % 4 === 3;
    if (i > 0 && !alivio && fase !== "polimento") top = Math.min(top * 1.1, 55);
    const km = fase === "polimento" ? top * [0.75, 0.6, 0.4][i - train] : top * (alivio ? 0.75 : 1);
    const longao = Math.min(32, Math.round(km * 0.55 * 2) / 2);
    return { semana: i + 1, inicio: toISODate(ini), fim: toISODate(fim), fase, km: Math.round(km * 10) / 10, longao_km: longao, alivio };
  });
  const phases = (["base", "construcao", "pico", "polimento"] as GoalPhase[]).map((f) => {
    const ws = weeks.filter((w) => w.fase === f);
    const foco = { base: "Volume leve e constância, cuidando da lombar.", construcao: "Longões maiores e limiar.", pico: "Ritmo de prova e os longões de 32 km.", polimento: "Menos volume para chegar descansado." }[f];
    return { fase: f, inicio: ws[0].inicio, fim: ws[ws.length - 1].fim, foco };
  });
  const workouts: PlannedWorkout[] = weeks.flatMap((w) => {
    const ini = new Date(w.inicio + "T00:00:00");
    const at = (wd: number) => {
      const d = new Date(ini);
      d.setDate(d.getDate() + ((wd - ((d.getDay() + 6) % 7)) + 7) % 7);
      return toISODate(d);
    };
    const rest = w.km - w.longao_km;
    return [
      workout({ id: `g${w.semana}q`, date: at(1), title: w.fase === "base" ? "Progressivo" : "Limiar", target_intensity: w.fase === "base" ? "moderado" : "forte", target_distance_m: Math.round(rest * 0.55) * 1000, goal_plan_id: "gp", targets: { tipo: w.fase === "base" ? "progressivo" : "limiar", ritmo: w.fase === "base" ? "6:48 → 5:48/km" : "blocos a 5:25/km", zona_fc: "Z4 (155–170 bpm)" } }),
      workout({ id: `g${w.semana}e`, date: at(3), title: "Rodagem leve", target_distance_m: Math.round(rest * 0.45) * 1000, goal_plan_id: "gp", targets: { tipo: "rodagem leve", ritmo: "6:13–6:48/km", zona_fc: "Z2 (128–142 bpm)" } }),
      workout({ id: `g${w.semana}l`, date: at(6), title: "Longão", target_distance_m: w.longao_km * 1000, goal_plan_id: "gp", targets: { tipo: "longão", ritmo: "6:13–6:48/km", zona_fc: "Z2 (128–142 bpm)" } }),
    ].filter((x) => x.date <= toISODate(race) && x.date >= toISODate(start));
  });
  return {
    plan: {
      id: "gp", race_name: "Maratona do Rio", race_date: toISODate(race), race_distance_km: 42.2, days_per_week: 3, vdot: 37,
      summary: "Base longa e tranquila para a lombar, construção com limiar e pico com ritmo de prova e três longões de 32 km.",
      phases, weeks, paces: { leve_rapido: 383, leve_lento: 419, limiar: 334, intervalo: 308, prova: 358 }, model_used: "exemplo", created_at: NOW,
      analysis: [
        { tema: "Último mês", texto: "Média de 9,8 km por semana (a última com 17,8 km), 1,8 corridas por semana e longão de 10 km. O plano parte daqui." },
        { tema: "Histórico de 6 meses", texto: "Você já sustentou 52,8 km por semana (abr/26) e fez longão de 36 km. Isso define até onde o plano sobe." },
        { tema: "Pausa", texto: "8 semanas seguidas quase parado. A volta é gradual, sem tentar recuperar o volume antigo de uma vez." },
        { tema: "Dor", texto: "Dor recente: lombar, sacroilíaca (até 3/10). O volume sobe no máximo 8% por semana." },
        { tema: "Nível", texto: "VDOT 35,8, 70% pelo seu ritmo e FC no último mês e 30% pelos recordes. Maratona prevista hoje: 4:11:27." },
        { tema: "Dias", texto: "Treinos de terça, quinta e sábado, como você contou; longão no sábado." },
      ],
    },
    workouts,
  };
}

const GOAL = goalExample();

const METRICS: DailyMetric[] = [{ date: toISODate(new Date()), daily_load: 40, ctl: 38, atl: 35, tsb: 3.2, acwr: 1.05 }];

const ROUTES: [RegExp, unknown][] = [
  [/\/coach\/plan\/free\/use/, WEEK],
  [/\/coach\/plan\/free/, FREE],
  [/\/coach\/plan\/[^/]+\/analyze/, {
    verdict: "ajustar",
    explanation: "A lombar doeu no último treino (3/10): troque o progressivo por rodagem leve e mais curta.",
    points: ["Dor lombar no sábado", "Semana de base: o importante é constância", "Volume da semana segue igual"],
    suggestion: { titulo: "Rodagem leve sem dor" },
    preview: {
      title: "Rodagem leve sem dor", target_distance_m: 4000, target_duration_s: 1620, target_intensity: "leve",
      targets: { tipo: "rodagem leve", ritmo: "6:30–7:00/km", zona_fc: "Z2 (136–150 bpm)" },
      steps: [
        { fase: "aquecimento", descricao: "Caminhada", distancia_km: 0.5, duracao_min: 5, ritmo: "9:30/km", zona_fc: "Z1", repeticoes: null, recuperacao: null },
        { fase: "principal", descricao: "Rodagem leve", distancia_km: 3, duracao_min: 20, ritmo: "6:45/km", zona_fc: "Z2 (136–150 bpm)", repeticoes: null, recuperacao: null },
        { fase: "desaquecimento", descricao: "Caminhada", distancia_km: 0.5, duracao_min: 5, ritmo: "9:30/km", zona_fc: "Z1", repeticoes: null, recuperacao: null },
      ],
    },
    model_used: "exemplo",
  }],
  [/\/coach\/goal-plan/, GOAL],
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
      // ?sem-semana: plano do objetivo sem a semana detalhada (cards so com os treinos do objetivo)
      if (/\/coach\/plan\/week/.test(url) && window.location.search.includes("sem-semana")) {
        const end = day(6);
        const body = { plan: null, workouts: GOAL.workouts.filter((w) => w.date <= end) };
        return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
      }
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
