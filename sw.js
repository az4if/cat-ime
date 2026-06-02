const CACHE = 'catime-v24';
const ASSETS = ['./', './index.html', './dmca.html', './dmca/index.html', './js/catime-api.js', './js/catime-storage.js', './js/catime-ui.js', './js/catime-features.js', './js/catime-comments.js'];

function isHtmlRequest(url) {
  return url.pathname === '/' || url.pathname === '/dmca' || url.pathname.startsWith('/dmca') || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
}

function cachePut(request, response) {
  if (response.ok) {
    const copy = response.clone();
    caches.open(CACHE).then((c) => c.put(request, copy));
  }
}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  if (isHtmlRequest(url)) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          cachePut(e.request, res);
          return res;
        })
        .catch(() => caches.match(e.request).then((cached) => cached || Response.error()))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request)
        .then((res) => {
          if (res.ok && (url.pathname.endsWith('.js') || url.pathname.endsWith('.webmanifest'))) {
            cachePut(e.request, res);
          }
          return res;
        })
        .catch(() => Response.error());
    })
  );
});
