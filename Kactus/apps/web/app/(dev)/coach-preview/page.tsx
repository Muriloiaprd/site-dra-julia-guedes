"use client";

/**
 * Ferramenta só-de-desenvolvimento: abre a página da Duni com dados de exemplo,
 * sem login e sem chamar a API (nem a IA). Serve pra conferir o layout da
 * /coach. Troca o `fetch` da janela por respostas fixas só enquanto esta
 * página está aberta. Uso: /coach-preview
 */

import CoachPage from "@/app/coach/page";

import { usePreviewApi } from "./mock";

export default function CoachPreview() {
  usePreviewApi();
  return <CoachPage />;
}
