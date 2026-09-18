/**
 * Primitivas de desenho puras para o gerador de Stories. Não conhecem layout
 * nem dados de atividade — só sabem desenhar num CanvasRenderingContext2D.
 */

export const STORY_W = 1080;
export const STORY_H = 1920;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

let fontsPromise: Promise<void> | null = null;

/**
 * Carrega as fontes usadas no gerador de Stories, auto-hospedadas via
 * FontFace API. Montserrat (700/800/900) é a fonte dos títulos e valores,
 * igual ao que o usuário usou no Canva. O modelo "Stats à direita" usa Inter
 * (fonte variável, único arquivo cobrindo os pesos 700–900) — o usuário
 * confirmou que o Canva usou "Canva Sans" nesse modelo, que é proprietária da
 * Canva e não pode ser redistribuída; Inter é a aproximação livre mais
 * próxima (grotesque geométrica, mesma família de peso usada por várias
 * ferramentas de design). Poppins fica só pra outras partes do app
 * (dashboard, etc.), não é usada aqui. Idempotente.
 */
export function loadStoryFonts(): Promise<void> {
  if (fontsPromise) return fontsPromise;
  fontsPromise = (async () => {
    if (typeof document === "undefined" || typeof FontFace === "undefined") return;
    const specs: [string, string, string, string?][] = [
      ["Montserrat", "700", "/fonts/Montserrat-700.woff2"],
      ["Montserrat", "800", "/fonts/Montserrat-800.woff2"],
      ["Montserrat", "900", "/fonts/Montserrat-900.woff2"],
      ["Inter", "700 900", "/fonts/Inter-Variable.woff2"],
    ];
    await Promise.all(
      specs.map(async ([family, weight, url]) => {
        const already = [...document.fonts].some((f) => f.family === family && f.weight === weight);
        if (already) return;
        const font = new FontFace(family, `url(${url})`, { weight });
        await font.load();
        document.fonts.add(font);
      })
    );
  })();
  return fontsPromise;
}

/** Recorte "cover": preenche a caixa inteira sem distorcer, cortando o excesso. */
export function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource & { width: number; height: number },
  box: Box,
  opts: { offsetX?: number; offsetY?: number; zoom?: number } = {}
): void {
  const { offsetX = 0, offsetY = 0, zoom = 1 } = opts;
  const iw = img.width;
  const ih = img.height;
  if (!iw || !ih) return;
  const scale = Math.max(box.w / iw, box.h / ih) * zoom;
  const drawW = iw * scale;
  const drawH = ih * scale;
  const cx = box.x + box.w / 2 + offsetX;
  const cy = box.y + box.h / 2 + offsetY;
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  ctx.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
  ctx.restore();
}

/**
 * Projeta pontos lat/lon numa caixa de pixels: projeção equirretangular com
 * correção de cosseno da latitude, escala uniforme (preserva o aspecto) e
 * margem de 8% garantida em cada eixo. Os vértices nunca saem de `box` — quem
 * pode sangrar para fora é só a tinta de `drawRoute` (linha + glow), por isso
 * o `box` passado aqui deve já vir encolhido o suficiente para essa margem de
 * tinta (ver `clip` em `drawRoute` como rede de segurança).
 */
export function projectRoute(
  points: { lat: number; lon: number }[],
  box: Box,
  marginRatio = 0.08
): [number, number][] | null {
  if (!points || points.length < 2) return null;

  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const latMid = (minLat + maxLat) / 2;
  const lonScale = Math.cos((latMid * Math.PI) / 180);

  const spanLat = maxLat - minLat || 1e-6;
  const spanLon = (maxLon - minLon) * lonScale || 1e-6;

  const usableW = box.w * (1 - 2 * marginRatio);
  const usableH = box.h * (1 - 2 * marginRatio);
  const scale = Math.min(usableW / spanLon, usableH / spanLat);
  const drawW = spanLon * scale;
  const drawH = spanLat * scale;
  const offsetX = box.x + (box.w - drawW) / 2;
  const offsetY = box.y + (box.h - drawH) / 2;

  return points.map(({ lat, lon }) => [
    offsetX + (lon - minLon) * lonScale * scale,
    offsetY + (maxLat - lat) * scale,
  ]);
}

/**
 * Rota no traço da arte do Canva: linha de 9px (medido no PNG) com brilho
 * gaussiano de verdade (`shadowBlur`, não alfa empilhado — empilhar deixava
 * uma faixa verde-oliva grossa em volta) e marcadores em anel vazado, na
 * mesma cor. A arte não usa bolinha preenchida nem cor diferente por ponta.
 */
