// Phase 2 — 수수료 정책 수정 모달
// admin / operator 박은 영역 (RLS 박은 영역)
// 박은 영역 박은 영역: engineer_base / fee_rate / principal_fee / notes
// 박지 X 박은 영역: id / tenant_id / category_id / policy_key (immutable)

import { useState } from "react";
import { updateCommissionPolicy, PRINCIPAL_LABEL, SERVICE_LABEL, CALC_METHOD_DESC } from "../../lib/commissionPoliciesDb.js";

export function CommissionPolicyEditModal({ policy, onClose, onSaved }) {
  const [engineerBase, setEngineerBase] = useState(policy.engineer_base ?? "");
  const [feeRate, setFeeRate]           = useState(policy.fee_rate ?? "");
  const [principalFee, setPrincipalFee] = useState(policy.principal_fee ?? "");
  const [notes, setNotes]               = useState(policy.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setError("");
    setBusy(true);
    try {
      const patch = {};
      if (engineerBase !== "" && engineerBase !== policy.engineer_base) {
        const n = parseInt(engineerBase, 10);
        if (!Number.isFinite(n)) { setError("engineer_base 숫자 박을 영역"); setBusy(false); return; }
        patch.engineer_base = n;
      }
      if (feeRate !== "" && Number(feeRate) !== Number(policy.fee_rate)) {
        const r = parseFloat(feeRate);
        if (!Number.isFinite(r) || r < 0 || r > 1) { setError("fee_rate 박은 영역 0~1 사이 박을 영역"); setBusy(false); return; }
        patch.fee_rate = r;
      }
      if (principalFee !== policy.principal_fee) {
        patch.principal_fee = principalFee === "" ? null : String(principalFee);
      }
      if (notes !== policy.notes) {
        patch.notes = notes === "" ? null : notes;
      }

      if (Object.keys(patch).length === 0) {
        setError("변경된 내용이 없습니다");
        setBusy(false);
        return;
      }

      const res = await updateCommissionPolicy(policy.id, patch);
      if (!res.ok) {
        setError(res.error || "저장 실패");
        return;
      }
      onSaved(res.data);
    } catch (e) {
      setError(e?.message || "저장 실패 (네트워크)");
    } finally {
      setBusy(false);
    }
  };

  const principalLabel = PRINCIPAL_LABEL[policy.principal_code] || policy.principal_code;
  const serviceLabel   = SERVICE_LABEL[policy.service_code]     || policy.service_code;

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={modalStyle}>
        <div style={{ fontSize: 11, color: "#888", fontFamily: "monospace", marginBottom: 4 }}>
          {policy.policy_key}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
          {principalLabel} · {serviceLabel}
          {policy.appliance_code && ` · ${policy.appliance_code}`}
        </div>
        {policy.qty_condition && (
          <div style={{ fontSize: 12, color: "#FFB800", marginBottom: 4 }}>
            qty: {policy.qty_condition}
          </div>
        )}
        <div style={{ fontSize: 12, color: "#aaa", marginBottom: 16 }}>
          {policy.calc_method} — {CALC_METHOD_DESC[policy.calc_method] || ""}
        </div>

        <FormRow label="engineer_base (기사 단가)">
          <input
            type="number"
            value={engineerBase}
            onChange={(e) => setEngineerBase(e.target.value)}
            placeholder="40000"
            style={inputStyle}
          />
        </FormRow>

        <FormRow label="fee_rate (비율 / 0~1)">
          <input
            type="number"
            step="0.01"
            value={feeRate}
            onChange={(e) => setFeeRate(e.target.value)}
            placeholder="0.15"
            style={inputStyle}
          />
        </FormRow>

        <FormRow label="principal_fee (원청 정액 / text)">
          <input
            type="text"
            value={principalFee}
            onChange={(e) => setPrincipalFee(e.target.value)}
            placeholder="10000"
            style={inputStyle}
          />
        </FormRow>

        <FormRow label="notes (가짜단가 JSON 박은 영역)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder='{"fake_base":{"벽걸이":50000,...}}'
            style={{ ...inputStyle, minHeight: 80, fontFamily: "monospace", fontSize: 12 }}
          />
        </FormRow>

        {error && (
          <div style={{
            marginTop: 12, padding: 10,
            background: "rgba(255, 59, 92, 0.10)",
            border: "1px solid rgba(255, 59, 92, 0.30)",
            borderRadius: 8, color: "#FF3B5C", fontSize: 13,
          }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button type="button" onClick={onClose} disabled={busy} style={btnGhost}>취소</button>
          <button type="button" onClick={handleSave} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>
            {busy ? "저장중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormRow({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: "#aaa", marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

// ============= 스타일 =============
const overlayStyle = {
  position: "fixed", inset: 0,
  background: "rgba(0,0,0,0.8)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 9999, padding: 20,
};
const modalStyle = {
  background: "#1C1C1E",
  borderRadius: 16,
  padding: 24,
  maxWidth: 480, width: "100%",
  maxHeight: "90vh", overflowY: "auto",
  fontFamily: "-apple-system, 'Pretendard', sans-serif",
  color: "#FFF",
};
const inputStyle = {
  width: "100%",
  background: "#0A0A0A",
  border: "1px solid #2A2A2A",
  color: "#FFF",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};
const btnGhost = {
  flex: 1,
  background: "transparent",
  border: "1px solid #2A2A2A",
  color: "#FFF",
  borderRadius: 10,
  padding: "12px 16px",
  fontSize: 14,
  cursor: "pointer",
  fontFamily: "inherit",
};
const btnPrimary = {
  flex: 2,
  background: "#FF1B8D",
  border: "none",
  color: "#FFF",
  borderRadius: 10,
  padding: "12px 16px",
  fontSize: 14, fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};
