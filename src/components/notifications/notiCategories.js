// V14 — 알림 카테고리 7가지 (기사 + 운영자 공통)
// 카드 배경 = 카테고리 색 12% 톤 / 아이콘 박스 = 18% 톤

export const NOTI_CATEGORIES = {
  NEW_ASSIGN: {
    key: "new_assign",
    label: "새 배정",
    color: "#FF1B8D",          // 핫핑크
    bgLight: "rgba(255,27,141,0.12)",
    bgDark:  "rgba(255,27,141,0.12)",
    iconBgLight: "rgba(255,27,141,0.18)",
    iconBgDark:  "rgba(255,27,141,0.20)",
  },
  SCHEDULE_CONFIRM: {
    key: "schedule_confirm",
    label: "일정 확정",
    color: "#FFB800",          // 노랑 (V14)
    colorLight: "#B25900",     // 라이트 모드 진한 노랑/갈색
    bgLight: "rgba(255,184,0,0.12)",
    bgDark:  "rgba(255,184,0,0.12)",
    iconBgLight: "rgba(255,184,0,0.18)",
    iconBgDark:  "rgba(255,184,0,0.20)",
  },
  SCHEDULE_CHANGE: {
    key: "schedule_change",
    label: "일정 변경",
    color: "#FF8A3D",          // 주황 (V14)
    bgLight: "rgba(255,138,61,0.12)",
    bgDark:  "rgba(255,138,61,0.12)",
    iconBgLight: "rgba(255,138,61,0.18)",
    iconBgDark:  "rgba(255,138,61,0.20)",
  },
  URGENT: {
    key: "urgent",
    label: "긴급",
    color: "#FF3B5C",          // 빨강 (V14)
    bgLight: "rgba(255,59,92,0.12)",
    bgDark:  "rgba(255,59,92,0.12)",
    iconBgLight: "rgba(255,59,92,0.18)",
    iconBgDark:  "rgba(255,59,92,0.20)",
  },
  SETTLEMENT: {
    key: "settlement",
    label: "입금 확인",
    color: "#03C75A",          // 네이버 그린 (V14)
    bgLight: "rgba(3,199,90,0.12)",
    bgDark:  "rgba(3,199,90,0.12)",
    iconBgLight: "rgba(3,199,90,0.18)",
    iconBgDark:  "rgba(3,199,90,0.20)",
  },
  COMPLETE: {
    key: "complete",
    label: "작업 완료",
    color: "#03C75A",          // 그린 (완료)
    bgLight: "rgba(3,199,90,0.08)",
    bgDark:  "rgba(3,199,90,0.10)",
    iconBgLight: "rgba(3,199,90,0.15)",
    iconBgDark:  "rgba(3,199,90,0.18)",
  },
  OPS_MEMO: {
    key: "ops_memo",
    label: "운영팀 메모",
    color: "#7B61FF",          // 보라 (V14)
    bgLight: "rgba(123,97,255,0.10)",
    bgDark:  "rgba(123,97,255,0.12)",
    iconBgLight: "rgba(123,97,255,0.18)",
    iconBgDark:  "rgba(123,97,255,0.20)",
  },
};
