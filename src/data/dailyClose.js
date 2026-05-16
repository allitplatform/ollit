// V11-1 — 5원청 매일 마감 시스템 (유솔 N은 별도 흐름이라 제외)
// 흐름: 고객 → 기사 (현장 받음) → 기사 → 회사 (당일 마감)
import { loadTasks } from "./tasks.js";

// 매일 마감 대상 5원청
const FIVE_PRINCIPALS = ["allday", "aircon_pro", "yongin", "usol_h", "crikrin"];

export function isDailyClosePrincipal(principalId) {
  return FIVE_PRINCIPALS.includes(principalId);
}

// ── 날짜 헬퍼 ───────────────────────────────────
function isSameDay(iso, date) {
  if (!iso) return false;
  const a = new Date(iso);
  const b = date instanceof Date ? date : new Date(date);
  return a.getFullYear() === b.getFullYear()
      && a.getMonth()    === b.getMonth()
      && a.getDate()     === b.getDate();
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// ── 마감 상태 ───────────────────────────────────
const CLOSED_STATES = ["completed", "partial", "visit_only", "done"];

function pickAmountFromEngineer(t) {
  // 기사 → 회사 입금 금액 (작업 견적 - 기사 수익 = 회사가 받을 돈)
  // 시드 호환: companyReceiveFromEngineer 우선 / 없으면 estimateTotal - engineerEarning
  if (typeof t.companyReceiveFromEngineer === "number") return t.companyReceiveFromEngineer;
  const total = (t.estimateTotal || 0) + (t.addonFee || 0);
  return Math.max(0, total - (t.engineer_amount || 0));
}

// 특정 날짜의 마감 상태 (기사 → 회사)
export function getDailyCloseStatus(date, tasksArg) {
  const list = (tasksArg || loadTasks()).filter(t =>
    isSameDay(t.completedAt, date) &&
    CLOSED_STATES.includes(t.status || t.state) &&
    isDailyClosePrincipal(t.principalId)
  );

  let expected = 0;
  let received = 0;
  list.forEach(t => {
    const amt = pickAmountFromEngineer(t);
    expected += amt;
    if (t.engineerPaidAt) received += amt;
  });

  return {
    expected,
    received,
    unpaid: expected - received,
    tasks: list,
    taskCount: list.length,
  };
}

// 기사별 미입금 묶음 (오늘 + 누적)
export function getUnpaidByEngineer(tasksArg) {
  const list = (tasksArg || loadTasks()).filter(t =>
    CLOSED_STATES.includes(t.status || t.state) &&
    !t.engineerPaidAt &&
    isDailyClosePrincipal(t.principalId)
  );

  const grouped = {};
  list.forEach(t => {
    const key = t.engineerId || t.engineer || "unknown";
    if (!grouped[key]) {
      grouped[key] = {
        engineerId: t.engineerId || null,
        engineerName: t.engineer || "—",
        tasks: [],
        totalAmount: 0,
        dates: new Set(),
      };
    }
    grouped[key].tasks.push(t);
    grouped[key].totalAmount += pickAmountFromEngineer(t);
    if (t.completedAt) grouped[key].dates.add(formatDate(t.completedAt));
  });

  return Object.values(grouped).map(g => ({
    engineerId:   g.engineerId,
    engineerName: g.engineerName,
    tasks:        g.tasks,
    totalAmount:  g.totalAmount,
    unpaidDays:   g.dates.size,
    unpaidDates:  Array.from(g.dates).sort(),
  }));
}
