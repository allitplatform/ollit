// V11-10 — 추천 기사 카드 (tier 등급 + 점수 + 이유 칩)
// tier: best 🏆 / good ✅ / possible 👌 / fallback ⚠️
import { EngineerBadge } from "./EngineerBadge.jsx";

// V11-11 — 4색 → 2색 (핑크 + 그레이) + bg 진하기로 차별화
const TIER_STYLE = {
  best:     { color: "#FF1B8D",                label: "🏆 최적",   bg: "var(--accent-bg-strong)", border: "#FF1B8D" },
  good:     { color: "#FF1B8D",                label: "✅ 추천",   bg: "var(--accent-bg)",        border: "var(--accent-border)" },
  possible: { color: "var(--text-primary)",    label: "👌 가능",   bg: "var(--bg-tertiary)",      border: "var(--border)" },
  fallback: { color: "var(--text-tertiary, var(--text-secondary))", label: "⚠️ 어려움", bg: "var(--bg-tertiary)", border: "var(--border)" },
};

export function EngineerRecommendCard({ recommendation, onAssign, isTop, disabled }) {
  const { engineer, score, reasons, tier } = recommendation;
  const ts = TIER_STYLE[tier] || TIER_STYLE.possible;

  return (
    <div style={{
      padding: 12,
      background: ts.bg,
      border: isTop ? `2px solid ${ts.border}` : `1px solid ${ts.border}`,
      borderRadius: 10, marginBottom: 6,
      opacity: disabled ? 0.6 : 1,
      pointerEvents: disabled ? "none" : "auto",
    }}>
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
          <EngineerBadge engineer={engineer} size="sm"/>
          <span style={{
            fontSize: 9, color: ts.color,
            background: `${ts.color}26`,
            padding: "1px 5px", borderRadius: 3, fontWeight: 700,
            flexShrink: 0,
          }}>
            {ts.label}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <span style={{
            fontSize: 16, color: ts.color,
            fontWeight: 700, fontFamily: "monospace",
          }}>
            {score}
          </span>
          <span style={{ fontSize: 9, color: "var(--text-tertiary, var(--text-secondary))" }}>/100</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
        {reasons.length === 0 ? (
          <span style={{ fontSize: 10, color: "var(--text-tertiary, var(--text-secondary))" }}>
            추천 이유 없음
          </span>
        ) : (
          reasons.map((reason, idx) => <ReasonChip key={idx} reason={reason}/>)
        )}
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled && onAssign) onAssign();
        }}
        disabled={disabled}
        style={{
          width: "100%", padding: 10,
          background: tier === "best" ? ts.color : "transparent",
          border: tier === "best" ? "none" : `1px solid ${ts.border}`,
          borderRadius: 6,
          color: tier === "best" ? "#fff" : ts.color,
          fontSize: 12, fontWeight: 700,
          cursor: disabled ? "not-allowed" : "pointer",
          fontFamily: "inherit",
        }}
      >
        {disabled ? "처리 중..." : (tier === "best" ? "⚡ 즉시 배정" : "배정하기")}
      </button>
    </div>
  );
}

function ReasonChip({ reason }) {
  // V11-11 — 핑크 + 그레이 단순화
  const colors = {
    high:   { bg: "var(--accent-bg-strong)", text: "#FF1B8D" },
    medium: { bg: "var(--accent-bg)",        text: "#FF1B8D" },
    low:    { bg: "var(--bg-tertiary)",      text: "var(--text-tertiary, var(--text-secondary))" },
  };
  const c = colors[reason.weight] || colors.medium;
  return (
    <span style={{
      fontSize: 9, padding: "2px 6px",
      background: c.bg, color: c.text,
      borderRadius: 4, fontWeight: 500,
      display: "inline-flex", alignItems: "center", gap: 2,
    }}>
      {reason.icon} {reason.text}
    </span>
  );
}

export default EngineerRecommendCard;
