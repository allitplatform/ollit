// V11-2 — 유솔 N · 정산 CSV 매칭 탭
// CSV 업로드 → 자동 분류 (우리/다른 회사/미매칭) → 일괄 확정
import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { autoMatchSettlementCsv, confirmMatching } from "../../utils/usolNAutoMatch.js";

export function UsolNCsvMatch() {
  const [csvData, setCsvData]         = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const fileInputRef = useRef(null);

  function toInt(v) {
    if (v == null || v === "") return 0;
    const s = String(v).replace(/[^\d.\-]/g, "");
    const n = parseInt(s, 10);
    return isNaN(n) ? 0 : n;
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data  = new Uint8Array(evt.target.result);
        const wb    = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows  = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        const totalAmount = rows.reduce((s, r) => s + toInt(r["정산예정금액"]), 0);

        setCsvData({
          fileName: file.name,
          uploadedAt: new Date().toISOString(),
          rows,
          totalCount: rows.length,
          totalAmount,
        });
        setMatchResult(autoMatchSettlementCsv(rows));
        setConfirmedCount(0);
      } catch (err) {
        console.error("[UsolNCsvMatch.parse]", err);
        alert("CSV 파싱 실패: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function handleConfirmMatching() {
    if (!matchResult?.matched?.length) return;
    const updated = confirmMatching(matchResult.matched);
    setConfirmedCount(updated.length);
    setCsvData(null);
    setMatchResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleReset() {
    setCsvData(null);
    setMatchResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (!csvData) {
    return (
      <div>
        <UploadDropZone fileInputRef={fileInputRef} onFileSelect={handleFileSelect}/>
        {confirmedCount > 0 && (
          <div style={{
            padding: 12,
            background: "rgba(29,158,117,0.10)",
            border: "1px solid rgba(29,158,117,0.4)",
            borderRadius: 8, marginBottom: 12,
            color: "#1D9E75", fontSize: 12, fontWeight: 600,
            textAlign: "center",
          }}>
            ✓ 직전 매칭 확정: {confirmedCount}건 정산 정보 업데이트 완료
          </div>
        )}
        <Empty>오늘 받은 정산 CSV를 업로드하세요</Empty>
      </div>
    );
  }

  return (
    <div>
      <CsvInfoCard csvData={csvData} onReset={handleReset}/>
      <ClassificationResults result={matchResult}/>

      {matchResult?.matched?.length > 0 && (
        <MatchedItemsPreview items={matchResult.matched}/>
      )}

      {matchResult?.unmatched?.length > 0 && (
        <UnmatchedItemsList items={matchResult.unmatched}/>
      )}

      <button
        onClick={handleConfirmMatching}
        disabled={!matchResult?.matched?.length}
        style={{
          ...confirmButtonStyle,
          opacity: matchResult?.matched?.length ? 1 : 0.5,
          cursor: matchResult?.matched?.length ? "pointer" : "not-allowed",
        }}
      >
        {matchResult?.matched?.length || 0}건 매칭 확정
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
      background: "linear-gradient(135deg, rgba(255,27,141,0.12), rgba(168,85,247,0.04))",
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
        label="우리 매칭"
        count={result.matched.length}
        rightExtra={`₩${totalMatchedAmount.toLocaleString()}`}
        color="#03C75A"
        accent
      />
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
          rightExtra="확인 필요"
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
          fontFamily: "monospace",
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
      {items.slice(0, 5).map((item, idx) => {
        const row         = item.row || {};
        const productName = row["상품명"] || "";
        const isExtra     = !productName.includes("에어컨청소") && !productName.includes("에어컨 청소");
        const netAmount   = parseInt(row["정산예정금액"]) || 0;

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
                  {row["구매자명"] || row["수취인명"] || "—"}
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
                fontFamily: "monospace",
              }}>
                ₩{netAmount.toLocaleString()}
              </span>
            </div>
            <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>
              {productName.length > 40 ? productName.slice(0, 40) + "..." : productName}
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
  background: "linear-gradient(135deg, #03C75A, #02A847)",
  border: "none", borderRadius: 10,
  color: "#fff", fontSize: 13, fontWeight: 700,
  fontFamily: "inherit",
  boxShadow: "0 2px 6px rgba(3,199,90,0.3)",
  transition: "transform 0.1s, box-shadow 0.1s",
};

export default UsolNCsvMatch;
