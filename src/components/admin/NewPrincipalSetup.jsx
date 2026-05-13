// Phase B-3 — 새 원청 기본 정책 12건 자동 생성
// PrincipalEditScreen 측 (isNew=true && 저장 완료 후) 표시
// 정책 미리보기 표 + "기본 정책 생성 (12건)" 버튼

import { useState } from "react";
import {
  generateDefaultPolicies,
  insertCommissionPolicies,
  DEFAULT_APPLIANCES,
} from "../../lib/commissionPoliciesDb.js";

export function NewPrincipalSetup({ principalCode, onCreated }) {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [done, setDone] = useState(false);

  async function handleCreatePolicies() {
    if (!principalCode) {
      setToast({ type: "warn", message: "원청 코드가 없습니다" });
      return;
    }
    setBusy(true);
    setToast(null);
    const policies = generateDefaultPolicies(principalCode);
    const res = await insertCommissionPolicies(policies);
    setBusy(false);
    if (res.ok) {
      const cnt = (res.data && res.data.length) || policies.length;
      setToast({ type: "success", message: `정책 ${cnt}건 생성 완료` });
      setDone(true);
      setTimeout(() => onCreated && onCreated(res.data), 700);
    } else {
      setToast({ type: "warn", message: `생성 실패: ${res.error || "알 수 없는 오류"}` });
    }
  }

  return (
    <div>
      <div style={infoBoxStyle}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>
          💡 기본 정책 12건을 자동 생성합니다
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          크리크린 정책 기준 (견적금액 × 20%)으로 생성됩니다.<br/>
          생성 후 자유롭게 수정할 수 있습니다.
        </div>
      </div>

      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>작업 유형</th>
              <th style={thStyle}>기종</th>
              <th style={{ ...thStyle, textAlign: "right" }}>기사 단가</th>
              <th style={{ ...thStyle, textAlign: "right" }}>수수료율</th>
            </tr>
          </thead>
          <tbody>
            {DEFAULT_APPLIANCES.map((app, i) => (
              <tr key={`cleaning_${app.key}`}>
                {i === 0 && (
                  <td style={{ ...tdStyle, fontWeight: 600, verticalAlign: "middle" }} rowSpan={6}>
                    🧽 세척
                  </td>
                )}
                <td style={tdStyle}>{app.key}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{app.base.toLocaleString()}원</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>20%</td>
              </tr>
            ))}
            {DEFAULT_APPLIANCES.map((app, i) => (
              <tr key={`refrigerant_${app.key}`}>
                {i === 0 && (
                  <td style={{ ...tdStyle, fontWeight: 600, verticalAlign: "middle" }} rowSpan={6}>
                    ❄️ 냉매
                  </td>
                )}
                <td style={tdStyle}>{app.key}</td>
                <td style={{ ...tdStyle, textAlign: "right", color: "var(--text-tertiary)" }}>—</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>20%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14 }}>
        <button
          type="button"
          onClick={handleCreatePolicies}
          disabled={busy || done}
          style={{
            ...pinkBtnStyle,
            opacity: (busy || done) ? 0.5 : 1,
            cursor: (busy || done) ? "default" : "pointer",
          }}
        >
          {done ? "✓ 생성 완료" : busy ? "생성 중..." : "기본 정책 생성 (12건)"}
        </button>
      </div>

      {toast && (
        <div style={{
          marginTop: 10,
          padding: "8px 12px",
          background: toast.type === "success"
            ? "rgba(0, 135, 90, 0.10)"
            : "rgba(245, 158, 11, 0.10)",
          border: `1px solid ${
            toast.type === "success" ? "rgba(0, 135, 90, 0.30)" : "rgba(245, 158, 11, 0.40)"
          }`,
          borderRadius: 8,
          color: toast.type === "success" ? "#00875A" : "#B45309",
          fontSize: 12, lineHeight: 1.5, textAlign: "center",
        }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ===== 스타일 =====
const infoBoxStyle = {
  padding: "12px 14px",
  background: "rgba(255, 27, 141, 0.06)",
  border: "1px solid rgba(255, 27, 141, 0.20)",
  borderRadius: 10,
};
const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 8,
};
const thStyle = {
  padding: "8px 10px",
  textAlign: "left",
  fontWeight: 600,
  color: "var(--text-secondary)",
  borderBottom: "1px solid var(--border)",
  background: "var(--bg-tertiary)",
};
const tdStyle = {
  padding: "7px 10px",
  color: "var(--text-primary)",
  borderBottom: "1px solid var(--border)",
};
const pinkBtnStyle = {
  width: "100%",
  padding: "11px 16px",
  background: "#FF1B8D",
  border: "none",
  borderRadius: 8,
  color: "#fff",
  fontSize: 13,
  fontWeight: 700,
  fontFamily: "inherit",
};

export default NewPrincipalSetup;
