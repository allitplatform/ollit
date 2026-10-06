// 2026-10-06 — 협력사 관리자 홈(대시보드).
//   위에서부터: 할 일 띠 / 오늘 카드 / 오늘 기사 현황 / 내일 미리보기 / 이번 달 요약.
//   자료는 기존 RPC 만 쓴다: 작업 목록(부모가 넘겨줌) · 기사 목록 · 날짜별 정산.
//   onGo(대상): { view, tab?, date?, eng?, focusRemits? } — 부모가 해당 화면·필터로 옮긴다.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { subListStaff, subListDailySettlements } from "../lib/subcontractorsDb.js";
import { fmtWon } from "../utils/money.js";

const card = {
  background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 14, padding: 14, marginBottom: 10,
};
const title = { fontSize: 12, fontWeight: 800, color: "var(--text-secondary)", marginBottom: 8 };
const small = { fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 };
const DONE = ["완료", "visit_only", "정산완료"];

const kstYmd = (d) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
function dayOf(t) {
  const iso = (DONE.includes(t.status) || t.status === "취소") ? (t.completed_at || t.scheduled_at) : t.scheduled_at;
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return kstYmd(d);
  }
  return t.requested_date || "";
}

export default function SubManagerHome({ tasks, todo, loading, onRefresh, onGo }) {
  const [staff, setStaff] = useState([]);
  const [days, setDays] = useState([]);
  const [noWorkOpen, setNoWorkOpen] = useState(false);

  const today = kstYmd(new Date());
  const tomorrow = kstYmd(new Date(Date.now() + 86400000));
  const monthStart = today.slice(0, 8) + "01";

  const loadExtra = useCallback(async () => {
    const [sr, ds] = await Promise.all([subListStaff(), subListDailySettlements(monthStart, today)]);
    if (sr.ok) setStaff(Array.isArray(sr.staff) ? sr.staff : []);
    if (ds.ok) setDays(Array.isArray(ds.days) ? ds.days : []);
  }, [monthStart, today]);
  useEffect(() => { loadExtra(); }, [loadExtra]);
  const refresh = useCallback(() => { if (onRefresh) onRefresh(); loadExtra(); }, [onRefresh, loadExtra]);

  // 아래로 당겨 새로고침 — 화면 맨 위에서 70px 넘게 당겼다 놓으면
  const pull = useRef({ y: 0, on: false });
  const [pulling, setPulling] = useState(false);
  const onTouchStart = (e) => { pull.current = { y: e.touches[0].clientY, on: (window.scrollY || 0) <= 0 }; };
  const onTouchMove = (e) => { if (pull.current.on) setPulling(e.touches[0].clientY - pull.current.y > 70); };
  const onTouchEnd = () => { if (pull.current.on && pulling) refresh(); pull.current.on = false; setPulling(false); };

  const live = useMemo(() => (tasks || []).filter(t => t.status !== "취소"), [tasks]);
  const todayTasks = useMemo(() => live.filter(t => dayOf(t) === today), [live, today]);
  const tmrTasks = useMemo(() => live.filter(t => dayOf(t) === tomorrow), [live, tomorrow]);

  const tDone = todayTasks.filter(t => DONE.includes(t.status)).length;
  const tDoing = todayTasks.filter(t => t.status === "진행중").length;
  const tLeft = todayTasks.length - tDone - tDoing;
  const pct = todayTasks.length > 0 ? Math.round((tDone / todayTasks.length) * 100) : 0;

  // 오늘 기사 현황 — 오늘 작업이 있는 기사만, 많은 순
  const byEng = useMemo(() => {
    const m = new Map();
    for (const t of todayTasks) {
      if (!t.assigned_engineer_id) continue;
      if (!m.has(t.assigned_engineer_id)) m.set(t.assigned_engineer_id, { id: t.assigned_engineer_id, name: t.engineer_name || "기사", phone: t.engineer_phone || "", n: 0, done: 0 });
      const g = m.get(t.assigned_engineer_id);
      g.n += 1;
      if (DONE.includes(t.status)) g.done += 1;
    }
    return [...m.values()].sort((a, b) => b.n - a.n || String(a.name).localeCompare(String(b.name), "ko"));
  }, [todayTasks]);
  const idle = useMemo(() => staff.filter(s => !byEng.some(g => g.id === s.id)), [staff, byEng]);
  const todayUnassigned = todayTasks.filter(t => !t.assigned_engineer_id).length;

  // 이번 달 요약 — 날짜별 정산(완료일 기준)에서 더한다
  const month = useMemo(() => {
    let count = 0, received = 0, fee = 0, unsent = 0;
    for (const d of days) {
      if (!d.date || d.date < monthStart) continue;
      count += Number(d.task_count) || 0;
      received += Number(d.received) || 0;
      fee += Number(d.own_fee != null ? d.own_fee : d.fee) || 0;
      if (!d.locked && Number(d.fee) > 0) unsent += Number(d.fee);
    }
    return { count, received, fee, unsent };
  }, [days, monthStart]);

  const todoItems = [
    todo.unassigned > 0 ? { key: "todo", label: `미배정 ${todo.unassigned}`, go: { view: "tasks", tab: "todo" } } : null,
    todo.waiting > 0 ? { key: "wait", label: `기사 송금 확인 ${todo.waiting}`, go: { view: "settle", focusRemits: true } } : null,
    todo.todayFee > 0 ? { key: "fee", label: `오늘 보낼 수수료 ${fmtWon(todo.todayFee)}`, go: { view: "settle" } } : null,
  ].filter(Boolean);

  const stat = (label, value, color) => (
    <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: color || "var(--text-primary)" }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  );
  const line = (k, v, strong) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "5px 0" }}>
      <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>{k}</span>
      <span style={{ fontSize: strong ? 15 : 13, fontWeight: strong ? 800 : 700 }}>{v}</span>
    </div>
  );

  return (
    <div style={{ padding: 12 }} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {(pulling || loading) && <div style={{ ...small, textAlign: "center", paddingBottom: 8 }}>{loading ? "불러오는 중…" : "놓으면 새로고침"}</div>}

      {/* a. 할 일 띠 — 0건 항목은 숨긴다 */}
      {todoItems.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {todoItems.map(it => (
            <button key={it.key} onClick={() => onGo(it.go)} style={{
              padding: "9px 12px", borderRadius: 999, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
              fontSize: 13, fontWeight: 800, border: "1px solid rgba(229,72,77,0.4)", background: "rgba(229,72,77,0.10)", color: "#E5484D",
            }}>{it.label} ›</button>
          ))}
        </div>
      )}

      {/* b. 오늘 카드 */}
      <div style={{ ...card, cursor: "pointer" }} onClick={() => onGo({ view: "tasks", date: today })}>
        <div style={title}>오늘</div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>작업 {todayTasks.length}건</div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          {stat("완료", tDone, "var(--success, #10B981)")}
          {stat("진행", tDoing, "var(--accent, #FF1B8D)")}
          {stat("남음", tLeft)}
        </div>
        <div style={{ height: 6, borderRadius: 999, background: "var(--bg-inset, var(--bg-secondary))", marginTop: 12, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "var(--success, #10B981)" }}/>
        </div>
      </div>

      {/* c. 오늘 기사 현황 */}
      <div style={card}>
        <div style={title}>오늘 기사 현황</div>
        {byEng.length === 0 && <div style={small}>오늘 배정된 작업이 없습니다.</div>}
        {byEng.map(g => {
          const digits = String(g.phone || "").replace(/[^0-9]/g, "");
          return (
            <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: "1px solid var(--border)" }}>
              <div onClick={() => onGo({ view: "tasks", eng: g.id })} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                <span style={{ fontSize: 14, fontWeight: 800 }}>{g.name}</span>
                <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}> {g.n}건 (완료 {g.done})</span>
              </div>
              {digits && (
                <a href={`tel:${digits}`} aria-label={`${g.name} 전화`} style={{
                  width: 36, height: 36, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-secondary)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16, textDecoration: "none", flexShrink: 0,
                }}>📞</a>
              )}
            </div>
          );
        })}
        {todayUnassigned > 0 && (
          <div onClick={() => onGo({ view: "tasks", tab: "todo" })} style={{ ...small, color: "#E5484D", fontWeight: 700, padding: "8px 0 0", cursor: "pointer" }}>
            오늘 작업 중 미배정 {todayUnassigned}건 ›
          </div>
        )}
        {idle.length > 0 && (
          <>
            <button type="button" onClick={() => setNoWorkOpen(v => !v)} style={{
              background: "transparent", border: "none", padding: "10px 0 0", fontSize: 12, fontWeight: 700,
              color: "var(--text-secondary)", fontFamily: "inherit", cursor: "pointer",
            }}>오늘 일 없는 기사 {idle.length}명 {noWorkOpen ? "▲" : "▼"}</button>
            {noWorkOpen && <div style={{ ...small, marginTop: 4 }}>{idle.map(s => s.name).join(" · ")}</div>}
          </>
        )}
      </div>

      {/* d. 내일 미리보기 */}
      <div style={{ ...card, cursor: "pointer" }} onClick={() => onGo({ view: "tasks", date: tomorrow })}>
        <div style={title}>내일</div>
        <div style={{ display: "flex", gap: 8 }}>
          {stat("작업", `${tmrTasks.length}건`)}
          {stat("일정 미확정", tmrTasks.filter(t => t.status !== "확정" && t.status !== "진행중" && !DONE.includes(t.status)).length)}
          {stat("미배정", tmrTasks.filter(t => !t.assigned_engineer_id).length, tmrTasks.some(t => !t.assigned_engineer_id) ? "#E5484D" : undefined)}
        </div>
      </div>

      {/* e. 이번 달 요약 */}
      <div style={card}>
        <div style={title}>이번 달 ({Number(today.slice(5, 7))}월)</div>
        {line("완료", `${month.count}건`)}
        {line("받은 금액", fmtWon(month.received))}
        {line("올데이케어 수수료", fmtWon(month.fee))}
        {line("아직 안 보낸 수수료", fmtWon(month.unsent), true)}
      </div>

      <button type="button" onClick={refresh} disabled={loading} style={{
        display: "block", width: "100%", background: "transparent", border: "1px solid var(--border)", borderRadius: 10,
        padding: "11px 0", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "inherit", cursor: "pointer",
      }}>{loading ? "불러오는 중…" : "새로고침"}</button>
    </div>
  );
}
