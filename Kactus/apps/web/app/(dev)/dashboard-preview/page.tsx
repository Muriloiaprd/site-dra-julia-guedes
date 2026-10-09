"use client";

/**
 * Ferramenta só-de-desenvolvimento: o dashboard com dados de exemplo, sem login e sem
 * API (fetch interceptado). Serve pra conferir a meta de km, a próxima prova, o
 * planejado × feito e o Story do último treino. Uso: /dashboard-preview
 * (?sem-prova mostra o cartão sem plano do objetivo).
 */

import { useEffect, useState } from "react";

import DashboardPage from "@/app/dashboard/page";
import { toISODate } from "@/lib/athlete";

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toISODate(d);
};
const at = (offset: number, hour = 7) => `${day(offset)}T${String(hour).padStart(2, "0")}:00:00-03:00`;

function activity(id: string, offset: number, km: number, pace: number, title: string) {
  return {
    id, sport: "run", title, start_time: at(offset), duration_s: Math.round(km * pace) + 60, moving_time_s: Math.round(km * pace),
    distance_m: km * 1000, elevation_gain_m: 35, avg_hr: 148, avg_pace_s_per_km: pace, avg_speed_kmh: 3600 / pace, source: "fit",
  };
}

const monday = (() => { const d = new Date(); return -((d.getDay() + 6) % 7); })();
const ACTS = [
  activity("a1", 0, 8.2, 372, "Rodagem leve"),
  activity("a2", Math.max(monday, -2), 6.0, 365, "Regenerativo"),
  activity("a3", -4, 14.0, 395, "Longão"),
  activity("a4", -8, 10.0, 360, "Progressivo"),
  activity("a5", -11, 6.5, 370, "Rodagem"),
];

const points = Array.from({ length: 120 }, (_, i) => ({
  elapsed_time_s: i * 25, lat: -22.97 + Math.sin(i / 19) * 0.01, lon: -43.19 + Math.cos(i / 19) * 0.01, altitude_m: 10 + (i % 30),
  distance_m: i * 70, hr: 140 + (i % 15), cadence: 168, power_w: null, speed_ms: 2.7,
}));

const weeks = Array.from({ length: 30 }, (_, i) => {
  const start = -14 + i * 7;
  return {
    semana: i + 1, inicio: day(start), fim: day(start + 6), fase: i < 10 ? "base" : i < 20 ? "construcao" : i < 27 ? "pico" : "polimento",
    km: 20 + i, longao_km: 10 + i / 2, alivio: i % 4 === 3,
  };
});

const GOAL = {
  plan: {
    id: "g1", race_name: "Maratona do Rio", race_date: day(200), race_distance_km: 42.2, days_per_week: 3, vdot: 35.8,
    summary: "Base longa, construção e pico até a maratona.", phases: [], weeks,
    paces: { leve_rapido: 395, leve_lento: 425, limiar: 330, intervalo: 305, prova: 358 }, analysis: [], model_used: "exemplo", created_at: at(-20),
  },
  workouts: [],
};

const ROUTES: [RegExp, unknown][] = [
  [/\/auth\/me$/, { id: "preview", email: "murilo@kactus" }],
  [/\/profile$/, { full_name: "Murilo", avatar_data_url: null, weekly_km_goal: 30, max_hr: 190, resting_hr: 55, hr_zones: null }],
  [/\/activities\/[^/?]+\/splits/, [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ index: i, distance_m: 1000, duration_s: 370, pace_s_per_km: 365 + (i % 3) * 5, avg_hr: 145 + i, elevation_gain_m: 3, gap_pace_s_per_km: 362 }))],
  [/\/activities\/[^/?]+\/zones/, [1, 2, 3, 4, 5].map((z) => ({ zone: z, seconds: [300, 1500, 900, 200, 0][z - 1], percent: [10, 52, 31, 7, 0][z - 1] }))],
  [/\/activities\/a\d$/, { ...ACTS[0], description: null, equipment_id: null, laps: [], points, max_hr: 168, avg_cadence: 168 }],
  [/\/activities\?/, ACTS],
  [/\/records$/, []],
  [/\/predictions\/overview/, {
    race_predictions: [{ distance: "10k", distance_m: 10000, predicted_s: 3480, confidence: 0.8, source: "fastest_5k", vdot: 35.8 }],
    risk: { level: "low", reasons: ["Carga dentro da zona segura"], recommendation: "" },
    recommendation: { type: "moderate", label: "Treino moderado", color: "#e3b341", detail: "Cansaço sob controle" },
  }],
  [/\/metrics\/load/, []],
  [/\/coach\/plan\/adherence/, [{
    id: "ad1", date: day(-1), title: "Rodagem leve", sport: "run", status: "done",
    planned: { distance_m: 8000, duration_s: 3000, intensity: "leve", ritmo: "6:30–7:00/km", zona_fc: "Z2" },
    actual: { activity_id: "a1", title: "Rodagem leve", sport: "run", distance_m: 8200, moving_s: 3050, pace_s_per_km: 372, avg_hr: 148, rpe: 4 },
    volume: "cumpriu", ratio: 1.03, ritmo: "no_ritmo", comment: null,
  }]],
  [/\/coach\/plan\/week/, { plan: null, workouts: [] }],
  [/\/coach\/plan\?/, []],
  [/\/coach\/goal-plan/, GOAL],
  [/\/coach\/memories/, [
    { id: "m1", kind: "prova", content: "Maratona do Rio", event_date: day(200), active: true, source: "manual", created_at: at(-30) },
    { id: "m2", kind: "prova", content: "Meia de Niterói", event_date: day(60), active: true, source: "manual", created_at: at(-30) },
  ]],
];

let installed = false;

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const semProva = window.location.search.includes("sem-prova");
  const real = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes("/api/")) return real(input, init);
    if (semProva && /\/coach\/(goal-plan|memories)/.test(url)) {
      const body = url.includes("goal-plan") ? { plan: null, workouts: [] } : [];
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    const hit = ROUTES.find(([re]) => re.test(url));
    return new Response(JSON.stringify(hit ? hit[1] : {}), { status: 200, headers: { "Content-Type": "application/json" } });
  };
}

export default function DashboardPreview() {
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
  return <DashboardPage />;
}
