// 유솔N 기사 정산 — 회차 헬퍼 (bucket model)
// 2026-06-01
//
// 측측 측측 (engineer_settled_at) 측 KST 측측 측측 측 1차/2차 측측측.
// 측측 측측: 측월 15일 / 30일 (or 측월 측측 측).
//   KST day <= 15 → "1차"
//   KST day >  15 → "2차"
//
// 새 컬럼 X — engineer_settled_at 측 측측 측측 측측 측측.

export function getSettleRound(engineerSettledAtIso) {
  if (!engineerSettledAtIso) return null;
  const t = new Date(engineerSettledAtIso);
  if (isNaN(t.getTime())) return null;
  // KST 측측 (UTC + 9시간)
  const k = new Date(t.getTime() + 9 * 3600 * 1000);
  const day = k.getUTCDate();
  return day <= 15 ? "1차" : "2차";
}

// 측측 측측 — KST 측측 (예: "5/15", "5/30")
export function formatSettleDateKST(engineerSettledAtIso) {
  if (!engineerSettledAtIso) return "";
  const t = new Date(engineerSettledAtIso);
  if (isNaN(t.getTime())) return "";
  const k = new Date(t.getTime() + 9 * 3600 * 1000);
  const m = k.getUTCMonth() + 1;
  const d = k.getUTCDate();
  return `${m}/${d}`;
}
