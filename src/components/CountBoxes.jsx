// 2026-06-06 — 상단 카운트 박스 공용 컴포넌트.
//   호출처: AllTasksScreen (운영자, 6원청) + PrincipalListTab (원청 KA/crikrin).
//   spec 통일 — 오늘 접수 / 완료 / 대기.
//     · 오늘 접수: created_at KST 오늘 (status 무관) — 파랑 #5BA3F0
//     · 완료     : status='완료' AND completed_at KST 오늘 — 초록 #34D399
//     · 대기     : status='확정' (날짜 무관)             — 노랑 #FBBF24
//   디자인: 다크 3-up, 선택 시 핑크 #FF1B8D 테두리 + 틴트.
//   동작: 박스 탭 → 그 조건으로 목록 필터. 같은 박스 재탭 또는 외부 '필터 해제' 버튼 측 해제.

export function CountBoxes({ counts, selected, onSelect }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8,
      marginBottom: 10,
    }}>
      <CountBox label="오늘 접수" value={counts?.todayCreated || 0}
        color="#5BA3F0" selected={selected === "todayCreated"}
        onClick={() => onSelect("todayCreated")}/>
      <CountBox label="완료" value={counts?.todayCompleted || 0}
        color="#34D399" selected={selected === "todayCompleted"}
        onClick={() => onSelect("todayCompleted")}/>
      <CountBox label="대기" value={counts?.confirmed || 0}
        color="#FBBF24" selected={selected === "confirmed"}
        onClick={() => onSelect("confirmed")}/>
    </div>
  );
}

function CountBox({ label, value, color, selected, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: selected ? "rgba(255, 27, 141, 0.10)" : "var(--bg-elevated, #1F1F1F)",
      border: `1px solid ${selected ? "#FF1B8D" : "var(--border, #2A2A2A)"}`,
      borderRadius: 10,
      padding: "12px 8px",
      cursor: "pointer", fontFamily: "inherit",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      minWidth: 0,
    }}>
      <span style={{
        fontSize: 11, fontWeight: 700,
        color: "var(--text-secondary, #B5B0A8)",
      }}>{label}</span>
      <span className="mono" style={{
        fontSize: 22, fontWeight: 800, color,
        letterSpacing: "-0.3px", lineHeight: 1.1,
      }}>{value}</span>
    </button>
  );
}

export default CountBoxes;
