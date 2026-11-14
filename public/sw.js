const CACHE_VERSION = 'v3';
const CACHE_NAME = `caltrack-${CACHE_VERSION}`;

// Only precache truly static files, NOT Next.js pages
const PRECACHE_URLS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Install: precache static assets only
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for everything, cache as fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip external API calls (Firestore handles its own caching)
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Hashed build assets never change once deployed: serve from cache instantly.
  // (Previously these were network-first, so every page load waited on the network
  // for dozens of JS/CSS files, which made the app feel slow on weak connections.)
  if (url.pathname.startsWith('/_next/static/') || PRECACHE_URLS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }))
    );
    return;
  }

  // Pages and data: network-first so new versions show up right away, cache as offline fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
