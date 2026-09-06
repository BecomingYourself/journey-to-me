/* The Journey to Me — offline cache for the 3D journal.

   This is what makes it installable: with everything cached, the book opens
   from a home screen with no internet at all. No domain and no hosting
   required beyond the page it already sits on.

   Bump CACHE when anything in ASSETS changes, or installed copies keep serving
   the old files for ever.

   The root sw.js deliberately ignores /3d/, so the two never fight over the
   same requests. */

const CACHE = 'journey-to-me-3d-v2';

/* addAll() is all-or-nothing: one 404 in this list and NOTHING is cached, and
   the app silently stops being installable. Every path here is checked. */
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './scene.js',
  './pages.js',
  './cloud.js',
  './config.js',
  '../content.js',

  './lib/three.module.js',
  './lib/controls/OrbitControls.js',
  './lib/postprocessing/EffectComposer.js',
  './lib/postprocessing/MaskPass.js',
  './lib/postprocessing/OutputPass.js',
  './lib/postprocessing/Pass.js',
  './lib/postprocessing/RenderPass.js',
  './lib/postprocessing/ShaderPass.js',
  './lib/postprocessing/UnrealBloomPass.js',
  './lib/shaders/CopyShader.js',
  './lib/shaders/LuminosityHighPassShader.js',
  './lib/shaders/OutputShader.js',

  './assets/caveat.woff2',
  './assets/wood.webp',
  './assets/wood_n.webp',
  './assets/wood_r.webp',
  './assets/leather_n.webp',
  './assets/leather_r.webp',
  './assets/petal_n.webp',
  './assets/petal1.webp',
  './assets/petal2.webp',
  './assets/petal3.webp',
  './assets/petal4.webp',
  './assets/petal5.webp',
  './assets/petal6.webp',

  '../assets/cover.webp',
  '../assets/paper.webp',
  '../assets/sky.webp',
  '../assets/clouds-far.webp',
  '../assets/clouds-near.webp',
  '../assets/clouds-sea.webp',
  '../assets/icon-180.png',
  '../assets/icon-192.png',
  '../assets/icon-512.png',
  '../assets/icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* Never touch the account service. Those requests must reach the network or
     fail honestly — a cached sign-in answer would be worse than no answer. */
  if (url.origin !== location.origin) return;

  /* The page itself comes from the network first, falling back to the cache
     only when there is none. Cache-first HTML is how a fix fails to reach
     somebody who has already visited. */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' })).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  /* The journal's OWN code goes to the network first.

     It did not, and that cost the client a whole round of review: cache-first
     with a quiet background refresh means a change never appears on the visit
     you make after it ships — only on the one after THAT. She reviewed a build
     two versions old and reported a fix as not working, which it was. For
     anything I edit, correctness of what she sees beats saving a few kilobytes.

     The heavy things — textures, fonts, the three.js bundle — do stay
     cache-first. They are what makes it work with no internet, they are large,
     and they almost never change. */
  const codeish = /\.(?:js|mjs|css|html|json|webmanifest)$/i.test(url.pathname) &&
                  !url.pathname.includes('/lib/');

  if (codeish) {
    e.respondWith(
      /* `cache: 'no-cache'` is doing real work here, not belt-and-braces.
         Going to the network is not enough on its own: the browser's own HTTP
         cache sits in front of the service worker's fetch, and it had already
         stored these files while the install step was priming. Without this the
         worker faithfully asks for a fresh copy and is handed the stale one —
         which is exactly what my first attempt at this fix did. It forces a
         revalidation, so a 304 still costs nothing when nothing changed. */
      fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' })).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req))     // offline: whatever we last saw
    );
    return;
  }

  // Everything else: serve from the cache, refresh quietly behind it.
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
