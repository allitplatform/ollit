// V14 — 알림 카테고리 (사장님 spec 7가지 + 옛 키 alias)
// 기사 + 운영자 공용. 카드 좌측 4px 바 + 컬러 박스 + 우측 점.

const NEW_ASSIGNMENT = {
  key: "new_assignment",
  label: "새 배정",
  icon: "🔔",
  barColor: "#FF1B8D",
  color: "#FF1B8D",
  colorLight: "#FF1B8D",
  iconBoxBg: { light: "#FFB8D6", dark: "#FFB8D6" },
  cardBg: { light: "#FFF5FA", dark: "#2D0F1E" },
  cardBorder: { light: "rgba(255,27,141,0.20)", dark: "rgba(255,27,141,0.20)" },
  // 옛 NotiCard 호환
  bgLight: "rgba(255,27,141,0.12)",
  bgDark:  "rgba(255,27,141,0.12)",
  iconBgLight: "rgba(255,27,141,0.18)",
  iconBgDark:  "rgba(255,27,141,0.20)",
  group: "assignment",
};

const ACCEPTANCE_PENDING = {
  key: "acceptance_pending",
  label: "수락 대기",
  icon: "⚡",
  barColor: "#FFB800",
  color: "#FFB800",
  colorLight: "#B25900",
  iconBoxBg: { light: "#FFE699", dark: "#FFE699" },
  cardBg: { light: "#FFF8EC", dark: "#2A2010" },
  cardBorder: { light: "rgba(255,184,0,0.30)", dark: "rgba(255,184,0,0.30)" },
  bgLight: "rgba(255,184,0,0.12)",
  bgDark:  "rgba(255,184,0,0.12)",
  iconBgLight: "rgba(255,184,0,0.18)",
  iconBgDark:  "rgba(255,184,0,0.20)",
  group: "assignment",
};

const TEAM_MESSAGE = {
  key: "team_message",
  label: "운영팀 메시지",
  icon: "💬",
  barColor: "#7B61FF",
  color: "#7B61FF",
  colorLight: "#5A3FE0",
  iconBoxBg: { light: "#F0EDFF", dark: "#F0EDFF" },
  cardBg: { light: "#FFFFFF", dark: "#1F1B33" },
  cardBorder: { light: "rgba(123,97,255,0.30)", dark: "rgba(123,97,255,0.30)" },
  bgLight: "rgba(123,97,255,0.10)",
  bgDark:  "rgba(123,97,255,0.12)",
  iconBgLight: "rgba(123,97,255,0.18)",
  iconBgDark:  "rgba(123,97,255,0.20)",
  group: "message",
};

const SCHEDULE_CHANGED = {
  key: "schedule_changed",
  label: "일정 변경",
  icon: "📅",
  barColor: "#888",
  color: "#888",
  colorLight: "#555",
  iconBoxBg: { light: "#F5F2ED", dark: "#16161A" },
  cardBg: { light: "#FFFFFF", dark: "#1C1C1E" },
  cardBorder: { light: "#EFE9E0", dark: "#2A2A2A" },
  bgLight: "rgba(136,136,136,0.08)",
  bgDark:  "rgba(255,255,255,0.04)",
  iconBgLight: "#F5F2ED",
  iconBgDark:  "#16161A",
  group: "schedule",
};

const WORK_CANCELED = {
  key: "work_canceled",
  label: "작업 취소",
  icon: "❌",
  barColor: "#FF3B5C",
  color: "#FF3B5C",
  colorLight: "#D62442",
  iconBoxBg: { light: "#FFE5E8", dark: "#4A1525" },
  cardBg: { light: "#FFFFFF", dark: "#1C1C1E" },
  cardBorder: { light: "#EFE9E0", dark: "#2A2A2A" },
  bgLight: "rgba(255,59,92,0.08)",
  bgDark:  "rgba(255,59,92,0.10)",
  iconBgLight: "#FFE5E8",
  iconBgDark:  "#4A1525",
  group: "schedule",
};

// V14 v7 — 입금 요청 (마감 직후 22:00 회사 송금)
const PAYMENT_REQUEST = {
  key: "payment_request",
  label: "입금 요청",
  icon: "💰",
  barColor: "#F59E0B",
  color: "#F59E0B",
  colorLight: "#B45309",
  iconBoxBg: { light: "#FEF3C7", dark: "#2D1F0F" },
  cardBg: { light: "#FFFBEB", dark: "#1C1C1E" },
  cardBorder: { light: "rgba(245,158,11,0.30)", dark: "#2A2A2A" },
  bgLight: "rgba(245,158,11,0.10)",
  bgDark:  "rgba(245,158,11,0.12)",
  iconBgLight: "#FEF3C7",
  iconBgDark:  "#2D1F0F",
  group: "payment",
};

// V14 v7 — 입금 확인 (다음날 회사 처리)
const PAYMENT_CONFIRMED = {
  key: "payment_confirmed",
  label: "입금 확인",
  icon: "✅",
  barColor: "#10B981",
  color: "#10B981",
  colorLight: "#047857",
  iconBoxBg: { light: "#D1FAE5", dark: "#0F2D20" },
  cardBg: { light: "#F0FDF4", dark: "#1C1C1E" },
  cardBorder: { light: "rgba(16,185,129,0.30)", dark: "#2A2A2A" },
  bgLight: "rgba(16,185,129,0.10)",
  bgDark:  "rgba(16,185,129,0.12)",
  iconBgLight: "#D1FAE5",
  iconBgDark:  "#0F2D20",
  group: "payment",
};

