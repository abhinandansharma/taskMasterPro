/* TaskMaster Pro service worker: the app opens offline and installs as a PWA.
   Online, everything is fetched from the network first so a new deploy is never masked by the cache;
   versioned assets (?v=N) and font files are served from the cache once seen. */
const CACHE = 'taskmaster-v1';
const PRECACHE = ['./', './index.html', './manifest.webmanifest', './assets/JS/lib/jquery-3.5.1.min.js', './assets/fonts/GeistPixel-Square.woff2'];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const isFont = (url) => url.hostname === 'fonts.gstatic.com' || /\.woff2?$/.test(url.pathname);
const isVersioned = (url) => url.origin === self.location.origin && url.searchParams.has('v');

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') { const cache = await caches.open(CACHE); cache.put(request, response.clone()); }
    return response;
}

async function networkFirst(request, fallback) {
    try {
        const response = await fetch(request);
        if (response.ok || response.type === 'opaque') { const cache = await caches.open(CACHE); cache.put(request, response.clone()); }
        return response;
    } catch (_) {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (fallback) { const f = await caches.match(fallback); if (f) return f; }
        throw _;
    }
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (request.mode === 'navigate') { event.respondWith(networkFirst(request, './index.html')); return; }
    if (isFont(url) || isVersioned(url)) { event.respondWith(cacheFirst(request)); return; }
    if (url.origin === self.location.origin || url.hostname === 'fonts.googleapis.com') { event.respondWith(networkFirst(request)); }
});
