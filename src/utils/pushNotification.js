// Step 6-1 (1단계) — PWA 푸시 알림 권한 / 구독 hook
// VITE_VAPID_PUBLIC 환경 변수 필요 (Vercel + .env.local 박음 / 다음 단계 = 시트 sync)

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i);
  return out;
}

// 브라우저 푸시 지원 여부
export function isPushSupported() {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  return "serviceWorker" in navigator
      && "PushManager"   in window
      && "Notification"  in window;
}

// PWA standalone 모드 (홈 화면 추가 / 디스플레이 모드)
export function isStandalone() {
  if (typeof window === "undefined") return false;
  if (window.navigator && window.navigator.standalone === true) return true;
  if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
  return false;
}

// iOS 감지 (Safari + iOS 16.4+ 권장)
export function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
}

// 알림 권한 요청
// 응답: { ok: true } | { ok: false, reason: 'unsupported' | 'denied' }
export async function requestPushPermission() {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  if (Notification.permission === "granted") return { ok: true };
  if (Notification.permission === "denied")  return { ok: false, reason: "denied" };
  const res = await Notification.requestPermission();
  return res === "granted" ? { ok: true } : { ok: false, reason: "denied" };
}

// 푸시 구독 (Service Worker 활성 상태에서 호출)
// 반환: { ok: true, subscription: {...} } | { ok: false, reason: 'no_vapid' | 'unsupported' | 'error' }
export async function subscribePush(userId) {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  const vapidPublic = import.meta.env.VITE_VAPID_PUBLIC;
  if (!vapidPublic) return { ok: false, reason: "no_vapid" };

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublic),
      });
    }
    const subData = sub.toJSON();
    // 임시 — localStorage 저장 (다음 단계: 시트 sync)
    if (userId) {
      try {
        localStorage.setItem(`ollit_push_subscription_${userId}`, JSON.stringify(subData));
      } catch (e) { /* */ }
    }
    return { ok: true, subscription: subData };
  } catch (e) {
    return { ok: false, reason: "error", error: e?.message || String(e) };
  }
}

// 구독 해제
export async function unsubscribePush(userId) {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    if (userId) {
      try {
        localStorage.removeItem(`ollit_push_subscription_${userId}`);
      } catch (e) { /* */ }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "error", error: e?.message || String(e) };
  }
}

// 현재 구독 정보 조회 (UI 토글 등)
export async function getCurrentSubscription() {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? sub.toJSON() : null;
  } catch (e) { return null; }
}

// 권한 + 구독 한 번에 (UI 토글에서 호출)
export async function enablePush(userId) {
  const perm = await requestPushPermission();
  if (!perm.ok) return perm;
  return subscribePush(userId);
}

// ============================================================
// Step 6-2 (2-D) — Vercel API 측 sync 박은 신규 함수
// ============================================================
// 옛 subscribePush / unsubscribePush 보존 (보호) — 신규 함수는 시트 sync까지 박음

// 권한 + 구독 + Vercel API 호출 (한 번에)
// 응답: { ok: true, subscription, action } | { ok: false, reason, error }
//   reason: 'unsupported' | 'denied' | 'no_vapid' | 'sync_failed' | 'error'
export async function subscribePushWithSync({ userId, engineerId, role } = {}) {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };
  const vapidPublic = import.meta.env.VITE_VAPID_PUBLIC;
  if (!vapidPublic) return { ok: false, reason: "no_vapid" };

  // 1) 권한 요청
  const perm = await requestPushPermission();
  if (!perm.ok) return perm;

  // 2) Service Worker 측 구독
  let subData;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublic),
      });
    }
    subData = sub.toJSON();
  } catch (e) {
    return { ok: false, reason: "error", error: e?.message || "구독 실패" };
  }

  // 3) localStorage 백업 (sync 실패 catch)
  const lsKey = `ollit_push_subscription_${engineerId || userId || "anon"}`;
  try { localStorage.setItem(lsKey, JSON.stringify(subData)); } catch (e) { /* */ }

  // 4) Vercel API 호출 (/api/push/subscribe)
  try {
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId:     userId     || "",
        engineerId: engineerId || "",
        role:       role       || "",
        subscription: subData,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      }),
    });
    const json = await res.json();
    if (json && json.ok) {
      return { ok: true, subscription: subData, action: json.action || "create" };
    }
    return {
      ok: false, reason: "sync_failed",
      error: json?.error || "시트 sync 실패",
      subscription: subData, localOk: true,
    };
  } catch (e) {
    return {
      ok: false, reason: "sync_failed",
      error: e?.message || "네트워크 오류",
      subscription: subData, localOk: true,
    };
  }
}

// 구독 해제 + Vercel API 호출
// 응답: { ok: true } | { ok: false, reason, error }
export async function unsubscribePushWithSync({ userId, engineerId } = {}) {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };

  let endpoint = "";
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      endpoint = sub.endpoint;
      await sub.unsubscribe();
    }
  } catch (e) { /* unsubscribe 실패해도 Vercel 측 정리 시도 */ }

  // localStorage 정리
  const lsKey = `ollit_push_subscription_${engineerId || userId || "anon"}`;
  try { localStorage.removeItem(lsKey); } catch (e) { /* */ }

  // Vercel API DELETE 호출 (best-effort)
  if (endpoint) {
    try {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoints: [endpoint] }),
      });
    } catch (e) { /* 정리 실패는 무시 */ }
  }

  return { ok: true };
}

// 알림 권한 상태 (UI 표시용)
// 'granted' | 'denied' | 'default' | 'unsupported'
export function getPermissionState() {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission || "default";
}
