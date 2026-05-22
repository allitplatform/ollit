// ============================================
// taskStatus.js — task.status 측 공통 헬퍼
// 2026-05-22 — visit_only 측 "완료 계열" 일관 처리
//
// 사장님 spec:
//   · visit_only = 출장만 가서 작업 못 한 경우. 출장비 30,000원 청구.
//   · DB 측 종착 상태 (status='visit_only'). 정산 측 정상 처리됨.
//   · 화면 측 "완료의 한 종류" — 모든 완료 판정 / 합계 / 카운트 측 포함.
//
// 사용처 (이번 정정):
//   · EngineerSettleTab — "오늘 번 돈" 합계 / "완료 N건" 카운트
//   · EngineerCalendarTab — 카드 흐릿 스타일 (완료 톤)
//   · EngineerTaskDetailScreen — 완료 분기 (이미 적용)
//
// 향후 확장: 다른 완료 계열 status 추가 시 본 헬퍼 측 한 줄만 변경.
// ============================================

// 완료 계열 판정 — "완료" / "visit_only" 모두 catch
export function isCompletedStatus(status) {
  return status === "완료" || status === "visit_only";
}

// status 측 한글 라벨 매핑 (영어 키 → 한글)
// "완료" / "취소" / "확정" 등 한글 status 측 그대로 표시.
// "visit_only" 등 영어 키 측 한글 변환 필요.
export const STATUS_KO_LABEL = {
  visit_only: "출장비만",
};

// status → 표시용 라벨 (한글 변환 + 옛 한글 그대로 통과)
export function statusLabel(status) {
  if (!status) return "";
  return STATUS_KO_LABEL[status] || status;
}
