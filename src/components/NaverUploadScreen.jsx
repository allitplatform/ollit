// Step 7 V2 — 유솔 N CSV/XLSX 업로드 (xlsx + papaparse 사용)
// 진단 정보 / 인코딩 자동 / 컬럼 매핑
import { useState } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";

export function NaverUploadScreen({ onComplete, onBack }) {
  const [parsed, setParsed]     = useState([]);
  const [debugInfo, setDebugInfo] = useState(null);
  const [colMap, setColMap]     = useState(null);
  const [error, setError]       = useState(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy]         = useState(false);

  async function handleFile(file) {
    if (!file) return;
    setError(null);
    setDebugInfo(null);
    setColMap(null);
    setParsed([]);
    setFileName(file.name);
    setBusy(true);

    const ext = (file.name.split(".").pop() || "").toLowerCase();

    try {
      let rows = [];

      if (ext === "xlsx" || ext === "xls") {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      } else if (ext === "csv" || ext === "txt") {
        rows = await parseCSV(file);
      } else {
        throw new Error(`지원하지 않는 파일 형식: .${ext}`);
      }

      // 디버그 로그
      const headers = Object.keys(rows[0] || {});
      console.log("📋 행 개수:", rows.length);
      console.log("📋 헤더:", headers);
      console.log("📋 첫 행:", rows[0]);

      setDebugInfo({
        rowCount: rows.length,
        headers,
        firstRow: rows[0] || {},
      });

      if (rows.length === 0) {
        setError("파일이 비어 있습니다");
        return;
      }

      const { orders, mapping } = parseNaverOrders(rows);
      setColMap(mapping);
      setParsed(orders);

      console.log("📋 컬럼 매핑:", mapping);
      console.log("📋 박힌 주문:", orders.length, "건");

      if (orders.length === 0) {
        setError("파싱 실패 — 주문번호 컬럼을 찾지 못했습니다. 위 진단의 헤더 목록을 확인해주세요");
      }
    } catch (err) {
      console.error("❌ 박힌 에러:", err);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function handleConfirm() {
    if (parsed.length === 0) return;
    onComplete && onComplete(parsed);
  }

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh", color: "var(--text-primary)", fontFamily: "-apple-system, 'Pretendard', sans-serif", paddingBottom: 80 }}>
      <div style={headerStyle}>
        <button onClick={onBack} style={backBtnStyle}>←</button>
        <div style={titleStyle}>유솔 N · 주문 업로드</div>
        <div style={{ width: 40 }}/>
      </div>

      <div style={{ padding: 16 }}>
        <InfoBox>
          📋 네이버 주문 CSV/XLSX 파일 업로드<br/>
          · 같은 주문번호 = 한 작업으로 묶음 (옵션 포함)<br/>
          · 옵션정보 → 기종 자동 매핑<br/>
          · 통합배송지 → 지역 자동 추출<br/>
          · F12 → Console에서 자세한 진단 확인
        </InfoBox>

        <label style={uploadBtnStyle}>
          {busy ? "⏳ 처리 중..." : "📁 CSV / XLSX 파일 선택"}
          <input type="file" accept=".csv,.xlsx,.xls,.txt"
            onChange={(e) => handleFile(e.target.files[0])}
            style={{ display: "none" }}/>
        </label>

        {fileName && (
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 8 }}>
            · {fileName}
          </div>
        )}

        {/* 진단 박스 */}
        {debugInfo && <DebugBox info={debugInfo} colMap={colMap} error={error}/>}

        {/* 결과 */}
        {parsed.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <CountSummary parsed={parsed}/>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              {parsed.map(order => (
                <OrderPreview key={order.orderId} order={order}/>
              ))}
            </div>
            <div style={{ marginTop: 18 }}>
              <button onClick={handleConfirm} style={confirmBtnStyle}>
                {parsed.length}건 신규접수 등록
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== CSV (Papa) =====
async function parseCSV(file) {
  const tryEncodings = ["UTF-8", "EUC-KR", "CP949"];
  for (const encoding of tryEncodings) {
    try {
      const result = await new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          encoding,
          skipEmptyLines: true,
          complete: (r) => resolve(r),
          error: (e) => reject(e),
        });
      });
      const headers = Object.keys(result.data[0] || {});
      const hasKorean = headers.some(h => /[가-힣]/.test(h));
      if (hasKorean) {
        console.log(`✅ 박힌 인코딩: ${encoding}`);
        return result.data;
      }
    } catch (e) { continue; }
  }
  throw new Error("인코딩 감지 실패 (UTF-8 / EUC-KR / CP949 모두 실패)");
}

