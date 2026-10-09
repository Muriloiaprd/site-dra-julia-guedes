/*
 * Service worker MINIMO do Kactus: troca a tela branca por "Kactus desligado" e
 * mostra as notificacoes (Web Push, services/push.py na API).
 *
 * Intercepta apenas navegacoes (abrir/recarregar uma pagina), sempre pela rede.
 * Se a rede falhar (PC dormindo) ou o Tailscale responder 502/503/504 (servidor
 * desligado), mostra /desligado.html. Nenhuma pagina do app fica em cache: o
 * motivo de 2026-09-18 para nao ter service worker (app velho) nao se aplica.
 */
const CACHE = "kactus-desligado-v1";
const DESLIGADO = "/desligado.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.add(new Request(DESLIGADO, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  // /api, JS, CSS e imagens passam direto, sem o service worker no caminho
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    (async () => {
      try {
        const resp = await fetch(event.request);
        if (resp.status === 502 || resp.status === 503 || resp.status === 504) {
          return (await caches.match(DESLIGADO)) || resp;
        }
        return resp;
      } catch {
        return (await caches.match(DESLIGADO)) || Response.error();
      }
    })(),
  );
});

// notificacao: {title, body, url} mandado pela API
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Kactus", {
      body: data.body || "",
      icon: "/icons/app-192.png",
      badge: "/icons/app-192.png",
      data: { url: data.url || "/dashboard" },
    }),
  );
});

// tocar na notificacao: abre (ou traz para frente) o Kactus na pagina do aviso
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/dashboard", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const abertos = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of abertos) {
        if (new URL(c.url).origin === self.location.origin && "navigate" in c) {
          await c.focus();
          return c.navigate(url);
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
