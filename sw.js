// Caches the app shell (this app's own files + the pinned CDN modules it
// loads React/htm from) so the app can launch offline once it's been opened
// at least once. Star-citizen.wiki API data is deliberately NOT handled
// here — src/api.js already caches that in IndexedDB with its own 12h
// freshness policy and stale-while-error fallback, which a dumb SW cache
// would only fight with.
const CACHE_NAME = "star-hangar-shell-v1";
const CDN_ORIGIN = "https://esm.sh";

const SHELL_FILES = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon.svg",
  "/src/style.css",
  "/src/main.js",
  "/src/App.js",
  "/src/html.js",
  "/src/api.js",
  "/src/router.js",
  "/src/loadout.js",
  "/src/storage.js",
  "/src/share.js",
  "/src/tradeApi.js",
  "/src/pages/ShipList.js",
  "/src/pages/ShipDetail.js",
  "/src/pages/PartsBrowser.js",
  "/src/pages/MyHangar.js",
  "/src/pages/ImportBuild.js",
  "/src/pages/ShipCompare.js",
  "/src/pages/TradeRoutes.js",
  "/src/components/LoadoutOptimizer.js",
  "/src/components/ErrorBoundary.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => Promise.all(SHELL_FILES.map((url) => cache.add(url).catch(() => {}))))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isShell = url.origin === self.location.origin;
  const isCdn = url.origin === CDN_ORIGIN;
  if (!isShell && !isCdn) return; // API calls etc. go straight to the network

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return res;
      });
    })
  );
});
