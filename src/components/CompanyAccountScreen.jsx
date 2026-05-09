// Step 5-8 F-4 — 회사 계좌 관리 화면 (운영자/관리자)
// 시트 설정_회사 양방향 sync. 변경 시 모든 기사 정산 화면에 즉시 반영.

import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import {
  loadCompanyAccount,
  saveCompanyAccountWithSync,
  fetchCompanyAccount,
} from "../data/companyAccount.js";

const backBtnStyle = {
  background: "transparent", border: "none",
  color: "var(--text-primary)", fontSize: 14,
  cursor: "pointer", fontFamily: "inherit",
  padding: "4px 10px",
  display: "flex", alignItems: "center", gap: 4,
};

const inputStyle = {
  width: "100%", padding: 14,
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-primary)",
  fontSize: 15,
  boxSizing: "border-box", outline: "none",
  fontFamily: "inherit",
};

export function CompanyAccountScreen({ onBack }) {
  const [current, setCurrent] = useState(() => loadCompanyAccount());
  const [bankName, setBankName] = useState(current.bankName || "");
  const [accountNumber, setAccountNumber] = useState(current.accountNumber || "");
  const [accountHolder, setAccountHolder] = useState(current.accountHolder || "");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // 진입 시 시트 fetch (캐시 갱신)
  useEffect(() => {
    fetchCompanyAccount().then(data => {
      if (data) {
        setCurrent(data);
        setBankName(data.bankName || "");
        setAccountNumber(data.accountNumber || "");
        setAccountHolder(data.accountHolder || "");
      }
    });
  }, []);

  const valid = !!bankName.trim() && !!accountNumber.trim() && !!accountHolder.trim();
  const dirty =
    bankName.trim()      !== (current.bankName      || "") ||
    accountNumber.trim() !== (current.accountNumber || "") ||
    accountHolder.trim() !== (current.accountHolder || "");

  function showToast(msg, color = "#00875A") {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSave() {
    if (!valid || !dirty || saving) return;
    setSaving(true);
    const payload = {
      bankName:      bankName.trim(),
      accountNumber: accountNumber.trim(),
      accountHolder: accountHolder.trim(),
    };
    const res = await saveCompanyAccountWithSync(payload);
    setSaving(false);
    if (res.ok) {
      const next = loadCompanyAccount();
      setCurrent(next);
      showToast("✓ 회사 계좌가 갱신되었습니다", "#00875A");
    } else if (res.localOk) {
      const next = loadCompanyAccount();
      setCurrent(next);
      showToast("⚠️ 시트 sync 실패 — 로컬 저장됨", "#FFB300");
    } else {
      showToast(`⚠️ ${res.error || "저장 실패"}`, "#FF3D5A");
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
      fontFamily: "'Pretendard', -apple-system, sans-serif",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "14px 16px",
        borderBottom: "1px solid var(--border)",
      }}>
        <button onClick={onBack} style={backBtnStyle}>
          <ArrowLeft size={14}/> 뒤로
        </button>
        <div style={{ flex: 1, textAlign: "center", fontSize: 14, fontWeight: 700 }}>
          💳 회사 계좌
        </div>
        <div style={{ width: 40 }}/>
      </div>

      <div style={{ padding: 16 }}>
        {/* 현재 계좌 박스 */}
        <div style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 12, padding: 16, marginBottom: 20,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700,
            color: "var(--text-secondary)",
            letterSpacing: 0.3, marginBottom: 10,
          }}>
            현재 계좌
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
            {current.accountHolder || "—"} · {current.bankName || "—"}
          </div>
          <div style={{
            fontSize: 14, color: "var(--text-secondary)",
            fontFamily: "monospace", letterSpacing: 0.5, marginBottom: 8,
          }}>
            {current.accountNumber || "—"}
          </div>
          {current.changedAt && (
            <div style={{
              fontSize: 11, color: "var(--text-tertiary)",
              borderTop: "1px solid var(--border)",
              paddingTop: 8, marginTop: 8,
            }}>
              마지막 변경: {current.changedAt}
            </div>
          )}
        </div>

        {/* 안내 */}
        <div style={{
          background: "rgba(0,135,90,0.08)",
          border: "1px solid rgba(0,135,90,0.3)",
          borderRadius: 8, padding: 12, marginBottom: 16,
          fontSize: 12, color: "#00875A", lineHeight: 1.6,
        }}>
          ℹ️ 변경 시 모든 기사의 회사 송금 화면에 즉시 반영됩니다. (1주일 단위 변경 권장)
        </div>

        {/* 은행 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 13, color: "var(--text-secondary)",
            fontWeight: 700, marginBottom: 8,
          }}>
            은행
          </div>
          <input
            type="text"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="예: 우리은행 / 신한은행 / KB국민은행"
            style={inputStyle}
          />
        </div>

        {/* 계좌번호 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 13, color: "var(--text-secondary)",
            fontWeight: 700, marginBottom: 8,
          }}>
            계좌번호
          </div>
          <input
            type="text"
            inputMode="numeric"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9-]/g, ""))}
            placeholder="1002-XXX-XXXXXX"
            style={inputStyle}
          />
        </div>

        {/* 예금주 */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 13, color: "var(--text-secondary)",
            fontWeight: 700, marginBottom: 8,
          }}>
            예금주
          </div>
          <input
            type="text"
            value={accountHolder}
            onChange={(e) => setAccountHolder(e.target.value)}
            placeholder="회사 / 법인명"
            style={inputStyle}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!valid || !dirty || saving}
          style={{
            width: "100%", padding: 14,
            background: (valid && dirty && !saving) ? "#FF1B8D" : "var(--bg-secondary)",
            border: "none", borderRadius: 12,
            color: "#fff",
            fontSize: 14, fontWeight: 700,
            cursor: (valid && dirty && !saving) ? "pointer" : "not-allowed",
            opacity: (valid && dirty && !saving) ? 1 : 0.5,
            fontFamily: "inherit",
          }}
        >
          {saving ? "저장 중..." : "✓ 회사 계좌 갱신"}
        </button>
      </div>

      {toast && (
        <div style={{
          position: "fixed", left: "50%", bottom: "calc(60px + env(safe-area-inset-bottom))",
          transform: "translateX(-50%)",
          background: toast.color, color: "#fff",
          padding: "12px 18px", borderRadius: 10,
          fontSize: 12, fontWeight: 600,
          maxWidth: "90%", textAlign: "center", lineHeight: 1.5,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          zIndex: 9999, fontFamily: "inherit",
          pointerEvents: "none",
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

export default CompanyAccountScreen;
