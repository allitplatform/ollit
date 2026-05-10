// 2026-05-10 — 앱 안 알림 저장소 (IndexedDB)
// service worker 가 push 받을 때 박음 / NotificationsScreen 측 읽음

const DB_NAME = "ollit_notifications";
const STORE_NAME = "notifications";
const DB_VERSION = 1;
const MAX_NOTIFICATIONS = 30;

// DB 열기
function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB 미지원"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("read", "read", { unique: false });
      }
    };
  });
}

// 알림 추가
export async function addNotification(notification) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const data = {
      title: notification.title || "",
      body: notification.body || "",
      url: notification.url || "/",
      taskId: notification.taskId || null,
      timestamp: Date.now(),
      read: false,
    };

    await new Promise((resolve, reject) => {
      const req = store.add(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    // 30개 이상이면 옛 알림 자동 삭제
    await trimOldNotifications(db);

    db.close();
    return true;
  } catch (e) {
    console.error("[notificationStore] add 실패:", e);
    return false;
  }
}

// 알림 목록 (최신순)
export async function listNotifications() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("timestamp");

    const result = await new Promise((resolve, reject) => {
      const items = [];
      const req = index.openCursor(null, "prev"); // 최신순 (역순)
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          items.push(cursor.value);
          cursor.continue();
        } else {
          resolve(items);
        }
      };
      req.onerror = () => reject(req.error);
    });

    db.close();
    return result;
  } catch (e) {
    console.error("[notificationStore] list 실패:", e);
    return [];
  }
}

// 안 읽은 알림 카운트
export async function getUnreadCount() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    const all = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    db.close();
    return all.filter(n => !n.read).length;
  } catch (e) {
    console.error("[notificationStore] unread count 실패:", e);
    return 0;
  }
}

// 알림 읽음 처리
export async function markAsRead(id) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const item = await new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (item) {
      item.read = true;
      await new Promise((resolve, reject) => {
        const req = store.put(item);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }

    db.close();
    return true;
  } catch (e) {
    console.error("[notificationStore] markAsRead 실패:", e);
    return false;
  }
}

// 모든 알림 읽음 처리
export async function markAllAsRead() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const all = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    for (const item of all) {
      if (!item.read) {
        item.read = true;
        await new Promise((resolve, reject) => {
          const req = store.put(item);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
      }
    }

    db.close();
    return true;
  } catch (e) {
    console.error("[notificationStore] markAllAsRead 실패:", e);
    return false;
  }
}

// 단일 알림 삭제
export async function deleteNotification(id) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    await new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
    return true;
  } catch (e) {
    console.error("[notificationStore] delete 실패:", e);
    return false;
  }
}

// 모든 알림 삭제
export async function clearAll() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    await new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    db.close();
    return true;
  } catch (e) {
    console.error("[notificationStore] clearAll 실패:", e);
    return false;
  }
}

// 30개 이상 박혀 있으면 옛 알림 자동 삭제 (내부)
async function trimOldNotifications(db) {
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  const all = await new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (all.length > MAX_NOTIFICATIONS) {
    // 옛 알림부터 삭제 (timestamp 오름차순)
    all.sort((a, b) => a.timestamp - b.timestamp);
    const toDelete = all.slice(0, all.length - MAX_NOTIFICATIONS);

    for (const item of toDelete) {
      await new Promise((resolve, reject) => {
        const req = store.delete(item.id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
  }
}

// 상대 시간 포맷 (방금 / 5분 전 / 어제 등)
export function formatRelativeTime(timestamp) {
  if (!timestamp) return "";
  const diff = Date.now() - timestamp;
  if (diff < 60 * 1000) return "방금";
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}분 전`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}시간 전`;
  if (diff < 2 * 24 * 60 * 60 * 1000) return "어제";
  if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / (24 * 60 * 60 * 1000))}일 전`;
  const d = new Date(timestamp);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
