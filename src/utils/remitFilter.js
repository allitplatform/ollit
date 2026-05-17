// 2026-05-17 Round 1 Fix #7/#8 — 회사 송금 대기 공통 필터 헬퍼.
// 운영자 PWA(정산 탭) + 기사 PWA(회사 송금 내역) 양쪽이 동일 규칙으로 작동해
// 건수/금액이 일치하도록 하나의 헬퍼로 통합.
//
// 사장님 spec — 자금 흐름 두 트랙:
//
//   트랙 🅐 (일일 정산, 기사 → 회사, 23:00 KST 마감):
//     · 올데이케어 (allday) / KA / KB / 용인컴퍼니 (yongin)
//     · 유솔홈케어 H (usol_h) / 크리크린 (crikrin)
//     · 유솔홈케어 N의 "냉매점검" 본작업
//
//   트랙 🅑 (월간 정산, 회사 → 기사):
//     · 유솔홈케어 N "세척" (네이버 결제 → 유솔 → 회사 → 기사)
//     · 유솔홈케어 N "추가선택" (송풍팬분해 / 실외기 / 피톤치드)
//
// usol_n 분기는 payments.calc_method 컬럼으로 식별 (compute_payment v7이 박는 값).
//   · usol_n_본작업   → 세척      → 트랙 🅑 (제외)
//   · usol_n_추가선택 → 추가 옵션  → 트랙 🅑 (제외)
//   · usol_n_냉매점검 → 냉매      → 트랙 🅐 (포함)
//
// 호출처:
//   · 운영자: AdminApp.SettlementContent — apiTasks.filter(isTrackARemittance)
//   · 기사:   EngineerApp — tasks.filter(isTrackARemittance)
//
// "미정산"(engineer_remit_confirmed_at IS NULL) 추가 좁힘은 호출처에서 별도 적용.
// 기사 PWA의 history 4상태(pending/reported/confirmed/overdue) 표시 흐름을
// 깨지 않기 위해 헬퍼는 트랙 + status 두 조건만 본다.

// 트랙 🅑로 분류되는 usol_n calc_method 집합
const USOL_N_TRACK_B_METHODS = new Set([
  "usol_n_본작업",     // 유솔N 세척
  "usol_n_추가선택",   // 유솔N 추가 옵션
]);

/**
 * 회사 송금 대기 대상(트랙 🅐) 작업인지 판별한다.
 *
 * @param {object} task - 정규화된 task 객체 (camelCase / snake_case 양쪽 호환)
 * @returns {boolean}
 */
export function isTrackARemittance(task) {
  if (!task) return false;
  if (task.status !== "완료") return false;

  const calcMethod = String(task.calc_method || task.calcMethod || "");
  if (USOL_N_TRACK_B_METHODS.has(calcMethod)) return false;

  return true;
}

// 필요 시 호출처에서 합성: 미정산만 보고 싶을 때.
export function isPendingRemit(task) {
  if (!isTrackARemittance(task)) return false;
  const confirmedAt = task.engineerRemitConfirmedAt
                   || task.engineer_remit_confirmed_at;
  return !confirmedAt;
}
