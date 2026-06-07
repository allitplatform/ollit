// Phase 1-B 2-E ─ PWA 푸시 알림 Service Worker
// public/service-worker.js
//
// 2026-06-08 — 캐시 자동 업데이트 추가 (조용히 모드, 사장님 spec 🅑).
//   · CACHE 버전 업: ollit-push-v1 → ollit-v2 (activate 시 옛 캐시 삭제됨)
//   · fetch 핸들러 신규 추가:
//       - GET + 같은 origin 만
//       - /api/* + 외부 origin (supabase 등) bypass
//       - HTML/navigation = network-first + {cache:'reload'} (HTTP 캐시 우회)
//                           실패 시 캐시 → '/' fallback
//       - 해시 자산 /assets/...-[hash].* = cache-first (불변)
//       - 그 외 = 그냥 네트워크 (캐시 X)
//   · ★ controllerchange auto-reload 안 함 — 다음에 앱 열 때 자동 적용 (= 조용히).
//   · ★ push / notificationclick / notificationclose / IndexedDB = 한 글자도 변경 X.

const CACHE = "ollit-v2";

// 2026-05-10 — IndexedDB 직접 저장 (iOS 백그라운드 push 측 catch)
// broadcast 의존 X / SW 자체에서 박음 (PWA 비활성 상태에서 받은 push도 catch)
function openDB() {
  return new Promise((resolve, reject) => {
    const dbReq = indexedDB.open("ollit_notifications", 1);
    dbReq.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("notifications")) {
        const store = db.createObjectStore("notifications", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("read", "read", { unique: false });
      }
    };
    dbReq.onsuccess = () => resolve(dbReq.result);
    dbReq.onerror = () => reject(dbReq.error);
  });
}

async function saveToIndexedDB(data) {
  const db = await openDB();

  // 2026-05-15 fix — dedup 박기 (notificationStore A1 박은 거와 일관 spec)
  // 박은 거 같은 폰 측 endpoint 2개 박힌 경우 SW 2번 호출 박힘 → 2 row 박힘 박지 X
  const ts = data.timestamp || Date.now();
  const readTx = db.transaction("notifications", "readonly");
  const allReq = readTx.objectStore("notifications").getAll();
  const all = await new Promise((res, rej) => {
    allReq.onsuccess = () => res(allReq.result);
    allReq.onerror = () => rej(allReq.error);
  });
  const duplicate = all.some(n =>
    n.taskId === (data.taskId || null) &&
    n.title === data.title &&
    Math.abs((n.timestamp || 0) - ts) < 5000
  );
  if (duplicate) {
    console.log('[SW] saveToIndexedDB dedup 박힘:', data.title);
    return;
  }

  const tx = db.transaction("notifications", "readwrite");
  const store = tx.objectStore("notifications");
  store.add({
    title: data.title || "",
    body: data.body || "",
    url: data.url || "/",
    taskId: data.taskId || null,
    timestamp: ts,
    read: false,
  });

  // 30개 이상이면 옛 알림 자동 삭제 (기존 spec 보존)
  const allReq2 = store.getAll();
  await new Promise((res, rej) => {
    allReq2.onsuccess = () => {
      const all2 = allReq2.result;
      if (all2.length > 30) {
        all2.sort((a, b) => a.timestamp - b.timestamp);
        const toDelete = all2.slice(0, all2.length - 30);
        toDelete.forEach((item) => store.delete(item.id));
      }
      res();
    };
    allReq2.onerror = () => rej(allReq2.error);
  });
}

// 설치 즉시 활성화
self.addEventListener("install", (e) => {
  self.skipWaiting();
});

// 활성화 시 옛 캐시 정리 + 클라이언트 잡기
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    try {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n !== CACHE)
          .map((n) => caches.delete(n))
      );
    } catch (err) {}
    await self.clients.claim();
  })());
});

