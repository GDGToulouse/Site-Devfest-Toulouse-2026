// Service worker of the event-day zone (RG-ARR-63, #641), registered with the
// scope /arrivees only: the public site keeps no service worker.
//
// It keeps the application, never the data. Pages are network-first, so a
// deploy shows up on the next opening, and fall back to the copy kept here when
// the network or the server is gone: the Scan screen must still open then
// (RG-ARR-64). Next's build files carry a hash in their name and never change,
// so they are served from here first. /api is left alone: a stale state shown
// as live is worse than an indicator that says the link is down.
//
// Bump CACHE_NAME to drop everything kept by an earlier version.

const CACHE_NAME = "arrivees-v2";
const SHELL_URL = "/arrivees";
// The barcode reader of iOS phones (#642): needed by the Scan screen offline,
// and fetched only when a scan starts otherwise.
const PRECACHE_URLS = [SHELL_URL, "/arrivees-zxing/zxing_reader.wasm"];

self.addEventListener("install", (event) => {
  // The shell, at least: a phone that installed the app before ever loading
  // its screen offline still has something to open. A failure must not block
  // the install, the page caches itself on its next visit anyway.
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => Promise.all(PRECACHE_URLS.map((url) => cache.add(url).catch(() => undefined)))),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n.startsWith("arrivees-") && n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

// The page lists what it loaded before this worker took control (its first
// visit), so that visit's scripts and styles are kept too.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "cache-urls" || !Array.isArray(event.data.urls)) return;
  const urls = event.data.urls.filter((url) => typeof url === "string" && isCacheable(new URL(url, self.location.origin)));
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        urls.map((url) =>
          cache.match(url).then((hit) => hit || cache.add(url).catch(() => undefined)),
        ),
      ),
    ),
  );
});

function isCacheable(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  // A client-side navigation's payload, tied to one build: offline, Next
  // falls back to a full page load, which the cached page answers.
  if (url.searchParams.has("_rsc")) return false;
  return true;
}

function keep(request, response) {
  if (response.ok && response.type === "basic") {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (!isCacheable(url) || request.headers.get("RSC")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((res) => keep(request, res))));
    return;
  }

  event.respondWith(
    fetch(request)
      .then((res) => keep(request, res))
      .catch(() =>
        caches
          .match(request, { ignoreSearch: true })
          .then((hit) => hit || (request.mode === "navigate" ? caches.match(SHELL_URL) : undefined))
          .then((hit) => hit || Response.error()),
      ),
  );
});
