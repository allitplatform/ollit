// Step 10 — 대시보드 진짜 카운팅 헬퍼
// AdminApp의 mock 데이터로 동적 계산
// 추후 Phase 2 — Supabase 연결 시 동일 인터페이스 사용

import { filterTasksForUser, canSeeField } from "../data/permissions.js";

// 오늘 0시 ~ 24시
function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date();
  return d.getFullYear() === today.getFullYear()
      && d.getMonth() === today.getMonth()
      && d.getDate() === today.getDate();
}

// V14 — 한국어 status helper (시트 R열 박힌 값)
function _v14HasStatus(t, ...statuses) {
  const s = String(t.status || t.상태 || "").trim();
  return statuses.includes(s);
}

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
  //   새접수    = B열(접수일) 오늘 + 미배정/약속대기
  //   배정완료  = B열 오늘 + 배정
  //   일정확정  = B열 오늘 + 확정
  //   진행중    = N열(확정일) 오늘 + 진행중
  //   완료      = N열 오늘 + 완료
  const todayStr = new Date().toISOString().slice(0, 10);
  const isCreatedToday = (t) => {
    const b = String(t.createdAt || t.receivedAt || t.접수일시 || t.B || "");
    if (b.startsWith(todayStr)) return true;
    const idStr = String(t.id || t.taskId || t.작업번호 || "");
    const m = idStr.match(/(\d{6})-/);
    if (m) {
      const taskDate = `20${m[1].slice(0,2)}-${m[1].slice(2,4)}-${m[1].slice(4,6)}`;
      if (taskDate === todayStr) return true;
    }
    return false;
  };
  const isScheduledToday = (t) => {
    const n = String(t.scheduledAt || t.확정일시 || t.confirmedAt || t.N || "");
    return n.startsWith(todayStr);
  };

  const newReceptionTasks = uniqueTasks.filter(t => isCreatedToday(t) && _v14HasStatus(t, "미배정", "약속대기"));
  const assignedTasksList = uniqueTasks.filter(t => isCreatedToday(t) && _v14HasStatus(t, "배정"));
  const confirmedTasks    = uniqueTasks.filter(t => isCreatedToday(t) && _v14HasStatus(t, "확정"));
  const inProgressTasks   = uniqueTasks.filter(t => isScheduledToday(t) && _v14HasStatus(t, "작업중", "진행중"));
  const completedTasks    = uniqueTasks.filter(t => isScheduledToday(t) && _v14HasStatus(t, "완료", "정산완료"));

  const newCount        = newReceptionTasks.length;
  const assignedCount   = assignedTasksList.length;
  const confirmedCount  = confirmedTasks.length;
  const inProgressCount = inProgressTasks.length;
  const completedCount  = completedTasks.length;

  // V14 매출 — 오늘 완료된 작업의 총금액 합 (Z 총금액 / Asia/Seoul today)
  const today = new Date().toISOString().slice(0, 10);
  let revenue = null;
  if (canSeeField(user, "task.total_amount")) {
    const todayCompletedTasks = completedTasks.filter(t => {
      const completed = t.completedAt || t.completedDate || t.완료시간 || t.completedTime;
      if (!completed) return false;
      return String(completed).slice(0, 10) === today;
    });
    const total = todayCompletedTasks.reduce((s, t) =>
      s + Number(t.totalAmount || t.총금액 || t.estimateTotal || 0), 0
    );
    const principal = todayCompletedTasks.reduce((s, t) => s + Number(t.principalFee || 0), 0);
    const engineer  = todayCompletedTasks.reduce((s, t) => s + Number(t.engineerEarning || 0), 0);
    revenue = { total, principal, engineer };

    if (canSeeField(user, "task.company_margin")) {
      revenue.margin = todayCompletedTasks.reduce((s, t) => s + Number(t.companyMargin || 0), 0);
    }
  }

  // V14 긴급 (당일/긴급 키워드 박힌 새 접수)
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
    newReceptionTasks,        // V14 — workType 분류용 (OverviewTab 박힘)
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
    .reduce((s, t) => s + (t.engineerEarning || 0), 0);

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
      .reduce((s, t) => s + (t.principalFee || 0), 0);
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
  // 미배정 / 약속대기 + 오늘 / 당일 / 긴급 키워드
  return allReceptions.filter(r => {
    if (r.autoAssignStatus === "accepted") return false;
    // V14 status 값 추출
    const status = String(r.status || r.상태 || "").trim();
    const isPending = !status
      || status === "미배정"
      || status === "약속대기"
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
