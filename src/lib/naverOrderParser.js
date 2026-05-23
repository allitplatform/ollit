// Phase 5 — 네이버 발주 엑셀 측 공용 parser
// 2026-05-23 — NaverUploadScreen.jsx inline 측 측 측 분리 (UsolNOrders.jsx 재사용 위해)
//
// 사장님 실제 시트 검증 측 (2026-05-23):
//   본작업: 벽걸이 524 / 가정용 스탠드(...) 254 / 1way 201 / 4way(...) 29 / 스탠드 사무실(...) 14 / 2way 1 = 1023건
//   추가선택: 냉매점검(...) 96 / 송풍팬분해/층고 92 / 실외기 34 / 대형실외기 1 / 순수 천연 피톤치드 분사 24 = 247건
//
// 측 module 측 export:
//   - parseNaverOrders(rows) → { orders, mapping }
//   - findColumn / parseIntSafe / deriveOrderType / extractAppliance / extractRegion (helper)

// ===== 컬럼 매핑 + 주문 그룹화 =====
export function parseNaverOrders(rows) {
  if (rows.length === 0) return { orders: [], mapping: {} };

  const sample = rows[0];
  const COL = {
    orderId:          findColumn(sample, ["주문번호"]),
    productOrderId:   findColumn(sample, ["상품주문번호"]),
    buyerName:        findColumn(sample, ["구매자명"]),
    receiverName:     findColumn(sample, ["수취인명"]),
    buyerPhone:       findColumn(sample, ["구매자연락처", "구매자전화"]),
    receiverPhone:    findColumn(sample, ["수취인연락처1", "수취인연락처", "수취인전화"]),
    address:          findColumn(sample, ["통합배송지", "기본배송지", "배송지"]),
    paymentDate:      findColumn(sample, ["결제일시", "결제일"]),
    productName:      findColumn(sample, ["상품명"]),
    optionInfo:       findColumn(sample, ["옵션정보", "옵션"]),
    quantity:         findColumn(sample, ["수량"]),
    // 2026-05-24 — 사장님 spec (옵션 C):
    //   customerPaid    = "최종 상품별 총 주문금액"(AG) = 고객 실결제액 (예: 10,000)
    //   settlementAmount = "정산예정금액"               = 네이버 수수료 차감 후 (예: 9,444)
    //   기존 totalAmount (= "최종 상품별 총 주문금액" 우선) 호환용으로 유지하되, INSERT 측 명시 분리.
    customerPaid:     findColumn(sample, ["최종 상품별 총 주문금액"]),
    totalAmount:      findColumn(sample, ["최종 상품별 총 주문금액", "정산기준금액", "결제금액"]),
    settlementAmount: findColumn(sample, ["정산예정금액"]),
    // 2026-05-23 — 사장님 spec 측 정정:
    //   네이버 원본 엑셀 측 "서비스종류" 컬럼 측 X. order_type/기종 정보 측 "옵션정보" 측 통째로
    //   (예: "서비스 종류: 가정집 에어컨청소 / 구분: 벽걸이").
    //   → COL.serviceType = null 측 정상. orderType 판정 측 optionVal fallback (deriveOrderType 키워드 catch).
    //   "유형" / "구분" 측 후보 측 제거 — "배송비 유형" 측 부분 매칭 측 잘못된 catch 방지.
    serviceType:      findColumn(sample, ["서비스종류", "서비스 종류"]),
  };

  if (!COL.orderId) {
    return { orders: [], mapping: COL };
  }

  const grouped = {};
  rows.forEach(row => {
    const orderId = String(row[COL.orderId] || "").trim();
    if (!orderId) return;
    if (!grouped[orderId]) grouped[orderId] = [];
    grouped[orderId].push(row);
  });

  const orders = Object.entries(grouped).map(([orderId, items]) => {
    const first = items[0];
    const appliances = items.map(r => {
      // 2026-05-23 — extractAppliance 측 우선순위: 서비스구분 > 옵션정보 > 상품명
      //   사장님 시트 측 "서비스구분" 컬럼 측 본작업 기종 측 직접 들어있음.
      //   긴 이름 ("가정용 스탠드 (송풍팬 뒷판 포함)" 등) 측 includes 측 부분 매칭 catch.
      const serviceVal = COL.serviceType ? String(r[COL.serviceType] || "").trim() : "";
      const optionVal  = COL.optionInfo  ? String(r[COL.optionInfo]  || "").trim() : "";
      const productVal = COL.productName ? String(r[COL.productName] || "").trim() : "";
      return {
        type: extractAppliance(serviceVal) || extractAppliance(optionVal) || extractAppliance(productVal) || null,
        count: parseIntSafe(COL.quantity ? r[COL.quantity] : 1) || 1,
        productOrderId: COL.productOrderId ? r[COL.productOrderId] : "",
        amount: parseIntSafe(COL.totalAmount ? r[COL.totalAmount] : 0),
        settlement: parseIntSafe(COL.settlementAmount ? r[COL.settlementAmount] : 0),
        // 2026-05-24 — 고객 실결제액 (AG 칼럼 "최종 상품별 총 주문금액") — 표시 전용
        customerPaid: parseIntSafe(COL.customerPaid ? r[COL.customerPaid] : 0),
        // 2026-05-23 — serviceTypeRaw 측 — serviceVal 있으면 측 측, 측 측 optionVal fallback
        //   네이버 원본 측 "서비스종류" 컬럼 측 X (COL.serviceType=null) → optionVal 측 사용
        serviceTypeRaw: serviceVal || optionVal,
        // orderType 판정 — serviceVal 또는 optionVal 측 deriveOrderType (키워드 catch)
        orderType: deriveOrderType(serviceVal || optionVal),
      };
    });
    const address = (COL.address && first[COL.address]) || "";
    const totalSettlement = items.reduce((sum, r) =>
      sum + parseIntSafe(COL.settlementAmount ? r[COL.settlementAmount] : 0)
    , 0);
    const totalAmount = items.reduce((sum, r) =>
      sum + parseIntSafe(COL.totalAmount ? r[COL.totalAmount] : 0)
    , 0);

    return {
      orderId,
      productOrderIds: COL.productOrderId ? items.map(r => r[COL.productOrderId]) : [],
      customerName: (COL.receiverName && first[COL.receiverName]) || (COL.buyerName && first[COL.buyerName]) || "",
      phone:        (COL.receiverPhone && first[COL.receiverPhone]) || (COL.buyerPhone && first[COL.buyerPhone]) || "",
      address,
      region: extractRegion(address),
      paymentDate: COL.paymentDate ? first[COL.paymentDate] : "",
      appliances,
      settlementAmount: totalSettlement,
      totalAmount,
    };
  });

  // 2026-05-23 진단용 — 첫 번째 order 측 측 측 측 측 측 측 측 (Excel 측 날짜 측 직렬 측 측 측 timestamptz 측 측 측 측 측 측 catch)
  if (orders.length > 0) {
    const f = orders[0];
    console.warn("[parseNaverOrders 진단]",
      "주문 수:", orders.length,
      "| 매핑 catch 컬럼:", JSON.stringify(COL),
      "| 첫 order:", JSON.stringify({
        orderId: f.orderId,
        paymentDate: f.paymentDate,
        paymentDate_type: typeof f.paymentDate,
        paymentDate_isDate: f.paymentDate instanceof Date,
        customerName: f.customerName,
        address: f.address,
        appliances_count: f.appliances?.length,
        first_appliance: f.appliances?.[0],
      }, null, 2),
      "| sample row keys:", Object.keys(rows[0] || {}).slice(0, 30));
  }

  return { orders, mapping: COL };
}

