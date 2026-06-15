// 2026-06-15 — 기사 PWA 정산 _excl_extra 헬퍼 (운영자 화면과 동일 산식).
//   사장님 spec (f6fbcf1): 현장추가금(extra_fee) 의 기사 몫은 일정산(track A) 처리분이라
//   track B 월정산 뷰(유솔N) 에서 빠져야 함.
//
//   유솔 extra 몫    = FLOOR(extra_fee × 0.15)
//   기사 extra 몫    = extra_fee − FLOOR(extra_fee × 0.15)
//   engineer_excl_extra  = engineer_amount  − 기사 extra 몫
//   환불(net<0) 시 음수 그대로 — clamp 없음.

// task-level _excl_extra (task 객체 입력)
export function calcTaskEngineerExclExtra(task) {
  if (!task) return 0;
  const eng   = Number(task.engineer_amount) || 0;
  const extra = Number(task.extra_fee ?? task.extraFee) || 0;
  const usolExtraShare     = Math.floor(extra * 0.15);
  const engineerExtraShare = extra - usolExtraShare;
  return eng - engineerExtraShare;
}

// payments row 직접 입력용 (운영자 화면과 동일 시그니처)
export function calcEngineerExclExtraFromPayment(payment) {
  if (!payment) return 0;
  const eng   = Number(payment.engineer_amount) || 0;
  const extra = Number(payment.extra_fee)       || 0;
  const usolExtraShare     = Math.floor(extra * 0.15);
  const engineerExtraShare = extra - usolExtraShare;
  return eng - engineerExtraShare;
}

// task-level engineer_excl_extra → item 단위 분배 (item.subtotal 비율).
//   item-level 환불은 task 단위 분배 결과의 일부로 전파.
//   Σtask_sub = 0 인 희귀 케이스 → 균등 분배 폴백.
export function distributeEngineerExclExtra(payment, items) {
  const engExcl = calcEngineerExclExtraFromPayment(payment);
  const out = new Map();
  if (!Array.isArray(items) || items.length === 0) return out;
  const subSum = items.reduce((s, it) => s + (Number(it.subtotal) || 0), 0);
  if (subSum > 0) {
    for (const it of items) {
      const r = (Number(it.subtotal) || 0) / subSum;
      out.set(it.id, Math.round(engExcl * r));
    }
  } else {
    const per = Math.round(engExcl / items.length);
    for (const it of items) out.set(it.id, per);
  }
  return out;
}
