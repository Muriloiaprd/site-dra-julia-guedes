/**
 * Web Push no navegador: o que o aparelho suporta e a inscrição no serviço de push.
 *
 * No iPhone só funciona com o Kactus aberto pelo ícone da Tela de Início (iOS 16.4+);
 * no Safari comum `PushManager` nem existe. O service worker é o mesmo public/sw.js
 * da tela "Kactus desligado", que também mostra as notificações.
 */

export type PushSupport = "ok" | "ios-browser" | "unsupported";

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const has = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (has) return "ok";
  return isIOS() && !isStandalone() ? "ios-browser" : "unsupported";
}

export function deviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua) || isIOS()) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "PC (Windows)";
  if (/Mac/.test(ua)) return "Mac";
  return "Navegador";
}

async function registration(): Promise<ServiceWorkerRegistration> {
  // o RegistrarSW só registra fora do `next dev`; aqui garante o registro ao ativar
  const reg = (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js"));
  return navigator.serviceWorker.ready.then(() => reg);
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== "ok") return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ? reg.pushManager.getSubscription() : null;
}

function keyBytes(base64url: string): Uint8Array {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Pede a permissão (precisa vir de um toque) e inscreve o aparelho. */
export async function subscribe(publicKey: string): Promise<PushSubscription> {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error(perm === "denied" ? "denied" : "dismissed");
  const reg = await registration();
  const old = await reg.pushManager.getSubscription();
  if (old) return old;
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
}
