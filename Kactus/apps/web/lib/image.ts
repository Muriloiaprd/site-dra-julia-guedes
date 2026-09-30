/** Redimensionamento de imagem no navegador, antes de subir (foto de perfil, logo, fotos de equipamento). */

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(objectUrl); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("falha ao carregar imagem")); };
    img.src = objectUrl;
  });
}

function draw(img: HTMLImageElement, w: number, h: number, sx = 0, sy = 0, sw = img.width, sh = img.height): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponível");
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  return canvas;
}

/** Recorte quadrado central em JPEG (avatar). */
export async function resizeImageToDataUrl(file: File, size: number): Promise<string> {
  const img = await loadImage(file);
  const side = Math.min(img.width, img.height);
  return draw(img, size, size, (img.width - side) / 2, (img.height - side) / 2, side, side).toDataURL("image/jpeg", 0.85);
}

/** Igual ao avatar, mas sem recorte quadrado (mantém proporção) e em PNG,
 * pra preservar transparência — usada nos cards/stories compartilháveis. */
export async function resizeLogoToPngDataUrl(file: File, max: number): Promise<string> {
  const img = await loadImage(file);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  return draw(img, Math.round(img.width * scale), Math.round(img.height * scale)).toDataURL("image/png");
}

/** Foto de equipamento: mantém a proporção, lado maior `max`, JPEG (~30 KB com 480 px). */
export async function resizePhotoToJpegDataUrl(file: File, max = 480): Promise<string> {
  const img = await loadImage(file);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  return draw(img, Math.round(img.width * scale), Math.round(img.height * scale)).toDataURL("image/jpeg", 0.85);
}
