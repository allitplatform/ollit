// Phase 2 — 수수료 정책 수정 모달
// 디자인 — 원청관리 스타일 통일 (CSS 변수)
// 박은 영역: engineer_base / fee_rate / principal_fee / notes
// 박지 X (immutable): id / tenant_id / category_id / policy_key

import { useState } from "react";
import {
  updateCommissionPolicy,
  PRINCIPAL_LABEL,
  SERVICE_LABEL,
  CALC_METHOD_LABEL,
  CALC_METHOD_DESC,
  QTY_LABEL,
} from "../../lib/commissionPoliciesDb.js";

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
        if (!Number.isFinite(n)) { setError("기사 단가 박은 영역 숫자 박을 영역"); setBusy(false); return; }
        patch.engineer_base = n;
      }
      if (feeRate !== "" && Number(feeRate) !== Number(policy.fee_rate)) {
        const r = parseFloat(feeRate);
        if (!Number.isFinite(r) || r < 0 || r > 1) { setError("수수료율 박은 영역 0~1 사이 박을 영역"); setBusy(false); return; }
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
  const calcLabel      = CALC_METHOD_LABEL[policy.calc_method]  || policy.calc_method;
  const calcDesc       = CALC_METHOD_DESC[policy.calc_method]   || "";
  const qtyLabel       = policy.qty_condition ? (QTY_LABEL[policy.qty_condition] || policy.qty_condition) : "";

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={modalStyle}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>
          {principalLabel} · {serviceLabel}
          {policy.appliance_code && ` · ${policy.appliance_code}`}
        </div>
        {qtyLabel && (
          <div style={{ fontSize: 11, color: "#FFB800", marginBottom: 4 }}>
            수량 조건: {qtyLabel}
          </div>
        )}
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
          <span style={{ color: "#FF1B8D", fontWeight: 600 }}>{calcLabel}</span>
          {calcDesc && <span> — {calcDesc}</span>}
        </div>
        <div style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "monospace", opacity: 0.6, marginBottom: 20 }}>
          {policy.policy_key}
        </div>

        <FormRow label="기사 단가">
          <input
            type="number"
            value={engineerBase}
            onChange={(e) => setEngineerBase(e.target.value)}
            placeholder="40000"
            style={inputStyle}
          />
        </FormRow>

        <FormRow label="수수료율 (0~1 사이 / 예: 0.15 = 15%)">
          <input
            type="number"
            step="0.01"
            value={feeRate}
            onChange={(e) => setFeeRate(e.target.value)}
            placeholder="0.15"
            style={inputStyle}
          />
        </FormRow>

        <FormRow label="원청 수수료 (정액 / 예: 10000)">
          <input
            type="text"
            value={principalFee}
            onChange={(e) => setPrincipalFee(e.target.value)}
            placeholder="10000"
            style={inputStyle}
          />
        </FormRow>

        <FormRow label="추가 메모 (JSON 형식 / 가짜단가 박은 영역)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder='{"fake_base":{"벽걸이":50000,...}}'
            style={{ ...inputStyle, minHeight: 80, fontFamily: "monospace", fontSize: 12, resize: "vertical" }}
          />
        </FormRow>

        {error && (
          <div style={{ marginTop: 12 }}>
            <div style={errorStyle}>{error}</div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button type="button" onClick={onClose} disabled={busy} style={ghostBtnStyle}>
            취소
          </button>
          <button type="button" onClick={handleSave} disabled={busy} style={{
            ...pinkBtnStyle,
            opacity: busy ? 0.6 : 1,
          }}>
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
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, fontWeight: 500 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

// ============= 스타일 =============
const overlayStyle = {
  position: "fixed", inset: 0,
  background: "rgba(0, 0, 0, 0.7)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 9999, padding: 20,
};
const modalStyle = {
  background: "var(--bg-primary)",
  borderRadius: 14,
  padding: 24,
  maxWidth: 480, width: "100%",
  maxHeight: "90vh", overflowY: "auto",
  fontFamily: "-apple-system, 'Pretendard', sans-serif",
  color: "var(--text-primary)",
  border: "1px solid var(--border)",
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
const ghostBtnStyle = {
  flex: 1,
  background: "transparent",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
  borderRadius: 10,
  padding: "12px 16px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};
const pinkBtnStyle = {
  flex: 2,
  background: "#FF1B8D",
  border: "none",
  color: "#FFF",
  borderRadius: 10,
  padding: "12px 16px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};
const errorStyle = {
  padding: "10px 14px",
  background: "rgba(255, 59, 92, 0.10)",
  border: "1px solid rgba(255, 59, 92, 0.30)",
  borderRadius: 10,
  color: "#FF3B5C",
  fontSize: 13,
};
