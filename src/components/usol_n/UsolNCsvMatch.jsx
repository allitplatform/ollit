// Phase 5 Step 0.C-1 — 유솔N · 정산 CSV 매칭 (DB 전환)
// 2026-05-19 / 2026-06-01 bugfix / 2026-06-09 net_amount 동시 반영
// 흐름:
//   1) CSV (네이버 정산 시트) 업로드 → XLSX parse
//   2) 정산상태 "취소" 포함 row 는 사전 제외 (2026-06-09 — 백필 스크립트와 일관).
//   3) row["상품주문번호"] 추출 → Supabase task_items.product_order_id IN 매칭
//   4) 분류 (matched / otherCompany / unmatched)
//   5) "결제완료 확정" 버튼 → matched 행의 row["정산완료일"] + row["정산예정금액"] 기준
//      markTaskItemsNaverSettledAndNet 호출. naver_settled_at + net_amount 동시 UPDATE.
//      정산완료일 누락 = skip + 콘솔 경고. 정산예정금액 누락/비숫자 = net 만 생략(NULL 보존).
//      보호 (engineer_settled_at NOT NULL 또는 net_amount 이미 값) → net 덮어쓰기 X.
// 옛 흐름 (localStorage + autoMatchSettlementCsv) 폐기.
import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { fetchUsolNTaskItemsByOrderIds, markTaskItemsNaverSettledAndNet } from "../../lib/usolNTasksDb.js";
// 2026-06-11 — 폰트 표준 토큰 (내 작업 / 정산 / 업로드 동일 참조).
import { TEXT } from "../../styles/textTokens.js";

// 우리 작업 분류 키워드 (상품명 측)
// "에어컨청소" / "에어컨 청소" — 우리 본작업
// 추가선택 SKU: 피톤치드 / 스팀살균 / 송풍팬(분해) / 냉매(점검·충전)
// 그 외 (의류건조기, 세탁기 등) — 다른 회사
// 2026-06-08 — "냉매" 추가 (냉매점검/냉매충전 row 가 "다른 회사" 로 잘못 분류되던 사고 정정)
const OUR_PRODUCT_KEYWORDS = ["에어컨청소", "에어컨 청소", "피톤치드", "스팀살균", "송풍팬", "냉매"];

// 2026-06-09 — 첫 15자리 문자열 키 (LEFT(digits, 15)).
//   사고: 네이버 원본은 16번째 자리 항상 '1' 인데 DB 저장 시 16번째 자리가 '0' 으로 잘림.
//          16자리 풀매칭/숫자 변환은 양쪽 마지막 자리 차이로 미스 매칭.
//   해법: 양쪽 모두 비숫자 제거 후 첫 15자만 비교. 16번째 자리는 정보 없음(항상 1) → 충돌 X.
//   부수효과: Number 변환 정밀도 한계 (MAX_SAFE_INTEGER ≈ 9.007e15) 우회.
function poidKey(id) {
  if (id == null) return null;
  const digits = String(id).replace(/\D/g, "");
  if (digits.length < 15) return null;
  return digits.slice(0, 15);
}

