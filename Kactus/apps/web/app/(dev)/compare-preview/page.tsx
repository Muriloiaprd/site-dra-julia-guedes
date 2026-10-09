"use client";

/**
 * Ferramenta só-de-desenvolvimento: Comparar treinos com dois treinos de exemplo,
 * sem login e sem API (fetch interceptado). Uso: /compare-preview?a=a1&b=a2
 */

import { useState } from "react";

import CompareActivitiesPage from "@/app/activities/compare/page";

const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

/** Corrida de exemplo: `base` s/km com uma onda de ritmo, FC subindo devagar. */
function run(id: string, title: string, km: number, base: number, hr0: number, daysAgo: number) {
  const points = [];
  let d = 0, t = 0;
  while (d < km * 1000) {
    const pace = base + 12 * Math.sin(d / 900) + (d > km * 700 ? -8 : 0);
    const v = 1000 / pace;
    points.push({ elapsed_time_s: t, distance_m: d, speed_ms: v, hr: Math.round(hr0 + d / 600 + 3 * Math.sin(d / 400)), lat: null, lon: null, altitude_m: 20, cadence: 170, power_w: null });
    t += 5; d += v * 5;
  }
  const splits = Array.from({ length: Math.ceil(km) }, (_, i) => {
    const dist = Math.min(1000, km * 1000 - i * 1000);
    const pace = Math.round(base + 12 * Math.sin((i * 1000 + 500) / 900) + (i * 1000 > km * 700 ? -8 : 0));
    return { index: i + 1, distance_m: dist, duration_s: Math.round((pace * dist) / 1000), pace_s_per_km: pace, avg_hr: Math.round(hr0 + (i * 1000 + 500) / 600), elevation_gain_m: 4, gap_pace_s_per_km: pace - 2 };
  });
  return {
    detail: {
      id, sport: "run", title, start_time: day(daysAgo), duration_s: Math.round(km * base) + 30, moving_time_s: Math.round(km * base),
      distance_m: km * 1000, elevation_gain_m: 42, avg_hr: Math.round(hr0 + km * 0.8), max_hr: hr0 + 22, avg_pace_s_per_km: base, avg_speed_kmh: +(3600 / base).toFixed(1),
      gap_pace_s_per_km: base - 3, hr_decoupling_pct: 3.4, avg_cadence: 170, avg_stance_time_ms: 255, avg_temperature_c: 24, training_effect_aerobic: 3.2,
      srpe: 260, calories: 640, source: "fit", laps: [], points,
    },
    splits,
  };
}

const RUNS: Record<string, ReturnType<typeof run>> = {
  a1: run("a1", "Rodagem de terça", 10, 342, 140, 14),
  a2: run("a2", "Rodagem de quinta", 10.4, 330, 143, 2),
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let installed = false;

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const real = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes("/api/")) return real(input, init);
    const splits = url.match(/\/activities\/([^/?]+)\/splits/);
    if (splits) return json(RUNS[splits[1]]?.splits ?? [], RUNS[splits[1]] ? 200 : 404);
    const det = url.match(/\/activities\/([^/?]+)$/);
    if (det) return RUNS[det[1]] ? json(RUNS[det[1]].detail) : json({ detail: "Atividade não encontrada" }, 404);
    if (url.includes("/auth/me")) return json({ id: "preview", email: "preview@kactus" });
    return json({});
  };
}

export default function ComparePreview() {
  useState(install);
  return <CompareActivitiesPage />;
}
