// Phase 2 — 수수료 계산기 (calculate_commission RPC 박은 영역)
// 디자인 — 원청관리 스타일 통일 (CSS 변수)

import { useState } from "react";
import {
  calculateCommissionRpc,
  CALC_METHOD_LABEL,
} from "../../lib/commissionPoliciesDb.js";

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
  { value: "송풍팬분해", label: "송풍팬분해 (유솔N 추가 옵션)" },
  { value: "실외기",     label: "실외기 (유솔N 추가 옵션)" },
  { value: "피톤치드",   label: "피톤치드 (유솔N 추가 옵션)" },
];

const QTY_OPTIONS = [
  { value: "",     label: "(없음)" },
  { value: "첫대", label: "첫 대" },
  { value: "추가", label: "추가 (2번째부터)" },
];

export function CommissionCalculator() {
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

  const showQty = principal === "KA" && service === "refrigerant" && appliance === "1way";

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
    <div style={{ padding: "16px 16px 80px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <Row label="원청">
          <select value={principal} onChange={(e) => setPrincipal(e.target.value)} style={selectStyle}>
            {PRINCIPAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Row>
        <Row label="작업 유형">
          <select value={service} onChange={(e) => setService(e.target.value)} style={selectStyle}>
            {SERVICE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Row>
        <Row label="기종">
          <select value={appliance} onChange={(e) => setAppliance(e.target.value)} style={selectStyle}>
            {APPLIANCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Row>
        {showQty && (
          <Row label="수량 조건 (에어컨프로 1way 박은 영역 — 첫 대 / 추가)">
            <select value={qty} onChange={(e) => setQty(e.target.value)} style={selectStyle}>
              {QTY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Row>
        )}
        <Row label="견적금액 (판매가)">
          <input type="number" value={quoted} onChange={(e) => setQuoted(e.target.value)} style={inputStyle}/>
        </Row>
        <Row label="현장 추가금">
          <input type="number" value={extra} onChange={(e) => setExtra(e.target.value)} style={inputStyle}/>
        </Row>
        <Row label="네이버 수수료 (유솔N만)">
          <input type="number" value={naverFee} onChange={(e) => setNaverFee(e.target.value)} style={inputStyle}/>
        </Row>

        <button type="button" onClick={handleCalculate} disabled={busy} style={{
          ...pinkBtnStyle,
          opacity: busy ? 0.6 : 1,
          marginTop: 16,
        }}>
          {busy ? "계산중..." : "계산"}
        </button>

        {error && (
          <div style={{ marginTop: 16 }}>
            <div style={errorStyle}>{error}</div>
          </div>
        )}

        {result && result.ok && (
          <div style={resultCardStyle}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: "#FF1B8D" }}>
              {CALC_METHOD_LABEL[result.calc_method] || result.calc_method}
            </div>
            <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginBottom: 12, fontFamily: "monospace", opacity: 0.6 }}>
              {result.policy_key}
            </div>
            <ResultRow label="총금액" value={result.total} color="var(--text-primary)"/>
            <ResultRow label="원청 수수료" value={result.principal} color="#FFB800"/>
            <ResultRow label="기사 수익" value={result.engineer} color="#10B981"/>
            <ResultRow label="회사 이익" value={result.company} color="#FF1B8D"/>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, fontWeight: 500 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function ResultRow({ label, value, color }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      padding: "8px 0",
      borderBottom: "1px solid var(--border)",
    }}>
      <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{label}</span>
      <span style={{ color: color || "var(--text-primary)", fontSize: 15, fontWeight: 700 }}>
        {Number(value || 0).toLocaleString()}원
      </span>
    </div>
  );
}

// ============= 스타일 =============
const selectStyle = {
  width: "100%",
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "inherit",
  boxSizing: "border-box",
};
const inputStyle = {
  width: "100%",
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};
const pinkBtnStyle = {
  width: "100%",
  background: "#FF1B8D",
  border: "none",
  color: "#FFF",
  borderRadius: 10,
  padding: "14px 16px",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};
const resultCardStyle = {
  marginTop: 20,
  padding: 16,
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 12,
};
const errorStyle = {
  padding: "10px 14px",
  background: "rgba(255, 59, 92, 0.10)",
  border: "1px solid rgba(255, 59, 92, 0.30)",
  borderRadius: 10,
  color: "#FF3B5C",
  fontSize: 13,
};
