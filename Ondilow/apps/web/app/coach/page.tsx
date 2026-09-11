"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  CoachApiError,
  fetchCoachHistory,
  fetchMe,
  postCoachAnalyze,
  postCoachChat,
  postCoachGeneratePlan,
  type CoachChatMessage,
} from "@/lib/api";

function errorMessage(e: unknown): { title: string; detail: string } {
  if (e instanceof CoachApiError) {
    switch (e.detail.error) {
      case "not_configured":
        return {
          title: "Treinador de IA ainda não configurado",
          detail:
            "Falta configurar a chave da Anthropic (console.anthropic.com) e/ou do Gemini (aistudio.google.com/apikey) no .env da API.",
        };
      case "llm_unavailable":
        return { title: "Treinador indisponível", detail: "Os provedores de IA falharam agora — tente de novo em alguns instantes." };
      case "insufficient_data":
        return {
          title: "Ainda não há dados suficientes",
          detail: `Você tem ${e.detail.weeks_available ?? 0} semana(s) de atividades — são necessárias pelo menos 2 semanas para uma análise confiável.`,
        };
      case "invalid_plan_response":
        return { title: "Não consegui gerar um plano válido", detail: "Tente gerar de novo." };
    }
  }
  return { title: "Erro", detail: e instanceof Error ? e.message : "Erro desconhecido" };
}

export default function CoachPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<CoachChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [planCount, setPlanCount] = useState<number | null>(null);
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMe().then((u) => { if (!u) router.push("/login"); });
    fetchCoachHistory().then(setMessages).catch(() => {});
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const message = input.trim();
    if (!message || sending) return;
    setInput("");
    setError(null);
    setMessages((m) => [...m, { role: "user", content: message, created_at: new Date().toISOString() }]);
    setSending(true);
    try {
      const { reply } = await postCoachChat(message);
      setMessages((m) => [...m, { role: "assistant", content: reply, created_at: new Date().toISOString() }]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    setError(null);
    setReport(null);
    try {
      const { report } = await postCoachAnalyze();
      setReport(report);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleGeneratePlan() {
    setGenerating(true);
    setError(null);
    setPlanCount(null);
    try {
      const workouts = await postCoachGeneratePlan(7);
      setPlanCount(workouts.length);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Treinador de IA</h1>
          <p className="text-sm text-brand-muted mt-1">
            Especialista em triathlon (corrida, ciclismo, natação), fisioterapia e pilates — analisa seus dados reais.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-brand-danger/40 bg-brand-danger/10 p-3 text-sm">
            <p className="font-semibold text-brand-danger">{error.title}</p>
            <p className="text-brand-muted mt-1">{error.detail}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="rounded-md border border-brand-border px-3 py-1.5 text-xs hover:border-brand-accent hover:text-brand-accent disabled:opacity-50"
          >
            {analyzing ? "Analisando…" : "📊 Gerar Relatório"}
          </button>
          <button
            onClick={handleGeneratePlan}
            disabled={generating}
            className="rounded-md border border-brand-border px-3 py-1.5 text-xs hover:border-brand-accent hover:text-brand-accent disabled:opacity-50"
          >
            {generating ? "Gerando…" : "🗓️ Gerar Plano (7 dias)"}
          </button>
        </div>

        {planCount !== null && (
          <div className="rounded-lg border border-brand-accent/30 bg-brand-accent/5 p-3 text-sm text-brand-accent">
            Plano gerado com {planCount} treino(s) — já disponível no card &quot;Próximos Treinos&quot; do dashboard.
          </div>
        )}

        {report && (
          <div className="rounded-lg border border-brand-border bg-brand-surface p-4 text-sm whitespace-pre-wrap">
            {report}
          </div>
        )}

        <div className="rounded-lg border border-brand-border bg-brand-surface flex flex-col" style={{ height: 420 }}>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-sm text-brand-muted">Pergunte qualquer coisa sobre seus treinos, carga ou recuperação.</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`rounded-lg px-3 py-2 text-sm max-w-[80%] whitespace-pre-wrap ${
                    m.role === "user" ? "bg-brand-accent/15 text-brand-text" : "bg-white/5 text-brand-text"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && <p className="text-xs text-brand-muted">Pensando…</p>}
            <div ref={bottomRef} />
          </div>
          <div className="border-t border-brand-border p-3 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
              placeholder="Pergunte ao treinador…"
              className="flex-1 rounded-md border border-brand-border bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-accent"
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className="rounded-md border border-brand-border px-4 py-2 text-sm hover:border-brand-accent hover:text-brand-accent disabled:opacity-50"
            >
              Enviar
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
