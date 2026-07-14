// Step 8+9 V7 — 출장비만 정산 (현장 가서 작업 못한 경우)
// 2026-07-14 — 사장님 spec: 2026-07-15(KST)부터 출장비 40,000 / 기사 60% · 회사 40%.
//   그 전까지는 기존 30,000 / 기사 100%. 날짜 게이트로 자정에 자동 전환
//   (DB mark_visit_only v2 · compute_payment v26 과 동일 기준일 — Mig 177/178).

function _isNewRule() {
  // KST 오늘 날짜 문자열 비교 (en-CA = YYYY-MM-DD)
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }) >= "2026-07-15";
}

export const VISIT_FEE = {
  get amount()        { return _isNewRule() ? 40000 : 30000; },
  get engineerShare() { return _isNewRule() ? 60 : 100; },
  get companyShare()  { return _isNewRule() ? 40 : 0; },
  principalShare: 0,
  get engineerAmount() { return _isNewRule() ? 24000 : 30000; },
  get companyAmount()  { return _isNewRule() ? 16000 : 0; },
};

export const VISIT_REASONS = [
  { id: "wrong_type",      emoji: "🔧", label: "기종이 의뢰와 다름",       desc: "현장 기종이 의뢰와 다른 경우" },
  { id: "no_access",       emoji: "🚧", label: "접근 불가 (사다리차/높이)", desc: "고소 작업 / 안전 문제" },
  { id: "customer_absent", emoji: "🚪", label: "고객 부재",                 desc: "방문 시 고객 없음" },
  { id: "other",           emoji: "📝", label: "기타",                     desc: "메모에 상세 작성" },
];

export function calcVisitOnly() {
  return {
    type: "visit_only",
    total:     VISIT_FEE.amount,
    engineer:  VISIT_FEE.engineerAmount,
    company:   VISIT_FEE.companyAmount,
    principal: 0,
  };
}

// id → 사유 라벨 반환
export function getVisitReasonLabel(id) {
  const r = VISIT_REASONS.find(x => x.id === id);
  return r ? r.label : "—";
}
