"use client";

/**
 * Ferramenta só-de-desenvolvimento: a seção Importar do Perfil sem login e sem API
 * (o envio é interceptado e responde que importou). Serve pra conferir a área de
 * soltar arquivos, a fila e os totais. Uso: /import-preview
 */

import { useState } from "react";

import { ImportSection } from "@/components/profile/ImportSection";
import { PageContainer } from "@/components/ui/primitives";

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
    if (url.includes("/activities/upload/batch")) {
      const files = (init?.body as FormData).getAll("files") as File[];
      // o primeiro de cada lote finge ser duplicado, os outros entram como corrida de 10 km
      return json(files.map((f, i) => ({
        filename: f.name,
        imported: [{ activity_id: `p${i}`, duplicate: i === 0 && files.length > 1, sport: "run", distance_m: 10000, points_stored: 3600 }],
      })));
    }
    if (url.includes("/auth/me")) return json({ id: "preview", email: "preview@kactus" });
    return json({});
  };
}

export default function ImportPreview() {
  useState(install);
  return <PageContainer width="medium"><ImportSection /></PageContainer>;
}
