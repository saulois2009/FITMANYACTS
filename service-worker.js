// service-worker.js - Estrategia: RED PRIMERO, caché solo como respaldo offline
// Así, cada vez que haces deploy, los usuarios ven los cambios en el siguiente
// refresh/apertura de la app sin tener que borrar caché manualmente.

const CACHE_NAME = 'v42'; // Subir este número fuerza limpieza total del caché en todos los dispositivos
const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/storage.js',
    '/game.js',
    '/manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache).catch(err => console.log('Error al cachear archivos:', err)))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames =>
            Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
                })
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                if (!response || response.status !== 200 || response.type === 'error') {
                    return response;
                }
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
                return response;
            })
            .catch(() => {
                return caches.match(event.request).then(cached => cached || caches.match('/index.html'));
            })
    );
});
