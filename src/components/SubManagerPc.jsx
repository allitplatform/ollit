// 2026-10-06 Mig 238 — 협력사 관리자 PC 화면 (폭 1024px 이상): 타임라인 · 전체 작업 검색.
//   운영자 PC 화면의 배치(기사별 가로 타임라인 / 필터 한 줄 + 표)를 따르되, 데이터는 전부
//   협력사 RPC(sub_query_tasks · sub_list_staff — 세션 확인 + 자기 협력사 작업만)에서 읽는다.
//   운영자 RPC·운영자 화면 구성요소는 쓰지 않는다.
import { useCallback, useEffect, useMemo, useState } from "react";
import { subQueryTasks, subListStaff } from "../lib/subcontractorsDb.js";
import { getCategoryMeta, categoriesInTasks, getTaskDurationHours, categoryTint } from "../lib/serviceCatalog.js";
import CategoryChip from "./CategoryChip.jsx";
import { fmtWon } from "../utils/money.js";
import { catTask, workLabel, townOf, kstYmd, visitYmd, visitHm, stageOf, STAGE_STYLE } from "../utils/subTaskView.js";

const btn = {
  background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px",
  fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
};
const field = {
  height: 34, boxSizing: "border-box", padding: "0 10px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit",
};
// 이번 달 마지막 날 (미배정은 앞으로의 일정까지 봐야 해서 달 끝까지)
const endOfMonth = (ymd) => {
  const y = Number(ymd.slice(0, 4)), m = Number(ymd.slice(5, 7));
  return `${ymd.slice(0, 8)}${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
};
const addDays = (ymd, n) => kstYmd(new Date(new Date(`${ymd}T12:00:00+09:00`).getTime() + n * 86400000));
const dayTitle = (ymd) => {
  const d = new Date(`${ymd}T00:00:00+09:00`);
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" });
};

// ───────────────────────── 타임라인 ─────────────────────────
const H0 = 8, H1 = 22;                      // 08시 ~ 22시
const SPAN = H1 - H0;
function hourPos(t) {
  if (!t.scheduled_at) return null;
  const d = new Date(t.scheduled_at);
  if (Number.isNaN(d.getTime())) return null;
  const [h, m] = d.toLocaleTimeString("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" }).split(":").map(Number);
  return h + m / 60;
}

// preset: { day, n } — 홈에서 날짜를 정해 넘어올 때. n 이 바뀔 때마다 그 날짜로 맞춘다.
export function SubPcTimeline({ onOpen, refreshKey = 0, preset = null }) {
  const today = kstYmd(new Date());
  const [day, setDay] = useState((preset && preset.day) || today);
  useEffect(() => { if (preset && preset.day) setDay(preset.day); }, [preset && preset.n]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [tasks, setTasks] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    setLoading(true);
    const [tr, sr] = await Promise.all([subQueryTasks({ from: day, to: day }), subListStaff()]);
    if (!tr.ok) setError(tr.error || "작업을 불러오지 못했습니다.");
    else { setError(""); setTasks(Array.isArray(tr.tasks) ? tr.tasks : []); }
    if (sr.ok) setStaff(Array.isArray(sr.staff) ? sr.staff : []);
    setLoading(false);
  }, [day]);
  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(id); }, []);

  // 줄: 맨 위 "미배정", 그날 작업 있는 기사(많은 순), 없는 기사(흐리게)
  const rows = useMemo(() => {
    const by = new Map();
    for (const t of tasks) {
      const k = t.assigned_engineer_id || "none";
      if (!by.has(k)) by.set(k, []);
      by.get(k).push(t);
    }
    const names = new Map(staff.map(s => [s.id, s.name]));
    for (const t of tasks) if (t.assigned_engineer_id && !names.has(t.assigned_engineer_id)) names.set(t.assigned_engineer_id, t.engineer_name || "기사");
    const withWork = [...names.keys()].filter(id => by.has(id)).sort((a, b) => by.get(b).length - by.get(a).length || String(names.get(a)).localeCompare(String(names.get(b)), "ko"));
    const idle = [...names.keys()].filter(id => !by.has(id)).sort((a, b) => String(names.get(a)).localeCompare(String(names.get(b)), "ko"));
    return [
      { id: "none", name: "미배정", items: by.get("none") || [], warn: true },
      ...withWork.map(id => ({ id, name: names.get(id), items: by.get(id) })),
      ...idle.map(id => ({ id, name: names.get(id), items: [], dim: true })),
    ];
  }, [tasks, staff]);

  const nowPos = (() => {
    if (day !== today) return null;
    const [h, m] = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" }).split(":").map(Number);
    const x = h + m / 60;
    return x >= H0 && x <= H1 ? ((x - H0) / SPAN) * 100 : null;
  })();
  const NAMEW = 150;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginRight: 8 }}>타임라인</div>
        <button type="button" onClick={() => setDay(addDays(day, -1))} style={btn} aria-label="이전 날">◀</button>
        <button type="button" onClick={() => setDay(today)} style={{ ...btn, borderColor: day === today ? "var(--accent, #FF1B8D)" : "var(--border)" }}>오늘</button>
        <button type="button" onClick={() => setDay(addDays(day, 1))} style={btn} aria-label="다음 날">▶</button>
        <input type="date" value={day} onChange={e => e.target.value && setDay(e.target.value)} style={field} aria-label="날짜 선택"/>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{dayTitle(day)}</span>
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>· {tasks.filter(t => t.status !== "취소").length}건{tasks.some(t => t.status === "취소") ? ` (취소 ${tasks.filter(t => t.status === "취소").length})` : ""}</span>
        <span style={{ flex: 1 }}/>
        <button type="button" onClick={load} disabled={loading} style={btn}>{loading ? "…" : "새로고침"}</button>
      </div>
      {error && <div style={{ color: "var(--danger, #E5484D)", fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{error}</div>}

      <div style={{ border: "1px solid var(--border)", borderRadius: 12, background: "var(--bg-elevated)", overflowX: "auto" }}>
        <div style={{ minWidth: 980 }}>
          {/* 시간 눈금 */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
            <div style={{ width: NAMEW, flexShrink: 0, padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>기사</div>
            <div style={{ flex: 1, position: "relative", height: 32 }}>
              {Array.from({ length: SPAN + 1 }, (_, i) => (
                <span key={i} style={{ position: "absolute", left: `${(i / SPAN) * 100}%`, top: 8, transform: "translateX(-50%)", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>{H0 + i}</span>
              ))}
            </div>
          </div>
          {rows.map(r => {
            const timed = r.items.filter(t => { const x = hourPos(t); return x != null; });
            const untimed = r.items.filter(t => hourPos(t) == null);
            return (
              <div key={r.id} style={{ display: "flex", borderBottom: "1px solid var(--border)", opacity: r.dim ? 0.45 : 1, minHeight: 46 }}>
                <div style={{ width: NAMEW, flexShrink: 0, padding: "8px 12px", boxSizing: "border-box" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: r.warn && r.items.length > 0 ? "#E5484D" : "var(--text-primary)" }}>
                    {r.name}{r.items.length > 0 ? ` ${r.items.length}` : ""}
                  </div>
                  {/* 시각이 없는 작업은 이름 아래 칩으로 */}
                  {untimed.map(t => (
                    <button key={t.id} type="button" onClick={() => onOpen(t.id)} title={`${t.customer_name} · 시간 미정`} style={{
                      display: "block", maxWidth: "100%", marginTop: 4, padding: "2px 6px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                      border: `1px dashed ${getCategoryMeta(catTask(t)).color}`, background: "transparent", color: "var(--text-primary)",
                      fontFamily: "inherit", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left",
                    }}>미정 · {t.customer_name}</button>
                  ))}
                </div>
                <div style={{ flex: 1, position: "relative" }}>
                  {Array.from({ length: SPAN }, (_, i) => (
                    <span key={i} style={{ position: "absolute", left: `${(i / SPAN) * 100}%`, top: 0, bottom: 0, borderLeft: "1px solid var(--border)", opacity: 0.5 }}/>
                  ))}
                  {nowPos != null && <span style={{ position: "absolute", left: `${nowPos}%`, top: 0, bottom: 0, borderLeft: "2px solid var(--accent, #FF1B8D)", zIndex: 2 }}/>}
                  {(() => {
                    // 시작 시각순으로 놓고, 막대 길이 = 서비스별 기본 소요 시간. 다음 막대와 겹치는 구간만 반투명으로 칠한다.
                    const bars = timed.map(t => {
                      const s0 = Math.min(Math.max(hourPos(t), H0), H1 - 0.25);
                      return { t, s: s0, e: Math.min(s0 + getTaskDurationHours(catTask(t)), H1) };
                    }).sort((x, y) => x.s - y.s);
                    return bars.map((bar, i) => {
                      const { t, s: bs, e: be } = bar;
                      const cat = getCategoryMeta(catTask(t));
                      const cancelled = t.status === "취소";
                      const done = stageOf(t) === "완료";
                      const prevEnd = Math.max(bs, ...bars.slice(0, i).map(x => x.e));          // 앞 막대가 덮는 끝
                      const nextStart = i + 1 < bars.length ? Math.min(be, bars[i + 1].s) : be; // 뒤 막대가 시작하는 곳
                      const len = Math.max(be - bs, 0.01);
                      const p1 = Math.min(Math.max(((prevEnd - bs) / len) * 100, 0), 100);      // 앞쪽 겹침 끝 %
                      const p2 = Math.min(Math.max(((nextStart - bs) / len) * 100, p1), 100);   // 뒤쪽 겹침 시작 %
                      const solid = cat.color, soft = categoryTint(cat.color, 0.45);
                      const bg = cancelled
                        ? "repeating-linear-gradient(135deg, var(--bg-secondary) 0 6px, var(--border) 6px 12px)"   // 취소 = 회색 줄무늬
                        : `linear-gradient(to right, ${soft} 0 ${p1}%, ${solid} ${p1}% ${p2}%, ${soft} ${p2}% 100%)`;
                      return (
                        <button key={t.id} type="button" onClick={() => onOpen(t.id)}
                          title={`${visitHm(t)} ${t.customer_name} · ${townOf(t)} · ${stageOf(t)} · 약 ${getTaskDurationHours(catTask(t))}시간`}
                          style={{
                            position: "absolute", top: 6, bottom: 6, left: `${((bs - H0) / SPAN) * 100}%`,
                            width: `calc(${((be - bs) / SPAN) * 100}% - 3px)`, minWidth: 48, zIndex: 1 + i,
                            borderRadius: 8, border: "none", padding: "0 8px", cursor: "pointer", fontFamily: "inherit",
                            fontSize: 12, fontWeight: 700, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            color: cancelled ? "var(--text-secondary)" : (cat.textOnColor || "#fff"),
                            background: bg,
                            textDecoration: cancelled ? "line-through" : "none",
                          }}>
                          {done ? "✓ " : ""}{t.customer_name}{townOf(t) ? ` · ${townOf(t)}` : ""}
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 12, color: "var(--text-secondary)", flexWrap: "wrap" }}>
        {categoriesInTasks(tasks.map(catTask)).map(m => (
          <span key={m.key} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: m.color }}/>{m.icon} {m.label}
          </span>
        ))}
        <span>✓ 완료 · 줄무늬 = 취소 · 분홍 세로선 = 지금 · 막대 길이 = 서비스별 기본 소요 시간(표시용) · 겹친 구간은 연하게</span>
      </div>
    </div>
  );
}

// ───────────────────────── 전체 작업 검색 ─────────────────────────
const STAGES = ["전체", "미배정", "배정", "일정확정", "진행", "완료", "취소"];
const COLS = [
  { key: "when",  label: "방문일시", get: t => `${visitYmd(t)} ${visitHm(t)}` },
  { key: "cat",   label: "종목",     get: t => getCategoryMeta(catTask(t)).label },
  { key: "name",  label: "고객명",   get: t => t.customer_name || "" },
  { key: "town",  label: "주소(구·동)", get: t => townOf(t) },
  { key: "work",  label: "작업 항목", get: t => workLabel(t) },
  { key: "eng",   label: "담당 기사", get: t => t.engineer_name || "" },
  { key: "stage", label: "상태",     get: t => stageOf(t) },
  { key: "supply", label: "공급가",  get: t => Number(t.supply_amount) || 0, num: true },
  { key: "fee",   label: "수수료",   get: t => Number(t.fee) || 0, num: true },
];

// preset: { stage?, eng?, n } — 홈·기사 탭에서 조건을 정해 넘어올 때 (기간은 이번 달).
export function SubPcSearch({ onOpen, refreshKey = 0, preset = null }) {
  const today = kstYmd(new Date());
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [stage, setStage] = useState((preset && preset.stage) || "전체");
  const [eng, setEng] = useState((preset && preset.eng) || "");
  useEffect(() => {
    if (!preset) return;
    setStage(preset.stage || "전체"); setEng(preset.eng || "");
    setFrom(today.slice(0, 8) + "01"); setTo(endOfMonth(today));     // 이번 달 전체(앞으로의 일정 포함)
  }, [preset && preset.n]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState({ key: "when", dir: -1 });

  useEffect(() => { subListStaff().then(r => { if (r.ok) setStaff(Array.isArray(r.staff) ? r.staff : []); }); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await subQueryTasks({ from, to, engineerId: eng || null, query: q.trim() });
    if (!res.ok) { setError(res.error || "작업을 불러오지 못했습니다."); setRows([]); setTotal(0); }
    else { setError(""); setRows(Array.isArray(res.tasks) ? res.tasks : []); setTotal(Number(res.total) || 0); }
    setLoading(false);
  }, [from, to, eng, q]);
  // 검색어는 입력이 멈춘 뒤에, 나머지 조건은 바로
  useEffect(() => { const id = setTimeout(load, 350); return () => clearTimeout(id); }, [load, refreshKey]);

  const cats = useMemo(() => categoriesInTasks(rows.map(catTask)), [rows]);
  const shown = useMemo(() => {
    const list = rows.filter(t => (stage === "전체" || stageOf(t) === stage) && (!cat || getCategoryMeta(catTask(t)).key === cat));
    const col = COLS.find(c => c.key === sort.key) || COLS[0];
    return [...list].sort((a, b) => {
      const x = col.get(a), y = col.get(b);
      const r = col.num ? (x - y) : String(x).localeCompare(String(y), "ko");
      return r * sort.dir;
    });
  }, [rows, stage, cat, sort]);
  const sum = useMemo(() => {
    const live = shown.filter(t => t.status !== "취소");
    return { n: shown.length, supply: live.reduce((s, t) => s + (Number(t.supply_amount) || 0), 0), fee: live.reduce((s, t) => s + (Number(t.fee) || 0), 0) };
  }, [shown]);

  function downloadCsv() {
    const esc = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const head = ["작업번호", ...COLS.map(c => c.label), "고객 전화", "주소"];
    const lines = shown.map(t => [t.task_no || "", ...COLS.map(c => c.get(t)), t.phone || "", t.address || ""].map(esc).join(","));
    // UTF-8 BOM — 엑셀에서 한글이 깨지지 않게
    const blob = new Blob(["﻿" + [head.map(esc).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `작업목록_${from}_${to}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const th = { padding: "9px 10px", fontSize: 12, fontWeight: 800, color: "var(--text-secondary)", textAlign: "left", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", position: "sticky", top: 0 };
  const td = { padding: "9px 10px", fontSize: 13, borderBottom: "1px solid var(--border)", verticalAlign: "middle" };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>전체 작업</div>
      {/* 필터 한 줄 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input type="date" value={from} onChange={e => e.target.value && setFrom(e.target.value)} style={field} aria-label="기간 시작"/>
        <span style={{ color: "var(--text-secondary)" }}>~</span>
        <input type="date" value={to} onChange={e => e.target.value && setTo(e.target.value)} style={field} aria-label="기간 끝"/>
        <select value={stage} onChange={e => setStage(e.target.value)} style={field} aria-label="상태">
          {STAGES.map(s => <option key={s} value={s}>{s === "전체" ? "상태 전체" : s}</option>)}
        </select>
        <select value={eng} onChange={e => setEng(e.target.value)} style={field} aria-label="기사">
          <option value="">기사 전체</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={cat} onChange={e => setCat(e.target.value)} style={field} aria-label="종목">
          <option value="">종목 전체</option>
          {cats.map(m => <option key={m.key} value={m.key}>{m.icon} {m.label}</option>)}
        </select>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="고객명 · 전화 뒷자리 · 주소 · 작업번호" style={{ ...field, flex: 1, minWidth: 220 }} aria-label="검색어"/>
        <button type="button" onClick={load} disabled={loading} style={btn}>{loading ? "…" : "조회"}</button>
      </div>
      {error && <div style={{ color: "var(--danger, #E5484D)", fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{error}</div>}
      {total > rows.length && <div style={{ fontSize: 12, color: "var(--danger, #E5484D)", fontWeight: 700, marginBottom: 8 }}>조건에 맞는 작업이 {total}건이라 최근 {rows.length}건만 보여 줍니다. 기간을 줄여 주세요.</div>}

      <div style={{ border: "1px solid var(--border)", borderRadius: 12, background: "var(--bg-elevated)", overflow: "auto", maxHeight: "calc(100vh - 250px)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
          <thead>
            <tr>
              {COLS.map(c => (
                <th key={c.key} onClick={() => setSort(s => ({ key: c.key, dir: s.key === c.key ? -s.dir : 1 }))} style={{ ...th, textAlign: c.num ? "right" : "left" }}>
                  {c.label}{sort.key === c.key ? (sort.dir > 0 ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading && shown.length === 0 && (
              <tr><td colSpan={COLS.length} style={{ ...td, textAlign: "center", color: "var(--text-secondary)", padding: "40px 0" }}>조건에 맞는 작업이 없습니다.</td></tr>
            )}
            {shown.map(t => {
              const st = stageOf(t);
              const ss = STAGE_STYLE[st] || STAGE_STYLE["취소"];
              const cancelled = t.status === "취소";
              return (
                <tr key={t.id} onClick={() => onOpen(t.id)} style={{ cursor: "pointer", opacity: cancelled ? 0.55 : 1 }}>
                  <td style={{ ...td, whiteSpace: "nowrap", fontWeight: 700 }}>{visitYmd(t).slice(5).replace("-", "/")} {visitHm(t) || "미정"}</td>
                  <td style={td}><CategoryChip task={catTask(t)} size="sm"/></td>
                  <td style={{ ...td, fontWeight: 700 }}>{t.customer_name}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{townOf(t)}</td>
                  <td style={{ ...td, color: "var(--text-secondary)" }}>{workLabel(t)}</td>
                  <td style={{ ...td, whiteSpace: "nowrap", color: t.engineer_name ? "var(--text-primary)" : "#E5484D" }}>{t.engineer_name || "미배정"}</td>
                  <td style={td}><span style={{ fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6, background: ss.bg, color: ss.fg, whiteSpace: "nowrap" }}>{st}</span></td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{Number(t.supply_amount) > 0 ? fmtWon(t.supply_amount) : "—"}</td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>{Number(t.fee) > 0 ? fmtWon(t.fee) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* 합계 + CSV */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 800 }}>합계 {sum.n}건</span>
        <span style={{ fontSize: 13 }}>공급가 <b>{fmtWon(sum.supply)}</b></span>
        <span style={{ fontSize: 13 }}>수수료 <b>{fmtWon(sum.fee)}</b></span>
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>(금액 합계는 취소 건 제외)</span>
        <span style={{ flex: 1 }}/>
        <button type="button" onClick={downloadCsv} disabled={shown.length === 0} style={btn}>엑셀(CSV) 받기</button>
      </div>
    </div>
  );
}
