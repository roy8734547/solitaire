// Mindful Solitaire — Service Worker
// Cache version: bump this string any time you deploy an update
const CACHE = 'sol-v8';

// Resources to cache on install (app shell)
const PRECACHE = [
  './',                         // solitaire.html via directory index
  './solitaire.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
  // React 18 + Babel (CDN — cached so the game works offline)
  'https://unpkg.com/react@18/umd/react.development.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.development.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
];

// ── Install: pre-cache the app shell ──────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => {
      // addAll will throw if ANY request fails; we use individual adds so
      // a single CDN hiccup doesn't break the whole install.
      return Promise.allSettled(
        PRECACHE.map(url =>
          cache.add(url).catch(err => console.warn('[SW] pre-cache miss:', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: delete old caches ───────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for app shell, network-first for ARTIC artwork ─────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // ARTIC image / API calls: network-first (fresh art), fall back to cache
  if (url.hostname.includes('artic.edu') || url.hostname.includes('api.artic.edu')) {
    event.respondWith(
      fetch(event.request)
        .then(resp => {
          // Clone and cache a fresh copy of artwork images
          if (resp.ok && event.request.method === 'GET') {
            const clone = resp.clone();
            caches.open(CACHE).then(c => c.put(event.request, clone));
          }
          return resp;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Everything else: cache-first (app shell + CDN scripts)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      // Not in cache — fetch, cache, return
      return fetch(event.request).then(resp => {
        if (resp.ok && event.request.method === 'GET') {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(event.request, clone));
        }
        return resp;
      });
    })
  );
});