// ─────────────────────────────────────────────────────────────
// 2026-06-08 — fetch 핸들러 (조용히 캐시 자동 업데이트)
// 푸시 핸들러는 무관 — 본 핸들러는 GET 페이지/자산만 처리.
// ─────────────────────────────────────────────────────────────
const HASHED_ASSET_RE = /\/assets\/[^\/]+-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|png|jpg|jpeg|svg|webp|ico)$/i;
const NAVIGATION_FALLBACK = "/";

self.addEventListener("fetch", (e) => {
  const req = e.request;

  // GET 외 (POST/PUT/DELETE) — bypass
  if (req.method !== "GET") return;

  let url;
  try { url = new URL(req.url); } catch { return; }

  // 다른 origin (supabase / web-push 등) — bypass
  if (url.origin !== self.location.origin) return;

  // /api/* — 항상 네트워크 (SW 안 거침)
  if (url.pathname.startsWith("/api/")) return;

  // (a) navigation / HTML → network-first + {cache:'reload'}
  //   HTTP 캐시까지 우회 → 새 배포 즉시 반영.
  const acceptsHtml = (req.headers.get("accept") || "").includes("text/html");
  if (req.mode === "navigate" || acceptsHtml) {
    e.respondWith((async () => {
      try {
        // {cache:'reload'} 가드 — Request 생성자가 안 받는 환경(iOS 일부) 대비 try/catch.
        let netReq = req;
        try {
          netReq = new Request(req, { cache: "reload" });
        } catch {}
        const res = await fetch(netReq);
        try {
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone()).catch(() => {});
        } catch {}
        return res;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        const fallback = await caches.match(NAVIGATION_FALLBACK);
        if (fallback) return fallback;
        return new Response("offline", { status: 503, headers: { "Content-Type": "text/plain" } });
      }
    })());
    return;
  }

  // (b) 해시된 자산 → cache-first (불변)
  if (HASHED_ASSET_RE.test(url.pathname)) {
    e.respondWith((async () => {
      try {
        const cached = await caches.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        try {
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone()).catch(() => {});
        } catch {}
        return res;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        throw new Error("asset fetch failed");
      }
    })());
    return;
  }

  // (c) 그 외 (manifest, icon, 옛 파일 등) — 그냥 네트워크 (SW 캐시 안 함)
});

// 푸시 수신 → 시스템 알림 + 앱 클라이언트 broadcast
self.addEventListener("push", (e) => {
  let data = { title: "올잇", body: "새 알림", url: "/" };
  if (e.data) {
    try {
      data = { ...data, ...e.data.json() };
    } catch (err) {
      data = { ...data, body: e.data.text() };
    }
  }

  const options = {
    body:    data.body,
    icon:    data.icon  || "/icon-192.png",
    badge:   data.badge || "/icon-192.png",
    data:    data.url   || "/",
    vibrate: [100, 50, 100],
    tag:     data.tag   || "ollit-noti",
    requireInteraction: !!data.requireInteraction,
    silent:  false,
  };

  // 1. OS 알림
  const showNotiPromise = self.registration.showNotification(data.title || "올잇", options);

  // 2. 앱 클라이언트 broadcast (실시간 새로고침용)
  const broadcastPromise = self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'PUSH_RECEIVED',
        data: data
      });
    });
  }).catch(() => {});

  // 3. IndexedDB 직접 저장 (broadcast 의존 X / iOS 백그라운드 push catch)
  const saveDbPromise = saveToIndexedDB(data).catch((err) => {
    console.log("[SW] IndexedDB 저장 실패:", err);
  });

  e.waitUntil(Promise.all([showNotiPromise, broadcastPromise, saveDbPromise]));
});

// 알림 클릭 → 앱 포커스 + URL 이동
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
      } catch (err) {}
      return;
    }
    if (self.clients.openWindow) {
      await self.clients.openWindow(url);
    }
  })());
});

// 알림 닫음 (예약)
self.addEventListener("notificationclose", (e) => {
});
