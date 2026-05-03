// V11-4 — 매일 22시 자동 알림 스케줄러
// 미입금 기사들에게 자동 알림 발송 (운영자/관리자 PWA가 열려 있을 때)
import { getUnpaidByEngineer } from "../data/dailyClose.js";
import { loadEngineers } from "../data/engineers.js";
import { loadNotificationQueue, saveNotificationQueue } from "./notificationQueue.js";

const ALERT_HOUR     = 22;
const ALERT_MINUTE   = 0;
const LAST_ALERT_KEY = "ollit_last_alert_date";

let scheduledTimerId  = null;
let visibilityHandler = null;

// 스케줄러 시작 (브라우저가 열려 있을 때 작동)
export function startDailyAlertScheduler() {
  if (scheduledTimerId) clearTimeout(scheduledTimerId);
  scheduleNext();

  // 탭 전환/포커스 복귀 시 누락 체크
  if (typeof document !== "undefined") {
    if (visibilityHandler) document.removeEventListener("visibilitychange", visibilityHandler);
    visibilityHandler = () => {
      if (!document.hidden) checkAndSendIfMissed();
    };
    document.addEventListener("visibilitychange", visibilityHandler);
  }
}

// 다음 22시까지 시간 계산해 한 번 예약
function scheduleNext() {
  const now    = new Date();
  const target = new Date(
    now.getFullYear(), now.getMonth(), now.getDate(),
    ALERT_HOUR, ALERT_MINUTE, 0
  );
  if (now > target) target.setDate(target.getDate() + 1);

  const delay = Math.max(0, target.getTime() - now.getTime());
  scheduledTimerId = setTimeout(() => {
    sendDailyAlerts();
    scheduleNext();
  }, delay);

  console.log(`[Scheduler] 다음 알림 예약: ${target.toLocaleString("ko-KR")}`);
}

// 미입금 기사들에게 알림 발송 (하루 1회)
function sendDailyAlerts() {
  const today = new Date().toISOString().split("T")[0];

  // 오늘 이미 발송했는지 확인
  const lastAlert = (typeof localStorage !== "undefined")
    ? localStorage.getItem(LAST_ALERT_KEY)
    : null;
  if (lastAlert === today) {
    console.log("[Scheduler] 오늘 이미 발송 완료");
    return { sent: 0, reason: "already_sent" };
  }

  const unpaidEngineers = getUnpaidByEngineer();
  if (unpaidEngineers.length === 0) {
    console.log("[Scheduler] 미입금 기사 없음");
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LAST_ALERT_KEY, today);
    }
    return { sent: 0, reason: "no_unpaid" };
  }

  const engineers = (() => {
    try { return loadEngineers(); } catch { return []; }
  })();
  const queue = loadNotificationQueue();
  let sentCount = 0;

  unpaidEngineers.forEach(item => {
    const engineer = engineers.find(e => e.id === item.engineerId);
    const targetId = engineer?.id || item.engineerId;
    if (!targetId) return;

    const notification = {
      id:        `unpaid_${today}_${targetId}`,
      type:      "unpaid_alert",
      target:    "engineer",
      targetId,
      title:     "오늘 입금 알림",
      body:      `₩${(item.totalAmount || 0).toLocaleString()} 입금 부탁드립니다 (${item.unpaidDays}일치)`,
      priority:  "high",
      createdAt: new Date().toISOString(),
      sentAt:    new Date().toISOString(),
      readAt:    null,
    };

    // 중복 방지 (같은 id가 이미 큐에 있으면 추가 X)
    if (!queue.find(n => n.id === notification.id)) {
      queue.push(notification);
      sentCount += 1;
    }

    // 브라우저 푸시 (권한 허용된 경우)
    if (typeof window !== "undefined" && window.Notification && window.Notification.permission === "granted") {
      try {
        new window.Notification("💰 오늘 입금 알림", {
          body: notification.body,
          tag:  notification.id,
        });
      } catch (e) {
        console.warn("[Scheduler] Notification 실패:", e);
      }
    }
  });

  saveNotificationQueue(queue);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(LAST_ALERT_KEY, today);
  }
  console.log(`[Scheduler] ${sentCount}명 알림 발송 완료`);
  return { sent: sentCount, reason: "ok" };
}

// 페이지 활성화 시 누락 체크 (PWA가 22시 정각에 닫혀 있었을 경우)
function checkAndSendIfMissed() {
  const now   = new Date();
  const today = now.toISOString().split("T")[0];
  const lastAlert = (typeof localStorage !== "undefined")
    ? localStorage.getItem(LAST_ALERT_KEY)
    : null;

  if (now.getHours() >= ALERT_HOUR && lastAlert !== today) {
    sendDailyAlerts();
  }
}

// 운영자 화면에서 직접 발송 (BulkAction 버튼)
export function sendManualAlerts() {
  // 수동 발송은 LAST_ALERT_KEY를 무시하고 바로 발송
  if (typeof localStorage !== "undefined") {
    const today = new Date().toISOString().split("T")[0];
    // 같은 날 이미 자동 발송이 있었더라도 수동은 강제로 한 번 더 발송
    // (단, 큐 내부에서 같은 id는 중복 방지)
    localStorage.removeItem(LAST_ALERT_KEY);
    const result = sendDailyAlerts();
    // 키 복원 — 자동 스케줄이 또 발송하지 않도록
    localStorage.setItem(LAST_ALERT_KEY, today);
    return result;
  }
  return sendDailyAlerts();
}

export function stopDailyAlertScheduler() {
  if (scheduledTimerId) {
    clearTimeout(scheduledTimerId);
    scheduledTimerId = null;
  }
  if (typeof document !== "undefined" && visibilityHandler) {
    document.removeEventListener("visibilitychange", visibilityHandler);
    visibilityHandler = null;
  }
}

// 외부에서 상수 노출 (테스트/디버그용)
export const SCHEDULER_INFO = {
  ALERT_HOUR, ALERT_MINUTE, LAST_ALERT_KEY,
};
