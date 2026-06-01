// Phase 5 Step 0.C-1 — 유솔N · 정산 CSV 매칭 (DB 전환)
// 2026-05-19 / 2026-06-01 bugfix
// 흐름:
//   1) CSV (네이버 정산 시트) 업로드 → XLSX parse
//   2) row["상품주문번호"] 추출 → Supabase task_items.product_order_id IN 매칭
//   3) 분류 (matched / otherCompany / unmatched)
//   4) "결제완료 확정" 버튼 → matched 행의 row["정산완료일"] 기준
//      naver_settled_at UPDATE (정산일 그룹별 markTaskItemsField 호출).
//      정산완료일 누락 행 = skip + 콘솔 경고.
// 옛 흐름 (localStorage + autoMatchSettlementCsv) 폐기.
import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { fetchUsolNTaskItemsByOrderIds, markTaskItemsField } from "../../lib/usolNTasksDb.js";

// 우리 작업 분류 키워드 (상품명 측)
// "에어컨청소" / "에어컨 청소" — 우리 본작업
// 그 외 (의류건조기, 세탁기 등) — 다른 회사
const OUR_PRODUCT_KEYWORDS = ["에어컨청소", "에어컨 청소", "피톤치드", "스팀살균", "송풍팬"];

// 2026-06-01 — 네이버 상품주문번호 floor(/10) 키.
//   네이버 번호는 항상 10단위 → 끝자리 1자리 제거해도 행끼리 충돌 X.
//   저장된 product_order_id ±1 오차도 같은 키로 매칭.
function poidKey(id) {
  if (id == null) return null;
  const n = Number(String(id).trim());
  if (!isFinite(n)) return null;
  return Math.floor(n / 10);
}

