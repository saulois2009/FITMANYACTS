// service-worker.js - Service Worker para funcionamiento offline

const CACHE_NAME = 'fitmanyacts-v3';
const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/storage.js',
    '/game.js',
    '/manifest.json'
];

// Instalación del Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache)
                    .catch(err => {
                        console.log('Error al cachear archivos:', err);
                    });
            })
    );
    self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Estrategia de caché: primero caché, luego red
self.addEventListener('fetch', event => {
    // Solo cachear GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Retornar desde caché si existe
                if (response) {
                    return response;
                }

                // Intentar obtener de la red
                return fetch(event.request)
                    .then(response => {
                        // No cachear respuestas que no son válidas
                        if (!response || response.status !== 200 || response.type === 'error') {
                            return response;
                        }

                        // Clonar la respuesta
                        const responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch(() => {
                        // Retornar página de caché como fallback si está disponible
                        return caches.match('/index.html');
                    });
            })
    );
});
