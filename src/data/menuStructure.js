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

// 2026-06-01 R-A1 — 4탭 (옛 5탭에서 유솔정산 + 기사정산 → 단일 '정산' 으로 통합).
//   - 'assign' : 배정 작업 리스트 (메인)
//   - 'all'    : 전체 작업
//   - 'upload' : 업로드 (접수 + 정산 CSV 토글)
//   - 'settle' : 정산 — 유솔→회사 주차별 + 회사→기사 월정산 1·2차 (UsolNSettleScreen).
//     · 접근 권한: 'menu:usol_n_tracking' 단일 perm 사용
//       (옛 engineer_settlement perm 은 Phase B 에서 통합 검토).
export const USOL_N_TABS = [
  { id: "assign", label: "배정",   perm: "menu:usol_n_orders" },
  { id: "all",    label: "전체",   perm: "menu:usol_n_in_progress" },
  { id: "upload", label: "업로드", perm: "menu:usol_n_orders" },
  { id: "settle", label: "정산",   perm: "menu:usol_n_tracking" },
];
