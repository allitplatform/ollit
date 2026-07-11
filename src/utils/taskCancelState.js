// 2026-07-11 — task 실질 취소 여부 판정 (사장님 spec: 배지/목록/타임라인 일관 표시).
//
// 문제 배경:
//   · task.status='확정' 유지 + task_items 전부 is_canceled → 상태 배지는 여전히 '확정'.
//   · 사장님 관점: 전 항목 취소 = 실질 전체 취소. '취소' 로 표시되어야.
//
// 판정 우선순위:
//   [1] task.status === '취소'                    → 명시적 취소.
//   [2] task.workItems 있는데 전부 isCanceled     → 부분 취소 누적 = 실질 취소.
//   [3] task.cancelReason || task.cancelAt        → cancel 이력 있음 (옛 데이터 호환).
//   그 외 → false.

export function isEffectivelyCanceled(task) {
  if (!task) return false;
  if (task.status === "취소") return true;
  const wi = Array.isArray(task.workItems) ? task.workItems : [];
  if (wi.length > 0) {
    const live = wi.filter(w => !(w?.isCanceled ?? w?.is_canceled));
    if (live.length === 0) return true;
  }
  if (task.cancelReason || task.cancelAt) return true;
  return false;
}