// 옛 payment_received alias = payment_confirmed (이미 처리된 입금)
const PAYMENT_RECEIVED = PAYMENT_CONFIRMED;

const PHOTO_MISSING = {
  key: "photo_missing",
  label: "사진 누락",
  icon: "📷",
  barColor: "#FF1B8D",
  color: "#FF1B8D",
  colorLight: "#FF1B8D",
  iconBoxBg: { light: "#FFB8D6", dark: "#FFB8D6" },
  cardBg: { light: "#FFFFFF", dark: "#1C1C1E" },
  cardBorder: { light: "#EFE9E0", dark: "#2A2A2A" },
  bgLight: "rgba(255,27,141,0.08)",
  bgDark:  "rgba(255,27,141,0.10)",
  iconBgLight: "#FFB8D6",
  iconBgDark:  "#FFB8D6",
  group: "message",
};

// 2026-05-16 — 작업 시작 (시나리오 4 분리, schedule_changed에서 떼냄)
const WORK_STARTED = {
  key: "work_started",
  label: "작업 시작",
  icon: "▶️",
  barColor: "#3B82F6",
  color: "#3B82F6",
  colorLight: "#1D4ED8",
  iconBoxBg: { light: "#DBEAFE", dark: "#172554" },
  cardBg: { light: "#EFF6FF", dark: "#1C1C1E" },
  cardBorder: { light: "rgba(59,130,246,0.30)", dark: "#2A2A2A" },
  bgLight: "rgba(59,130,246,0.10)",
  bgDark:  "rgba(59,130,246,0.12)",
  iconBgLight: "#DBEAFE",
  iconBgDark:  "#172554",
  group: "schedule",
};

// 2026-05-16 — 작업 완료 (시나리오 5 분리, complete=PAYMENT_CONFIRMED 의미 충돌 해소)
const WORK_COMPLETED = {
  key: "work_completed",
  label: "작업 완료",
  icon: "✅",
  barColor: "#10B981",
  color: "#10B981",
  colorLight: "#047857",
  iconBoxBg: { light: "#D1FAE5", dark: "#0F2D20" },
  cardBg: { light: "#F0FDF4", dark: "#1C1C1E" },
  cardBorder: { light: "rgba(16,185,129,0.30)", dark: "#2A2A2A" },
  bgLight: "rgba(16,185,129,0.10)",
  bgDark:  "rgba(16,185,129,0.12)",
  iconBgLight: "#D1FAE5",
  iconBgDark:  "#0F2D20",
  group: "schedule",
};

// 사장님 V14 v7 spec 7가지 (입금 분리 + 사진 alias 유지)
export const NOTI_CATEGORIES = {
  new_assignment:     NEW_ASSIGNMENT,
  acceptance_pending: ACCEPTANCE_PENDING,
  team_message:       TEAM_MESSAGE,
  schedule_changed:   SCHEDULE_CHANGED,
  work_canceled:      WORK_CANCELED,
  work_started:       WORK_STARTED,
  work_completed:     WORK_COMPLETED,
  payment_request:    PAYMENT_REQUEST,
  payment_confirmed:  PAYMENT_CONFIRMED,

  // 옛 키 alias (기존 mock 데이터 호환)
  payment_received:  PAYMENT_CONFIRMED,
  new_assign:        NEW_ASSIGNMENT,
  urgent:            ACCEPTANCE_PENDING,
  ops_memo:          TEAM_MESSAGE,
  schedule_change:   SCHEDULE_CHANGED,
  // 2026-05-16 — 의미 정정: schedule_confirm은 시작 의미, complete는 완료 의미
  schedule_confirm:  WORK_STARTED,
  settlement:        PAYMENT_CONFIRMED,
  complete:          WORK_COMPLETED,
  photo_missing:     PHOTO_MISSING,

  // UPPERCASE alias (옛 NotiCard 호환)
  NEW_ASSIGN:        NEW_ASSIGNMENT,
  NEW_ASSIGNMENT:    NEW_ASSIGNMENT,
  ACCEPTANCE_PENDING:ACCEPTANCE_PENDING,
  URGENT:            ACCEPTANCE_PENDING,
  TEAM_MESSAGE:      TEAM_MESSAGE,
  OPS_MEMO:          TEAM_MESSAGE,
  SCHEDULE_CHANGED:  SCHEDULE_CHANGED,
  SCHEDULE_CHANGE:   SCHEDULE_CHANGED,
  SCHEDULE_CONFIRM:  WORK_STARTED,
  WORK_CANCELED:     WORK_CANCELED,
  WORK_STARTED:      WORK_STARTED,
  WORK_COMPLETED:    WORK_COMPLETED,
  PAYMENT_REQUEST:   PAYMENT_REQUEST,
  PAYMENT_CONFIRMED: PAYMENT_CONFIRMED,
  PAYMENT_RECEIVED:  PAYMENT_CONFIRMED,
  SETTLEMENT:        PAYMENT_CONFIRMED,
  COMPLETE:          PAYMENT_CONFIRMED,
  PHOTO_MISSING:     PHOTO_MISSING,
};

// 카테고리 탭용 그룹 매핑 (전체/배정/일정/메시지/정산)
export function getNotiGroup(typeOrCategory) {
  const cat = NOTI_CATEGORIES[typeOrCategory];
  return cat ? cat.group : "other";
}
