// 2026-10-06 — 금액 표기 공통 함수.
//   음수는 통화 기호 앞에 부호: -₩70,000 (₩-70,000 아님).
//   정산 화면처럼 음수(차감분)가 나올 수 있는 곳은 이 함수를 쓴다.

// 12345 → "₩12,345" / -70000 → "-₩70,000"
export function fmtWon(n) {
  const v = Math.round(Number(n) || 0);
  const abs = Math.abs(v).toLocaleString("ko-KR");
  return v < 0 ? `-₩${abs}` : `₩${abs}`;
}

// 증감 표기: +₩70,000 / -₩70,000 (0 은 ₩0)
export function fmtWonSigned(n) {
  const v = Math.round(Number(n) || 0);
  if (v === 0) return "₩0";
  return v > 0 ? `+₩${v.toLocaleString("ko-KR")}` : fmtWon(v);
}