// 2026-05-23 — 정확 일치 우선 + 측 측 측 부분 일치 fallback
//   "주문번호" / "상품주문번호" 측 측 측 측 측 측 부분 매칭 측 잘못된 catch 방지.
//   1순위: 키 측 정확 일치 (trim 후 ===)
//   2순위: 측 측 측 측 측 부분 일치 (includes) — "서비스 종류" 측 catch 측
export function findColumn(row, candidates) {
  if (!row) return null;
  const keys = Object.keys(row);
  // 1순위 — 정확 일치
  for (const c of candidates) {
    const exact = keys.find(k => k.trim() === c);
    if (exact) return exact;
  }
  // 2순위 — 부분 일치 (옛 흐름 보존)
  for (const c of candidates) {
    const found = keys.find(k => k.trim().includes(c));
    if (found) return found;
  }
  return null;
}

export function parseIntSafe(v) {
  if (v == null) return 0;
  const n = parseInt(String(v).replace(/[^\d-]/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

// 2026-05-23 — 서비스종류 → task_items.order_type 판정 (사장님 spec / 실제 시트 검증)
//   본작업 (524+254+201+29+14+1 = 1023건): "에어컨청소" 포함 — 가정집/사무실 측
//     · 기종 측 "벽걸이" / "1way" / "스탠드" / "4way" / "2way" / "투인원" 등 catch
//     · 2way (1건) — clean_2way work_type 시드 측 존재 (Migration 004 + appliance code "2way")
//   추가선택 (96+92+34+1+24 = 247건):
//     · "추가선택" 명시
//     · "냉매점검" — 96건 (Migration 034 측 refri_no_appliance)
//     · "송풍팬" / "층고" — 92건 (fan_disassembly)
//     · "실외기" — 34건 (outdoor_unit) — "대형실외기" 1건 측 동일 카테고리 (원청 15% / 기사 85%)
//     · "피톤치드" — 24건
//   이상값 (예: "서울지역" 같은 입력 오류) → null (운영자 확인 필요)
export function deriveOrderType(serviceTypeValue) {
  if (!serviceTypeValue) return null;
  const v = String(serviceTypeValue).trim();
  // 본작업 catch — "에어컨청소" 포함 (가정집/사무실)
  if (v.includes("에어컨청소")) return "본작업";
  if (v.includes("벽걸이") || v.includes("스탠드") || v.includes("1way") || v.includes("2way") || v.includes("4way")
   || v.includes("투인원") || v.includes("원형") || v.includes("시스템멀티")) {
    return "본작업";
  }
  // 추가선택 catch
  if (v.includes("추가선택"))   return "추가선택";
  if (v.includes("냉매점검"))   return "추가선택";
  if (v.includes("송풍팬") || v.includes("층고")) return "추가선택";
  if (v.includes("피톤치드"))   return "추가선택";
  if (v.includes("실외기"))     return "추가선택";   // "대형실외기" 포함 (원청 15% / 기사 85% 동일)
  return null;  // 이상값 — 경고 대상
}

export function extractAppliance(text) {
  if (!text) return null;
  const t = String(text).toLowerCase();
  if (t.includes("1way") || t.includes("1WAY".toLowerCase())) return "1way";
  if (t.includes("2way") || t.includes("2WAY".toLowerCase())) return "2way";
  if (t.includes("4way") || t.includes("4WAY".toLowerCase())) return "4way";
  if (t.includes("스탠드")) return "스탠드";
  if (t.includes("벽걸이")) return "벽걸이";
  if (t.includes("투인원")) return "투인원";
  if (t.includes("원형"))   return "원형";
  if (t.includes("천장형")) return "4way";
  return null;
}

export function extractRegion(address) {
  if (!address) return null;
  const seoul = address.match(/서울(?:특별시)?\s*([가-힣]+구)/);
  if (seoul) return seoul[1];
  const gg = address.match(/(?:경기도|인천(?:광역시)?)\s*([가-힣]+(?:시|군))/);
  if (gg) return gg[1];
  const seoulGu = ["강남구","강동구","강북구","강서구","관악구","광진구","구로구","금천구","노원구","도봉구","동대문구","동작구","마포구","서대문구","서초구","성동구","성북구","송파구","양천구","영등포구","용산구","은평구","종로구","중구","중랑구"];
  for (const g of seoulGu) if (address.includes(g)) return g;
  return null;
}
