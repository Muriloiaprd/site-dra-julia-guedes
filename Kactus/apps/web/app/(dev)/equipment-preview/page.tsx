"use client";

/**
 * Ferramenta só-de-desenvolvimento: a página de equipamentos com dados de exemplo,
 * sem login e sem API (fetch interceptado). Serve pra conferir o tênis padrão por
 * esporte e o "Aplicar aos treinos antigos". Uso: /equipment-preview
 */

import { useState } from "react";

import EquipmentPage from "@/app/equipment/page";

type Item = {
  id: string; name: string; type: string; brand: string | null; model: string | null; purchase_date: string | null;
  retired_at: string | null; initial_distance_m: number; total_distance_m: number; notes: string | null;
  photo_data_url: string | null; default_sports: string[]; created_at: string;
};

const item = (id: string, name: string, type: string, km: number, sports: string[]): Item => ({
  id, name, type, brand: null, model: null, purchase_date: "2026-03-01", retired_at: null, initial_distance_m: 0,
  total_distance_m: km * 1000, notes: null, photo_data_url: null, default_sports: sports, created_at: "2026-03-01T12:00:00Z",
});

let items: Item[] = [item("e1", "Pegasus 41", "shoe", 412, ["run", "treadmill"]), item("e2", "Speedgoat", "shoe", 120, ["trail_run"]), item("e3", "Boné", "cap", 0, [])];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let installed = false;

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  // a página confere a sessão antes de carregar: um token de mentira basta (toda /api é falsa aqui)
  try { if (!localStorage.getItem("kactus_token")) localStorage.setItem("kactus_token", "preview"); } catch { /* sem armazenamento */ }
  const real = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    if (!url.includes("/api/")) return real(input, init);
    if (url.includes("/auth/me")) return json({ id: "preview", email: "preview@kactus" });
    if (url.includes("/equipment/recommendations")) return json({ detail: "sem recomendações no exemplo" }, 404);
    const apply = url.match(/\/equipment\/([^/]+)\/apply-default/);
    if (apply) return json({ updated: 7 });
    const one = url.match(/\/equipment\/([^/?]+)$/);
    if (one && method === "PATCH") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      items = items.map((i) => (i.id === one[1] ? { ...i, ...body } : body.default_sports ? { ...i, default_sports: i.default_sports.filter((s) => !body.default_sports.includes(s)) } : i));
      return json(items.find((i) => i.id === one[1]));
    }
    if (url.endsWith("/api/equipment") && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      items = items.map((i) => ({ ...i, default_sports: i.default_sports.filter((s) => !(body.default_sports ?? []).includes(s)) }));
      const created = { ...item(`n${items.length}`, body.name, body.type, 0, body.default_sports ?? []) };
      items = [created, ...items];
      return json(created, 201);
    }
    if (url.endsWith("/api/equipment")) return json(items);
    return json({});
  };
}

export default function EquipmentPreview() {
  useState(install);
  return <EquipmentPage />;
}
