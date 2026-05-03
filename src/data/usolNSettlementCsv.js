// V11-1 — 유솔 N 정산 CSV (유솔이 매일 보내주는 파일)
// 21컬럼 중 핵심 9개. productOrderId가 매칭 키.
import { parseDate } from "./usolNClassify.js";

export const USOL_N_SETTLEMENT_CSV_FIELDS = {
  orderNumber:           "주문번호",
  productOrderId:        "상품주문번호",
  productName:           "상품명",
  buyerName:             "구매자명",
  paidAt:                "결제일",

  naverSettleScheduledAt: "정산예정일",
  naverSettledAt:         "정산완료일",   // 핵심
  settlementBaseDate:     "정산기준일",
  settlementStatus:       "정산상태",     // "일반정산" 등

  grossAmount:            "정산기준금액",
  npayFee:                "Npay 수수료",
  salesLinkFee:           "매출 연동 수수료 합계",
  netAmount:              "정산예정금액",
};

function toInt(raw) {
  if (raw == null || raw === "") return 0;
  const s = String(raw).replace(/[^\d.\-]/g, "");
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

// 한 행 → 기존 Task 업데이트 patch (productOrderId로 매칭한 후 사용)
export function csvSettlementRowToTaskUpdate(row) {
  return {
    productOrderId:     row["상품주문번호"] || null,

    // 정산 정보 업데이트
    naverSettledAt:     parseDate(row["정산완료일"]),
    settlementStatus:   row["정산상태"] || null,
    settlementBaseDate: parseDate(row["정산기준일"]),

    // 금액이 다를 경우 정정 (보통 동일)
    netAmount:          toInt(row["정산예정금액"]),
    grossAmount:        toInt(row["정산기준금액"]),
    npayFee:            toInt(row["Npay 수수료"]),
    salesLinkFee:       toInt(row["매출 연동 수수료 합계"]),

    csvImportedAt:      new Date().toISOString(),
  };
}
