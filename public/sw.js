// public/sw.js
// 미니 service worker - network-first 캐시

const CACHE = "ollit-v1";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (e) => {
  // network-first
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // 성공 = 캐시 업데이트
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(e.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => {
        // 실패 = 캐시 fallback
        return caches.match(e.request);
      })
  );
});
