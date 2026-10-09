/**
 * Formato Feed 4:5 (1080×1350) a partir dos modelos de Story (1080×1920).
 *
 * Os modelos só sabem desenhar em 9:16. Para o feed, cada modelo é desenhado no
 * modo "fundo transparente" num canvas 9:16 fora da tela; a área com tinta (arte,
 * números, rota) é recortada e centralizada no 4:5, reduzida só se não couber.
 * O fundo (preto da marca ou a foto, cobrindo o 4:5 inteiro) é desenhado aqui.
 * Modelo cujo conteúdo ocupa o Story de cima a baixo ficaria pequeno demais:
 * esses ficam fora do feed (`StoryLayout.feed === false`).
 */

import { drawCoverImage, prepareCanvas, STORY_H, STORY_W, type Box } from "./engine";
import type { StoryLayout, StoryLayoutData } from "./types";

export const FEED_W = 1080;
export const FEED_H = 1350;
const PAD = 56;
const SCAN_W = 270; // varre a transparência em 1/4 do tamanho: rápido e preciso o bastante
const SCAN_H = 480;

export type StoryFormat = "story" | "feed";

export function formatSize(format: StoryFormat): { w: number; h: number } {
  return format === "feed" ? { w: FEED_W, h: FEED_H } : { w: STORY_W, h: STORY_H };
}

export function feedLayouts(layouts: StoryLayout[]): StoryLayout[] {
  return layouts.filter((l) => l.feed !== false);
}

let scratch: HTMLCanvasElement | null = null;
let scan: HTMLCanvasElement | null = null;

/** Retângulo (em px do Story) com tudo o que tem tinta; null se o canvas está vazio. */
export function inkBounds(src: HTMLCanvasElement): Box | null {
  scan ??= document.createElement("canvas");
  scan.width = SCAN_W;
  scan.height = SCAN_H;
  const s = scan.getContext("2d", { willReadFrequently: true })!;
  s.clearRect(0, 0, SCAN_W, SCAN_H);
  s.drawImage(src, 0, 0, SCAN_W, SCAN_H);
  const { data } = s.getImageData(0, 0, SCAN_W, SCAN_H);
  let x0 = SCAN_W, y0 = SCAN_H, x1 = -1, y1 = -1;
  for (let y = 0; y < SCAN_H; y++) {
    for (let x = 0; x < SCAN_W; x++) {
      if (data[(y * SCAN_W + x) * 4 + 3] > 12) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const k = STORY_W / SCAN_W;
  const x = Math.max(0, (x0 - 1) * k), y = Math.max(0, (y0 - 1) * k);
  return { x, y, w: Math.min(STORY_W, (x1 + 2) * k) - x, h: Math.min(STORY_H, (y1 + 2) * k) - y };
}

/**
 * Desenha o modelo no 4:5 em `ctx` (1080×1350). Devolve a escala aplicada ao
 * conteúdo (1 = tamanho do Story).
 */
export function drawFeed(ctx: CanvasRenderingContext2D, layout: StoryLayout, data: StoryLayoutData): number {
  scratch ??= document.createElement("canvas");
  scratch.width = STORY_W;
  scratch.height = STORY_H;
  const sctx = scratch.getContext("2d")!;
  prepareCanvas(sctx, true);
  layout.draw(sctx, { ...data, photo: null, transparent: true });

  ctx.clearRect(0, 0, FEED_W, FEED_H);
  if (!data.transparent) {
    ctx.fillStyle = "#0A0A0A";
    ctx.fillRect(0, 0, FEED_W, FEED_H);
    if (data.photo) {
      drawCoverImage(ctx, data.photo.image, { x: 0, y: 0, w: FEED_W, h: FEED_H }, data.photo);
      // sem os escurecimentos do modelo (ficaram no 9:16): um véu único segura o contraste
      ctx.fillStyle = "rgba(6,6,6,0.38)";
      ctx.fillRect(0, 0, FEED_W, FEED_H);
    }
  }

  const b = inkBounds(scratch);
  if (!b) return 1;
  const scale = Math.min(1, (FEED_W - 2 * PAD) / b.w, (FEED_H - 2 * PAD) / b.h);
  const w = b.w * scale, h = b.h * scale;
  ctx.drawImage(scratch, b.x, b.y, b.w, b.h, (FEED_W - w) / 2, (FEED_H - h) / 2, w, h);
  return scale;
}

/** Desenha no formato escolhido: o Story como sempre, ou o reenquadramento 4:5. */
export function drawInFormat(ctx: CanvasRenderingContext2D, format: StoryFormat, layout: StoryLayout, data: StoryLayoutData): void {
  if (format === "feed") {
    drawFeed(ctx, layout, data);
    return;
  }
  prepareCanvas(ctx, data.transparent);
  layout.draw(ctx, data);
}