// ===== 컬럼 매핑 + 주문 그룹화 =====
function parseNaverOrders(rows) {
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
    totalAmount:      findColumn(sample, ["최종 상품별 총 주문금액", "정산기준금액", "결제금액"]),
    settlementAmount: findColumn(sample, ["정산예정금액"]),
    // 2026-05-23 — 사장님 spec: "서비스종류" 컬럼 측 본작업/추가선택 판정
    //   값: "가정집 에어컨청소" / "사무실 에어컨청소" / "추가선택" / (이상값)
    //   "에어컨청소" 포함 → 본작업, "추가선택" → 추가선택, 그 외 → 경고
    serviceType:      findColumn(sample, ["서비스종류", "서비스 종류", "유형", "구분"]),
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
        // 서비스종류 raw 값 + order_type 판정 (deriveOrderType 측 키워드 catch)
        serviceTypeRaw: serviceVal,
        orderType: deriveOrderType(serviceVal),
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

function findColumn(row, candidates) {
  if (!row) return null;
  const keys = Object.keys(row);
  for (const c of candidates) {
    const found = keys.find(k => k.trim().includes(c));
    if (found) return found;
  }
  return null;
}

function parseIntSafe(v) {
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
function deriveOrderType(serviceTypeValue) {
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

function extractAppliance(text) {
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

function extractRegion(address) {
  if (!address) return null;
  const seoul = address.match(/서울(?:특별시)?\s*([가-힣]+구)/);
  if (seoul) return seoul[1];
  const gg = address.match(/(?:경기도|인천(?:광역시)?)\s*([가-힣]+(?:시|군))/);
  if (gg) return gg[1];
  const seoulGu = ["강남구","강동구","강북구","강서구","관악구","광진구","구로구","금천구","노원구","도봉구","동대문구","동작구","마포구","서대문구","서초구","성동구","성북구","송파구","양천구","영등포구","용산구","은평구","종로구","중구","중랑구"];
  for (const g of seoulGu) if (address.includes(g)) return g;
  return null;
}

// ===== UI 컴포넌트 =====
function DebugBox({ info, colMap, error }) {
  const importantCols = ["orderId", "settlementAmount", "address", "optionInfo", "receiverName", "totalAmount"];
  return (
    <div style={{
      background: "var(--bg-secondary)", border: "1px solid var(--border)",
      borderRadius: 10, padding: 14, marginBottom: 16, marginTop: 16,
    }}>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 600 }}>
        🩺 파싱 진단
      </div>
      <div style={{ fontSize: 11, color: "var(--text-primary)", marginBottom: 8 }}>
        · 행 수: <strong>{info.rowCount}</strong>건 / 헤더 <strong>{info.headers.length}</strong>개
      </div>
      <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 6 }}>· 감지된 헤더:</div>
      <div style={{
        background: "var(--bg-inset)", padding: 8, borderRadius: 6,
        fontSize: 9, color: "#FF1B8D", fontFamily: "inherit",
        maxHeight: 80, overflow: "auto", lineHeight: 1.6,
      }}>
        {info.headers.join(", ")}
      </div>
      {colMap && (
        <>
          <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 10, marginBottom: 6 }}>· 컬럼 매핑 (핵심):</div>
          <div style={{ fontSize: 10, fontFamily: "inherit", lineHeight: 1.6 }}>
            {importantCols.map(k => (
              <div key={k} style={{ color: colMap[k] ? "#00875A" : "#FF3D5A" }}>
                {colMap[k] ? "✓" : "✗"} {k} → {colMap[k] || "찾지 못함"}
              </div>
            ))}
          </div>
        </>
      )}
      {error && (
        <div style={{
          marginTop: 8, padding: 8,
          background: "rgba(255,61,90,0.10)",
          border: "1px solid rgba(255,61,90,0.30)",
          borderRadius: 6, fontSize: 11, color: "#FF3D5A",
        }}>
          ⚠️ {error}
        </div>
      )}
      <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginTop: 8 }}>
        ※ F12 → Console에서 자세한 진단 확인 (행/헤더/매핑)
      </div>
    </div>
  );
}

