import type { MetadataRoute } from "next";

/** "App" na Tela de Início (iPhone/Android). Sem service worker de propósito: token em localStorage + cache = páginas velhas. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kactus",
    short_name: "Kactus",
    description: "Análise pessoal de treino - corrida, ciclismo e natação",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0A0A0A",
    theme_color: "#0A0A0A",
    lang: "pt-BR",
    icons: [
      { src: "/icons/app-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/app-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/app-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
