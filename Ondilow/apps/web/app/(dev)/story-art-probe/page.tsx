"use client";

/**
 * Ferramenta só-de-desenvolvimento: mede as regiões de alfa (bandas de
 * linha/coluna) dos PNGs em `public/story-art/` e imprime literais TS
 * prontos pra colar em `lib/story/regions.ts`. Ver plano em
 * docs/PLANEJAMENTO_ATIVIDADES.md — Etapa 1.
 */

import { useEffect, useRef, useState } from "react";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const IMAGES = [
  { id: "icones-direita", src: "/story-art/icones-direita.png" },
  { id: "icones-esquerda", src: "/story-art/icones-esquerda.png" },
  { id: "rota-minimal", src: "/story-art/rota-minimal.png" },
  { id: "logo-lateral", src: "/story-art/logo-lateral.png" },
  { id: "rota-limpa", src: "/story-art/rota-limpa.png" },
  { id: "faixa-simples", src: "/story-art/faixa-simples.png" },
  { id: "rota-faixa", src: "/story-art/rota-faixa.png" },
  { id: "faixa-listras", src: "/story-art/faixa-listras.png" },
  { id: "mao-apontando", src: "/story-art/mao-apontando.png" },
  { id: "simbolo-metricas", src: "/story-art/simbolo-metricas.png" },
  { id: "tenis", src: "/story-art/tenis.png" },
  { id: "bandeiras", src: "/story-art/bandeiras.png" },
  { id: "icones-solidos", src: "/story-art/icones-solidos.png" },
  { id: "rota-icones", src: "/story-art/rota-icones.png" },
  { id: "rotulos-centro", src: "/story-art/rotulos-centro.png" },
  { id: "moldura-tracejada", src: "/story-art/moldura-tracejada.png" },
  { id: "desafio", src: "/story-art/desafio.png" },
  { id: "stats-direita", src: "/story-art/stats-direita.png" },
  { id: "rota-grande", src: "/story-art/rota-grande.png" },
];

/**
 * Detecta regiões retangulares de conteúdo (alfa > threshold) via projeção:
 * primeiro em bandas horizontais (linhas com tinta, separadas por `rowGap`
 * linhas vazias), depois cada banda em segmentos verticais (mesma lógica,
 * `colGap`). Para cada segmento, recalcula a bbox exata dos pixels com tinta.
 */
function detectRegions(
  imgData: ImageData,
  alphaThreshold: number,
  rowGap: number,
  colGap: number,
  minInk: number
): Rect[] {
  const { data, width, height } = imgData;

  const inkPerRow = new Int32Array(height);
  for (let y = 0; y < height; y++) {
    let count = 0;
    const base = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (data[base + x * 4 + 3] > alphaThreshold) count++;
    }
    inkPerRow[y] = count;
  }

  const bands: [number, number][] = [];
  let y = 0;
  while (y < height) {
    if (inkPerRow[y] >= minInk) {
      let end = y;
      let gap = 0;
      let cursor = y + 1;
      while (cursor < height) {
        if (inkPerRow[cursor] >= minInk) {
          end = cursor;
          gap = 0;
        } else {
          gap++;
          if (gap >= rowGap) break;
        }
        cursor++;
      }
      bands.push([y, end]);
      y = cursor;
    } else {
      y++;
    }
  }

  const rects: Rect[] = [];
  for (const [y0, y1] of bands) {
    const inkPerCol = new Int32Array(width);
    for (let x = 0; x < width; x++) {
      let count = 0;
      for (let yy = y0; yy <= y1; yy++) {
        if (data[(yy * width + x) * 4 + 3] > alphaThreshold) count++;
      }
      inkPerCol[x] = count;
    }

    let x = 0;
    while (x < width) {
      if (inkPerCol[x] >= minInk) {
        let end = x;
        let gap = 0;
        let cursor = x + 1;
        while (cursor < width) {
          if (inkPerCol[cursor] >= minInk) {
            end = cursor;
            gap = 0;
          } else {
            gap++;
            if (gap >= colGap) break;
          }
          cursor++;
        }

        let minX = end, maxX = x, minY = y1, maxY = y0;
        for (let yy = y0; yy <= y1; yy++) {
          for (let xx = x; xx <= end; xx++) {
            if (data[(yy * width + xx) * 4 + 3] > alphaThreshold) {
              if (xx < minX) minX = xx;
              if (xx > maxX) maxX = xx;
              if (yy < minY) minY = yy;
              if (yy > maxY) maxY = yy;
            }
          }
        }
        if (maxX >= minX && maxY >= minY) {
          rects.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
        }
        x = cursor;
      } else {
        x++;
      }
    }
  }
  return rects;
}