// 2026-06-11 — splitView=true → PC 2단 (좌: 드롭존 + CsvInfoCard / 우: 분류 결과 + 확정 버튼).
//   디자인만 — 파싱·매칭·확정 로직 일체 동일.
export function UsolNCsvMatch({ splitView = false } = {}) {
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

        // 2026-06-09 — 정산상태 "취소" 포함 row 사전 제외.
        //   대상: "취소", "정산후 취소" 등. 환불 정산은 is_canceled 트리거(Mig 070) 영역.
        //   정산 CSV 가 net_amount / naver_settled_at 을 건드릴 일 X.
        //   백필 스크립트(scripts/backfill-naver-net.cjs:96-97) 와 동일 정책.
        const activeRows = [];
        let canceledCsvCnt = 0;
        rows.forEach(row => {
          const status = String(row["정산상태"] || "");
          if (status.includes("취소")) { canceledCsvCnt += 1; return; }
          activeRows.push(row);
        });
        if (canceledCsvCnt > 0) {
          console.warn(`[UsolNCsvMatch] 정산상태 '취소' 포함 ${canceledCsvCnt}건 — 사전 제외 (UPDATE 대상 아님)`);
        }

        const totalAmount = activeRows.reduce((s, r) => s + toInt(r["정산예정금액"]), 0);

        setCsvData({
          fileName:   file.name,
          uploadedAt: new Date().toISOString(),
          rows: activeRows,
          totalCount:  activeRows.length,
          totalAmount,
          canceledCsvCnt,
        });

        // 1차 분류 — 상품명 측 우리/다른 회사 (productOrderId 측 X 영역도 포함)
        const ourRows   = [];
        const otherRows = [];
        activeRows.forEach(row => {
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

        // [DIAG 2026-07-01] 강성철 추적 — fetchRes 도착 단계
        const DIAG_POID = "2026051334158921";
        const DIAG_TASK_NO = "YS-260514-006";
        const fetchResHit = (fetchRes.items || []).find(it =>
          String(it.product_order_id || "") === DIAG_POID
          || it.tasks?.task_no === DIAG_TASK_NO
        );
        const csvRowHit = ourRows.find(r => r.productOrderId === DIAG_POID);
        console.warn("[DIAG UsolNCsvMatch fetchRes]",
          "ourOrderIds_count:", ourOrderIds.length,
          "ourRows_count:", ourRows.length,
          "fetchRes_items_count:", fetchRes.items?.length || 0,
          "강성철_in_csv_ourRows:", !!csvRowHit,
          "강성철_in_fetchRes:", !!fetchResHit,
          csvRowHit ? { productName: csvRowHit.productName, csv_poid: csvRowHit.productOrderId } : null,
          fetchResHit ? { db_poid: fetchResHit.product_order_id, status: fetchResHit.tasks?.status } : null
        );

        // 2026-06-01 — floor(/10) 키 매칭 + 우선순위.
        //   네이버 상품주문번호 10단위 → 끝자리 떼도 행끼리 충돌 X.
        //   저장 측 ±1 오차 (예 ...071 vs CSV ...070) 흡수.
        //   취소 후보 제외는 lib 측 처리. 같은 floor 키 후보 여럿이면 아래 순위:
        //     1) CSV 와 product_order_id 정확 일치
        //     2) tasks.status='완료'
        //     3) 나머지 (배정/확정/진행중 등 비취소)
        const csvExactSet = new Set(
          ourRows.map(r => String(r.productOrderId).trim()).filter(Boolean)
        );
        function rankItem(item) {
          const exact = csvExactSet.has(String(item.product_order_id)) ? 100 : 0;
          const done  = item.tasks?.status === "완료" ? 10 : 0;
          return exact + done;
        }
        const itemByKey = new Map();
        (fetchRes.items || []).forEach(it => {
          const k = poidKey(it.product_order_id);
          if (k == null) return;
          const existing = itemByKey.get(k);
          if (!existing || rankItem(it) > rankItem(existing)) {
            itemByKey.set(k, it);
          }
        });

        // [DIAG 2026-07-01] 강성철 추적 — itemByKey 단계
        const diagKey = poidKey(DIAG_POID);
        const diagItemInMap = itemByKey.get(diagKey);
        console.warn("[DIAG itemByKey]",
          "itemByKey_size:", itemByKey.size,
          "diagKey:", diagKey,
          "key_in_itemByKey:", itemByKey.has(diagKey),
          "csv_ourRow_poid_key:", csvRowHit ? poidKey(csvRowHit.productOrderId) : null,
          "csv_ourRow_poid_raw:", csvRowHit ? csvRowHit.productOrderId : null,
          "csv_ourRow_poidKey_eq_diagKey:", csvRowHit ? poidKey(csvRowHit.productOrderId) === diagKey : null,
          diagItemInMap ? {
            mapped_task_no: diagItemInMap.tasks?.task_no,
            mapped_customer: diagItemInMap.tasks?.customer_name,
            mapped_poid: diagItemInMap.product_order_id,
          } : null
        );

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

        // [DIAG 2026-07-01] 강성철 추적 — 분류 후 단계
        const inMatchedFresh   = matchedFresh.find(m => m.productOrderId === DIAG_POID);
        const inMatchedAlready = matchedAlready.find(m => m.productOrderId === DIAG_POID);
        const inUnmatched      = unmatched.find(m => m.productOrderId === DIAG_POID);
        const inOther          = otherRows.find(r => r.productOrderId === DIAG_POID);
        console.warn("[DIAG 분류 후]",
          "matchedFresh:", matchedFresh.length,
          "matchedAlready:", matchedAlready.length,
          "unmatched:", unmatched.length,
          "otherCompany:", otherRows.length,
          "강성철_위치:",
            inMatchedFresh   ? "matched_fresh"
          : inMatchedAlready ? "matched_already"
          : inUnmatched      ? "unmatched"
          : inOther          ? "other_company"
          :                    "어디에도_없음"
        );

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

  // 2026-06-09 — 정산예정금액 → 양의 정수 또는 null.
  //   사고: xlsx 측 dtype=int 로 정산예정금액 / 상품주문번호 반환 케이스.
  //         옛 typeof number 분기는 정상이지만 다른 경로 (NaN / 잡음 / 음수)
  //         흡수가 약해 23/30 가 NULL 반환 → net 미스탬프.
  //   처방: 통합 처리 — 모든 입력 String 캐스팅 → 디짓·점·마이너스만 → Number().
  //         양수만 유효 (0/음수/NaN/빈칸 → null. 의미 없는 stamp 차단).
  function parseNetAmount(v) {
    const s = String(v ?? "").replace(/[^0-9.-]/g, "");
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  async function handleConfirmMatching() {
    if (!matchResult?.matched?.length) return;
    setConfirming(true);
    setError("");

    // 2026-06-09 — naver_settled_at + net_amount 동시 stamp.
    //   옛 흐름: 정산완료일 그룹별 markTaskItemsField(단일 필드, naver 만).
    //   현재: items 배열 빌드 → markTaskItemsNaverSettledAndNet (두 필드, 보호 포함).
    //   보호 (engineer_settled_at NOT NULL 또는 net_amount 이미 값) 는 lib 측 처리.

    // 1회용 디버그 — 첫 row 컬럼 구조 콘솔 출력 (확인 후 제거 가능)
    if (matchResult.matched[0]?.row) {
      console.log(
        "[UsolNCsvMatch] matched[0].row 컬럼:",
        Object.keys(matchResult.matched[0].row)
      );
    }

    const SETTLED_DATE_COL = "정산완료일";
    const NET_COL          = "정산예정금액";
    const items   = [];
    const skipped = [];   // {orderId, reason}
    let netNullCnt = 0;   // 정산예정금액 누락/비숫자
    // 2026-06-09 — 진단: net_amount 미반영 사고 추적용. row별 raw → parsed 기록.
    const netDiagSample = [];   // 첫 5건 trace (raw + parsed)

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
      const rawNet = m.row?.[NET_COL];
      const net = parseNetAmount(rawNet);
      if (net == null) netNullCnt += 1;
      if (netDiagSample.length < 5) {
        netDiagSample.push({
          orderId: m.productOrderId,
          itemId: m.item.id,
          raw: rawNet,
          rawType: typeof rawNet,
          parsed: net,
        });
      }
      items.push({
        id: m.item.id,
        naverSettledAt: isoTs,
        netAmount: net,
      });
    }

    if (skipped.length > 0) {
      console.warn("[UsolNCsvMatch] 정산완료일 누락/오류 건:", skipped);
    }
    if (netNullCnt > 0) {
      console.warn(`[UsolNCsvMatch] 정산예정금액 누락/비숫자 ${netNullCnt}건 — net_amount NULL 보존`);
    }
    // 2026-06-09 — 진단 출력: items 전체 + sample
    console.group("[UsolNCsvMatch.handleConfirmMatching] 진단");
    console.log("matched 총건:",   matchResult.matched.length);
    console.log("items pushed:",   items.length);
    console.log("netNullCnt:",     netNullCnt);
    console.log("skippedCnt:",     skipped.length);
    console.log("정산예정금액 컬럼 키 존재:", matchResult.matched[0]?.row && (NET_COL in matchResult.matched[0].row));
    if (netDiagSample.length > 0) {
      console.log("netDiagSample (첫 5건 raw → parsed):");
      console.table(netDiagSample);
    }
    console.groupEnd();

    if (items.length === 0) {
      setConfirming(false);
      setError(
        `전체 ${matchResult.matched.length}건 모두 정산완료일 누락/오류 — 확정 불가.`
      );
      return;
    }

    const res = await markTaskItemsNaverSettledAndNet(items);
    if (!res.ok) {
      setConfirming(false);
      setError(
        res.error
          ? `확정 실패: ${res.error}`
          : `확정 실패: 오류 ${res.errorCount}건 (콘솔 확인)`
      );
      return;
    }
    setConfirming(false);

    setConfirmedInfo({
      count:           res.naverCount,
      netCount:        res.netCount,
      protectedCount:  res.protectedCount,
      timestamp:       new Date().toISOString(),
      skippedCnt:      skipped.length,
      netNullCnt,
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
        <UploadDropZone
          fileInputRef={fileInputRef}
          onFileSelect={handleFileSelect}
          onFile={(file) => handleFileSelect({ target: { files: [file] } })}
        />
        {confirmedInfo && (
          <div style={confirmedBoxStyle}>
            ✓ 직전 결제완료 확정: {confirmedInfo.count}건
            {confirmedInfo.netCount != null && (
              <span style={{ marginLeft: 4 }}>
                · net 반영 {confirmedInfo.netCount}건
              </span>
            )}
            {confirmedInfo.protectedCount > 0 && (
              <div style={{ color: "var(--text-secondary)", fontSize: 11, marginTop: 4 }}>
                🛡 net 보호 {confirmedInfo.protectedCount}건 (기지급 또는 기존 net 보존)
              </div>
            )}
            {confirmedInfo.netNullCnt > 0 && (
              <div style={{ color: "#F59E0B", fontSize: 11, marginTop: 4 }}>
                ⚠️ 정산예정금액 누락 {confirmedInfo.netNullCnt}건 — net_amount NULL (콘솔 확인)
              </div>
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

  const csvInfo = <CsvInfoCard csvData={csvData} onReset={handleReset}/>;
  const errorBox = error && <div style={errorBoxStyle}>⚠️ {error}</div>;
  const classification = matchResult && <ClassificationResults result={matchResult}/>;
  const matchedPreview = matchResult?.matched?.length > 0 && (
    <MatchedItemsPreview items={matchResult.matched}/>
  );
  const unmatchedList = matchResult?.unmatched?.length > 0 && (
    <UnmatchedItemsList items={matchResult.unmatched}/>
  );
  const confirmBtn = (
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
  );

  // 2026-06-11 — splitView: PC 2단 (좌: CsvInfoCard + 확정 버튼 / 우: 분류·매칭·미매칭). 로직 동일.
  if (splitView) {
    return (
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
        gap: 20,
        alignItems: "start",
      }}>
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          {csvInfo}
          {errorBox}
          {confirmBtn}
        </div>
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          {classification}
          {matchedPreview}
          {unmatchedList}
        </div>
      </div>
    );
  }

  return (
    <div>
      {csvInfo}
      {errorBox}
      {classification}
      {matchedPreview}
      {unmatchedList}
      {confirmBtn}
    </div>
  );
}

function UploadDropZone({ fileInputRef, onFileSelect, onFile }) {
  // 2026-06-08 — 드래그 앤 드롭 (UsolNOrders 패턴 정합 / 핑크 톤 유지)
  //   사장님 spec — 라벨에 "정산 CSV" 명시해 엉뚱한 탭 드롭 사고 방지.
  const [isDragging, setIsDragging] = useState(false);

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  }
  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }
  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && typeof onFile === "function") onFile(file);
  }

  const activeStyle = isDragging
    ? {
        background: "var(--accent-bg-strong)",
        border: "3px dashed var(--accent)",
        transform: "scale(1.01)",
      }
    : {
        background: "var(--accent-bg)",
        border: "2px dashed var(--accent-border)",
      };

  return (
    <div
      onClick={() => fileInputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        padding: 30,
        borderRadius: 12, textAlign: "center",
        cursor: "pointer", marginBottom: 16,
        transition: "background 0.12s, border 0.12s, transform 0.12s",
        ...activeStyle,
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 8 }}>{isDragging ? "📂" : "📥"}</div>
      <div style={{ fontSize: TEXT.HEADER, color: "var(--accent)", fontWeight: 700 }}>
        {isDragging ? "여기에 놓으세요 — 정산 CSV" : "정산 CSV 업로드"}
      </div>
      <div style={{ fontSize: TEXT.META, color: "var(--text-secondary)", marginTop: 4 }}>
        유솔이 매일 보내주는 정산 엑셀 — 클릭 또는 끌어다 놓기
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
      background: "var(--accent-bg)",
      border: "1px solid var(--accent)",
      borderRadius: 10, marginBottom: 14,
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <div>
        <div style={{ fontSize: TEXT.LABEL, color: "var(--accent)", fontWeight: 700, marginBottom: 4 }}>
          📥 분석 중인 CSV
        </div>
        <div style={{ fontSize: TEXT.BODY, color: "var(--text-primary)", fontWeight: 600 }}>
          {csvData.fileName}
        </div>
        <div style={{ fontSize: TEXT.META, color: "var(--text-secondary)", marginTop: 2 }}>
          총 {csvData.totalCount}건 · ₩{csvData.totalAmount.toLocaleString()}
        </div>
      </div>
      <button onClick={onReset} style={{
        padding: "7px 14px", background: "transparent",
        border: "1px solid var(--border)", borderRadius: 6,
        color: "var(--text-secondary)", fontSize: TEXT.META, cursor: "pointer",
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
        <span style={{ fontSize: TEXT.STATUS }}>{icon}</span>
        <span style={{
          fontSize: TEXT.STATUS,
          color: muted ? "var(--text-secondary)" : color,
          fontWeight: muted ? 500 : 700,
        }}>
          {label}
        </span>
        <span style={{
          fontSize: TEXT.BODY,
          color: muted ? "var(--text-secondary)" : color,
          fontWeight: 700, marginLeft: 4,
        }}>
          {count}건
        </span>
      </div>
      {rightExtra && (
        <span style={{
          fontSize: TEXT.META,
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
      <div style={{ fontSize: TEXT.HEADER, color: "var(--text-secondary)", fontWeight: 700, marginBottom: 8 }}>
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
      <div style={{ fontSize: TEXT.HEADER, color: "#F59E0B", fontWeight: 700, marginBottom: 8 }}>
        ⚠️ 미매칭 항목 ({items.length})
      </div>
      <div style={{
        background: "rgba(245,158,11,0.04)",
        border: "1px dashed rgba(245,158,11,0.3)",
        borderRadius: 8, padding: 12,
        fontSize: TEXT.META, color: "var(--text-secondary)", lineHeight: 1.7,
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
      color: "var(--text-secondary)", fontSize: TEXT.META,
      background: "var(--bg-secondary)",
      border: "1px dashed var(--border)",
      borderRadius: 10,
    }}>{children}</div>
  );
}

const confirmButtonStyle = {
  width: "100%", marginTop: 16, padding: 16,
  background: "var(--accent)",
  border: "none", borderRadius: 10,
  color: "#fff", fontSize: TEXT.BODY, fontWeight: 700,
  fontFamily: "inherit",
  transition: "transform 0.1s, box-shadow 0.1s",
};

const confirmedBoxStyle = {
  padding: 12,
  background: "rgba(29,158,117,0.10)",
  border: "1px solid rgba(29,158,117,0.4)",
  borderRadius: 8, marginBottom: 12,
  color: "#1D9E75", fontSize: TEXT.META, fontWeight: 600,
  textAlign: "center",
};

const errorBoxStyle = {
  padding: 10,
  background: "rgba(255,68,68,0.08)",
  border: "1px solid rgba(255,68,68,0.3)",
  borderRadius: 8, marginBottom: 12,
  color: "#ff4444", fontSize: TEXT.META, fontWeight: 600,
};

export default UsolNCsvMatch;
