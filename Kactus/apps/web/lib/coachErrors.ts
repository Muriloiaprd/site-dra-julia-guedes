import { CoachApiError } from "@/lib/api";

/** Titulo e explicacao para os erros da Duni (Gemini free tier, dados, formato). */
export function coachErrorMessage(e: unknown): { title: string; detail: string } {
  if (e instanceof CoachApiError) {
    switch (e.detail.error) {
      case "not_configured":
        return {
          title: "A Duni ainda não está configurada",
          detail:
            "Falta a chave do Gemini: gere uma grátis em aistudio.google.com/apikey e coloque em GEMINI_API_KEY no Kactus/.env. Depois reinicie a API.",
        };
      case "quota_exceeded":
        return {
          title: "Limite gratuito do Gemini atingido",
          detail: "A cota grátis acabou por agora. Volta a funcionar sozinho mais tarde (a cota diária renova todo dia) — não adianta insistir agora.",
        };
      case "invalid_key":
        return { title: "Chave do Gemini inválida", detail: "Confira a GEMINI_API_KEY no Kactus/.env (sem espaços nem aspas) e reinicie a API." };
      case "model_not_found":
        return { title: "Modelo do Gemini não encontrado", detail: "O modelo em GEMINI_MODEL não existe mais ou não está no plano grátis." };
      case "llm_unavailable":
        return { title: "Gemini sobrecarregado", detail: "Os modelos grátis do Gemini estão com muita demanda agora. Tente de novo em alguns minutos." };
      case "llm_timeout":
        return { title: "O Gemini demorou demais", detail: "A fila do plano grátis está lenta agora e a resposta não chegou a tempo. Tente de novo em alguns minutos." };
      case "insufficient_data":
        return {
          title: "Ainda não há dados suficientes",
          detail: `Você tem ${e.detail.weeks_available ?? 0} semana(s) de atividades — são necessárias pelo menos 2 semanas para uma análise confiável.`,
        };
      case "invalid_plan_response":
        return {
          title: "O plano veio fora das regras e foi recusado",
          detail: `${e.detail.message ? `${e.detail.message} ` : ""}Nada foi salvo. Tente gerar de novo.`,
        };
      case "invalid_response":
        return { title: "A resposta veio num formato inválido", detail: "Acontece às vezes com o modelo grátis. Mande a mensagem de novo." };
    }
  }
  return { title: "Erro", detail: e instanceof Error ? e.message : "Erro desconhecido" };
}
