// 2026-10-07 — PC 타임라인 날짜 고르기 (시안 v2). 운영자 · 협력사 타임라인 공용.
//   ‹ [📅 10/7 (수)] ›  +  어제 · 오늘 · 내일 · 모레
//   가운데 날짜를 누르면 달력이 열린다. 작업이 있는 날에는 노란 점, 아래에 [오늘로].
//   markedDates: Set("YYYY-MM-DD") — 이미 읽어 온 작업 목록에서 만든 날짜들 (따로 조회하지 않는다).
import { useEffect, useMemo, useRef, useState } from "react";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n) => String(n).padStart(2, "0");
const ymdOf = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
function parts(ymd) {
  const [y, m, d] = String(ymd || "").split("-").map(Number);
  return { y, m, d };
}
export function shiftYmd(ymd, n) {
  const { y, m, d } = parts(ymd);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return ymdOf(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}
function label(ymd) {
  const { y, m, d } = parts(ymd);
  if (!y) return String(ymd || "");
  return `${m}/${d} (${DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
}

const PINK = "var(--accent, #FF1B8D)";

export function TimelineDatePicker({ selectedDate, today, onChange, markedDates = null }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => { const p = parts(selectedDate); return { y: p.y, m: p.m }; });
  const boxRef = useRef(null);

  // 열 때마다 선택된 날짜의 달부터 보여 준다
  useEffect(() => { if (open) { const p = parts(selectedDate); setView({ y: p.y, m: p.m }); } }, [open, selectedDate]);
  // 바깥을 누르거나 Esc 를 누르면 닫는다
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(view.y, view.m - 1, 1)).getUTCDay();
    const days = new Date(Date.UTC(view.y, view.m, 0)).getUTCDate();
    const out = [];
    for (let i = 0; i < first; i++) out.push(null);
    for (let d = 1; d <= days; d++) out.push(ymdOf(view.y, view.m, d));
    return out;
  }, [view]);
  const moveMonth = (n) => setView(v => {
    const dt = new Date(Date.UTC(v.y, v.m - 1 + n, 1));
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1 };
  });
  const pick = (ymd) => { onChange(ymd); setOpen(false); };

  const arrow = {
    background: "transparent", border: "none", color: "var(--text-primary)", fontSize: 20, fontWeight: 700,
    padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", lineHeight: 1,
  };
  const chip = (text, ymd) => {
    const on = selectedDate === ymd;
    return (
      <button key={text} type="button" onClick={() => onChange(ymd)} style={{
        border: `1px solid ${on ? PINK : "var(--border)"}`, background: on ? PINK : "transparent",
        color: on ? "#fff" : "var(--text-secondary)", borderRadius: 20, padding: "7px 13px",
        fontSize: 13, fontWeight: on ? 800 : 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
      }}>{text}</button>
    );
  };

  return (
    <div ref={boxRef} style={{ display: "flex", alignItems: "center", gap: 10, position: "relative", flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: 12, background: "var(--bg-elevated)" }}>
        <button type="button" onClick={() => onChange(shiftYmd(selectedDate, -1))} style={arrow} aria-label="이전 날짜">‹</button>
        <button type="button" onClick={() => setOpen(v => !v)} aria-label="달력 열기" style={{
          background: "transparent", border: "none", borderLeft: "1px solid var(--border)", borderRight: "1px solid var(--border)",
          padding: "8px 14px", fontSize: 17, fontWeight: 800, color: PINK, cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums",
        }}>📅 {label(selectedDate)}</button>
        <button type="button" onClick={() => onChange(shiftYmd(selectedDate, 1))} style={arrow} aria-label="다음 날짜">›</button>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {chip("어제", shiftYmd(today, -1))}
        {chip("오늘", today)}
        {chip("내일", shiftYmd(today, 1))}
        {chip("모레", shiftYmd(today, 2))}
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", left: 0, width: 280, zIndex: 200,
          background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 14, padding: 12,
          boxShadow: "0 12px 30px rgba(0,0,0,0.45)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <button type="button" onClick={() => moveMonth(-1)} style={{ ...arrow, fontSize: 18, padding: "2px 10px" }} aria-label="이전 달">‹</button>
            <b style={{ fontSize: 14, color: "var(--text-primary)" }}>{view.y}년 {view.m}월</b>
            <button type="button" onClick={() => moveMonth(1)} style={{ ...arrow, fontSize: 18, padding: "2px 10px" }} aria-label="다음 달">›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, textAlign: "center" }}>
            {DOW.map(w => <span key={w} style={{ fontSize: 11, color: "var(--text-secondary)", padding: "4px 0" }}>{w}</span>)}
            {cells.map((ymd, i) => {
              if (!ymd) return <span key={`e${i}`}/>;
              const sel = ymd === selectedDate;
              const isToday = ymd === today;
              const dot = markedDates && markedDates.has(ymd);
              return (
                <button key={ymd} type="button" onClick={() => pick(ymd)} style={{
                  position: "relative", padding: "7px 0", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                  border: "none", outline: isToday && !sel ? `1px solid ${PINK}` : "none",
                  background: sel ? PINK : "transparent", color: sel ? "#fff" : "var(--text-primary)",
                  fontSize: 13, fontWeight: sel ? 800 : 600,
                }}>
                  {Number(ymd.slice(8))}
                  {dot && <span style={{ position: "absolute", bottom: 2, left: "50%", width: 4, height: 4, marginLeft: -2, borderRadius: "50%", background: "#FBBF24" }}/>}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, fontSize: 12, color: "var(--text-secondary)" }}>
            <span><span style={{ color: "#FBBF24" }}>●</span> 작업 있는 날</span>
            <button type="button" onClick={() => pick(today)} style={{ background: "transparent", border: "none", color: PINK, fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>오늘로</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TimelineDatePicker;
