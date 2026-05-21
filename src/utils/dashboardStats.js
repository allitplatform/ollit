// Step 10 — 대시보드 진짜 카운팅 헬퍼
// AdminApp의 mock 데이터로 동적 계산
// 추후 Phase 2 — Supabase 연결 시 동일 인터페이스 사용

import { filterTasksForUser, canSeeField } from "../data/permissions.js";
import { todayYmd, toKstYmd } from "./dateLabel.js";
import { isTrackARemittance } from "./remitFilter.js";

// 오늘 0시 ~ 24시
function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date();
  return d.getFullYear() === today.getFullYear()
      && d.getMonth() === today.getMonth()
      && d.getDate() === today.getDate();
}

// V14 — 한국어 status helper (시트 R열 매핑 값)
function _v14HasStatus(t, ...statuses) {
  const s = String(t.status || t.상태 || "").trim();
  return statuses.includes(s);
}

// 2026-05-21 Phase 5 Step 0.G-5-B — 메인 카운트 공유 판정 함수 (사장님 spec 확정)
//   유솔N task = "본작업(orderType='본작업') + 냉매(serviceCode='refrigerant')" 측만 메인 포함.
//   그 외 유솔N (세척 / 추가선택 / 방문비 / 현금수동 등) = 전부 제외.
//   다른 6원청 (allday / KA / KB / yongin / usol_h / crikrin) = 전부 포함.
//   적용 카드: 새 접수 / 배정 / 확정 (진행중 / 완료 = 원청 구분 없이 전부 포함)
const _isUsolNMainRefrigerant = (t) => {
  // 2026-05-21 Phase 5 Step 0.G-6-A — name fallback 추가 (옛 _isUsolNCleaning 측 동일 방식)
  //   principalCode 측 정규화 측 dropped 측 측 측 측 name 측 catch 측 spec
  const code = String(t.principalCode || t.principal_code || "").toLowerCase();
  const name = String(t.principal || t.client || t.원청 || "");
  const isUsolN = code === "usol_n" || name === "유솔홈케어 N";
  if (!isUsolN) return true;        // 유솔N 외 6원청 = 전부 포함
  // 2026-05-21 Phase 5 Step 0.G-6-C — task 레벨 boolean 측 사용 (workItems 측 측 측 X)
  //   category_data.workItems 측 serviceCode/orderType 측 측 X 측 = rowToTask 측 task_items 직접 catch
  return !!t.hasUsolNMainRefrigerant;
};

// 2026-05-21 Phase 5 Step 0.G-5-B — module-scope helper (TASK_FILTERS 측 측)
const _isScheduledTodayModule = (t) => {
  const n = t.scheduledAt || t.scheduled_at || t.확정일시 || t.confirmedAt || t.N || "";
  return !!n && toKstYmd(n) === todayYmd();
};
const _isCompletedTodayModule = (t) => {
  const c = t.completedAt || t.completed_at || t.완료시간 || "";
  return !!c && toKstYmd(c) === todayYmd();
};

// 2026-05-21 Phase 5 Step 0.G-5-B — TASK_FILTERS (메인 5카드 공유 필터)
//   5곳 통일: 상단 카드 / 작업 흐름 / 일정확정 상세 / 진행중 상세 / 완료 상세
//   _isUsolNMainRefrigerant: 유솔N 본작업 냉매만 포함 (그 외 유솔N 제외 / 6원청 전부 포함)
//   isLegacy 조건 = 미사용 (837건 전부 false라 무의미 — 사장님 결정)
export const TASK_FILTERS = {
  isUsolNMainRefrigerant: _isUsolNMainRefrigerant,
  isScheduledToday:       _isScheduledTodayModule,
  isCompletedToday:       _isCompletedTodayModule,

  newReception: (t) => _isUsolNMainRefrigerant(t) && _v14HasStatus(t, "미배정"),
  assigned:     (t) => _isUsolNMainRefrigerant(t) && _v14HasStatus(t, "배정"),
  confirmed:    (t) => _isUsolNMainRefrigerant(t) && _v14HasStatus(t, "확정"),
  inProgress:   (t) => _isScheduledTodayModule(t) && _v14HasStatus(t, "작업중", "진행중"),
  completed:    (t) => _isScheduledTodayModule(t) && _isCompletedTodayModule(t) && _v14HasStatus(t, "완료", "정산완료"),
};