export function drawRoute(
  ctx: CanvasRenderingContext2D,
  coords: [number, number][],
  opts: { color?: string; lineWidth?: number; clip?: Box } = {}
): void {
  if (coords.length < 2) return;
  const { color = "#C6FF00", lineWidth = 9, clip } = opts;

  const tracePath = () => {
    ctx.beginPath();
    ctx.moveTo(coords[0][0], coords[0][1]);
    for (let i = 1; i < coords.length; i++) ctx.lineTo(coords[i][0], coords[i][1]);
  };

  ctx.save();
  /**
   * Rede de segurança, não o mecanismo principal: em operação normal a tinta
   * (linha + glow) já cabe com folga dentro de `clip` — ver `routePlot` em
   * `regions.ts`, dimensionado pra isso. Se algum dia isso deixar de valer
   * (caixa re-alargada, linha mais grossa), o corte aparece como uma aresta
   * reta no glow — sintoma óbvio, não um vazamento silencioso sobre a arte.
   */
  if (clip) {
    ctx.beginPath();
    ctx.rect(clip.x, clip.y, clip.w, clip.h);
    ctx.clip();
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  ctx.shadowColor = color;
  ctx.shadowBlur = lineWidth * 2.6;
  tracePath();
  ctx.stroke();
  tracePath();
  ctx.stroke();

  ctx.shadowBlur = 0;
  tracePath();
  ctx.stroke();

  const ringR = lineWidth * 1.45;
  ctx.lineWidth = lineWidth * 0.62;
  for (const [x, y] of [coords[0], coords[coords.length - 1]]) {
    ctx.beginPath();
    ctx.arc(x, y, ringR, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Gradiente escuro atrás de texto, pra segurar contraste sobre qualquer foto. */
export function drawScrim(
  ctx: CanvasRenderingContext2D,
  region: Box,
  direction: "top" | "bottom" = "bottom",
  strength = 0.85
): void {
  const grad = ctx.createLinearGradient(0, region.y, 0, region.y + region.h);
  if (direction === "bottom") {
    grad.addColorStop(0, "rgba(6,6,6,0)");
    grad.addColorStop(1, `rgba(6,6,6,${strength})`);
  } else {
    grad.addColorStop(0, `rgba(6,6,6,${strength})`);
    grad.addColorStop(1, "rgba(6,6,6,0)");
  }
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(region.x, region.y, region.w, region.h);
  ctx.restore();
}

/** Reduz o tamanho da fonte até `text` caber em `maxWidth`, sem passar de `maxSize`. */
export function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSpec: (size: number) => string,
  maxWidth: number,
  maxSize: number,
  minSize = 24
): number {
  let size = maxSize;
  ctx.save();
  while (size > minSize) {
    ctx.font = fontSpec(size);
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  ctx.restore();
  return size;
}

export function textWithShadow(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: {
    font: string;
    color?: string;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
    shadowBlur?: number;
    shadowColor?: string;
    /** Deslocamento da sombra. O modelo 17 usa sombra dura deslocada nos dois eixos. */
    shadowOffset?: { x: number; y: number };
  }
): void {
  ctx.save();
  ctx.font = opts.font;
  ctx.textAlign = opts.align ?? "left";
  ctx.textBaseline = opts.baseline ?? "alphabetic";
  ctx.shadowColor = opts.shadowColor ?? "rgba(0,0,0,0.65)";
  ctx.shadowBlur = opts.shadowBlur ?? 18;
  ctx.shadowOffsetX = opts.shadowOffset?.x ?? 0;
  ctx.shadowOffsetY = opts.shadowOffset?.y ?? 2;
  ctx.fillStyle = opts.color ?? "#fff";
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * Limpa o canvas e desenha o fundo base antes do layout: cor escura da marca
 * quando não há foto ou o modo transparente está desligado; nada (alfa 0)
 * quando "fundo transparente" está ativo, pra manter o PNG exportável com
 * canal alfa.
 */
export function prepareCanvas(ctx: CanvasRenderingContext2D, transparent: boolean): void {
  ctx.clearRect(0, 0, STORY_W, STORY_H);
  if (!transparent) {
    ctx.save();
    ctx.fillStyle = "#0A0A0A";
    ctx.fillRect(0, 0, STORY_W, STORY_H);
    ctx.restore();
  }
}
