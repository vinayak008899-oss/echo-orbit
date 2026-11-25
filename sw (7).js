// Caches the app shell so Echo Orbit opens with no internet. Songs live in IndexedDB, not here.
// Bump CACHE_VER whenever you deploy a new index.html so old caches are dropped cleanly.
const CACHE_VER = 'echo-orbit-v17';
const ASSETS = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VER)
      .then(c => Promise.allSettled(ASSETS.map(a => c.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VER).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  // Never intercept Supabase, payment gateways, or third-party APIs
  const isFonts = /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(u.hostname);
  if (u.origin !== location.origin && !isFonts) return;

  const isShell = r.mode === 'navigate' || (u.origin === location.origin && /(\/|index\.html|sw\.js)$/.test(u.pathname));
  if (isShell) {
    // Network-first for app shell so fixes & Pro config updates arrive immediately
    e.respondWith(
      fetch(r).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE_VER).then(c => c.put(r, copy)); }
        return res;
      }).catch(() => caches.match(r, { ignoreSearch: true }).then(hit => hit || caches.match('index.html')))
    );
    return;
  }

  // Cache-first with background refresh for icons and fonts
  e.respondWith(
    caches.match(r, { ignoreSearch: true }).then(hit => {
      const net = fetch(r).then(res => {
        if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE_VER).then(c => c.put(r, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