export function UsolNCsvMatch() {
  const [csvData, setCsvData]         = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [confirming, setConfirming]   = useState(false);
  const [confirmedInfo, setConfirmedInfo] = useState(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  function toInt(v) {
    if (v == null || v === "") return 0;
    const s = String(v).replace(/[^\d.\-]/g, "");
    const n = parseInt(s, 10);
    return isNaN(n) ? 0 : n;
  }

  function isOurProduct(productName) {
    const name = String(productName || "");
    return OUR_PRODUCT_KEYWORDS.some(kw => name.includes(kw));
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setConfirmedInfo(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data  = new Uint8Array(evt.target.result);
        const wb    = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows  = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        const totalAmount = rows.reduce((s, r) => s + toInt(r["정산예정금액"]), 0);

        setCsvData({
          fileName:   file.name,
          uploadedAt: new Date().toISOString(),
          rows,
          totalCount:  rows.length,
          totalAmount,
        });

        // 1차 분류 — 상품명 측 우리/다른 회사 (productOrderId 측 X 영역도 포함)
        const ourRows   = [];
        const otherRows = [];
        rows.forEach(row => {
          const productOrderId = String(row["상품주문번호"] || "").trim();
          const productName    = String(row["상품명"] || "");
          if (isOurProduct(productName)) {
            ourRows.push({ row, productOrderId, productName });
          } else {
            otherRows.push({ row, productOrderId, productName });
          }
        });

        // 우리 row 측 product_order_id 추출 → Supabase 측 매칭
        const ourOrderIds = ourRows
          .map(r => r.productOrderId)
          .filter(Boolean);

        const fetchRes = await fetchUsolNTaskItemsByOrderIds(ourOrderIds);
        if (!fetchRes.ok) {
          setError(fetchRes.error || "DB 매칭 실패");
          return;
        }

        // 2026-06-01 — floor(/10) 키 매칭.
        //   네이버 상품주문번호 10단위 → 끝자리 떼도 행끼리 충돌 X.
        //   저장 측 ±1 오차 (예 ...071 vs CSV ...070) 흡수.
        const itemByKey = new Map();
        (fetchRes.items || []).forEach(it => {
          const k = poidKey(it.product_order_id);
          if (k != null) itemByKey.set(k, it);
        });

        // matched: itemByKey 측 key 일치 / unmatched: 작업DB 측 키 없음
        const matched   = ourRows.filter(r => itemByKey.has(poidKey(r.productOrderId)));
        const unmatched = ourRows.filter(r => !itemByKey.has(poidKey(r.productOrderId)));

        // 이미 결제완료 측 분리 (재마킹 방지)
        const matchedFresh    = [];
        const matchedAlready  = [];
        matched.forEach(m => {
          const item = itemByKey.get(poidKey(m.productOrderId));
          if (item && item.naver_settled_at) matchedAlready.push({ ...m, item });
          else if (item)                     matchedFresh.push({ ...m, item });
        });

        setMatchResult({
          matched:        matchedFresh,
          matchedAlready: matchedAlready,
          unmatched:      unmatched,
          otherCompany:   otherRows,
        });
      } catch (err) {
        console.error("[UsolNCsvMatch.parse]", err);
        setError("CSV 파싱 실패: " + (err.message || ""));
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleConfirmMatching() {
    if (!matchResult?.matched?.length) return;
    setConfirming(true);
    setError("");

    // 2026-06-01 bugfix:
    //   옛 호출은 timestamp 인자 누락 → markTaskItemsField 기본값 NOW() 폴백.
    //   결과: CSV 업로드한 날짜로 매일 일괄 stamp되는 버그.
    //   교정: CSV "정산완료일" 컬럼 → 정산일 그룹별 markTaskItemsField 호출.
    //   timestamp arg 명시 전달.

    // 1회용 디버그 — 첫 row 컬럼 구조 콘솔 출력 (확인 후 제거 가능)
    if (matchResult.matched[0]?.row) {
      console.log(
        "[UsolNCsvMatch] matched[0].row 컬럼:",
        Object.keys(matchResult.matched[0].row)
      );
    }

    const SETTLED_DATE_COL = "정산완료일";
    const groups  = new Map();   // isoTs → [itemIds]
    const skipped = [];          // {orderId, reason}

    for (const m of matchResult.matched) {
      const rawDate = m.row?.[SETTLED_DATE_COL];
      if (rawDate == null || String(rawDate).trim() === "") {
        skipped.push({ orderId: m.productOrderId, reason: "정산완료일 누락" });
        continue;
      }
      const isoTs = parseSettledDateToISO(rawDate);
      if (!isoTs) {
        skipped.push({
          orderId: m.productOrderId,
          reason: `날짜 형식 인식 실패: ${rawDate}`,
        });
        continue;
      }
      if (!groups.has(isoTs)) groups.set(isoTs, []);
      groups.get(isoTs).push(m.item.id);
    }

    if (skipped.length > 0) {
      console.warn("[UsolNCsvMatch] 정산완료일 누락/오류 건:", skipped);
    }

    if (groups.size === 0) {
      setConfirming(false);
      setError(
        `전체 ${matchResult.matched.length}건 모두 정산완료일 누락/오류 — 확정 불가.`
      );
      return;
    }

    // 정산일 그룹별로 markTaskItemsField 호출 (timestamp arg 명시 전달)
    let totalOk = 0;
    let lastTimestamp = null;
    for (const [isoTs, itemIds] of groups.entries()) {
      const res = await markTaskItemsField(itemIds, "naver_settled_at", isoTs);
      if (!res.ok) {
        setConfirming(false);
        setError(
          `${isoTs.slice(0, 10)} 그룹 (${itemIds.length}건) 실패: ${res.error || "unknown"}`
        );
        return;
      }
      totalOk += res.count;
      lastTimestamp = res.timestamp;
    }
    setConfirming(false);

    setConfirmedInfo({
      count:       totalOk,
      timestamp:   lastTimestamp,
      dateGroups:  groups.size,
      skippedCnt:  skipped.length,
    });
    setCsvData(null);
    setMatchResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // 네이버 정산내역 "정산완료일" → ISO 타임스탬프 (KST 자정 → UTC)
  // 허용:
  //   - Date 객체 (XLSX cellDates 모드)
  //   - "YYYY-MM-DD" / "YYYY.MM.DD" / "YYYY/MM/DD"
  //   - "YYYY-MM-DD HH:mm:ss" 등 시각 포함 문자열의 앞 10자리
  // 반환: ISO 문자열 또는 null (인식 실패)
  function parseSettledDateToISO(raw) {
    if (raw instanceof Date) {
      if (isNaN(raw.getTime())) return null;
      return raw.toISOString();
    }
    const s = String(raw).replace(/[./]/g, "-").trim();
    const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!m) return null;
    const y  = Number(m[1]);
    const mo = Number(m[2]);
    const d  = Number(m[3]);
    if (!y || !mo || !d) return null;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    // KST 자정 = UTC 전날 15:00 (Date.UTC 시간에 -9 전달 → 자동 조정)
    const utc = new Date(Date.UTC(y, mo - 1, d, -9, 0, 0, 0));
    if (isNaN(utc.getTime())) return null;
    return utc.toISOString();
  }

  function handleReset() {
    setCsvData(null);
    setMatchResult(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (!csvData) {
    return (
      <div>
        <UploadDropZone fileInputRef={fileInputRef} onFileSelect={handleFileSelect}/>
        {confirmedInfo && (
          <div style={confirmedBoxStyle}>
            ✓ 직전 결제완료 확정: {confirmedInfo.count}건
            {confirmedInfo.dateGroups != null && (
              <span style={{ marginLeft: 4 }}>
                ({confirmedInfo.dateGroups}개 정산일 그룹)
              </span>
            )}
            {confirmedInfo.skippedCnt > 0 && (
              <div style={{ color: "#F59E0B", fontSize: 11, marginTop: 4 }}>
                ⚠️ 정산완료일 누락/오류 {confirmedInfo.skippedCnt}건 — 미확정 (콘솔 확인)
              </div>
            )}
          </div>
        )}
        {error && <div style={errorBoxStyle}>⚠️ {error}</div>}
        <Empty>오늘 받은 정산 CSV를 업로드하세요</Empty>
      </div>
    );
  }

  return (
    <div>
      <CsvInfoCard csvData={csvData} onReset={handleReset}/>
      {error && <div style={errorBoxStyle}>⚠️ {error}</div>}
      {matchResult && <ClassificationResults result={matchResult}/>}

      {matchResult?.matched?.length > 0 && (
        <MatchedItemsPreview items={matchResult.matched}/>
      )}

      {matchResult?.unmatched?.length > 0 && (
        <UnmatchedItemsList items={matchResult.unmatched}/>
      )}

      <button
        onClick={handleConfirmMatching}
        disabled={!matchResult?.matched?.length || confirming}
        style={{
          ...confirmButtonStyle,
          opacity: (matchResult?.matched?.length && !confirming) ? 1 : 0.5,
          cursor:  (matchResult?.matched?.length && !confirming) ? "pointer" : "not-allowed",
        }}
      >
        {confirming
          ? "확정 중..."
          : `${matchResult?.matched?.length || 0}건 결제완료 확정 (🟡 마킹)`}
      </button>
    </div>
  );
}

function UploadDropZone({ fileInputRef, onFileSelect }) {
  return (
    <div
      onClick={() => fileInputRef.current?.click()}
      style={{
        padding: 30,
        background: "rgba(255,27,141,0.06)",
        border: "2px dashed rgba(255,27,141,0.4)",
        borderRadius: 12, textAlign: "center",
        cursor: "pointer", marginBottom: 16,
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 8 }}>📥</div>
      <div style={{ fontSize: 14, color: "#FF1B8D", fontWeight: 700 }}>
        정산 CSV 업로드
      </div>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
        유솔이 매일 보내주는 정산 엑셀 선택
      </div>
      <input
        type="file"
        ref={fileInputRef}
        accept=".xlsx,.xls,.csv"
        onChange={onFileSelect}
        style={{ display: "none" }}
      />
    </div>
  );
}

function CsvInfoCard({ csvData, onReset }) {
  return (
    <div style={{
      padding: 14,
      background: "rgba(255,27,141,0.10)",
      border: "1px solid #FF1B8D",
      borderRadius: 10, marginBottom: 14,
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <div>
        <div style={{ fontSize: 10, color: "#FF1B8D", fontWeight: 700, marginBottom: 4 }}>
          📥 분석 중인 CSV
        </div>
        <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>
          {csvData.fileName}
        </div>
        <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 2 }}>
          총 {csvData.totalCount}건 · ₩{csvData.totalAmount.toLocaleString()}
        </div>
      </div>
      <button onClick={onReset} style={{
        padding: "6px 12px", background: "transparent",
        border: "1px solid var(--border)", borderRadius: 4,
        color: "var(--text-secondary)", fontSize: 10, cursor: "pointer",
        fontFamily: "inherit",
      }}>취소</button>
    </div>
  );
}

function ClassificationResults({ result }) {
  if (!result) return null;
  const totalMatchedAmount = (result.matched || []).reduce(
    (s, m) => s + (parseInt((m.row || {})["정산예정금액"]) || 0), 0
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
      <ResultBox
        icon="✅"
        label="우리 매칭 (신규)"
        count={result.matched.length}
        rightExtra={`₩${totalMatchedAmount.toLocaleString()}`}
        color="var(--accent)"
        accent
      />
      {result.matchedAlready?.length > 0 && (
        <ResultBox
          icon="🟡"
          label="이미 결제완료"
          count={result.matchedAlready.length}
          rightExtra="중복 마킹 제외"
          color="#FACC15"
          muted
        />
      )}
      <ResultBox
        icon="🔇"
        label="다른 회사 (자동)"
        count={result.otherCompany.length}
        rightExtra="자동 제외"
        color="#9B9892"
        muted
      />
      {result.unmatched.length > 0 && (
        <ResultBox
          icon="⚠️"
          label="미매칭"
          count={result.unmatched.length}
          rightExtra="작업DB에 X"
          color="#F59E0B"
          accent
        />
      )}
    </div>
  );
}

function ResultBox({ icon, label, count, rightExtra, color, accent, muted }) {
  return (
    <div style={{
      background: "var(--usol-n-card-bg)",
      borderRadius: 10,
      padding: "11px 14px",
      boxShadow: "var(--usol-n-shadow)",
      borderLeft: accent ? `3px solid ${color}` : "3px solid var(--usol-n-border)",
      border: "1px solid var(--usol-n-border)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      opacity: muted ? 0.7 : 1,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11 }}>{icon}</span>
        <span style={{
          fontSize: 11,
          color: muted ? "var(--text-secondary)" : color,
          fontWeight: muted ? 500 : 700,
        }}>
          {label}
        </span>
        <span style={{
          fontSize: 12,
          color: muted ? "var(--text-secondary)" : color,
          fontWeight: 700, marginLeft: 4,
        }}>
          {count}건
        </span>
      </div>
      {rightExtra && (
        <span style={{
          fontSize: 10,
          color: muted ? "var(--text-tertiary, var(--text-secondary))" : color,
          fontFamily: "inherit",
          fontWeight: muted ? 500 : 700,
        }}>
          {rightExtra}
        </span>
      )}
    </div>
  );
}

function MatchedItemsPreview({ items }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>
        매칭 항목 (상위 5)
      </div>
      {items.slice(0, 5).map((m, idx) => {
        const row         = m.row || {};
        const productName = row["상품명"] || "";
        const isExtra     = !productName.includes("에어컨청소") && !productName.includes("에어컨 청소");
        const netAmount   = parseInt(row["정산예정금액"]) || 0;
        const item        = m.item || {};

        return (
          <div key={idx} style={{
            padding: 10,
            background: isExtra ? "rgba(245,158,11,0.04)" : "var(--bg-secondary)",
            border: isExtra ? "1px solid rgba(245,158,11,0.3)" : "1px solid var(--border)",
            borderRadius: 8, marginBottom: 4,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600 }}>
                  {item.tasks?.customer_name || row["구매자명"] || row["수취인명"] || "—"}
                </span>
                {isExtra && (
                  <span style={{
                    fontSize: 8,
                    background: "rgba(245,158,11,0.2)",
                    color: "#F59E0B",
                    padding: "1px 4px", borderRadius: 2, fontWeight: 700,
                  }}>추가</span>
                )}
              </div>
              <span style={{
                fontSize: 10,
                color: isExtra ? "#F59E0B" : "#1D9E75",
                fontFamily: "inherit",
              }}>
                ₩{netAmount.toLocaleString()}
              </span>
            </div>
            <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>
              {item.tasks?.task_no || ""} · {productName.length > 32 ? productName.slice(0, 32) + "..." : productName}
            </div>
          </div>
        );
      })}
      {items.length > 5 && (
        <div style={{ textAlign: "center", fontSize: 9, color: "var(--text-tertiary)", padding: 8 }}>
          ... 외 {items.length - 5}건
        </div>
      )}
    </div>
  );
}

function UnmatchedItemsList({ items }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11, color: "#F59E0B", fontWeight: 600, marginBottom: 6 }}>
        ⚠️ 미매칭 항목 ({items.length})
      </div>
      <div style={{
        background: "rgba(245,158,11,0.04)",
        border: "1px dashed rgba(245,158,11,0.3)",
        borderRadius: 8, padding: 10,
        fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.7,
      }}>
        우리 거 같은데 작업DB에 없는 항목입니다.<br/>
        새 접수 탭에서 접수 CSV를 먼저 업로드하면 해결됩니다.
      </div>
    </div>
  );
}

function Empty({ children }) {
  return (
    <div style={{
      padding: 40, textAlign: "center",
      color: "var(--text-secondary)", fontSize: 12,
      background: "var(--bg-secondary)",
      border: "1px dashed var(--border)",
      borderRadius: 10,
    }}>{children}</div>
  );
}

const confirmButtonStyle = {
  width: "100%", marginTop: 16, padding: 14,
  background: "var(--accent)",
  border: "none", borderRadius: 10,
  color: "#fff", fontSize: 13, fontWeight: 700,
  fontFamily: "inherit",
  transition: "transform 0.1s, box-shadow 0.1s",
};

const confirmedBoxStyle = {
  padding: 12,
  background: "rgba(29,158,117,0.10)",
  border: "1px solid rgba(29,158,117,0.4)",
  borderRadius: 8, marginBottom: 12,
  color: "#1D9E75", fontSize: 12, fontWeight: 600,
  textAlign: "center",
};

const errorBoxStyle = {
  padding: 10,
  background: "rgba(255,68,68,0.08)",
  border: "1px solid rgba(255,68,68,0.3)",
  borderRadius: 8, marginBottom: 12,
  color: "#ff4444", fontSize: 11, fontWeight: 600,
};

export default UsolNCsvMatch;
