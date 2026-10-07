/*
 * Service worker MINIMO do Kactus: so troca a tela branca por "Kactus desligado".
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
