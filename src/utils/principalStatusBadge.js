// 원청 PWA — task.status → 배지 색/라벨 (PrincipalListTab / TaskDetail / UsolHScheduleTab / PrincipalApp).
// 2026-06-12 — 사장님 spec 새 색 매핑 (확정 파랑 / 완료 초록 명확 구분) → 공통 utility 로 delegate.
//   옛 switch 색 (확정 #EA580C 주황 등) 폐기. taskStatusColor.js 로 일원화.
//   호출처 시그니처 변경 X (회귀 0).

import { getTaskStatusColor, getTaskStatusLabel } from "./taskStatusColor.js";

export function getStatusBadge(status) {
  return getTaskStatusColor(status);
}

export function getStatusLabel(status) {
  return getTaskStatusLabel(status);
}
