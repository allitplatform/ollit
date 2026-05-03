// src/components/notifications/notiCategories.js
// 알림 카테고리 7가지 (기사 + 운영자 공통)

export const NOTI_CATEGORIES = {
  NEW_ASSIGN: {
    key: "new_assign",
    label: "새 배정",         // 운영자 = "새 접수"
    color: "#FF1B8D",          // 핫핑크
    bgLight: "rgba(255,27,141,0.06)",
    bgDark:  "rgba(255,27,141,0.10)",
    iconBgLight: "rgba(255,27,141,0.15)",
    iconBgDark:  "rgba(255,27,141,0.20)",
  },
  SCHEDULE_CONFIRM: {
    key: "schedule_confirm",
    label: "일정 확정",
    color: "#FFB300",          // 노랑 (다크) / 라이트 = #B25900
    colorLight: "#B25900",
    bgLight: "rgba(255,179,0,0.06)",
    bgDark:  "rgba(255,179,0,0.10)",
    iconBgLight: "rgba(255,179,0,0.15)",
    iconBgDark:  "rgba(255,179,0,0.20)",
  },
  SCHEDULE_CHANGE: {
    key: "schedule_change",
    label: "일정 변경",
    color: "#FFB300",
    colorLight: "#B25900",
    bgLight: "rgba(255,179,0,0.06)",
    bgDark:  "rgba(255,179,0,0.10)",
    iconBgLight: "rgba(255,179,0,0.15)",
    iconBgDark:  "rgba(255,179,0,0.20)",
  },
  URGENT: {
    key: "urgent",
    label: "긴급",
    color: "#FF3D5A",          // 빨강
    bgLight: "rgba(255,61,90,0.06)",
    bgDark:  "rgba(255,61,90,0.10)",
    iconBgLight: "rgba(255,61,90,0.15)",
    iconBgDark:  "rgba(255,61,90,0.20)",
  },
  SETTLEMENT: {
    key: "settlement",
    label: "정산",
    color: "#00875A",          // 그린
    bgLight: "rgba(0,135,90,0.06)",
    bgDark:  "rgba(0,135,90,0.10)",
    iconBgLight: "rgba(0,135,90,0.15)",
    iconBgDark:  "rgba(0,135,90,0.20)",
  },
  COMPLETE: {
    key: "complete",
    label: "작업 완료",
    color: "#888888",          // 무채색 (이미 처리된 것)
    bgLight: "transparent",
    bgDark:  "transparent",
    iconBgLight: "rgba(0,0,0,0.05)",
    iconBgDark:  "rgba(255,255,255,0.05)",
  },
  OPS_MEMO: {
    key: "ops_memo",
    label: "운영팀 메모",
    color: "#888888",
    bgLight: "transparent",
    bgDark:  "transparent",
    iconBgLight: "rgba(0,0,0,0.05)",
    iconBgDark:  "rgba(255,255,255,0.05)",
  },
};
