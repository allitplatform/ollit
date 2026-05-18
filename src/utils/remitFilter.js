// 2026-05-18 Fix #29 — payments.track 기반으로 정정.
// Migration 031 (payments.track 컬럼) + Migration 032 (compute_payment v10) 적용 후 동작.
//
// 사장님 spec (2026-05-18 확정) — 자금 흐름 두 트랙:
//
//   트랙 🅐 (일일정산, 기사 → 회사, 23:00 KST 마감):
//     · 6개 원청: allday / KA / KB / yongin / usol_h / crikrin
//     · usol_n 냉매 (네이버 1만원 100% 유솔, 현장 추가금만 기사→회사 50:50)
//
//   트랙 🅑 (월정산, 회사 → 기사, 매월 15일):
//     · usol_n 세척 (cleaning)
//     · usol_n 추가선택 (송풍팬분해/층고, 피톤치드, 실외기 등 — 별도 SKU)
//
// 분류는 compute_payment v10이 INSERT 시 자동 결정 → payments.track 컬럼에 저장.
//   · principal_code = 'usol_n' AND task에 refrigerant 외 service_code 존재 → 'B'
//   · 그 외                                                                  → 'A'
//
// task 정규화 시점에 payment.track을 task.track으로 inline (3곳 매핑: tasksDb.rowToTask /
// v14Task.v14NormalizeTask / AdminApp._v14NormalizeTask). 정규화 누락 시 fallback 'A'.
//
// 호출처:
//   · 운영자: AdminApp.SettlementContent — apiTasks.filter(isTrackARemittance)
//   · 기사:   EngineerApp — tasks.filter(isTrackARemittance)
//   · 통계:   dashboardStats — 동일
//
// "미정산"(engineer_remit_confirmed_at IS NULL) 추가 좁힘은 호출처에서 별도 적용.
// 기사 PWA의 history 4상태(pending/reported/confirmed/overdue) 표시 흐름을
// 깨지 않기 위해 헬퍼는 트랙 + status 두 조건만 본다.
//
// ──────────────────────────────────────────────
// 이전 v1 (calc_method 기반) 폐기 사유:
//   USOL_N_TRACK_B_METHODS = ['usol_n_본작업', 'usol_n_추가선택']로 분류했으나
//   이 calc_method 값들은 DB에 한 번도 저장된 적 없음. 실제 calc_method 값:
//   직영_0 / 직영_50_50 / 비율_견적금액 / 비율_총금액 / 비율_판매가 / 정액
//   → 모든 usol_n 작업이 트랙 🅐로 잘못 분류됐을 위험. usol_n 0건이라 운영 영향 없음.
//   v2 (현재) — payments.track 컬럼 단일 진실 소스로 일원화.
// ──────────────────────────────────────────────

/**
 * 회사 송금 대기 대상(트랙 🅐) 작업인지 판별한다.
 *
 * @param {object} task - 정규화된 task 객체 (camelCase / snake_case 양쪽 호환)
 * @returns {boolean}
 */
export function isTrackARemittance(task) {
  if (!task) return false;
  if (task.status !== "완료") return false;

  // task.track 우선, snake/camel 백업, 최종 fallback 'A' (정규화 매핑 누락 시 안전망).
  const track = task.track || task.payment_track || task.paymentTrack || "A";
  return track === "A";
}

// 필요 시 호출처에서 합성: 미정산만 보고 싶을 때.
export function isPendingRemit(task) {
  if (!isTrackARemittance(task)) return false;
  const confirmedAt = task.engineerRemitConfirmedAt
                   || task.engineer_remit_confirmed_at;
  return !confirmedAt;
}
