const CACHE = 'ubvcc-panos-v1';

// Cache panorama images from Supabase storage
const isPanorama = (url) =>
  url.includes('supabase') && (url.includes('/object/public/') || url.includes('/storage/'));

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Clean up old caches
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (!isPanorama(e.request.url)) return; // only intercept panorama images

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request);
      if (cached) return cached; // serve instantly from cache

      try {
        const fresh = await fetch(e.request);
        if (fresh.ok) cache.put(e.request, fresh.clone()); // save for offline
        return fresh;
      } catch {
        return cached || new Response('Offline', { status: 503 });
      }
    })
  );
});