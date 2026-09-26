"use client";

/**
 * Ferramenta só-de-desenvolvimento: desenha um modelo de Story com os mesmos
 * valores de exemplo impressos na arte e compara com a arte original, pixel a
 * pixel. Branco = os dois têm tinta; vermelho = só o desenho novo; ciano = só
 * a arte (texto de exemplo que sobrou ou valor que não cobriu). Serve pra
 * conferir `lib/story/regions.ts` depois de trocar as artes. Uso:
 * /story-calibrate?id=<id do layout>. Rotas não são desenhadas (não há GPS de
 * exemplo), então a rota da arte aparece em ciano — é esperado.
 * `&color=%23RRGGBB` desenha o modelo nessa cor (recolor por esporte) e mostra
 * o resultado em vez da comparação — pra conferir que a logo não é tingida.
 */

import { useEffect, useRef, useState } from "react";

import type { ActivityDetail } from "@/lib/api";
import { ART_NATIVE_COLOR, loadArt } from "@/lib/story/art";
import { loadStoryFonts, prepareCanvas, STORY_H, STORY_W } from "@/lib/story/engine";
import { STORY_LAYOUTS } from "@/lib/story/layouts";
import type { StoryMetric } from "@/lib/story/metrics";

const m = (key: StoryMetric["key"], label: string, value: string, unit?: string): StoryMetric => ({ key, label, value, unit });

const ICONS = [m("distance", "Distância", "38,00", "km"), m("duration", "Tempo", "3:34:12"), m("pace", "Ritmo médio", "5:37", "/km"), m("elevation", "Elevação", "+412", "m")];
const LINES = [m("distance", "Distância", "38,00", "km"), m("duration", "Tempo", "1h 33min"), m("pace", "Ritmo médio", "5:37", "/km")];
const BAND = [m("distance", "Distância", "38,00", "km"), m("pace", "Ritmo", "5:20", "/km"), m("duration", "Tempo", "1h 33min")];

/** Valores de exemplo de cada arte, pra o texto desenhado ser o mesmo da arte. */
const SAMPLES: Record<string, StoryMetric[]> = {
  "icones-direita": ICONS,
  "icones-esquerda": ICONS,
  "logo-lateral": ICONS,
  "rota-icones": ICONS,
  "rota-minimal": LINES,
  "mao-apontando": LINES,
  "simbolo-metricas": LINES,
  tenis: LINES,
  "rota-limpa": BAND,
  "faixa-simples": BAND,
  "rota-faixa": BAND,
  "faixa-listras": BAND,
  bandeiras: BAND,
  "icones-solidos": [m("distance", "Distância", "21,05", "km"), m("duration", "Tempo", "1:52:34"), m("pace", "Ritmo médio", "5:20", "/km")],
  "rotulos-centro": [m("distance", "Distância", "5,00", "km"), m("pace", "Ritmo médio", "6:00", "/km"), m("duration", "Tempo", "30m 00s")],
  "moldura-tracejada": [m("duration", "Tempo", "29:13"), m("distance", "Distância", "5.10", "km"), m("pace", "Ritmo médio", "5:40", "/km")],
  desafio: [m("duration", "Time", "16:10"), m("pace", "Pace", "07:19"), m("distance", "Distance", "5.23")],
  "stats-direita": [m("distance", "Distance", "5.39", "km"), m("pace", "Pace", "8:23", "/km"), m("duration", "Time", "45m 9s")],
  "rota-grande": [],
};

const ACTIVITY = { id: "calib", sport: "run", title: "Morning Run Challenge", start_time: "2030-01-10T07:00:00" } as unknown as ActivityDetail;

export default function StoryCalibratePage() {
  const outRef = useRef<HTMLCanvasElement>(null);
  const [id, setId] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [stats, setStats] = useState<string>("");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setId(q.get("id") ?? STORY_LAYOUTS[0].id);
    setColor(q.get("color"));
  }, []);

  useEffect(() => {
    const layout = STORY_LAYOUTS.find((l) => l.id === id);
    if (!layout || !outRef.current) return;
    let cancelled = false;
    (async () => {
      await loadStoryFonts();
      const art = await loadArt(layout.art);
      if (cancelled) return;

      const drawn = document.createElement("canvas");
      drawn.width = STORY_W;
      drawn.height = STORY_H;
      const dctx = drawn.getContext("2d", { willReadFrequently: true })!;
      prepareCanvas(dctx, true);
      layout.draw(dctx, {
        activity: ACTIVITY,
        metrics: SAMPLES[layout.id] ?? [],
        routePoints: [],
        photo: null,
        art,
        transparent: true,
        color: color ?? ART_NATIVE_COLOR,
      });

      if (color) {
        const cv = outRef.current!;
        cv.width = STORY_W;
        cv.height = STORY_H;
        const cctx = cv.getContext("2d")!;
        prepareCanvas(cctx, false);
        cctx.drawImage(drawn, 0, 0);
        setStats(`${layout.id}: cor ${color}`);
        drawn.width = drawn.height = 1;
        return;
      }

      const orig = document.createElement("canvas");
      orig.width = STORY_W;
      orig.height = STORY_H;
      const octx = orig.getContext("2d", { willReadFrequently: true })!;
      octx.drawImage(art, 0, 0);

      const a = octx.getImageData(0, 0, STORY_W, STORY_H).data;
      const b = dctx.getImageData(0, 0, STORY_W, STORY_H).data;
      const out = new ImageData(STORY_W, STORY_H);
      let both = 0, onlyNew = 0, onlyArt = 0;
      for (let i = 0; i < a.length; i += 4) {
        // tinta = opaco e não escuro (a sombra do texto é preta e fica de fora)
        const inkA = a[i + 3] > 128 && Math.max(a[i], a[i + 1], a[i + 2]) > 90;
        const inkB = b[i + 3] > 128 && Math.max(b[i], b[i + 1], b[i + 2]) > 90;
        const [r, g, bl] = inkA && inkB ? [255, 255, 255] : inkB ? [255, 40, 40] : inkA ? [0, 220, 255] : [18, 18, 18];
        if (inkA && inkB) both++; else if (inkB) onlyNew++; else if (inkA) onlyArt++;
        out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = bl; out.data[i + 3] = 255;
      }
      const cv = outRef.current!;
      cv.width = STORY_W;
      cv.height = STORY_H;
      cv.getContext("2d")!.putImageData(out, 0, 0);
      setStats(`${layout.id}: comum ${both} · só novo ${onlyNew} · só arte ${onlyArt}`);
      drawn.width = drawn.height = orig.width = orig.height = 1;
    })();
    return () => {
      cancelled = true;
    };
  }, [id, color]);

  return (
    <div style={{ background: "#000", color: "#ccc", padding: 12, fontFamily: "monospace", fontSize: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {STORY_LAYOUTS.map((l) => (
          <a key={l.id} href={`?id=${l.id}`} style={{ color: l.id === id ? "#C6FF00" : "#888" }}>
            {l.id}
          </a>
        ))}
      </div>
      <div id="calib-stats">{stats}</div>
      <canvas ref={outRef} style={{ width: 540, height: 960, marginTop: 8 }} />
    </div>
  );
}
