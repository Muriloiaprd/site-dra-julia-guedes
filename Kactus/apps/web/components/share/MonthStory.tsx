"use client";

import { useEffect, useRef, useState } from "react";

import type { MonthSummary } from "@/lib/api";
import { DISPLAY, drawBrand, fitSize, rgba, SANS, txt, WORDMARK } from "@/lib/story/draw";
import { loadArt } from "@/lib/story/art";
import { loadStoryFonts, prepareCanvas, STORY_H, STORY_W } from "@/lib/story/engine";
import { formatPaceShort } from "@/lib/utils";

const ACCENT = "#C6FF00";
const MESES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
const TIPO: Record<string, string> = {
  run: "Corrida", walk: "Caminhada", bike: "Bike", swim: "Natação", strength: "Musculação", pilates: "Pilates", other: "Outros",
};

const num = (v: number, d = 1) => v.toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: 0 });

/** Desenha o Story do mês (1080×1920). Exportado para a página de teste. */
export function drawMonthStory(ctx: CanvasRenderingContext2D, m: MonthSummary, logo: HTMLImageElement | null): void {
  prepareCanvas(ctx, false);
  const glow = ctx.createRadialGradient(STORY_W / 2, 760, 0, STORY_W / 2, 760, 1000);
  glow.addColorStop(0, rgba(ACCENT, 0.14));
  glow.addColorStop(1, rgba(ACCENT, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, STORY_W, STORY_H);

  const [ano, mes] = m.mes.split("-").map(Number);
  if (logo) drawBrand(ctx, logo, STORY_W / 2, 150, 70);
  txt(ctx, "RESUMO DO MÊS", STORY_W / 2, 330, { font: `700 34px ${SANS}`, color: rgba("#ffffff", 0.6), align: "center", tracking: 10 });
  const titulo = `${MESES[mes - 1]} ${ano}`;
  txt(ctx, titulo, STORY_W / 2, 420, { font: `800 ${fitSize(ctx, titulo, (s) => `800 ${s}px ${DISPLAY}`, 940, 84)}px ${DISPLAY}`, align: "center" });

  // km total, gigante
  const km = num(m.total.km);
  const kmSize = fitSize(ctx, km, (s) => `900 ${s}px ${DISPLAY}`, 860, 300, 120);
  txt(ctx, km, STORY_W / 2, 760, { font: `900 ${kmSize}px ${DISPLAY}`, color: ACCENT, align: "center", glow: rgba(ACCENT, 0.45) });
  txt(ctx, "QUILÔMETROS", STORY_W / 2, 840, { font: `700 40px ${SANS}`, color: "#fff", align: "center", tracking: 12 });
  if (m.variacao.km_pct != null) {
    const v = m.variacao.km_pct;
    txt(ctx, `${v >= 0 ? "▲" : "▼"} ${Math.abs(v)}% vs mês anterior`, STORY_W / 2, 910, {
      font: `600 34px ${SANS}`, color: v >= 0 ? ACCENT : "#FFC145", align: "center",
    });
  }

  // três números
  const cols = [
    { v: String(m.total.treinos), l: "TREINOS" },
    { v: num(m.total.horas), l: "HORAS" },
    { v: String(m.total.dias), l: "DIAS ATIVOS" },
  ];
  cols.forEach((c, i) => {
    const x = 200 + i * 340;
    txt(ctx, c.v, x, 1080, { font: `800 92px ${DISPLAY}`, align: "center" });
    txt(ctx, c.l, x, 1135, { font: `700 26px ${SANS}`, color: rgba("#ffffff", 0.6), align: "center", tracking: 6 });
  });

  // esportes em barras
  let y = 1250;
  const maxKm = Math.max(1, ...m.esportes.map((e) => e.km));
  for (const e of m.esportes.slice(0, 4)) {
    txt(ctx, TIPO[e.tipo] ?? e.tipo, 120, y, { font: `700 34px ${SANS}` });
    txt(ctx, e.km > 0 ? `${num(e.km)} km` : `${e.treinos} treino${e.treinos === 1 ? "" : "s"}`, STORY_W - 120, y, { font: `600 34px ${SANS}`, color: rgba("#ffffff", 0.75), align: "right" });
    ctx.fillStyle = rgba("#ffffff", 0.08);
    ctx.fillRect(120, y + 18, STORY_W - 240, 14);
    ctx.fillStyle = ACCENT;
    ctx.fillRect(120, y + 18, Math.max(14, ((STORY_W - 240) * e.km) / maxKm), 14);
    y += 96;
  }

  // destaques
  const destaques: string[] = [];
  if (m.corrida?.pace_medio_s_km) destaques.push(`Ritmo médio da corrida ${formatPaceShort(m.corrida.pace_medio_s_km)}/km`);
  if (m.maior_treino) destaques.push(`Maior treino: ${num(m.maior_treino.km)} km`);
  if (m.recordes.length) destaques.push(`${m.recordes.length} recorde${m.recordes.length === 1 ? "" : "s"} pessoal${m.recordes.length === 1 ? "" : "is"}`);
  destaques.slice(0, 3).forEach((d, i) => {
    txt(ctx, d, STORY_W / 2, Math.max(y + 40, 1660) + i * 56, { font: `600 36px ${SANS}`, color: "#fff", align: "center" });
  });
}

/** Modal com o Story do mês: prévia, Compartilhar e Salvar (mesmo jeito do gerador de treinos). */
export function MonthStory({ month, onClose }: { month: MonthSummary; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([loadStoryFonts(), loadArt(WORDMARK).catch(() => null)]).then(([, logo]) => {
      const c = canvasRef.current;
      const ctx = c?.getContext("2d");
      if (!vivo || !c || !ctx) return;
      drawMonthStory(ctx, month, logo);
      // PNG pronto antes do toque: o Safari do iPhone só compartilha sem espera
      c.toBlob((b) => { if (vivo && b) setFile(new File([b], `kactus_mes_${month.mes}.png`, { type: "image/png" })); }, "image/png");
    });
    return () => { vivo = false; };
  }, [month]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function salvar() {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function compartilhar() {
    if (!file) return;
    setError(null);
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "Kactus" });
      else salvar();
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError")) setError(e instanceof Error ? e.message : "Não foi possível compartilhar");
    }
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6" style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)" }} role="dialog" aria-modal="true" aria-label="Story do mês">
      <div onClick={(e) => e.stopPropagation()} className="od-panel flex w-full max-w-[420px] flex-col !rounded-b-none sm:!rounded-card" style={{ background: "#0e0e0e", maxHeight: "min(95dvh, calc(100dvh - env(safe-area-inset-top) - 8px))" }}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-extrabold">Story do mês</h3>
          <button onClick={onClose} className="od-icon-btn !h-8 !w-8 !rounded-full" aria-label="Fechar">✕</button>
        </div>
        <div className="relative mx-auto w-full max-w-[260px] overflow-hidden rounded-tile" style={{ aspectRatio: `${STORY_W} / ${STORY_H}` }}>
          <canvas ref={canvasRef} width={STORY_W} height={STORY_H} className="h-full w-full" />
          {!file && <div className="od-skeleton absolute inset-0" aria-hidden />}
        </div>
        {error && <p className="mt-3 text-center text-xs text-brand-danger">{error}</p>}
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button onClick={compartilhar} disabled={!file} className="od-btn od-btn-primary od-btn-sm">Compartilhar</button>
          <button onClick={salvar} disabled={!file} className="od-btn od-btn-secondary od-btn-sm">Salvar</button>
        </div>
      </div>
    </div>
  );
}
