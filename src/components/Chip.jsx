// V12-3 — 표준 칩 컴포넌트 (사진 1 패턴: 흰배경 + 보더 + 활성시 진하게)
// 사용처: 정산 탭, 작업 종류 칩, 필터 칩 등 모든 칩 통일

export function Chip({ icon, label, color, active, disabled, onClick, size = "md", style }) {
  const sizeStyle = {
    sm: { padding: "2px 6px",  fontSize: 9,  borderRadius: 4 },
    md: { padding: "4px 10px", fontSize: 11, borderRadius: 4 },
    lg: { padding: "6px 14px", fontSize: 12, borderRadius: 24 },
  }[size] || { padding: "4px 10px", fontSize: 11, borderRadius: 4 };

  const baseColor = color || "var(--text-primary)";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: "var(--bg-secondary)",
        border: active
          ? `2px solid ${baseColor}`
          : "1px solid var(--border)",
        color: active
          ? baseColor
          : disabled
            ? "var(--text-tertiary)"
            : "var(--text-secondary)",
        fontWeight: active ? 700 : 500,
        cursor: onClick && !disabled ? "pointer" : "default",
        opacity: disabled ? 0.5 : 1,
        fontFamily: "inherit",
        ...sizeStyle,
        ...(style || {}),
      }}
    >
      {icon && <span>{icon}</span>}
      <span>{label}</span>
    </button>
  );
}

export default Chip;
