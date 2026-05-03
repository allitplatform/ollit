// V11-1 — 유솔 N 접수 CSV (네이버 발주서)
// 74컬럼 중 작업 등록에 필요한 16개만 사용
import { classifyOrderType, parseAppliances, normalizePhone, parseDate } from "./usolNClassify.js";
import { makeEmptyTask } from "./tasks.js";

export const USOL_N_ORDER_CSV_FIELDS = {
  orderNumber:    "주문번호",
  productOrderId: "상품주문번호",
  productName:    "상품명",
  optionInfo:     "옵션정보",
  quantity:       "수량",

  buyerName:      "구매자명",
  customerName:   "수취인명",          // 작업 기준
  customerPhone:  "수취인연락처1",      // 작업 기준
  address:        "기본배송지",
  request:        "배송메세지",

  paidAt:         "결제일",
  orderStatus:    "주문상태",

  grossAmount:    "최종 상품별 총 주문금액",
  npayFee:        "네이버페이 주문관리 수수료",
  salesLinkFee:   "매출연동 수수료",
  netAmount:      "정산예정금액",
};

// 안전한 정수 파서 (CSV 셀이 "12,345" 형태인 경우도 허용)
function toInt(raw) {
  if (raw == null || raw === "") return 0;
  const s = String(raw).replace(/[^\d.\-]/g, "");
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

// 한 행 → Task 객체
export function csvOrderRowToTask(row) {
  const productName = row["상품명"] || "";
  const qty         = toInt(row["수량"]) || 1;

  return makeEmptyTask({
    // 식별
    productOrderId: row["상품주문번호"] || null,
    orderNumber:    row["주문번호"] || null,
    productName,
    optionInfo:     row["옵션정보"] || null,
    orderType:      classifyOrderType(productName),

    // 작업
    qty,
    workItems: parseAppliances(row["옵션정보"], qty),

    // 고객 (수취인 우선)
    customer:   row["수취인명"]    || row["구매자명"] || "",
    phone:      normalizePhone(row["수취인연락처1"] || ""),
    address:    row["기본배송지"]   || "",
    request:    row["배송메세지"]   || "",
    buyerName:  row["구매자명"]     || null,

    // 시점
    paidAt:     parseDate(row["결제일"]),
    receivedAt: new Date().toISOString(),

    // 금액
    grossAmount:  toInt(row["최종 상품별 총 주문금액"]),
    npayFee:      toInt(row["네이버페이 주문관리 수수료"]),
    salesLinkFee: toInt(row["매출연동 수수료"]),
    netAmount:    toInt(row["정산예정금액"]),

    // 상태
    status:      "received",
    state:       "waiting",
    principal:   "유솔홈케어 N",
    principalId: "usol_n",

    // 메타
    importCsvType: "usol_n_order",
    csvImportedAt: new Date().toISOString(),
  });
}
