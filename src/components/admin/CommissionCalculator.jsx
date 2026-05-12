// Phase 2 — 수수료 계산기 (calculate_commission RPC 박은 영역)
// 사용자 입력 → RPC 호출 → 결과 표시 (principal / engineer / company)

import { useState } from "react";
import { calculateCommissionRpc } from "../../lib/commissionPoliciesDb.js";

const PRINCIPAL_OPTIONS = [
  { value: "allday",  label: "올데이케어" },
  { value: "KA",      label: "에어컨프로 (KA)" },
  { value: "KB",      label: "쿨가이 (KB)" },
  { value: "yongin",  label: "용인컴퍼니" },
  { value: "usol_h",  label: "유솔H" },
  { value: "usol_n",  label: "유솔N" },
  { value: "crikrin", label: "크리크린" },
  { value: "common",  label: "공통 (출장비)" },
];

const SERVICE_OPTIONS = [
  { value: "cleaning",    label: "세척" },
  { value: "refrigerant", label: "냉매충전" },
  { value: "addon",       label: "추가선택" },
  { value: "visit_fee",   label: "출장비" },
];

const APPLIANCE_OPTIONS = [
  { value: "",       label: "(없음 / 출장비·냉매점검)" },
  { value: "벽걸이", label: "벽걸이" },
  { value: "1way",   label: "1way" },
  { value: "스탠드", label: "스탠드" },
  { value: "4way",   label: "4way" },
  { value: "원형",   label: "원형" },
  { value: "투인원", label: "투인원" },
  // 유솔N 추가선택
  { value: "송풍팬분해", label: "송풍팬분해 (유솔N 추가)" },
  { value: "실외기",     label: "실외기 (유솔N 추가)" },
  { value: "피톤치드",   label: "피톤치드 (유솔N 추가)" },
];

const QTY_OPTIONS = [
  { value: "",     label: "(NULL)" },
  { value: "첫대", label: "첫대 (KA 1way 박은 영역)" },
  { value: "추가", label: "추가 (KA 1way 박은 영역)" },
];

export function CommissionCalculator({ onBack }) {
  const [principal, setPrincipal] = useState("KA");
  const [service, setService]     = useState("refrigerant");
  const [appliance, setAppliance] = useState("벽걸이");
  const [quoted, setQuoted]       = useState("70000");
  const [extra, setExtra]         = useState("0");
  const [naverFee, setNaverFee]   = useState("0");
  const [qty, setQty]             = useState("");
  const [result, setResult]       = useState(null);
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState("");

  const handleCalculate = async () => {
    setError("");
    setResult(null);
    setBusy(true);
    try {
      const res = await calculateCommissionRpc({
        principalCode: principal,
        serviceCode:   service,
        applianceCode: appliance,
        quotedAmount:  Number(quoted)   || 0,
        extraAmount:   Number(extra)    || 0,
        naverFee:      Number(naverFee) || 0,
        qtyCondition:  qty || null,
      });
      if (!res || !res.ok) {
        setError(res?.error || "계산 실패");
        return;
      }
      setResult(res);
    } catch (e) {
      setError(e?.message || "계산 실패 (네트워크)");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 16, minHeight: "100vh", background: "#0A0A0A", color: "#FFF" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        {onBack && <button onClick={onBack} style={btnGhost}>← 뒤로</button>}
        <div style={{ fontSize: 20, fontWeight: 700 }}>수수료 계산기</div>
      </div>

      <div style={{ maxWidth: 480 }}>
        <Row label="원청">
          <select value={principal} onChange={(e) => setPrincipal(e.target.value)} style={selectStyle}>
            {PRINCIPAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Row>
        <Row label="서비스">
          <select value={service} onChange={(e) => setService(e.target.value)} style={selectStyle}>
            {SERVICE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Row>
        <Row label="기종">
          <select value={appliance} onChange={(e) => setAppliance(e.target.value)} style={selectStyle}>
            {APPLIANCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Row>
        <Row label="qty_condition (KA 1way 박은 영역)">
          <select value={qty} onChange={(e) => setQty(e.target.value)} style={selectStyle}>
            {QTY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Row>
        <Row label="견적금액 (판매가)">
          <input type="number" value={quoted} onChange={(e) => setQuoted(e.target.value)} style={inputStyle}/>
        </Row>
        <Row label="현장추가금">
          <input type="number" value={extra} onChange={(e) => setExtra(e.target.value)} style={inputStyle}/>
        </Row>
        <Row label="네이버 수수료 (유솔N만)">
          <input type="number" value={naverFee} onChange={(e) => setNaverFee(e.target.value)} style={inputStyle}/>
        </Row>

        <button onClick={handleCalculate} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1, marginTop: 12 }}>
          {busy ? "계산중..." : "계산"}
        </button>

        {error && (
          <div style={{
            marginTop: 16, padding: 12,
            background: "rgba(255, 59, 92, 0.10)",
            border: "1px solid rgba(255, 59, 92, 0.30)",
            borderRadius: 8, color: "#FF3B5C", fontSize: 13,
          }}>{error}</div>
        )}

        {result && result.ok && (
          <div style={{ marginTop: 20, padding: 16, background: "#1C1C1E", border: "1px solid #2A2A2A", borderRadius: 12 }}>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 8, fontFamily: "monospace" }}>
              {result.policy_key} · {result.calc_method}
            </div>
            <ResultRow label="총금액" value={result.total} highlight={false}/>
            <ResultRow label="원청 (principal)" value={result.principal} color="#FFB800"/>
            <ResultRow label="기사 (engineer)" value={result.engineer} color="#10B981"/>
            <ResultRow label="회사 (company)" value={result.company} color="#FF1B8D"/>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: "#aaa", marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

function ResultRow({ label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span style={{ color: "#aaa", fontSize: 13 }}>{label}</span>
      <span style={{ color: color || "#FFF", fontSize: 15, fontWeight: 600 }}>
        {Number(value || 0).toLocaleString()}원
      </span>
    </div>
  );
}

// ============= 스타일 =============
const btnGhost = {
  background: "transparent",
  border: "1px solid #2A2A2A",
  color: "#FFF",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
};
const btnPrimary = {
  width: "100%",
  background: "#FF1B8D",
  border: "none",
  color: "#FFF",
  borderRadius: 10,
  padding: "14px 16px",
  fontSize: 15, fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};
const selectStyle = {
  width: "100%",
  background: "#1C1C1E",
  border: "1px solid #2A2A2A",
  color: "#FFF",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "inherit",
  boxSizing: "border-box",
};
const inputStyle = {
  width: "100%",
  background: "#1C1C1E",
  border: "1px solid #2A2A2A",
  color: "#FFF",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};
