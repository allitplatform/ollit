// V13-FINAL2-fix1 catch #6-3 — 활동 지역 화면
// 25 구 체크박스 (서울 기준) — 운영자가 배정 시 참고

import { useState } from "react";
import { ArrowLeft } from "lucide-react";

const SEOUL_DISTRICTS = [
  "강남구", "강동구", "강북구", "강서구", "관악구",
  "광진구", "구로구", "금천구", "노원구", "도봉구",
  "동대문구", "동작구", "마포구", "서대문구", "서초구",
  "성동구", "성북구", "송파구", "양천구", "영등포구",
  "용산구", "은평구", "종로구", "중구", "중랑구",
];

const backBtnStyle = {
  background: "transparent", border: "none",
  color: "var(--text-primary)", fontSize: 14,
  cursor: "pointer", fontFamily: "inherit",
  padding: "4px 10px",
  display: "flex", alignItems: "center", gap: 4,
};

export function EngineerRegionsScreen({ engineer, onBack, onSave }) {
  const initialRegions = (engineer?.regions || []);
  const [selected, setSelected] = useState(new Set(initialRegions));

  function toggle(d) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
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
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>🚗 활동 지역</div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
            선택 {selected.size}개 · 운영자가 배정 시 참고
          </div>
        </div>
        <div style={{ width: 40 }}/>
      </div>

      <div style={{ padding: 16, paddingBottom: 90 }}>
        <div style={{
          fontSize: 13, color: "var(--text-secondary)",
          fontWeight: 700, marginBottom: 8, marginLeft: 4,
        }}>
          서울 (25개 구)
        </div>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6,
        }}>
          {SEOUL_DISTRICTS.map(d => {
            const checked = selected.has(d);
            return (
              <button
                key={d}
                onClick={() => toggle(d)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: 12,
                  background: checked ? "rgba(255,27,141,0.10)" : "var(--bg-secondary)",
                  border: checked ? "1px solid #FF1B8D" : "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--text-primary)",
                  fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                  textAlign: "left",
                }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: 4,
                  background: checked ? "#FF1B8D" : "transparent",
                  border: checked ? "none" : "1.5px solid var(--text-secondary)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 11, fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {checked ? "✓" : ""}
                </div>
                <span>{d}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        maxWidth: 420, margin: "0 auto",
        background: "var(--bg-primary)",
        borderTop: "1px solid var(--border)",
        padding: 14,
      }}>
        <button
          onClick={() => onSave && onSave(Array.from(selected))}
          style={{
            width: "100%", padding: 12,
            background: "#FF1B8D", border: "none",
            borderRadius: 10, color: "#fff",
            fontSize: 13, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          ✓ 활동 지역 저장
        </button>
      </div>
    </div>
  );
}

export default EngineerRegionsScreen;
