const CACHE_NAME = 'breathing-app-v1';
const ASSETS_TO_CACHE = [
  '/Breathing/',
  '/Breathing/index.html',
  '/Breathing/styles.css',
  '/Breathing/script.js',
  '/Breathing/manifest.json',
  '/Breathing/icon-192.png',
  '/Breathing/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});