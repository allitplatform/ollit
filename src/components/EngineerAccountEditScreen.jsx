// V13-FINAL2-fix1 통합 — 계좌 변경 화면 (은행 텍스트 입력 1줄)
// 8 은행 버튼 → 자유 텍스트 입력 (예: 카카오뱅크 / KB국민은행 / 토스뱅크)

import { useState } from "react";
import { ArrowLeft } from "lucide-react";

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

export function EngineerAccountEditScreen({ engineer, onBack, onSave }) {
  const eng = engineer || {};
  const [bankName, setBankName] = useState(eng.bankName || "");
  const [accountNumber, setAccountNumber] = useState(eng.accountNumber || "");
  const [accountHolder, setAccountHolder] = useState(eng.accountHolder || eng.name || "");

  const valid = !!bankName.trim() && !!accountNumber.trim() && !!accountHolder.trim();

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
          🏦 계좌 변경
        </div>
        <div style={{ width: 40 }}/>
      </div>

      <div style={{ padding: 16 }}>
        {/* 안내 */}
        <div style={{
          background: "rgba(255,179,0,0.08)",
          border: "1px solid rgba(255,179,0,0.3)",
          borderRadius: 8, padding: 12, marginBottom: 16,
          fontSize: 12, color: "#FFB300",
        }}>
          ⚠️ 계좌 변경 시 운영팀에 자동 알림이 가요. 다음 정산부터 적용됩니다.
        </div>

        {/* 은행 — 텍스트 입력 1줄 */}
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
            placeholder="예: 카카오뱅크 / KB국민은행 / 토스뱅크"
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
            placeholder="123-456-789012"
            style={{ ...inputStyle, fontFamily: "monospace" }}
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
            placeholder="이름 입력"
            style={inputStyle}
          />
          <div style={{
            fontSize: 12, color: "var(--text-secondary)", marginTop: 6,
          }}>
            본인 명의 계좌만 등록해주세요
          </div>
        </div>

        <button
          onClick={() => onSave && onSave({ bankName: bankName.trim(), accountNumber: accountNumber.trim(), accountHolder: accountHolder.trim() })}
          disabled={!valid}
          style={{
            width: "100%", padding: 14,
            background: valid ? "#FF1B8D" : "var(--bg-secondary)",
            border: "none", borderRadius: 12,
            color: "#fff",
            fontSize: 14, fontWeight: 700,
            cursor: valid ? "pointer" : "not-allowed",
            opacity: valid ? 1 : 0.5,
            fontFamily: "inherit",
          }}
        >
          ✓ 계좌 변경 신청
        </button>
      </div>
    </div>
  );
}

export default EngineerAccountEditScreen;
