"use client";

import { useEffect, useRef, useState } from "react";

import { loadArt } from "@/lib/story/art";
import { prepareCanvas, STORY_H, STORY_W } from "@/lib/story/engine";
import type { StoryLayout, StoryLayoutData } from "@/lib/story/types";

/** 2x do maior tamanho exibido (cartão da galeria, ~108 px de largura). */
const THUMB_W = 216;
const THUMB_H = 384;

export type ThumbData = Omit<StoryLayoutData, "art">;

/**
 * Miniatura de cada modelo desenhada com os dados reais do treino (e a foto, se houver).
 * Desenha em tamanho real num canvas fora da tela e reduz: os layouts usam coordenadas
 * de 1080x1920 e o `shadowBlur` não acompanha `scale`, então desenhar direto pequeno
 * deixaria os brilhos errados. Um modelo por vez, cedendo a vez ao navegador entre eles;
 * recomeça (com atraso, para não refazer tudo a cada movimento ao arrastar a foto)
 * quando os dados mudam e fica parado durante a gravação do vídeo.
 */
export function useStoryThumbs(layouts: StoryLayout[], data: ThumbData | null, paused: boolean): Record<string, string> {
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const bigRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!data || paused) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!bigRef.current) {
        bigRef.current = document.createElement("canvas");
        bigRef.current.width = STORY_W;
        bigRef.current.height = STORY_H;
      }
      const big = bigRef.current;
      const ctx = big.getContext("2d");
      if (!ctx) return;
      for (const l of layouts) {
        if (cancelled) return;
        try {
          const art = await loadArt(l.art);
          if (cancelled) return;
          prepareCanvas(ctx, data.transparent);
          l.draw(ctx, { ...data, art });
          const small = document.createElement("canvas");
          small.width = THUMB_W;
          small.height = THUMB_H;
          const s = small.getContext("2d")!;
          s.imageSmoothingQuality = "high";
          s.drawImage(big, 0, 0, THUMB_W, THUMB_H);
          // webp guarda a transparencia; onde o navegador nao codifica webp, sai PNG
          const url = small.toDataURL("image/webp", 0.85);
          setThumbs((t) => ({ ...t, [l.id]: url }));
        } catch {
          // miniatura que falha fica no esqueleto; o modelo continua escolhivel
        }
        await new Promise((r) => setTimeout(r, 0));
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [layouts, data, paused]);

  return thumbs;
}
