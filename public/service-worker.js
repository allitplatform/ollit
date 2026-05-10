// Step 6-1 (1단계) — PWA 푸시 알림 Service Worker
// public/service-worker.js
// install / activate / push / notificationclick 핸들러 박음.
// 옛 public/sw.js (network-first 캐시) 와 별도. main.jsx 등록 경로 변경됨.

const CACHE = "ollit-push-v1";

// 설치 — 즉시 활성화 (옛 SW 대체)
self.addEventListener("install", (e) => {
  self.skipWaiting();
});

// 활성화 — 즉시 모든 클라이언트 제어 + 옛 캐시 정리
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    // 옛 sw.js의 캐시 ("ollit-v1") 정리 (충돌 방지)
    try {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n !== CACHE)
          .map((n) => caches.delete(n))
      );
    } catch (err) { /* 캐시 정리 실패는 무시 */ }
    await self.clients.claim();
  })());
});

// 푸시 메시지 수신 → 시스템 알림 표시
self.addEventListener("push", (e) => {
  let data = { title: "올잇", body: "새 알림", url: "/" };
  if (e.data) {
    try {
      data = { ...data, ...e.data.json() };
    } catch (err) {
      // text 만 박힌 경우
      data = { ...data, body: e.data.text() };
    }
  }

  const options = {
    body:    data.body,
    icon:    data.icon  || "/icon-192.png",
    badge:   data.badge || "/icon-192.png", // badge-72.png 미배포 → icon-192 fallback
    data:    data.url   || "/",
    vibrate: [100, 50, 100],
    tag:     data.tag   || "ollit-noti",
    requireInteraction: !!data.requireInteraction,
    silent:  false,
  };

  e.waitUntil(self.registration.showNotification(data.title || "올잇", options));
});

// 알림 클릭 → 앱 포커스 + 해당 URL 이동
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data || "/";
  e.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (allClients.length > 0) {
      const client = allClients[0];
      try {
        await client.focus();
        if (typeof client.navigate === "function") {
          await client.navigate(url);
        }
      } catch (err) { /* navigate 실패 시 그냥 focus만 */ }
      return;
    }
    if (self.clients.openWindow) {
      await self.clients.openWindow(url);
    }
  })());
});

// 사용자가 알림 닫음 (선택 — 통계용 가능)
self.addEventListener("notificationclose", (e) => {
  // 추후 분석 트래킹 가능
});
