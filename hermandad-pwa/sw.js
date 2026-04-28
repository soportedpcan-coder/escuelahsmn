// ============================================================
// SERVICE WORKER — Hermandad del Señor de los Milagros
// Versión: 2.0 PWA
// ============================================================

const CACHE_NAME = 'snm-asistencia-v2';
const CACHE_STATIC = 'snm-static-v2';

// Recursos a cachear para funcionamiento offline
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  // CDN externos — se cachean en primera visita
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Lato:wght@300;400;700&display=swap'
];

// ── INSTALL: cachear todos los recursos estáticos ──
self.addEventListener('install', event => {
  console.log('[SW] Instalando Service Worker v2...');
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => {
      console.log('[SW] Cacheando assets estáticos');
      // Cachear assets locales (críticos)
      return cache.addAll(['./', './index.html', './manifest.json'])
        .then(() => {
          // Intentar cachear CDN (no crítico si falla)
          const cdnAssets = [
            'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
            'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
          ];
          return Promise.allSettled(
            cdnAssets.map(url => 
              fetch(url).then(res => cache.put(url, res)).catch(() => {})
            )
          );
        });
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpiar caches viejos ──
self.addEventListener('activate', event => {
  console.log('[SW] Activando Service Worker v2...');
  event.waitUntil(
    caches.keys().then(keys => 
      Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_NAME)
          .map(k => { console.log('[SW] Eliminando cache viejo:', k); return caches.delete(k); })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: estrategia Cache First + Network Fallback ──
self.addEventListener('fetch', event => {
  // Solo interceptar GET
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Para fuentes de Google: Network first (con fallback a cache)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_STATIC).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Para CDN scripts: Cache first
  if (url.hostname === 'unpkg.com' || url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_STATIC).then(c => c.put(event.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // Para recursos locales: Cache first con network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_STATIC).then(c => c.put(event.request, clone));
        }
        return res;
      }).catch(() => {
        // Fallback: retornar index.html para navegación
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ── MENSAJE: forzar actualización ──
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
