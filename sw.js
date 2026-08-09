// =====================================================================
// ELITE — minimal service worker so the app shell loads instantly and
// "Add to Home Screen" on iOS feels like a real installed app. This
// caches the static app shell only — live data (auth, Firestore) always
// goes to the network, it is never cached here.
// =====================================================================
const CACHE_NAME = "elite-shell-v6";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/app.js",
  "./js/auth.js",
  "./js/store.js",
  "./js/local-store.js",
  "./js/progression.js",
  "./js/ui-helpers.js",
  "./js/firebase-init.js",
  "./js/firebase-config.js",
  "./js/screens/workshop.js",
  "./js/screens/leaderboard.js",
  "./js/games/rps-logic.js",
  "./js/games/rps-ui.js",
  "./js/games/connect4-logic.js",
  "./js/games/connect4-ui.js",
  "./js/games/dice-logic.js",
  "./js/games/dice-ui.js",
  "./js/games/cube-logic.js",
  "./js/games/cube-ui.js",
  "./js/games/cube-skin.js",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
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
  // Never intercept cross-origin requests (Firebase, Google Fonts, etc.)
  // — those must always hit the real network.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
