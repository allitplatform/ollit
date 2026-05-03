// V11-2-fix — 메뉴 구조 정의 (운영자/관리자 PWA)
// SettingsScreen이 이 구조를 참고해 카테고리/강조를 표시.
// V11-2-fix: 유솔 N 5개 메뉴 → 단일 항목 (네이버 초록 강조). 들어가면 5탭.
import { canAccessMenu } from "./permissions.js";

// 일반 정산 — 매일 마감 + 회사→원청
export const GENERAL_MENU = [
  { id: "settlement",           icon: "💰", label: "정산 (5원청)", sub: "매일 마감 / 미입금 알림", perm: "menu.settlement" },
  { id: "principal_settlement", icon: "🏢", label: "회사 → 원청",  sub: "5원청별 정산 내역",       perm: "menu.settlement" },
];

export function showGeneralSettlementGroup(user, hasPermission) {
  if (!user || typeof hasPermission !== "function") return false;
  return GENERAL_MENU.some(item => hasPermission(user, item.perm));
}

// V11-2-fix — 유솔 N 단일 메뉴 (네이버 초록 강조)
// 클릭 시 UsolNScreen으로 진입 → 권한 있는 5탭이 컨테이너 내부에서 노출.
export const USOL_N_ENTRY = {
  id:        "usol_n",
  icon:      "🟢",
  label:     "유솔 N",
  sub:       "네이버 결제 · 매주 월요일 정산",
  perm:      "menu:usol_n",
  color:     "#03C75A",
  highlight: true,
  badgeKey:  "usol_n_total_count",
};

// 호환용 — 이전 버전이 USOL_N_MENU 배열을 참조할 가능성 대비 (단일 항목 1개)
export const USOL_N_MENU = [USOL_N_ENTRY];

export function showUsolNEntry(user) {
  if (!user) return false;
  return canAccessMenu(user, USOL_N_ENTRY.perm);
}

// 호환 alias (V11-2 코드가 호출할 경우)
export const showUsolNGroup  = showUsolNEntry;
export const filterUsolNMenu = (user) => showUsolNEntry(user) ? [USOL_N_ENTRY] : [];

// V11-2-fix — 5탭 정의 (UsolNScreen이 import)
// 라벨 짧게: 접수 / 진행 / 매칭 / 추적 / 정산 (가로 스크롤 X / flex:1 균등)
export const USOL_N_TABS = [
  { id: "orders",              label: "접수", perm: "menu:usol_n_orders" },
  { id: "in_progress",         label: "진행", perm: "menu:usol_n_in_progress" },
  { id: "csv_match",           label: "매칭", perm: "menu:usol_n_csv_match" },
  { id: "tracking",            label: "추적", perm: "menu:usol_n_tracking" },
  { id: "engineer_settlement", label: "정산", perm: "menu:usol_n_engineer_settlement" },
];
