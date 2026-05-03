// V11-4 — 알림 큐 (localStorage)
// 운영자가 발송한 알림을 기사가 자기 화면에서 확인할 수 있도록 보관.
// Phase 2 — Supabase notifications 테이블로 이전 시 동일 인터페이스 사용.

const STORAGE_KEY    = "ollit_notifications_v1";
const MAX_QUEUE_SIZE = 100;

export function loadNotificationQueue() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveNotificationQueue(queue) {
  try {
    // 최신 100개만 보관 (오래된 것 제거)
    const trimmed = (queue || []).slice(-MAX_QUEUE_SIZE);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    return true;
  } catch (e) {
    console.error("[notificationQueue.save]", e);
    return false;
  }
}

export function pushNotification(notification) {
  if (!notification) return null;
  const queue = loadNotificationQueue();
  queue.push(notification);
  saveNotificationQueue(queue);
  return notification;
}

export function getNotificationsForEngineer(engineerId) {
  if (!engineerId) return [];
  const queue = loadNotificationQueue();
  return queue
    .filter(n => n.target === "engineer" && n.targetId === engineerId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function markNotificationAsRead(notificationId) {
  if (!notificationId) return false;
  const queue = loadNotificationQueue();
  const noti = queue.find(n => n.id === notificationId);
  if (noti) {
    noti.readAt = new Date().toISOString();
    saveNotificationQueue(queue);
    return true;
  }
  return false;
}

export function getUnreadCount(engineerId) {
  return getNotificationsForEngineer(engineerId).filter(n => !n.readAt).length;
}

export function clearOldNotifications(daysOld = 30) {
  const queue = loadNotificationQueue();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);
  const filtered = queue.filter(n => new Date(n.createdAt).getTime() > cutoff.getTime());
  saveNotificationQueue(filtered);
  return queue.length - filtered.length;
}