function ZoomView({
  canvasRef,
  x,
  y,
  w,
  h,
  rects,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  x: number;
  y: number;
  w: number;
  h: number;
  rects: Rect[];
}) {
  const zoomRef = useRef<HTMLCanvasElement>(null);
  const scale = 2;
  useEffect(() => {
    const src = canvasRef.current;
    const dst = zoomRef.current;
    if (!src || !dst) return;
    const ctx = dst.getContext("2d");
    if (!ctx) return;
    const cw = Math.min(w, 1080 - x);
    const ch = Math.min(h, 1920 - y);
    dst.width = cw * scale;
    dst.height = ch * scale;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, dst.width, dst.height);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, dst.width, dst.height);
    ctx.drawImage(src, x, y, cw, ch, 0, 0, cw * scale, ch * scale);
  }, [canvasRef, x, y, w, h, rects]);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <canvas ref={zoomRef} style={{ maxWidth: "100%", background: "#1a1a1a" }} />
      <svg
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        viewBox={`0 0 ${Math.min(w, 1080 - x)} ${Math.min(h, 1920 - y)}`}
      >
        {rects
          .filter((r) => r.x >= x - 5 && r.y >= y - 5 && r.x <= x + w + 5 && r.y <= y + h + 5)
          .map((r, i) => (
            <rect
              key={i}
              x={r.x - x}
              y={r.y - y}
              width={r.w}
              height={r.h}
              fill="rgba(255,0,0,0.2)"
              stroke="red"
              strokeWidth={1}
            />
          ))}
      </svg>
    </div>
  );
}

