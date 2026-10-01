"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { fetchProfile, type ActivityDetail, type HrZones, type Split, type ZoneBucket } from "@/lib/api";
import { resolveHrZones } from "@/lib/athlete";
import { loadArt, storyColor } from "@/lib/story/art";
import { loadStoryFonts, prepareCanvas, STORY_H, STORY_W } from "@/lib/story/engine";
import { availableLayouts, DATA_LAYOUTS } from "@/lib/story/layouts";
import { resolveStoryMetrics } from "@/lib/story/metrics";
import type { StoryPhoto } from "@/lib/story/types";

import { ModelGrid, ModelRail, type ModelGroup } from "./ModelGallery";
import { useStoryThumbs, type ThumbData } from "./useStoryThumbs";

// MP4 primeiro: e o que o Instagram aceita. WebM so se o navegador nao gravar MP4.
const VIDEO_TYPES = ["video/mp4;codecs=avc1.640028", "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
const VIDEO_DRAW_MS = 5500; // modelo se desenhando (rota, barras, curva)
const VIDEO_HOLD_MS = 2000; // imagem final parada
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Formato não suportado, use JPG ou PNG"));
    img.src = src;
  });
}

export function StoryGenerator({ activity, splits, zones, onClose }: {
  activity: ActivityDetail;
  splits: Split[];
  zones: ZoneBucket[];
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ x: number; y: number } | null>(null);
  // sem foto, arrastar a previa para o lado troca de modelo
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const [fontsReady, setFontsReady] = useState(false);
  const [layoutId, setLayoutId] = useState<string | null>(null);
  const [gallery, setGallery] = useState(false);
  const [photo, setPhoto] = useState<{ image: HTMLImageElement; offsetX: number; offsetY: number; zoom: number } | null>(null);
  const [art, setArt] = useState<{ layoutId: string; image: HTMLImageElement } | null>(null);
  const [transparent, setTransparent] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"share" | "save" | "copy" | "video" | null>(null);
  // gravacao do video: o efeito de redesenho fica parado enquanto os quadros sao desenhados a mao
  const recordingRef = useRef(false);
  const [recording, setRecording] = useState<number | null>(null);
  const [video, setVideo] = useState<{ blob: Blob; url: string; ext: string; layoutId: string } | null>(null);
  const [redrawTick, setRedrawTick] = useState(0);
  const [copied, setCopied] = useState(false);
  const [profile, setProfile] = useState<{ hrZones: HrZones | null; name: string | null }>({ hrZones: null, name: null });

  useEffect(() => {
    fetchProfile().then((p) => setProfile({ hrZones: resolveHrZones(p), name: p.full_name })).catch(() => {});
  }, []);

  const routePoints = useMemo(
    () =>
      activity.points
        .filter((p) => p.lat != null && p.lon != null)
        .map((p) => ({ lat: p.lat as number, lon: p.lon as number })),
    [activity.points]
  );
  const metrics = useMemo(() => resolveStoryMetrics(activity), [activity]);
  const color = storyColor(activity.sport);
  const available = useMemo(() => availableLayouts({ activity, routePoints, splits }), [activity, routePoints, splits]);
  // grupos da galeria; o trilho e as setas seguem a mesma ordem
  const groups = useMemo<ModelGroup[]>(() => [
    { id: "video", title: "🎬 Viram vídeo", hint: "Imagem ou vídeo animado", items: available.filter((l) => l.animated) },
    { id: "dados", title: "Feitos com seus dados", hint: "O treino vira a arte", items: available.filter((l) => !l.animated && DATA_LAYOUTS.includes(l)) },
    { id: "artes", title: "Artes Kactus", hint: "Seus números na arte da marca", items: available.filter((l) => !l.animated && !DATA_LAYOUTS.includes(l)) },
  ].filter((g) => g.items.length > 0), [available]);
  const layouts = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const layoutIndex = Math.max(0, layouts.findIndex((l) => l.id === layoutId));
  const layout = layouts[layoutIndex];
  const layoutGroup = groups.find((g) => g.items.includes(layout));
  // o video grava o modelo escolhido, quando ele sabe se animar
  const videoLayout = layout?.animated ? layout : null;

  function step(delta: number) {
    if (busy === "video" || layouts.length < 2) return;
    setLayoutId(layouts[(layoutIndex + delta + layouts.length) % layouts.length].id);
  }

  function pickFromGallery(id: string) {
    setLayoutId(id);
    setGallery(false);
  }

  // teclado: setas trocam de modelo, Esc fecha a galeria (ou o modal)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Escape") { e.preventDefault(); if (gallery) setGallery(false); else onClose(); }
      else if (!gallery && e.key === "ArrowRight") step(1);
      else if (!gallery && e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    loadStoryFonts().then(() => setFontsReady(true));
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const thumbData = useMemo<ThumbData | null>(
    () => (fontsReady ? {
      activity, metrics, routePoints, photo: photo as StoryPhoto | null, transparent, color,
      splits, zones, hrZones: profile.hrZones, athleteName: profile.name,
    } : null),
    [fontsReady, activity, metrics, routePoints, photo, transparent, color, splits, zones, profile]
  );
  const thumbs = useStoryThumbs(layouts, thumbData, busy === "video");

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
    if (!canvas || !layout || !artForLayout || recordingRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    prepareCanvas(ctx, transparent);
    layout.draw(ctx, {
      activity,
      metrics,
      routePoints,
      photo: photo as StoryPhoto | null,
      art: artForLayout,
      transparent,
      color,
      splits,
      zones,
      hrZones: profile.hrZones,
      athleteName: profile.name,
    });
  }, [layout, artForLayout, activity, metrics, routePoints, photo, transparent, color, fontsReady, splits, zones, profile, redrawTick]);

  useEffect(() => () => { if (video) URL.revokeObjectURL(video.url); }, [video]);

  /** Grava o modelo escolhido se desenhando direto do canvas do preview (30 fps), em MP4 quando o navegador deixa. */
  async function handleRecord() {
    const vl = videoLayout;
    const canvas = canvasRef.current;
    if (!vl || !canvas) return;
    setActionError(null);
    setVideo(null);
    setBusy("video");
    recordingRef.current = true;
    try {
      const mime = typeof MediaRecorder !== "undefined" ? VIDEO_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) : undefined;
      if (!mime) throw new Error("Este navegador não grava vídeo");
      const [art] = await Promise.all([loadArt(vl.art), loadStoryFonts()]);
      const ctx = canvas.getContext("2d")!;
      const frame = (progress: number) => {
        prepareCanvas(ctx, false);
        // video nao tem canal alfa: sempre com fundo (foto ou o preto da marca)
        vl.draw(ctx, {
          activity, metrics, routePoints, photo: photo as StoryPhoto | null, art, transparent: false, color,
          splits, zones, hrZones: profile.hrZones, athleteName: profile.name, progress,
        });
      };
      frame(0);
      const stream = canvas.captureStream(30);
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 10_000_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const stopped = new Promise<void>((resolve) => { rec.onstop = () => resolve(); });
      rec.start();
      const t0 = performance.now();
      let lastUi = 0;
      await new Promise<void>((resolve) => {
        const tick = () => {
          const t = performance.now() - t0;
          frame(easeInOut(Math.min(1, t / VIDEO_DRAW_MS)));
          if (t - lastUi > 100) { lastUi = t; setRecording(Math.min(1, t / (VIDEO_DRAW_MS + VIDEO_HOLD_MS))); }
          if (t < VIDEO_DRAW_MS + VIDEO_HOLD_MS) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      rec.stop();
      await stopped;
      stream.getTracks().forEach((tr) => tr.stop());
      const type = mime.split(";")[0];
      const blob = new Blob(chunks, { type });
      setVideo({ blob, url: URL.createObjectURL(blob), ext: type === "video/mp4" ? "mp4" : "webm", layoutId: vl.id });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Não foi possível gravar o vídeo");
    } finally {
      recordingRef.current = false;
      setRecording(null);
      setBusy(null);
      setRedrawTick((n) => n + 1);
    }
  }

  const videoName = video ? `kactus_${video.layoutId}_${activity.id}.${video.ext}` : "";

  function videoFile(): File | null {
    return video ? new File([video.blob], videoName, { type: video.blob.type }) : null;
  }

  function handleSaveVideo() {
    if (!video) return;
    const a = document.createElement("a");
    a.href = video.url;
    a.download = videoName;
    a.click();
  }

  async function handleShareVideo() {
    const file = videoFile();
    if (!file) return;
    setActionError(null);
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "Kactus" });
      else handleSaveVideo();
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setActionError(e instanceof Error ? e.message : "Não foi possível compartilhar o vídeo");
    }
  }

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
    if (!photo) {
      swipeStart.current = { x: e.clientX, y: e.clientY };
      return;
    }
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

  function handlePointerUp(e: React.PointerEvent) {
    dragState.current = null;
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || e.type === "pointercancel") return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - start.y)) step(dx < 0 ? 1 : -1);
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
      a.download = `kactus_story_${activity.id}.png`;
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
      const file = new File([blob], `kactus_story_${activity.id}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Kactus" });
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
          {gallery ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setGallery(false)} className="od-icon-btn !h-8 !w-8 !rounded-full" aria-label="Voltar para a prévia">‹</button>
              <h3 className="font-display text-lg font-extrabold">Modelos</h3>
              <span className="rounded-full px-2 py-0.5 text-[0.65rem] font-bold text-brand-muted" style={{ background: "rgba(255,255,255,0.06)" }}>{layouts.length}</span>
            </div>
          ) : (
            <h3 className="font-display text-lg font-extrabold">Compartilhar</h3>
          )}
          <button onClick={onClose} className="od-icon-btn !h-8 !w-8 !rounded-full" aria-label="Fechar">✕</button>
        </div>

        {gallery && (
          <ModelGrid groups={groups} selectedId={layout.id} thumbs={thumbs} transparent={transparent} onSelect={pickFromGallery} />
        )}

        {/* editor: fica montado (escondido) durante a galeria para o canvas nao perder o desenho */}
        <div className={gallery ? "hidden" : "contents"}>
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
          {layouts.length > 1 && busy !== "video" && (
            <>
              {([[-1, "left-2", "‹", "Modelo anterior"], [1, "right-2", "›", "Próximo modelo"]] as const).map(([d, pos, icon, label]) => (
                <button
                  key={d}
                  onClick={() => step(d)}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={`absolute ${pos} top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-xl leading-none text-white transition hover:scale-110`}
                  style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.15)" }}
                  aria-label={label}
                >
                  <span className="-mt-0.5">{icon}</span>
                </button>
              ))}
            </>
          )}
        </div>
        {photo && <p className="mt-2 text-center text-[0.7rem] text-brand-textTertiary">Arraste a foto pra reposicionar</p>}
        {photoError && <p className="mt-2 text-center text-xs text-brand-danger">{photoError}</p>}

        <div className="mt-4 flex items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate font-display text-base font-extrabold">
              {layout.label}
              {layout.animated && <span className="rounded-full px-2 py-0.5 text-[0.6rem] font-bold" style={{ color: "#00FF66", background: "rgba(0,255,102,0.1)" }}>🎬 vira vídeo</span>}
            </p>
            <p className="text-[0.7rem] text-brand-muted">{layoutIndex + 1} de {layouts.length}{layoutGroup ? ` · ${layoutGroup.title.replace("🎬 ", "")}` : ""}</p>
          </div>
          {layouts.length > 1 && (
            <button onClick={() => setGallery(true)} disabled={busy === "video"} className="od-btn od-btn-ghost od-btn-sm shrink-0 !px-3">
              <span aria-hidden className="mr-1.5 grid grid-cols-2 gap-[2px]">
                {[0, 1, 2, 3].map((i) => <span key={i} className="h-[5px] w-[5px] rounded-[1px] bg-current" />)}
              </span>
              Ver todos
            </button>
          )}
        </div>
        {layouts.length > 1 && (
          <ModelRail groups={groups} selectedId={layout.id} thumbs={thumbs} transparent={transparent} onSelect={setLayoutId} disabled={busy === "video"} />
        )}

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

        {videoLayout && (
          <div className="mt-4 flex justify-center">
            <button onClick={handleRecord} disabled={busy !== null} className="od-btn od-btn-secondary od-btn-sm relative overflow-hidden">
              {recording !== null && (
                <span className="absolute inset-y-0 left-0 bg-[rgba(0,255,102,0.18)]" style={{ width: `${recording * 100}%` }} aria-hidden />
              )}
              <span className="relative">{recording !== null ? `Gravando… ${Math.round(recording * 100)}%` : "🎬 Gravar vídeo"}</span>
            </button>
          </div>
        )}

        {video && (
          <div className="mt-4 flex items-center gap-3 rounded-xl p-2.5" style={{ background: "rgba(0,255,102,0.06)", boxShadow: "inset 0 0 0 1px rgba(0,255,102,0.2)" }}>
            <video src={video.url} autoPlay loop muted playsInline className="h-24 w-auto rounded-md" aria-label="Prévia do vídeo" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Vídeo pronto · {layouts.find((l) => l.id === video.layoutId)?.label}</p>
              <p className="text-[0.7rem] text-brand-muted">{((VIDEO_DRAW_MS + VIDEO_HOLD_MS) / 1000).toLocaleString("pt-BR")} s · {video.ext.toUpperCase()} · {(video.blob.size / 1e6).toFixed(1)} MB</p>
              <div className="mt-2 flex gap-2">
                <button onClick={handleShareVideo} className="od-btn od-btn-primary od-btn-sm">Compartilhar vídeo</button>
                <button onClick={handleSaveVideo} className="od-btn od-btn-ghost od-btn-sm">Salvar</button>
              </div>
            </div>
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
    </div>
  );
}
