// 2026-06-12 — AdminApp PC 날짜 네비 — 타임라인(시간축) + 처리흐름 공유.
//   ‹ 이전 / [M/D (요일)] / 다음 ›  + (선택 ≠ 오늘) 시 "오늘" 버튼.

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function formatDateKo(ymd) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${m}/${d} (${WEEKDAYS[dt.getDay()]})`;
}

export function shiftDate(ymd, delta) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export function AdminPcDateNav({ selectedDate, onPrev, onNext, onToday, isToday }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 2,
      background: "var(--bg-elevated)",
      border: "1px solid var(--border)",
      borderRadius: 999,
      padding: 3,
    }}>
      <NavBtn onClick={onPrev} aria="이전 날짜">‹</NavBtn>
      <span style={{
        padding: "4px 10px",
        fontSize: 13, fontWeight: 700,
        color: isToday ? "var(--accent)" : "var(--text-primary)",
        minWidth: 90, textAlign: "center",
        fontVariantNumeric: "tabular-nums",
      }}>{formatDateKo(selectedDate)}</span>
      <NavBtn onClick={onNext} aria="다음 날짜">›</NavBtn>
      {!isToday && (
        <button onClick={onToday}
          style={{
            marginLeft: 4,
            padding: "4px 11px",
            background: "var(--accent)",
            border: "none",
            borderRadius: 999,
            color: "#fff",
            fontSize: 11, fontWeight: 800,
            cursor: "pointer", fontFamily: "inherit",
          }}>오늘</button>
      )}
    </div>
  );
}

function NavBtn({ onClick, children, aria }) {
  return (
    <button onClick={onClick} aria-label={aria}
      style={{
        width: 26, height: 26, padding: 0,
        background: "transparent",
        border: "none",
        color: "var(--text-secondary)",
        fontSize: 18, fontWeight: 700,
        cursor: "pointer", fontFamily: "inherit",
        borderRadius: 999,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>{children}</button>
  );
}

export default AdminPcDateNav;