export default function StoryArtProbePage() {
  const [selected, setSelected] = useState(IMAGES[0].id);
  const [alphaThreshold, setAlphaThreshold] = useState(16);
  const [rowGap, setRowGap] = useState(12);
  const [colGap, setColGap] = useState(14);
  const [minInk, setMinInk] = useState(2);
  const [rects, setRects] = useState<Rect[]>([]);
  const [showOverlay, setShowOverlay] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [cropW, setCropW] = useState(1080);
  const [cropH, setCropH] = useState(1920);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgDataRef = useRef<ImageData | null>(null);

  const img = IMAGES.find((i) => i.id === selected)!;

  useEffect(() => {
    setRects([]);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const image = new Image();
    image.onload = () => {
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);
      imgDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    };
    image.src = img.src;
  }, [img.src]);

  function runDetection() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    setBusy(true);
    setTimeout(() => {
      const cw = Math.min(cropW, canvas.width - cropX);
      const ch = Math.min(cropH, canvas.height - cropY);
      const cropped = ctx.getImageData(cropX, cropY, cw, ch);
      const result = detectRegions(cropped, alphaThreshold, rowGap, colGap, minInk);
      for (const r of result) {
        r.x += cropX;
        r.y += cropY;
      }
      result.sort((a, b) => a.y - b.y || a.x - b.x);
      setRects(result);
      setBusy(false);
    }, 0);
  }

  const literal =
    `export const RECTS_${selected.replace(/-/g, "_").toUpperCase()} = [\n` +
    rects.map((r) => `  { x: ${r.x}, y: ${r.y}, w: ${r.w}, h: ${r.h} },`).join("\n") +
    `\n];`;

  return (
    <div style={{ background: "#111", color: "#eee", minHeight: "100vh", padding: 24, fontFamily: "monospace" }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Story art probe (dev only)</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {IMAGES.map((i) => (
          <button
            key={i.id}
            onClick={() => setSelected(i.id)}
            style={{
              padding: "6px 12px",
              background: i.id === selected ? "#00FF66" : "#222",
              color: i.id === selected ? "#000" : "#eee",
              border: "1px solid #444",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            {i.id}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <label>
          alphaThreshold{" "}
          <input
            type="number"
            value={alphaThreshold}
            onChange={(e) => setAlphaThreshold(Number(e.target.value))}
            style={{ width: 60 }}
          />
        </label>
        <label>
          rowGap{" "}
          <input type="number" value={rowGap} onChange={(e) => setRowGap(Number(e.target.value))} style={{ width: 60 }} />
        </label>
        <label>
          colGap{" "}
          <input type="number" value={colGap} onChange={(e) => setColGap(Number(e.target.value))} style={{ width: 60 }} />
        </label>
        <label>
          minInk{" "}
          <input type="number" value={minInk} onChange={(e) => setMinInk(Number(e.target.value))} style={{ width: 60 }} />
        </label>
        <button onClick={runDetection} disabled={busy} style={{ padding: "6px 16px", background: "#00FF66", color: "#000", border: "none", borderRadius: 4, cursor: "pointer" }}>
          {busy ? "Detectando…" : "Detectar regiões"}
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input type="checkbox" checked={showOverlay} onChange={(e) => setShowOverlay(e.target.checked)} />
          overlay
        </label>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ color: "#888" }}>recorte (restringe a busca a essa sub-região):</span>
        <label>
          x <input type="number" value={cropX} onChange={(e) => setCropX(Number(e.target.value))} style={{ width: 70 }} />
        </label>
        <label>
          y <input type="number" value={cropY} onChange={(e) => setCropY(Number(e.target.value))} style={{ width: 70 }} />
        </label>
        <label>
          w <input type="number" value={cropW} onChange={(e) => setCropW(Number(e.target.value))} style={{ width: 70 }} />
        </label>
        <label>
          h <input type="number" value={cropH} onChange={(e) => setCropH(Number(e.target.value))} style={{ width: 70 }} />
        </label>
        <button
          onClick={() => { setCropX(0); setCropY(0); setCropW(1080); setCropH(1920); }}
          style={{ padding: "4px 10px", background: "#222", color: "#eee", border: "1px solid #444", borderRadius: 4, cursor: "pointer" }}
        >
          resetar recorte
        </button>
      </div>

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        <div style={{ position: "relative", width: 300, flexShrink: 0 }}>
          <canvas
            ref={canvasRef}
            style={{
              width: 300,
              height: 300 * (1920 / 1080),
              display: "block",
              background:
                "repeating-conic-gradient(#2a2a2a 0% 25%, #1a1a1a 0% 50%) 0 0 / 16px 16px",
            }}
          />
          {showOverlay && (
            <svg
              width={300}
              height={300 * (1920 / 1080)}
              viewBox="0 0 1080 1920"
              style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
            >
              {rects.map((r, i) => (
                <rect
                  key={i}
                  x={r.x}
                  y={r.y}
                  width={r.w}
                  height={r.h}
                  fill="rgba(255,0,0,0.25)"
                  stroke="red"
                  strokeWidth={2}
                />
              ))}
              <rect
                x={cropX}
                y={cropY}
                width={Math.min(cropW, 1080 - cropX)}
                height={Math.min(cropH, 1920 - cropY)}
                fill="none"
                stroke="#4aa3ff"
                strokeWidth={3}
                strokeDasharray="10 6"
              />
            </svg>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ marginBottom: 8, color: "#888" }}>{rects.length} região(ões) detectada(s)</p>
          <pre style={{ background: "#000", padding: 12, borderRadius: 4, overflow: "auto", maxHeight: 500, fontSize: 12 }}>
            {literal}
          </pre>
          <p style={{ margin: "12px 0 8px", color: "#888" }}>zoom do recorte (só visual, escala 2x)</p>
          <ZoomView canvasRef={canvasRef} x={cropX} y={cropY} w={cropW} h={cropH} rects={rects} />
        </div>
      </div>
    </div>
  );
}
