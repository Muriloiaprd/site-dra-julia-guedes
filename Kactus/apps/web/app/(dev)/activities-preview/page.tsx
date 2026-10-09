"use client";

/**
 * Ferramenta só-de-desenvolvimento: a página de atividades com dados de exemplo,
 * sem login e sem API (fetch interceptado). Serve pra conferir a lixeira
 * (Restaurar / Limpar lixeira). Uso: /activities-preview
 */

import { useState } from "react";

import ActivitiesPage from "@/app/activities/page";

const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

function activity(id: string, title: string, km: number, daysAgo: number) {
  return {
    id, sport: "run", title, start_time: day(daysAgo), duration_s: Math.round(km * 360), moving_time_s: Math.round(km * 350),
    distance_m: km * 1000, elevation_gain_m: 40, avg_hr: 150, max_hr: 170, avg_pace_s_per_km: 360, avg_speed_kmh: 10,
    avg_power_w: null, calories: 400, tss: 50, source: "fit", created_at: day(daysAgo), equipment_id: null,
  };
}

let active = [activity("a1", "Rodagem leve", 5, 1), activity("a2", "Longão de base", 10, 3)];
let trash = [
  { id: "t1", sport: "run", title: "Corrida duplicada", start_time: day(8), duration_s: 1800, distance_m: 5000, deleted_at: day(2) },
  { id: "t2", sport: "walk", title: "Caminhada", start_time: day(12), duration_s: 2700, distance_m: 3500, deleted_at: day(1) },
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let installed = false;

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const real = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    if (!url.includes("/api/")) return real(input, init);
    if (url.includes("/activities/trash")) {
      if (method === "DELETE") {
        const n = trash.length;
        trash = [];
        return json({ deleted: n });
      }
      return json(trash);
    }
    const restore = url.match(/\/activities\/([^/]+)\/restore/);
    if (restore) {
      const item = trash.find((t) => t.id === restore[1]);
      trash = trash.filter((t) => t.id !== restore[1]);
      if (item) active = [activity(item.id, item.title, (item.distance_m ?? 0) / 1000, 8), ...active];
      return json(item ?? {}, item ? 200 : 404);
    }
    const del = url.match(/\/activities\/([^/?]+)$/);
    if (del && method === "DELETE") {
      const a = active.find((x) => x.id === del[1]);
      active = active.filter((x) => x.id !== del[1]);
      if (a) trash = [{ id: a.id, sport: a.sport, title: a.title, start_time: a.start_time, duration_s: a.duration_s, distance_m: a.distance_m, deleted_at: day(0) }, ...trash];
      return new Response(null, { status: 204 });
    }
    if (/\/activities(\?|$)/.test(url)) return json(active);
    if (url.includes("/auth/me")) return json({ id: "preview", email: "preview@kactus" });
    return json({});
  };
}

export default function ActivitiesPreview() {
  // antes da pagina montar: os efeitos dela ja chamam a API no primeiro render
  useState(install);
  return <ActivitiesPage />;
}
