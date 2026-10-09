"use client";

import { useEffect, useRef, useState } from "react";

import { loadArt } from "@/lib/story/art";
import { STORY_H, STORY_W } from "@/lib/story/engine";
import { drawInFormat, formatSize, type StoryFormat } from "@/lib/story/feed";
import type { StoryLayout, StoryLayoutData } from "@/lib/story/types";

/** 2x do maior tamanho exibido (cartão da galeria, ~108 px de largura); a altura segue o formato. */
const THUMB_W = 216;

export type ThumbData = Omit<StoryLayoutData, "art">;

/**
 * Miniatura de cada modelo desenhada com os dados reais do treino (e a foto, se houver).
 * Desenha em tamanho real num canvas fora da tela e reduz: os layouts usam coordenadas
 * de 1080x1920 e o `shadowBlur` não acompanha `scale`, então desenhar direto pequeno
 * deixaria os brilhos errados. Um modelo por vez, cedendo a vez ao navegador entre eles;
 * recomeça (com atraso, para não refazer tudo a cada movimento ao arrastar a foto)
 * quando os dados mudam e fica parado durante a gravação do vídeo.
 */
export function useStoryThumbs(layouts: StoryLayout[], data: ThumbData | null, paused: boolean, format: StoryFormat = "story"): Record<string, string> {
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const bigRef = useRef<HTMLCanvasElement | null>(null);
  const formatRef = useRef(format);

  useEffect(() => {
    if (!data || paused) return;
    // trocou Story <-> Feed: as miniaturas antigas estão no formato errado
    if (formatRef.current !== format) {
      formatRef.current = format;
      setThumbs({});
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!bigRef.current) {
        bigRef.current = document.createElement("canvas");
        bigRef.current.width = STORY_W;
        bigRef.current.height = STORY_H;
      }
      const big = bigRef.current;
      const size = formatSize(format);
      big.width = size.w;
      big.height = size.h;
      const thumbH = Math.round((THUMB_W * size.h) / size.w);
      const ctx = big.getContext("2d");
      if (!ctx) return;
      for (const l of layouts) {
        if (cancelled) return;
        try {
          const art = await loadArt(l.art);
          if (cancelled) return;
          drawInFormat(ctx, format, l, { ...data, art });
          const small = document.createElement("canvas");
          small.width = THUMB_W;
          small.height = thumbH;
          const s = small.getContext("2d")!;
          s.imageSmoothingQuality = "high";
          s.drawImage(big, 0, 0, THUMB_W, thumbH);
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
  }, [layouts, data, paused, format]);

  return thumbs;
}
