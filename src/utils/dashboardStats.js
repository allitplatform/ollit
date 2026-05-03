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

// 메인 통계 계산 (AdminApp mock 데이터 기반)
// 입력: { tasksToday, newReceptions, extraReceptions, assignedTasks, user }
export function computeDashboardStats({
  tasksToday = [],
  newReceptions = { "세척": [], "냉매충전": [] },
  extraReceptions = [],
  assignedTasks = [],
  user,
} = {}) {
  // 1. 새 접수 (NEW_RECEPTIONS + extraReceptions / 중복 제거)
  const allReceptions = [
    ...(newReceptions["세척"] || []),
    ...(newReceptions["냉매충전"] || []),
    ...(extraReceptions || []),
  ];
  const seenIds = new Set();
  const uniqueReceptions = allReceptions.filter(r => {
    if (seenIds.has(r.id)) return false;
    seenIds.add(r.id);
    return true;
  });
  const newCount = uniqueReceptions.length;

  // 2. 배정 / 확정 (ASSIGNED_TASKS 기반)
  const assignedCount = (assignedTasks || []).filter(a =>
    a.assignType === "assigned" || a.state === "waiting"
  ).length;
  const confirmedCount = (assignedTasks || []).filter(a =>
    a.assignType === "confirmed" || ["scheduled", "moving", "active"].includes(a.state)
  ).length;

  // 3. 진행중 / 완료 / 부분완료 / 출장비만 / 취소 (TASKS_TODAY 기반)
  const workTasks = (tasksToday || []).filter(t => t.type === "work");
  const inProgressCount = workTasks.filter(t => t.state === "active" || t.state === "moving").length;
  const completedTasks   = workTasks.filter(t => t.state === "done");
  const completedCount   = completedTasks.length;

  // 4. 매출 (완료된 작업만 — 권한 체크)
  let revenue = null;
  if (canSeeField(user, "task.total_amount")) {
    const total      = completedTasks.reduce((s, t) => s + ((t.estimateTotal || 0) + (t.addonFee || 0)), 0);
    const principal  = completedTasks.reduce((s, t) => s + (t.principalFee || 0), 0);
    const engineer   = completedTasks.reduce((s, t) => s + (t.engineerEarning || 0), 0);
    revenue = { total, principal, engineer };

    if (canSeeField(user, "task.company_margin")) {
      revenue.margin = completedTasks.reduce((s, t) => s + (t.companyMargin || 0), 0);
    }

    // 가짜 단가 — 운영자만 노출
    if (canSeeField(user, "task.fake_engineer_rate")) {
      revenue.fakeEngineerTotal = completedTasks
        .filter(t => t.principal === "에어컨프로")
        .reduce((s, t) => s + (t.fakeEngineerRate || 0), 0);
    }
  }

  // 5. 미배정 (긴급 후보)
  const unassigned = uniqueReceptions.filter(r => !r.autoAssignStatus || r.autoAssignStatus === "pushing");

  return {
    new: newCount,
    assigned: assignedCount,
    confirmed: confirmedCount,
    inProgress: inProgressCount,
    completed: completedCount,
    revenue,
    completedTasks,
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

// 긴급 작업 (당일 / 미배정 기준)
export function getUrgentTasks({ extraReceptions = [], newReceptions = {} }) {
  const allReceptions = [
    ...(newReceptions["세척"] || []),
    ...(newReceptions["냉매충전"] || []),
    ...(extraReceptions || []),
  ];
  // 미배정 + 오늘/긴급 일정
  return allReceptions.filter(r => {
    if (r.autoAssignStatus === "accepted") return false;
    const sched = (r.schedule || "").toLowerCase();
    return sched.includes("오늘") || sched.includes("당일") || sched.includes("긴급");
  });
}

export { isToday };
