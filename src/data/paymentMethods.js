// 결제 방식 옵션 — Migration 077 (tasks.payment_method)
// 2026-05-27 / 2026-05-29 prepaid 추가
//
// DB 값(snake_case): naver_pay / cash / card / transfer / prepaid / NULL
// 화면 라벨:        네이버결제 / 현금 / 카드 / 계좌이체 / 선결제
//
// 사용처:
//   · NewReceptionFormScreen (운영자 새 접수)
//   · NewReceptionScreenLite (유솔H 포털 새 접수)
//   · AdminTaskDetailScreen / EngineerNewAssignDetailScreen / EngineerTaskDetailScreen 측 라벨 표시
//   · UsolNSettlementCycleCard 측 'naver_pay' 가드 (그 외는 사이클 카드 숨김)

export const PAYMENT_METHOD_OPTIONS = [
  { id: "naver_pay", label: "네이버결제" },
  { id: "cash",      label: "현금" },
  { id: "card",      label: "카드" },
  { id: "transfer",  label: "계좌이체" },
  { id: "prepaid",   label: "선결제" },
];

export const PAYMENT_METHOD_LABELS = Object.fromEntries(
  PAYMENT_METHOD_OPTIONS.map(o => [o.id, o.label])
);
