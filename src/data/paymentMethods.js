// 결제 방식 옵션 — Migration 077 (tasks.payment_method)
// 2026-05-27
//
// DB 값(snake_case): naver_pay / cash / card / transfer / NULL
// 화면 라벨:        네이버결제 / 현금 / 카드 / 계좌이체
//
// 사용처:
//   · NewReceptionFormScreen (운영자 새 접수)
//   · NewReceptionScreenLite (유솔H 포털 새 접수)
//   · 향후 사이클 카드 가드 / 정산 분기 (다음 단계 spec)

export const PAYMENT_METHOD_OPTIONS = [
  { id: "naver_pay", label: "네이버결제" },
  { id: "cash",      label: "현금" },
  { id: "card",      label: "카드" },
  { id: "transfer",  label: "계좌이체" },
];

export const PAYMENT_METHOD_LABELS = Object.fromEntries(
  PAYMENT_METHOD_OPTIONS.map(o => [o.id, o.label])
);
