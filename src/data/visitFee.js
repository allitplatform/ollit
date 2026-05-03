// Step 8+9 V7 — 출장비만 정산 (현장 가서 작업 못한 경우)
// 30,000원 고정 / 기사 100% / 회사·원청 0%

export const VISIT_FEE = {
  amount: 30000,
  engineerShare: 100,
  companyShare: 0,
  principalShare: 0,
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
    engineer:  VISIT_FEE.amount,
    company:   0,
    principal: 0,
  };
}

// id → 사유 라벨 반환
export function getVisitReasonLabel(id) {
  const r = VISIT_REASONS.find(x => x.id === id);
  return r ? r.label : "—";
}
