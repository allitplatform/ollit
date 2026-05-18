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

/**
 * 트랙 🅒 (유솔 송금 대상) 판별: usol_n 본작업에 현장 추가건이 있는 경우.
 *
 * 2026-05-19 Fix #30 🅒 — 사장님 spec 확정:
 *   - principal = 'usol_n' AND extra_fee > 0 AND status = '완료'
 *   - 수금방법 (현금/계좌이체) 무관 — 사장님 명확화 "계좌이체도 현장 현금 추가건"
 *   - 시트 27건 운영 중 (현금 9 + 계좌이체 18)
 *   - 자금 흐름: 기사 현금 수령 → 15% 유솔 직접 송금 + 85% 기사 보유
 *
 * compute_payment v11이 이미 principal_amount=15% / engineer_amount=85% 자동 계산.
 * 클라이언트 필터링만 — DB 트랙 'C' 컬럼 추가 X (트랙 'B'에 머묾, UI 분류만 별도).
 *
 * @param {object} task - 정규화된 task 객체 (loadTasksForRole 결과: principalCode 포함)
 * @returns {boolean}
 */
export function isTrackC(task) {
  if (!task) return false;
  if (task.status !== "완료") return false;

  // principalCode 채워진 경로: loadTasksForRole의 in-memory join (tasksDb.js:499)
  const principalCode = task.principalCode || task.principal_code || task.principal;
  if (principalCode !== 'usol_n') return false;

  const extraFee = Number(task.extraFee || task.extra_fee || 0);
  if (extraFee <= 0) return false;

  return true;
}