// V14 메인 통계 계산 (apiTasks 진짜 시트 데이터 사용 / 시뮬 mock 폐기)
// 입력: { apiTasks, extraReceptions, user, tasksToday, newReceptions, assignedTasks (옛 호환) }
export function computeDashboardStats({
  tasksToday = [],
  newReceptions = { "세척": [], "냉매충전": [] },
  extraReceptions = [],
  apiTasks = [],     // V14 2A — 진짜 시트 작업DB
  assignedTasks = [],
  user,
} = {}) {
  // V14 — 진짜 데이터 = apiTasks + 옛 호환 (NEW_RECEPTIONS / extraReceptions / 중복 제거)
  const allTasks = [
    ...(apiTasks || []),                 // V14 — 진짜 시트 (우선)
    ...(newReceptions["세척"] || []),
    ...(newReceptions["냉매충전"] || []),
    ...(extraReceptions || []),
  ];
  const seenIds = new Set();
  const uniqueTasks = allTasks.filter(r => {
    if (!r.id || seenIds.has(r.id)) return false;
    seenIds.add(r.id);
    return true;
  });

  // 2026-05-11 명세 — 카운트 영역 통일 (B열/N열 기준 / 단계별 분리)
  //   2026-05-15 사장님 spec 수정:
  //   새접수    = 전체 + 미배정 (시간 필터 X — 처리 대기열)
  //   배정완료  = 전체 + 배정   (시간 필터 X — 처리 대기열)
  //   일정확정  = N열(확정일) 오늘 + 확정 (서비스 일자=오늘)
  //   진행중    = N열(확정일) 오늘 + 진행중
  //   완료      = N열 오늘 + 완료
  const todayStr = todayYmd();
  // 2026-05-17 — UTC ISO 문자열 .startsWith(todayStr) 미사용 (KST 새벽 작업이 전날 UTC로 잡힘).
  // toKstYmd가 KST 로컬 날짜로 정규화 후 비교 → 시간대 mismatch 해결.
  const isCreatedToday = (t) => {
    // 2026-05-19 Phase 5 Step 0.C-11 — created_at (snake_case) 추가 (NewReceptionScreen 측 spec 일치)
    const b = t.createdAt || t.created_at || t.receivedAt || t.received_at || t.접수일시 || t.B || "";
    if (b && toKstYmd(b) === todayStr) return true;
    const idStr = String(t.id || t.taskId || t.작업번호 || "");
    const m = idStr.match(/(\d{6})-/);
    if (m) {
      const taskDate = `20${m[1].slice(0,2)}-${m[1].slice(2,4)}-${m[1].slice(4,6)}`;
      if (taskDate === todayStr) return true;
    }
    return false;
  };
  const isScheduledToday = (t) => {
    const n = t.scheduledAt || t.scheduled_at || t.확정일시 || t.confirmedAt || t.N || "";
    return !!n && toKstYmd(n) === todayStr;
  };

  // 2026-05-19 Phase 5 Step 0.C-6 — 사장님 spec 측 오늘 기준 필터 강화:
  //   신규 접수 = DATE(created_at KST) = today + 미배정 (옛: 미배정 전체 / 시간 필터 X)
  //   진행중   = DATE(scheduled_at KST) = today + 진행중 (옛 그대로)
  //   완료     = DATE(completed_at KST) = today + 완료 (옛: scheduled_at 기준 → completed_at 측)
  // 배정 / 확정 = 옛 spec 유지 (작업 흐름 5단계 시각화 측)
  //
  // 2026-05-21 Phase 5 Step 0.G-5-B — 메인 카운트 spec 통일 (사장님 확정)
  //   새 접수 / 배정 / 확정 = _isUsolNMainRefrigerant + status 매칭 (날짜 필터 X)
  //     → 유솔N 외 6원청 = 전부 포함
  //     → 유솔N = 본작업(orderType='본작업') + 냉매(serviceCode='refrigerant')만 포함, 그 외 유솔N 전부 제외
  //   진행중 / 완료 = isScheduledToday + 해당 status (원청 구분 없이 전부 포함)
  //   is_legacy 조건 = 미사용 (837건 전부 false라 무의미)
  //   TASK_FILTERS 측 5곳(상단 카드 / 작업 흐름 / 일정확정 상세 / 진행중 상세 / 완료 상세) 통일.
  const isCompletedTodayLocal = (t) => {
    const c = t.completedAt || t.completed_at || t.완료시간 || "";
    return !!c && toKstYmd(c) === todayStr;
  };
  const newReceptionTasks = uniqueTasks.filter(TASK_FILTERS.newReception);
  const assignedTasksList = uniqueTasks.filter(TASK_FILTERS.assigned);
  const confirmedTasks    = uniqueTasks.filter(TASK_FILTERS.confirmed);
  const inProgressTasks   = uniqueTasks.filter(TASK_FILTERS.inProgress);
  const completedTasks    = uniqueTasks.filter(TASK_FILTERS.completed);

  const newCount        = newReceptionTasks.length;
  const assignedCount   = assignedTasksList.length;
  const confirmedCount  = confirmedTasks.length;
  const inProgressCount = inProgressTasks.length;
  const completedCount  = completedTasks.length;

  // V14 매출 — 오늘 완료 + 트랙 🅐 작업의 합 (Asia/Seoul today)
  // 2026-05-17 Round 1 마무리 — 사장님 spec 확정 🅑:
  //   4개 카드(매출/마진/정산/수수료) 모두 같은 dataset 기준으로 합산.
  //   dataset = { completedAt 오늘, status='완료', isTrackARemittance() = true }
  //   미정산 필터는 적용 X — 정산 끝나도 매출은 그대로 (일반적 매출 의미).
  //   completedAt 비어있으면 보수적으로 제외.
  //   상태 카드 "완료" count(completedCount)는 별개 의미라 위 completedTasks 그대로 유지.
  const today = todayYmd();
  let revenue = null;
  if (canSeeField(user, "task.total_amount")) {
    const revenueBaseTasks = uniqueTasks.filter(t => {
      // 매출 측 = isTrackARemittance (트랙 🅐 / 일일정산) — 트랙 🅑 (유솔N 세척) 측 별도 spec
      //   사장님 spec — 5카운트 spec 측 변경 — 매출 측 변경 X
      if (!isTrackARemittance(t)) return false;
      const completed = t.completedAt || t.completed_at || t.completedDate || t.완료시간 || t.completedTime;
      if (!completed) return false;
      return toKstYmd(completed) === today;
    });
    const total = revenueBaseTasks.reduce((s, t) =>
      s + Number(t.totalAmount || t.총금액 || t.estimateTotal || 0), 0
    );
    const principal = revenueBaseTasks.reduce((s, t) => s + Number(t.principal_amount || 0), 0);
    const engineer  = revenueBaseTasks.reduce((s, t) => s + Number(t.engineer_amount || 0), 0);
    revenue = { total, principal, engineer };

    if (canSeeField(user, "task.company_margin")) {
      revenue.margin = revenueBaseTasks.reduce((s, t) => s + Number(t.owner_amount || 0), 0);
    }
  }

  // V14 긴급 (당일/긴급 키워드 있는 새 접수)
  const urgentTasks = newReceptionTasks.filter(t => {
    const note = String(t.requestNote || t.요청사항 || t.memo || t.비고 || "");
    return /긴급|당일|급함|asap/i.test(note);
  });

  // 옛 호환 (unassigned)
  const unassigned = newReceptionTasks.filter(r => !r.autoAssignStatus || r.autoAssignStatus === "pushing");

  return {
    new: newCount,
    assigned: assignedCount,
    confirmed: confirmedCount,
    inProgress: inProgressCount,
    completed: completedCount,
    revenue,
    completedTasks,
    newReceptionTasks,        // V14 — workType 분류용 (OverviewTab 측 사용)
    confirmedTasks,
    inProgressTasks,
    urgentTasks,              // V14 — 긴급 (이지은 시뮬 폐기)
    urgentCount: urgentTasks.length,
    unassigned,
    unassignedCount: unassigned.length,
  };
}

