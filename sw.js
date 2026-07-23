const CACHE_NAME = "btmm-bmwt-cr-v8-map-imagery-export";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./key-data.js",
  "./app.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./vendor/leaflet.css",
  "./vendor/leaflet.js",
  "./vendor/proj4.js",
  "./vendor/jszip.min.js"
];

async function responsesDiffer(cached, fresh) {
  if (!cached) return true;
  const [cachedBytes, freshBytes] = await Promise.all([
    cached.arrayBuffer(),
    fresh.clone().arrayBuffer()
  ]);
  if (cachedBytes.byteLength !== freshBytes.byteLength) return true;
  const before = new Uint8Array(cachedBytes);
  const after = new Uint8Array(freshBytes);
  for (let index = 0; index < before.length; index += 1) {
    if (before[index] !== after[index]) return true;
  }
  return false;
}

async function refreshAppCache() {
  const cache = await caches.open(CACHE_NAME);
  let changed = false;
  await Promise.all(ASSETS.map(async (url) => {
    const cached = await cache.match(url);
    const request = new Request(url, { cache: "reload" });
    const response = await fetch(request);
    if (!response.ok) throw new Error(`No se pudo actualizar ${url}: ${response.status}`);
    if (await responsesDiffer(cached, response)) changed = true;
    await cache.put(url, response.clone());
  }));
  return changed;
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
        .then((changed) => event.source?.postMessage({
          type: "APP_CACHE_REFRESHED",
          changed
        }))
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
  const isImageryTile = requestUrl.hostname === "server.arcgisonline.com";
  if (isImageryTile) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const copy = response.clone();
          caches.open("btmm-map-tiles-v1").then((cache) => cache.put(event.request, copy));
          return response;
        });
      })
    );
    return;
  }
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
