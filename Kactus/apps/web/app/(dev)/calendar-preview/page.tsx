"use client";

/**
 * Ferramenta só-de-desenvolvimento: o calendário de treinos com dados de exemplo
 * (treinos feitos, pulados, a semana e o plano do objetivo), sem login e sem a IA.
 * Usa as mesmas respostas falsas da /coach-preview. Uso: /calendar-preview
 */

import CalendarPage from "@/app/calendar/page";

import { usePreviewApi } from "../coach-preview/mock";

export default function CalendarPreview() {
  usePreviewApi();
  return <CalendarPage />;
}