function CountSummary({ parsed }) {
  const totalSettlement = parsed.reduce((s, o) => s + (o.settlementAmount || 0), 0);
  const totalAppliances = parsed.reduce((s, o) => s + (o.appliances?.length || 0), 0);
  const unmappedAppliances = parsed.flatMap(o => o.appliances).filter(a => !a.type).length;
  const unmappedRegions = parsed.filter(o => !o.region).length;
  return (
    <div style={{
      background: "var(--bg-secondary)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "12px 14px",
    }}>
      <div style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 600, marginBottom: 8 }}>
        📊 파싱 요약
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11, color: "var(--text-secondary)" }}>
        <div>주문 <strong style={{ color: "var(--text-primary)" }}>{parsed.length}</strong>건</div>
        <div>기종 <strong style={{ color: "var(--text-primary)" }}>{totalAppliances}</strong>대</div>
        <div>정산예정 <strong style={{ color: "var(--text-primary)", fontFamily: "inherit" }}>{totalSettlement.toLocaleString()}원</strong></div>
        <div>
          미매핑
          {unmappedAppliances > 0 && <span style={{ color: "#FF3D5A", marginLeft: 4 }}>기종 {unmappedAppliances}</span>}
          {unmappedRegions > 0 && <span style={{ color: "#FF3D5A", marginLeft: 4 }}>지역 {unmappedRegions}</span>}
          {unmappedAppliances === 0 && unmappedRegions === 0 && <span style={{ color: "#00875A", marginLeft: 4 }}>없음 ✓</span>}
        </div>
      </div>
    </div>
  );
}

function OrderPreview({ order }) {
  return (
    <div style={{
      background: "var(--bg-secondary)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "12px 14px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{order.customerName || "—"}</span>
        <span className="mono" style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "inherit" }}>{order.orderId}</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
        · {order.region || <span style={{ color: "#FF3D5A" }}>지역 X</span>} · {order.address || "—"}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
        {order.appliances.map((a, i) => (
          <span key={i} style={{
            background: a.type ? "var(--bg-tertiary)" : "rgba(239, 68, 68, 0.15)",
            color: a.type ? "var(--text-primary)" : "#FF3D5A",
            fontSize: 10, padding: "2px 6px", borderRadius: 4, fontWeight: 500,
          }}>
            {a.type || "❓ 기종 X"} ×{a.count}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-secondary)" }}>
        <span>{order.phone || "—"}</span>
        <span style={{ color: "var(--text-primary)", fontFamily: "inherit", fontWeight: 600 }}>
          {(order.settlementAmount || 0).toLocaleString()}원
        </span>
      </div>
    </div>
  );
}

function InfoBox({ children }) {
  return (
    <div style={{
      background: "var(--bg-secondary)",
      borderLeft: "4px solid #FF1B8D",
      borderTop: "1px solid var(--border)",
      borderRight: "1px solid var(--border)",
      borderBottom: "1px solid var(--border)",
      borderRadius: 10, padding: "12px 14px", marginBottom: 16,
      fontSize: 11, color: "var(--text-primary)", lineHeight: 1.6,
    }}>
      {children}
    </div>
  );
}

const headerStyle = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "14px 16px", borderBottom: "1px solid var(--border)",
  position: "sticky", top: 0, background: "var(--bg-primary)", zIndex: 10,
};
const backBtnStyle = { background: "none", border: "none", color: "var(--text-primary)", fontSize: 18, cursor: "pointer", padding: 4 };
const titleStyle = { fontSize: 15, fontWeight: 500 };
const uploadBtnStyle = {
  display: "block", width: "100%", textAlign: "center",
  padding: "16px 14px",
  background: "var(--bg-secondary)",
  border: "2px dashed #FF1B8D",
  borderRadius: 10, color: "#FF1B8D",
  fontSize: 13, fontWeight: 700, cursor: "pointer",
  fontFamily: "inherit", boxSizing: "border-box",
};
const confirmBtnStyle = {
  width: "100%", padding: 14,
  background: "#FF1B8D", border: "none", borderRadius: 10,
  color: "var(--text-primary)", fontSize: 14, fontWeight: 600,
  cursor: "pointer", fontFamily: "inherit",
};

export default NaverUploadScreen;
