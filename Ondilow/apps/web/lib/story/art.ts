/**
 * Carrega os PNGs de `public/story-art/` e monta, por layout, a camada de
 * arte pronta pra desenhar: recorta as regiões dinâmicas (rota/números) e
 * recolore pra cor do esporte, preservando o brilho e a transparência
 * originais. Ver docs/PLANEJAMENTO_ATIVIDADES.md — arquitetura "arte como
 * camada".
 */

import { sportColor } from "@/lib/utils";
import type { Box } from "./engine";

/** Cor nativa da arte (o lima do Canva). Esportes com essa cor saem em identidade — pixel a pixel iguais ao PNG. */
export const ART_NATIVE_COLOR = "#C6FF00";

/**
 * Cor do Story por esporte. Corrida (e esteira) usa a cor nativa da arte: os
 * modelos do Canva foram desenhados em cima de uma corrida, então manter o lima
 * faz o Story sair pixel a pixel igual ao original, sem passar pelo recolor.
 * Os outros esportes seguem a paleta do app — mas a logo nunca é tingida
 * (ver `noTint` em `buildArtLayer`), porque marca não muda de cor por esporte.
 */
export function storyColor(sport: string): string {
  if (sport === "run" || sport === "treadmill") return ART_NATIVE_COLOR;
  return sportColor(sport);
}
const NATIVE_SAT = 1;
const NATIVE_LIGHT = 0.5;
/** Abaixo disso o pixel é branco/preto/cinza (texto, badge, sombra) — nunca é tingido. */
const SATURATION_FLOOR = 0.25;

const imgCache = new Map<string, Promise<HTMLImageElement>>();

export function loadArt(src: string): Promise<HTMLImageElement> {
  let hit = imgCache.get(src);
  if (!hit) {
    hit = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Falha ao carregar arte: ${src}`));
      img.src = src;
    });
    imgCache.set(src, hit);
  }
  return hit;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
    case g: h = (b - r) / d + 2; break;
    default: h = (r - g) / d + 4;
  }
  return { h: h * 60, s, l };
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hn = h / 360;
  return [
    Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, hn) * 255),
    Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  ];
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const n = parseInt(hex.replace("#", ""), 16);
  return rgbToHsl((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

export type ArtRegions = { mode: "clear"; rects: Box[] } | { mode: "keep"; rects: Box[] };

const layerCache = new Map<string, HTMLCanvasElement>();

/**
 * Monta a camada de arte pronta: recorta as regiões dinâmicas e recolore
 * pra `color`. Memoizado por (src, assinatura das regiões, cor) — o mesmo
 * resultado é reusado enquanto o usuário arrasta a foto (que redesenha a
 * cada `pointermove`, mas não muda layout nem cor).
 */
export function buildArtLayer(
  img: HTMLImageElement,
  src: string,
  regions: ArtRegions,
  color: string,
  /** Regiões que o recolor não pode tocar (a logo) — restauradas da arte original depois da LUT. */
  noTint: Box[] = []
): HTMLCanvasElement {
  const key = `${src}|${regions.mode}|${regions.rects.map((r) => `${r.x},${r.y},${r.w},${r.h}`).join(";")}|${color}`;
  const hit = layerCache.get(key);
  if (hit) return hit;

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;

  const PAD = 6;
  if (regions.mode === "keep") {
    for (const r of regions.rects) {
      ctx.drawImage(img, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
    }
  } else {
    ctx.drawImage(img, 0, 0);
    for (const r of regions.rects) {
      ctx.clearRect(r.x - PAD, r.y - PAD, r.w + PAD * 2, r.h + PAD * 2);
    }
  }

  if (color.toUpperCase() !== ART_NATIVE_COLOR) {
    const target = hexToHsl(color);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const p = data.data;
    for (let i = 0; i < p.length; i += 4) {
      if (p[i + 3] === 0) continue;
      const { h, s, l } = rgbToHsl(p[i], p[i + 1], p[i + 2]);
      if (s < SATURATION_FLOOR) continue;
      const [r, g, b] = hslToRgb(
        target.h,
        Math.min(1, s * (target.s / NATIVE_SAT)),
        Math.min(1, Math.max(0, l * (target.l / NATIVE_LIGHT)))
      );
      p[i] = r; p[i + 1] = g; p[i + 2] = b;
    }
    ctx.putImageData(data, 0, 0);

    // a logo volta da arte original: o gradiente da marca não pode ser deslocado
    for (const r of noTint) {
      ctx.clearRect(r.x, r.y, r.w, r.h);
      ctx.drawImage(img, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
    }
  }

  layerCache.set(key, canvas);
  return canvas;
}
