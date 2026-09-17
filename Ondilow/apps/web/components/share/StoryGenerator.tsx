"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { ActivityDetail } from "@/lib/api";
import { loadArt, storyColor } from "@/lib/story/art";
import { loadStoryFonts, prepareCanvas, STORY_H, STORY_W } from "@/lib/story/engine";
import { availableLayouts } from "@/lib/story/layouts";
import { resolveStoryMetrics } from "@/lib/story/metrics";
import { LOGO_HI_RES } from "@/lib/story/regions";
import type { StoryPhoto } from "@/lib/story/types";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Formato não suportado, use JPG ou PNG"));
    img.src = src;
  });
}

export function StoryGenerator({ activity, onClose }: { activity: ActivityDetail; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ x: number; y: number } | null>(null);

  const [fontsReady, setFontsReady] = useState(false);
  const [layoutIndex, setLayoutIndex] = useState(0);
  const [photo, setPhoto] = useState<{ image: HTMLImageElement; offsetX: number; offsetY: number; zoom: number } | null>(null);
  const [art, setArt] = useState<{ layoutId: string; image: HTMLImageElement } | null>(null);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [transparent, setTransparent] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"share" | "save" | "copy" | null>(null);
  const [copied, setCopied] = useState(false);

  const routePoints = useMemo(
    () =>
      activity.points
        .filter((p) => p.lat != null && p.lon != null)
        .map((p) => ({ lat: p.lat as number, lon: p.lon as number })),
    [activity.points]
  );
  const metrics = useMemo(() => resolveStoryMetrics(activity), [activity]);
  const color = storyColor(activity.sport);
  const layouts = useMemo(() => availableLayouts(routePoints.length >= 2), [routePoints.length]);
  const layout = layouts[Math.min(layoutIndex, layouts.length - 1)];

  useEffect(() => {
    loadStoryFonts().then(() => setFontsReady(true));
    loadArt(LOGO_HI_RES).then(setLogo).catch(() => setLogo(null));
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // carrega a arte do layout ativo (pré-carrega os vizinhos ocioso, sem travar a troca)
  useEffect(() => {
    let cancelled = false;
    loadArt(layout.art).then((img) => {
      if (!cancelled) setArt({ layoutId: layout.id, image: img });
    });
    const idle = (cb: () => void) =>
      "requestIdleCallback" in window ? requestIdleCallback(cb) : setTimeout(cb, 200);
    idle(() => {
      for (const l of layouts) if (l.id !== layout.id) loadArt(l.art).catch(() => {});
    });
    return () => { cancelled = true; };
  }, [layout, layouts]);

  // só desenha quando a arte carregada é a do layout ativo — evita usar a arte
  // do layout anterior (stale) na primeira renderização após trocar de layout
  const artForLayout = art?.layoutId === layout.id ? art.image : null;

  // redesenha sempre que algo que afeta o visual muda
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout || !artForLayout) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    prepareCanvas(ctx, transparent);
    layout.draw(ctx, {
      activity,
      metrics,
      routePoints,
      photo: photo as StoryPhoto | null,
      art: artForLayout,
      logo,
      transparent,
      color,
    });
  }, [layout, artForLayout, logo, activity, metrics, routePoints, photo, transparent, color, fontsReady]);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoError(null);
    if (!file.type.startsWith("image/")) {
      setPhotoError("Formato não suportado, use JPG ou PNG");
      return;
    }
    try {
      const objectUrl = URL.createObjectURL(file);
      const image = await loadImage(objectUrl);
      setPhoto({ image, offsetX: 0, offsetY: 0, zoom: 1 });
    } catch {
      setPhotoError("Formato não suportado, use JPG ou PNG");
    }
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (!photo) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragState.current = { x: e.clientX, y: e.clientY };
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!photo || !dragState.current || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const scale = STORY_W / rect.width;
    const dx = (e.clientX - dragState.current.x) * scale;
    const dy = (e.clientY - dragState.current.y) * scale;
    dragState.current = { x: e.clientX, y: e.clientY };
    setPhoto((p) => (p ? { ...p, offsetX: p.offsetX + dx, offsetY: p.offsetY + dy } : p));
  }

  function handlePointerUp() {
    dragState.current = null;
  }

  function toBlob(): Promise<Blob | null> {
    return new Promise((resolve) => canvasRef.current?.toBlob((b) => resolve(b), "image/png"));
  }

  async function handleSave() {
    setBusy("save");
    setActionError(null);
    try {
      const blob = await toBlob();
      if (!blob) throw new Error("Não foi possível gerar a imagem");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ondilow_story_${activity.id}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Não foi possível salvar a imagem");
    } finally {
      setBusy(null);
    }
  }

  async function handleShare() {
    setBusy("share");
    setActionError(null);
    try {
      const blob = await toBlob();
      if (!blob) throw new Error("Não foi possível gerar a imagem");
      const file = new File([blob], `ondilow_story_${activity.id}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Ondilow" });
      } else {
        await handleSave();
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setActionError(e instanceof Error ? e.message : "Não foi possível compartilhar a imagem");
    } finally {
      setBusy(null);
    }
  }

  async function handleCopy() {
    setBusy("copy");
    setActionError(null);
    try {
      const blob = await toBlob();
      if (!blob) throw new Error("Não foi possível gerar a imagem");
      if (!navigator.clipboard?.write) throw new Error("Copiar não é suportado neste navegador");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Não foi possível copiar a imagem");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Compartilhar atividade"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="od-panel flex max-h-[95vh] w-full max-w-[520px] flex-col overflow-y-auto !rounded-b-none sm:!rounded-card"
        style={{ background: "#0e0e0e" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-extrabold">Compartilhar</h3>
          <button onClick={onClose} className="od-icon-btn !h-8 !w-8 !rounded-full" aria-label="Fechar">✕</button>
        </div>

        <div
          ref={previewRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative mx-auto w-full max-w-[280px] touch-none select-none overflow-hidden rounded-tile"
          style={{
            aspectRatio: `${STORY_W} / ${STORY_H}`,
            cursor: photo ? "grab" : "default",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
            backgroundImage: transparent
              ? "repeating-conic-gradient(#2a2a2a 0% 25%, #1a1a1a 0% 50%)"
              : undefined,
            backgroundSize: transparent ? "16px 16px" : undefined,
          }}
        >
          <canvas ref={canvasRef} width={STORY_W} height={STORY_H} className="h-full w-full" />
          {!artForLayout && (
            <div className="od-skeleton absolute inset-0" aria-hidden />
          )}
        </div>
        {photo && <p className="mt-2 text-center text-[0.7rem] text-brand-textTertiary">Arraste a foto pra reposicionar</p>}
        {photoError && <p className="mt-2 text-center text-xs text-brand-danger">{photoError}</p>}

        {layouts.length > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            {layouts.map((l, i) => (
              <button
                key={l.id}
                onClick={() => setLayoutIndex(i)}
                className="od-btn od-btn-ghost od-btn-sm !px-3"
                style={i === layoutIndex ? { color: "#00FF66", boxShadow: "inset 0 0 0 1px rgba(0,255,102,0.4)" } : undefined}
              >
                {l.label}
              </button>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {layouts.map((l, i) => (
            <span
              key={l.id}
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: i === layoutIndex ? "#00FF66" : "rgba(255,255,255,0.2)" }}
            />
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          <label className="od-btn od-btn-secondary od-btn-sm cursor-pointer">
            {photo ? "Trocar foto" : "Escolher foto"}
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </label>
          <button
            onClick={() => setTransparent((t) => !t)}
            className="od-btn od-btn-ghost od-btn-sm"
            style={transparent ? { color: "#00FF66", boxShadow: "inset 0 0 0 1px rgba(0,255,102,0.4)" } : undefined}
          >
            {transparent ? "✓ " : ""}Fundo transparente
          </button>
        </div>

        {photo && (
          <div className="mt-4 flex items-center gap-3 px-2">
            <span className="text-[0.7rem] text-brand-muted">Zoom</span>
            <input
              type="range"
              min={1}
              max={2.5}
              step={0.05}
              value={photo.zoom}
              onChange={(e) => setPhoto((p) => (p ? { ...p, zoom: Number(e.target.value) } : p))}
              className="w-full"
            />
          </div>
        )}

        {actionError && <p className="mt-3 text-center text-xs text-brand-danger">{actionError}</p>}

        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <button onClick={handleShare} disabled={busy !== null} className="od-btn od-btn-primary od-btn-sm">
            {busy === "share" ? "…" : "Compartilhar"}
          </button>
          <button onClick={handleSave} disabled={busy !== null} className="od-btn od-btn-secondary od-btn-sm">
            {busy === "save" ? "…" : "Salvar"}
          </button>
          <button onClick={handleCopy} disabled={busy !== null} className="od-btn od-btn-ghost od-btn-sm">
            {copied ? "Copiado!" : busy === "copy" ? "…" : "Copiar"}
          </button>
        </div>
      </div>
    </div>
  );
}