// 기사 전용 통계 (자기 작업만)
export function computeEngineerStats({ tasksToday = [], user } = {}) {
  if (!user || user.role !== "engineer") return null;
  const myTasks = filterTasksForUser(tasksToday, user);

  const scheduled  = myTasks.filter(t => t.state === "scheduled" || t.state === "waiting").length;
  const inProgress = myTasks.filter(t => t.state === "active" || t.state === "moving").length;
  const completed  = myTasks.filter(t => t.state === "done").length;

  // 다음 작업 (가까운 시간순 — 진행/대기 중)
  const upcoming = myTasks
    .filter(t => ["waiting", "scheduled", "moving", "active"].includes(t.state))
    .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
  const nextTask = upcoming[0] || null;

  // 오늘 수익
  const todayEarning = myTasks
    .filter(t => t.state === "done")
    .reduce((s, t) => s + (t.engineer_amount || 0), 0);

  return { scheduled, inProgress, completed, todayEarning, nextTask };
}

// 원청 전용 (자기 원청 작업만)
export function computePrincipalStats({ tasksToday = [], user } = {}) {
  if (!user || user.role !== "principal") return null;
  const ourTasks = filterTasksForUser(tasksToday, user);

  const inProgress = ourTasks.filter(t => t.state === "active" || t.state === "moving").length;
  const completed  = ourTasks.filter(t => t.state === "done").length;
  const scheduled  = ourTasks.filter(t => t.state === "scheduled" || t.state === "waiting").length;

  // 우리 수수료 (이번달 — mock에서는 오늘 분량만)
  let ourFee = 0;
  if (canSeeField(user, "task.principal_fee")) {
    ourFee = ourTasks
      .filter(t => t.state === "done")
      .reduce((s, t) => s + (t.principal_amount || 0), 0);
  }

  return { scheduled, inProgress, completed, ourFee, ourTasks };
}

// V14 긴급 작업 (apiTasks 우선 / 옛 호환)
export function getUrgentTasks({ extraReceptions = [], newReceptions = {}, apiTasks = [] }) {
  const allReceptions = [
    ...(apiTasks || []),                  // V14 — 진짜 시트 (우선)
    ...(newReceptions["세척"] || []),
    ...(newReceptions["냉매충전"] || []),
    ...(extraReceptions || []),
  ];
  // 미배정 + 오늘 / 당일 / 긴급 키워드
  return allReceptions.filter(r => {
    if (r.autoAssignStatus === "accepted") return false;
    // V14 status 값 추출
    const status = String(r.status || r.상태 || "").trim();
    const isPending = !status
      || status === "미배정"
      || r.assignedEngineer === ""
      || !r.assignedEngineer;
    if (!isPending) return false;
    // 긴급 / 당일 / 오늘 키워드 (schedule / requestNote / memo)
    const sched = String(r.schedule || "").toLowerCase();
    const note  = String(r.requestNote || r.요청사항 || r.memo || r.비고 || "");
    return sched.includes("오늘") || sched.includes("당일") || sched.includes("긴급")
      || /긴급|당일|급함|asap/i.test(note);
  });
}

export { isToday };
