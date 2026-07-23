const CACHE_NAME = "btmm-bmwt-cr-v4-auto-update";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./vendor/proj4.js",
  "./vendor/jszip.min.js"
];

async function refreshAppCache() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(ASSETS.map(async (url) => {
    const request = new Request(url, { cache: "reload" });
    const response = await fetch(request);
    if (!response.ok) throw new Error(`No se pudo actualizar ${url}: ${response.status}`);
    await cache.put(url, response.clone());
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(refreshAppCache());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("btmm-bmwt-cr-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (event.data?.type === "REFRESH_APP_CACHE") {
    event.waitUntil(
      refreshAppCache()
        .then(() => event.source?.postMessage({ type: "APP_CACHE_REFRESHED" }))
        .catch((error) => {
          console.warn("No fue posible renovar la caché de la aplicación.", error);
          event.source?.postMessage({ type: "APP_CACHE_REFRESH_FAILED" });
        })
    );
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    fetch(new Request(event.request, { cache: "no-store" }))
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate") return caches.match("./index.html");
        return Response.error();
      })
  );
});
