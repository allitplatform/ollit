// V13-FINAL2-fix1 통합 — 담당 구역 변경 요청 화면
// 25구 체크 X → 운영팀에 변경 사유 메모 요청

import { useState } from "react";
import { ArrowLeft } from "lucide-react";

const backBtnStyle = {
  background: "transparent", border: "none",
  color: "var(--text-primary)", fontSize: 14,
  cursor: "pointer", fontFamily: "inherit",
  padding: "4px 10px",
  display: "flex", alignItems: "center", gap: 4,
};

export function EngineerRegionChangeRequestScreen({ engineer, onBack, onSave }) {
  const [memo, setMemo] = useState("");
  const eng = engineer || {};

  const valid = memo.trim().length > 0;

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
      fontFamily: "'Spoqa Han Sans Neo', -apple-system, sans-serif",
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
          🚗 담당 구역 변경 요청
        </div>
        <div style={{ width: 40 }}/>
      </div>

      <div style={{ padding: 16 }}>
        {/* 현재 구역 */}
        <div style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 10, padding: 12, marginBottom: 16,
        }}>
          <div style={{
            fontSize: 11, color: "var(--text-secondary)",
            fontWeight: 700, marginBottom: 6,
          }}>
            현재 담당 구역
          </div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {(eng.regions || []).join(" · ") || "—"}
          </div>
        </div>

        {/* 안내 */}
        <div style={{
          background: "rgba(255,179,0,0.08)",
          border: "1px solid rgba(255,179,0,0.3)",
          borderRadius: 8, padding: 12, marginBottom: 16,
          fontSize: 12, color: "#FFB300",
        }}>
          ⚠️ 담당 구역은 운영팀이 관리합니다. 변경 요청 메모를 남겨주시면 운영팀이 검토합니다.
        </div>

        {/* 요청 메모 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 13, color: "var(--text-secondary)",
            fontWeight: 700, marginBottom: 8,
          }}>
            변경 요청 사유
          </div>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="예: 강남구 추가 가능 / 송파구 빼주세요 / 등"
            style={{
              width: "100%", minHeight: 120, padding: 12,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text-primary)",
              fontSize: 13, boxSizing: "border-box",
              outline: "none", resize: "vertical",
              fontFamily: "inherit",
            }}
          />
        </div>

        <button
          onClick={() => onSave && onSave({ memo: memo.trim() })}
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
          ✓ 운영팀에 변경 요청
        </button>
      </div>
    </div>
  );
}

export default EngineerRegionChangeRequestScreen;
