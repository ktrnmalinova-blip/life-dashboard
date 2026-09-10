/**
 * Life Dashboard — Service Worker
 * Даёт офлайн-доступ и делает приложение "устанавливаемым" (installable PWA).
 * Версию кеша (CACHE_NAME) меняйте при каждом значимом обновлении файлов,
 * чтобы у пользователей подтянулась свежая версия.
 */
const CACHE_NAME = 'life-dashboard-v1';

const PRECACHE_URLS = [
  './index.html',
  './tasks.html',
  './journal.html',
  './habits.html',
  './finance.html',
  './health.html',
  './styles.css',
  './auth.js',
  './pwa.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png'
];

/* ── INSTALL: кладём базовые файлы в кеш ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('SW precache error (не критично):', err))
  );
});

/* ── ACTIVATE: чистим старые версии кеша ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH: network-first для HTML (свежий контент),
   cache-first для остального (шрифты, картинки, статика) ── */
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const isHTML = req.headers.get('accept')?.includes('text/html');

  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
