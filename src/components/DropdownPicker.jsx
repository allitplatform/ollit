// V13-FINAL2-fix2 — 드롭다운 picker (시간 / 오전·오후 등)
// 다크 모드 글자 = #FFFFFF 순백 / 폰트 700

import { useState } from "react";

export const HOURS   = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
export const MINUTES = ["00", "10", "20", "30", "40", "50"];
export const AMPM    = ["오전", "오후"];
// V14 — 24시간 시간 picker (09~21 / 00 또는 30)
export const HOURS_24    = ["09","10","11","12","13","14","15","16","17","18","19","20","21"];
export const MINUTES_30  = ["00", "30"];

export function DropdownPicker({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const isDark = typeof document !== "undefined"
    && document.documentElement.dataset.theme === "dark";

  const textColor = isDark ? "#FFFFFF" : "#1A1512";

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", padding: 12,
          background: "var(--input-bg)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          color: textColor,
          fontSize: 14, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          boxSizing: "border-box",
        }}
      >
        <span>{value}</span>
        <span style={{ opacity: 0.7, fontSize: 11 }}>▾</span>
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 9 }}
          />
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0,
            marginTop: 4,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            zIndex: 10,
            maxHeight: 240, overflowY: "auto",
            boxShadow: "0 4px 12px rgba(0,0,0,0.10)",
          }}>
            {options.map(opt => {
              const isSelected = opt === value;
              return (
                <div
                  key={opt}
                  onClick={() => { onChange && onChange(opt); setOpen(false); }}
                  style={{
                    padding: "10px 12px",
                    fontSize: 13, fontWeight: 700,
                    color: isSelected ? "#FF1B8D" : textColor,
                    background: isSelected ? "rgba(255,27,141,0.10)" : "transparent",
                    cursor: "pointer",
                  }}
                >
                  {opt}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default DropdownPicker;
