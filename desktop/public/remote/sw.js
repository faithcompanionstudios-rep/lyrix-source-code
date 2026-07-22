// Basic service worker for PWA support on iOS
self.addEventListener('install', (e) => {
    // Skip waiting so the service worker activates immediately
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
    // Pass-through fetch (network only) since it's a dynamic app that relies on websockets anyway
    e.respondWith(fetch(e.request));
});
