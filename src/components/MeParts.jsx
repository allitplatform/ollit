// 2026-10-06 — "내 정보" 화면 공용 부품.
//   기사 앱(EngineerMeTab)과 협력사 관리자(SubManagerMe)가 같은 것을 쓴다 — 한쪽만 모양이 달라지지 않게.
//   원래 EngineerMeTab 안에 있던 것을 그대로 옮겼다 (SettingRow 의 sub · dim 만 추가, 안 주면 전과 같음).

// 카드 공통 스타일
export function meCardStyle(isDark) {
  return {
    background: isDark ? "#1C1C1E" : "#FFFFFF",
    border: `1px solid ${isDark ? "#2A2A2A" : "#EFE9E0"}`,
    borderRadius: 18,
    marginBottom: 14,
  };
}

export function SectionHeader({ isDark, children }) {
  return (
    <div style={{
      fontSize: 11,
      color: isDark ? "#999" : "#6B6359",
      fontWeight: 700,
      letterSpacing: 0.3,
      padding: "12px 18px 6px",
    }}>
      {children}
    </div>
  );
}

// sub = 이름 아래 작은 설명 (선택) · dim = 흐리게 (선택)
export function SettingRow({ icon, label, sub, rightSlot, onClick, isLast, isDark, dim }) {
  return (
    <div onClick={onClick} style={{
      padding: "14px 18px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottom: isLast ? "none" : `0.5px solid ${isDark ? "#2A2A2A" : "#F5F2ED"}`,
      cursor: onClick ? "pointer" : "default",
      gap: 12,
      opacity: dim ? 0.45 : 1,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
        <div style={{ minWidth: 0 }}>
          <span style={{
            fontSize: 14,
            color: isDark ? "#FAF8F5" : "#1A1A1A",
            fontWeight: 600,
          }}>
            {label}
          </span>
          {sub && (
            <div style={{ fontSize: 11, color: isDark ? "#999" : "#6B6359", marginTop: 2, lineHeight: 1.4 }}>{sub}</div>
          )}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>{rightSlot}</div>
    </div>
  );
}

export function Toggle({ on, onChange }) {
  return (
    <div onClick={() => onChange(!on)} style={{
      width: 44, height: 26,
      background: on ? "#FF1B8D" : "#E5E0D6",
      borderRadius: 999,
      padding: 2,
      display: "flex",
      justifyContent: on ? "flex-end" : "flex-start",
      boxSizing: "border-box",
      cursor: "pointer",
      transition: "background 0.2s",
    }}>
      <div style={{
        width: 22, height: 22,
        background: "#fff",
        borderRadius: "50%",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }}/>
    </div>
  );
}

export function FontSizeButton({ label, size, current, onChange, isDark }) {
  const isActive = current === size;
  const fontSize = size === "small" ? 12 : size === "large" ? 14 : 13;
  return (
    <button onClick={() => onChange(size)} style={{
      background: isActive ? "#FF1B8D" : (isDark ? "transparent" : "#fff"),
      border: isActive ? "1px solid #FF1B8D" : `1px solid ${isDark ? "#2A2A2A" : "#EFE9E0"}`,
      color: isActive ? "#fff" : (isDark ? "#999" : "#555"),
      padding: "5px 11px",
      borderRadius: 8,
      fontSize: fontSize,
      fontWeight: 700,
      cursor: "pointer",
      fontFamily: "inherit",
    }}>
      {label}
    </button>
  );
}

export function Chevron({ isDark }) {
  return (
    <span style={{ color: isDark ? "#555" : "#B0A99E", fontSize: 16 }}>›</span>
  );
}

// 오른쪽 작은 값 + › (예: "국민은행 123****4567 ›")
export function RowValue({ isDark, children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, maxWidth: "52vw" }}>
      <span style={{
        fontSize: 12, fontWeight: 600, color: isDark ? "#999" : "#6B6359",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{children}</span>
      <Chevron isDark={isDark}/>
    </span>
  );
}

export function LogoutButton({ isDark, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: "100%",
      background: isDark ? "transparent" : "#FFFFFF",
      border: "1.5px solid #FF3B5C",
      color: isDark ? "#FF6B85" : "#FF3B5C",
      padding: 16,
      borderRadius: 14,
      fontSize: 15, fontWeight: 700,
      cursor: "pointer",
      fontFamily: "inherit",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      marginTop: 4,
    }}>
      🚪 로그아웃
    </button>
  );
}
