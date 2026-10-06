// 2026-10-06 — 협력사 관리자 홈(대시보드). 시안: docs/mockups/올잇_시안_협력사홈_작업탭_기사아이콘_v1.html 의 A.
//   위에서부터: 오늘 링 카드(+내일 한 줄) / 할 일 3칸 고정 / 오늘 기사 현황(막대) / 최근 7일 완료 막대 / 이번 달 2×2.
//   차트는 SVG·CSS 로 직접 그린다 (라이브러리 없음).
//   자료는 기존 RPC 만 쓴다: 작업 목록(부모가 넘겨줌) · 기사 목록 · 날짜별 정산.
//   onGo(대상): { view, tab?, date?, eng?, focusRemits? } — 부모가 해당 화면·필터로 옮긴다.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { subListStaff, subListDailySettlements } from "../lib/subcontractorsDb.js";
import { getCategoryMeta } from "../lib/serviceCatalog.js";
import { fmtWon } from "../utils/money.js";
import { catTask } from "../utils/subTaskView.js";

const card = {
  background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 16, padding: 14, marginBottom: 10,
};
const ttl = { fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 };
const small = { fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 };
const OK = "var(--success, #16A34A)";
const OKBG = "rgba(22,163,74,0.12)";
const RED = "#E5484D";
const ORANGE = "#F59E0B";
const GREY = "var(--bg-inset, var(--bg-secondary))";
const DONE = ["완료", "visit_only", "정산완료"];

const kstYmd = (d) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
const addDays = (ymd, n) => kstYmd(new Date(new Date(`${ymd}T12:00:00+09:00`).getTime() + n * 86400000));
const dayFull = (ymd) => {
  const d = new Date(`${ymd}T00:00:00+09:00`);
  const wd = d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", weekday: "short" });
  return `${Number(ymd.slice(5, 7))}월 ${Number(ymd.slice(8, 10))}일(${wd})`;
};
const weekday = (ymd) => new Date(`${ymd}T00:00:00+09:00`).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", weekday: "short" });
function dayOf(t) {
  const iso = (DONE.includes(t.status) || t.status === "취소") ? (t.completed_at || t.scheduled_at) : t.scheduled_at;
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return kstYmd(d);
  }
  return t.requested_date || "";
}

