// Step 8+9 — 작업 상태 데이터 (확장)
// 7개 상태 + 단계별 액션 + 취소 사유

export const TASK_STATUSES = {
  received:    { name: "접수",     emoji: "🟠", color: "#888780" },
  assigned:    { name: "배정",     emoji: "🟡", color: "#FF1B8D" },
  confirmed:   { name: "확정",     emoji: "🔵", color: "#06B6D4" },
  in_progress: { name: "진행중",   emoji: "🟢", color: "#00875A" },
  completed:   { name: "완료",     emoji: "⚪", color: "#00875A" },
  partial:     { name: "부분완료", emoji: "🔶", color: "#FF1B8D" },
  visit_only:  { name: "출장비만", emoji: "🚗", color: "#FF1B8D" },
  canceled:    { name: "취소",     emoji: "⚫", color: "#888780" },
};

export const ACTIVE_STATUSES = ["received", "assigned", "confirmed", "in_progress"];
export const FINAL_STATUSES  = ["completed", "partial", "visit_only", "canceled"];

// 단계별 가능 액션
export const STATUS_ACTIONS = {
  received:    ["assign", "cancel"],
  assigned:    ["confirm", "cancel"],
  confirmed:   ["start", "cancel"],
  in_progress: ["complete", "partial", "visit_only", "cancel"],
};

// 취소 사유
export const CANCEL_REASONS = [
  { id: "customer", label: "고객 사정으로 취소", desc: "일정 변경 / 단순 변심 등",      emoji: "🙅" },
  { id: "schedule", label: "일정 조율 실패",     desc: "기사·고객 시간이 안 맞음",      emoji: "📅" },
  { id: "onsite",   label: "현장 작업 불가",     desc: "기종 다름 / 접근 불가 등",       emoji: "⚠️" },
  { id: "other",    label: "기타",              desc: "메모에 상세 입력",               emoji: "📝" },
];

// 액션 라벨 (UI 표시용)
export const ACTION_LABELS = {
  assign:     "기사 배정",
  confirm:    "고객 확정 처리",
  start:      "작업 시작",
  complete:   "✓ 정상 완료",
  partial:    "🔶 부분 완료",
  visit_only: "🚗 출장비만 정산",
  cancel:     "⚫ 작업 취소",
};

export function getStatusInfo(status) {
  return TASK_STATUSES[status] || TASK_STATUSES.received;
}

export function getNextActions(status) {
  return STATUS_ACTIONS[status] || [];
}

export function isActiveStatus(status) {
  return ACTIVE_STATUSES.includes(status);
}

export function isFinalStatus(status) {
  return FINAL_STATUSES.includes(status);
}