// 원형 진행 링 — 완료(초록) 다음에 진행(분홍)을 이어 그린다
function Ring({ done, doing, total }) {
  const R = 15.5, C = 2 * Math.PI * R;
  const a = total > 0 ? (done / total) * C : 0;
  const b = total > 0 ? (doing / total) * C : 0;
  return (
    <div style={{ width: 96, height: 96, flex: "none", position: "relative" }}>
      <svg viewBox="0 0 36 36" width="96" height="96" aria-hidden="true">
        <circle cx="18" cy="18" r={R} fill="none" stroke="var(--border)" strokeWidth="4"/>
        {a > 0 && <circle cx="18" cy="18" r={R} fill="none" stroke="#16A34A" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${a} ${C}`} transform="rotate(-90 18 18)"/>}
        {b > 0 && <circle cx="18" cy="18" r={R} fill="none" stroke="var(--accent, #FF1B8D)" strokeWidth="4" strokeDasharray={`${b} ${C}`} strokeDashoffset={-a} transform="rotate(-90 18 18)"/>}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", fontWeight: 800, fontSize: 22, lineHeight: 1.1 }}>
        <div>{done}/{total}<div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>완료</div></div>
      </div>
    </div>
  );
}

export default function SubManagerHome({ tasks, todo, loading, onRefresh, onGo }) {
  const [staff, setStaff] = useState([]);
  const [days, setDays] = useState([]);
  const [noWorkOpen, setNoWorkOpen] = useState(false);

  const today = kstYmd(new Date());
  const tomorrow = addDays(today, 1);
  const monthStart = today.slice(0, 8) + "01";
  const weekStart = addDays(today, -6);
  const rangeFrom = weekStart < monthStart ? weekStart : monthStart;     // 이번 달 + 최근 7일을 한 번에

  const loadExtra = useCallback(async () => {
    const [sr, ds] = await Promise.all([subListStaff(), subListDailySettlements(rangeFrom, today)]);
    if (sr.ok) setStaff(Array.isArray(sr.staff) ? sr.staff : []);
    if (ds.ok) setDays(Array.isArray(ds.days) ? ds.days : []);
  }, [rangeFrom, today]);
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
  const tmrUnfixed = tmrTasks.filter(t => t.status !== "확정" && t.status !== "진행중" && !DONE.includes(t.status)).length;

  // 오늘 기사 현황 — 오늘 작업이 있는 기사만, 많은 순. 막대의 "남은 작업" 색은 그 기사의 첫 남은 작업 종목 색.
  const byEng = useMemo(() => {
    const m = new Map();
    for (const t of todayTasks) {
      if (!t.assigned_engineer_id) continue;
      if (!m.has(t.assigned_engineer_id)) m.set(t.assigned_engineer_id, { id: t.assigned_engineer_id, name: t.engineer_name || "기사", phone: t.engineer_phone || "", n: 0, done: 0, color: "" });
      const g = m.get(t.assigned_engineer_id);
      g.n += 1;
      if (DONE.includes(t.status)) g.done += 1;
      else if (!g.color) g.color = getCategoryMeta(catTask(t)).color;
    }
    return [...m.values()].sort((a, b) => b.n - a.n || String(a.name).localeCompare(String(b.name), "ko"));
  }, [todayTasks]);
  const maxN = Math.max(1, ...byEng.map(g => g.n));
  const idle = useMemo(() => staff.filter(s => !byEng.some(g => g.id === s.id)), [staff, byEng]);
  const todayUnassigned = todayTasks.filter(t => !t.assigned_engineer_id).length;

  // 최근 7일 완료 — 날짜별 정산(완료일 기준)에서
  const week = useMemo(() => {
    const by = new Map(days.map(d => [d.date, d]));
    const list = [];
    for (let i = 6; i >= 0; i -= 1) {
      const ymd = addDays(today, -i);
      const d = by.get(ymd);
      list.push({ ymd, n: d ? (Number(d.task_count) || 0) : 0, fee: d ? (Number(d.own_fee != null ? d.own_fee : d.fee) || 0) : 0 });
    }
    return list;
  }, [days, today]);
  const weekMax = Math.max(1, ...week.map(w => w.n));
  const weekFee = week.reduce((s, w) => s + w.fee, 0);

  // 이번 달
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

  const tile = (n, label, bg, color) => (
    <div style={{ borderRadius: 10, padding: "8px 4px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", background: bg }}>
      <b style={{ display: "block", fontSize: 20, color: color || "var(--text-primary)" }}>{n}</b>{label}
    </div>
  );
  // 할 일 칸 — 0이면 숨기지 않고 회색 "✓ 없음"
  const todoTile = (label, has, value, color, bg, border, go, bigText) => (
    <button type="button" onClick={() => onGo(go)} style={{
      background: has ? bg : "var(--bg-elevated)", border: `1px solid ${has ? border : "var(--border)"}`, borderRadius: 14,
      padding: 10, minHeight: 74, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", textAlign: "left",
      fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", fontFamily: "inherit", cursor: "pointer",
    }}>
      <span>{label}</span>
      <b style={{ fontSize: has ? (bigText ? 15 : 20) : 13, color: has ? color : "var(--text-secondary)", opacity: has ? 1 : 0.7, wordBreak: "keep-all", overflowWrap: "anywhere" }}>
        {has ? value : "✓ 없음"}
      </b>
    </button>
  );
  const cell = (label, value, red) => (
    <div style={{ background: GREY, borderRadius: 12, padding: 10, fontSize: 11, color: "var(--text-secondary)", fontWeight: 700, minWidth: 0 }}>
      {label}
      <b style={{ display: "block", fontSize: 16, color: red ? RED : "var(--text-primary)", marginTop: 2, overflowWrap: "anywhere" }}>{value}</b>
    </div>
  );

  return (
    <div style={{ padding: 12 }} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {(pulling || loading) && <div style={{ ...small, textAlign: "center", paddingBottom: 8 }}>{loading ? "불러오는 중…" : "놓으면 새로고침"}</div>}

      {/* a. 오늘 링 카드 */}
      <div style={card}>
        <div style={{ ...ttl, cursor: "pointer" }} onClick={() => onGo({ view: "tasks", date: today })}>
          <span>오늘 · {dayFull(today)}</span><span>›</span>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center", cursor: "pointer" }} onClick={() => onGo({ view: "tasks", date: today })}>
          <Ring done={tDone} doing={tDoing} total={todayTasks.length}/>
          <div style={{ flex: 1, minWidth: 0, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
            {tile(tDone, "완료", OKBG, OK)}
            {tile(tDoing, "진행", "var(--accent-bg, rgba(255,27,141,0.08))", "var(--accent, #FF1B8D)")}
            {tile(tLeft, "남음", GREY)}
          </div>
        </div>
        <div onClick={() => onGo({ view: "tasks", date: tomorrow })} style={{
          marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--border)", fontSize: 12, color: "var(--text-secondary)",
          display: "flex", justifyContent: "space-between", cursor: "pointer", fontWeight: 600,
        }}>
          <span>📅 내일 {tmrTasks.length}건 · 일정 미확정 {tmrUnfixed}</span><span>›</span>
        </div>
      </div>

      {/* b. 할 일 3칸 고정 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 10 }}>
        {todoTile("미배정", todo.unassigned > 0, todo.unassigned, RED, "rgba(229,72,77,0.08)", "rgba(229,72,77,0.4)", { view: "tasks", tab: "todo" })}
        {todoTile("기사 송금 확인", todo.waiting > 0, todo.waiting, ORANGE, "rgba(245,158,11,0.10)", "rgba(245,158,11,0.45)", { view: "settle", focusRemits: true })}
        {todoTile("오늘 보낼 수수료", todo.todayFee > 0, fmtWon(todo.todayFee), "var(--accent, #FF1B8D)", "var(--accent-bg, rgba(255,27,141,0.08))", "rgba(255,27,141,0.3)", { view: "settle" }, true)}
      </div>

      {/* c. 오늘 기사 현황 */}
      <div style={card}>
        <div style={ttl}>
          <span>오늘 기사 현황</span>
          {todayUnassigned > 0 && <span onClick={() => onGo({ view: "tasks", tab: "todo" })} style={{ color: RED, cursor: "pointer" }}>미배정 {todayUnassigned}건 ⚠</span>}
        </div>
        {byEng.length === 0 && <div style={small}>오늘 배정된 작업이 없습니다.</div>}
        {byEng.map(g => {
          const digits = String(g.phone || "").replace(/[^0-9]/g, "");
          return (
            <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0" }}>
              <div onClick={() => onGo({ view: "tasks", eng: g.id })} style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, cursor: "pointer" }}>
                <span style={{ width: 30, height: 30, borderRadius: "50%", background: GREY, display: "grid", placeItems: "center", fontSize: 13, fontWeight: 800, flex: "none" }}>{String(g.name).charAt(0)}</span>
                <span style={{ width: 52, flex: "none", fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</span>
                {/* 진한 초록 = 완료, 연한 종목 색 = 남은 작업. 길이는 가장 많은 기사 기준 */}
                <span style={{ flex: 1, minWidth: 20, height: 10, background: GREY, borderRadius: 99, overflow: "hidden", display: "flex" }}>
                  <i style={{ display: "block", height: "100%", width: `${(g.done / maxN) * 100}%`, background: "#16A34A" }}/>
                  <i style={{ display: "block", height: "100%", width: `${((g.n - g.done) / maxN) * 100}%`, background: g.color || "#9CA3AF", opacity: 0.35 }}/>
                </span>
                <span style={{ flex: "none", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", textAlign: "right", whiteSpace: "nowrap" }}>{g.n}건{g.done > 0 ? `·완료${g.done}` : ""}</span>
              </div>
              {digits
                ? <a href={`tel:${digits}`} aria-label={`${g.name} 전화`} style={{ width: 36, height: 36, flex: "none", display: "grid", placeItems: "center", fontSize: 15, textDecoration: "none" }}>📞</a>
                : <span style={{ width: 36, flex: "none" }}/>}
            </div>
          );
        })}
        {idle.length > 0 && (
          <div style={{ paddingTop: 6, borderTop: "1px solid var(--border)", marginTop: 4 }}>
            <button type="button" onClick={() => setNoWorkOpen(v => !v)} style={{
              background: "transparent", border: "none", padding: "4px 0", fontSize: 12, fontWeight: 600,
              color: "var(--text-secondary)", fontFamily: "inherit", cursor: "pointer",
            }}>오늘 일 없는 기사 {idle.length}명 {noWorkOpen ? "▲" : "▼"}</button>
            {noWorkOpen && <div style={{ ...small, marginTop: 2 }}>{idle.map(s => s.name).join(" · ")}</div>}
          </div>
        )}
      </div>

      {/* d. 최근 7일 완료 막대 */}
      <div style={card}>
        <div style={ttl}><span>최근 7일 완료</span><span>수수료 {fmtWon(weekFee)}</span></div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 110, paddingTop: 14 }}>
          {week.map(w => {
            const on = w.ymd === today;
            return (
              <button key={w.ymd} type="button" onClick={() => onGo({ view: "tasks", date: w.ymd })} aria-label={`${dayFull(w.ymd)} ${w.n}건`} style={{
                flex: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end",
                background: "transparent", border: "none", padding: 0, fontFamily: "inherit", cursor: "pointer",
                fontSize: 11, fontWeight: 700, color: on ? "var(--accent, #FF1B8D)" : "var(--text-secondary)",
              }}>
                {w.n}
                <i style={{ display: "block", width: "100%", margin: "3px 0", borderRadius: "6px 6px 2px 2px", height: `${Math.max(3, (w.n / weekMax) * 62)}%`, background: on ? "var(--accent, #FF1B8D)" : "var(--border)" }}/>
                {on ? "오늘" : weekday(w.ymd)}
              </button>
            );
          })}
        </div>
      </div>

      {/* e. 이번 달 2×2 */}
      <div style={card}>
        <div style={ttl}><span>이번 달</span><span>{Number(today.slice(5, 7))}월</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 8 }}>
          {cell("완료", `${month.count}건`)}
          {cell("받은 금액", fmtWon(month.received))}
          {cell("올데이케어 수수료", fmtWon(month.fee))}
          {cell("아직 안 보낸 수수료", fmtWon(month.unsent), month.unsent > 0)}
        </div>
      </div>
    </div>
  );
}
