// 2026-06-06 — 유솔홈케어(usol_h) 일정 탭. 측 측 측 측 다른 원청 측 측 측 측.
//
// 측 측:
//   · 측 측: scheduled_at (예정일시) 측 KST 측 측 측 측 measure usol_h 작업.
//   · 측 측: 빠른 칩 [오늘 / 최근 7일 / 이번 달] (택1) + 측 측 측 측 측 (시작~종료).
//   · 측 측: 측 측 → 측 측 측 측 시간 asc. NULL 측 "일정미정" 측 측.
//   · 측 표시: [시간] [아이콘+고객명] [기종×수량] · · · [상태].
//
// KST 측 측 (★ slice(0,10)/startsWith 금지 — UTC 함정):
//   toKstYmd(date)         — 'YYYY-MM-DD' (Asia/Seoul).
//   kstRangeToUtc(s, e)    — KST 측 측 → UTC ISO startISO / endISO (endISO = 다음날 00:00).
//
// Supabase 1000행 캡 측:
//   PAGE_SIZE=1000 loop fetch. 측 측 측 측 측 측 측 측 (KST 측 측 측 measure 측 측 측 측 측 측 측).

import { useState, useMemo, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { getStatusBadge, getStatusLabel } from "../../utils/principalStatusBadge.js";

const ACCENT = "#FF1B8D";

// KST YYYY-MM-DD (Intl Asia/Seoul, en-CA)
function toKstYmd(d) {
  const date = d instanceof Date ? d : new Date(d);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

// KST 'YYYY-MM-DD' 측 측 → UTC ISO (startISO, endISO=다음날 00:00).
function kstRangeToUtc(startYmd, endYmd) {
  const start = new Date(`${startYmd}T00:00:00+09:00`);
  const end = new Date(`${endYmd}T00:00:00+09:00`);
  end.setDate(end.getDate() + 1);   // end exclusive = 다음날 KST 00:00
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

// KST 측 'HH:MM'
function toKstHm(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
}

// 측 측 측 라벨: "6월 6일 (금)"
const KO_WEEKDAY = ["일","월","화","수","목","금","토"];
function fmtDateHeader(ymd) {
  const [_, mo, dd] = ymd.split("-").map(Number);
  const d = new Date(`${ymd}T00:00:00+09:00`);
  const wd = KO_WEEKDAY[d.getUTCDay() === 0 ? 6 : (d.getUTCDay() - 1 + 7) % 7];
  // 측 측 측 측 측 측 — KST 측 측 측 측 측 측 직접 측 측.
  const kstWd = KO_WEEKDAY[new Date(`${ymd}T00:00:00+09:00`).getDay()];
  return `${mo}월 ${dd}일 (${kstWd})`;
}

// 기본 빠른 칩 측 측
const QUICK_PRESETS = [
  { id: "today",  label: "오늘" },
  { id: "week7",  label: "최근 7일" },
  { id: "month", label: "이번 달" },
];

function presetToRange(preset) {
  const todayYmd = toKstYmd(new Date());
  if (preset === "today") return { start: todayYmd, end: todayYmd };
  if (preset === "week7") {
    const start = new Date(`${todayYmd}T00:00:00+09:00`);
    start.setDate(start.getDate() - 6);
    return { start: toKstYmd(start), end: todayYmd };
  }
  if (preset === "month") {
    const [y, m] = todayYmd.split("-");
    return { start: `${y}-${m}-01`, end: todayYmd };
  }
  return { start: todayYmd, end: todayYmd };
}

// 상태 배지 — PrincipalListTab 측 측 (테마 측 측 토큰).
function StatusBadge({ status }) {
  const cfg = getStatusBadge(status);
  return (
    <span style={{
      fontSize: 10, fontWeight: 700,
      color: cfg.color, background: cfg.bg,
      padding: "2px 7px", borderRadius: 8, whiteSpace: "nowrap", flexShrink: 0,
    }}>{getStatusLabel(status)}</span>
  );
}

// PrincipalListTab 측 측측 색 토큰 (라이트/다크 측측 측측).
const CLEAN_COLOR       = "#378ADD";
const REFRIGERANT_COLOR = "#EF9F27";
const VISIT_COLOR       = "#9CA3AF";

function getMainItem(task) {
  const items = Array.isArray(task.task_items) ? task.task_items : [];
  return items.find(it => it.order_type === "본작업") || items[0] || null;
}

// PrincipalListTab.getServiceKind 측 (nested task_items shape 측 측측).
function getKind(task) {
  if (task?.status === "visit_only") return "visit";
  const main = getMainItem(task);
  if (!main) return "clean";
  const svc = String(main.work_types?.service_types?.code || "").toLowerCase();
  if (svc === "refrigerant") return "refrigerant";
  if (svc === "cleaning")    return "clean";
  const wt = String(main.work_types?.name || "");
  if (/냉매|가스|충전/.test(wt)) return "refrigerant";
  if (/세척|cleaning|clean/i.test(wt)) return "clean";
  return "clean";
}

function ServiceIcon({ kind, size = 14 }) {
  if (kind === "visit")       return <span style={{ fontSize: size, color: VISIT_COLOR }}>🚗</span>;
  if (kind === "refrigerant") return <span style={{ fontSize: size, color: REFRIGERANT_COLOR }}>⚡</span>;
  return <span style={{ fontSize: size, color: CLEAN_COLOR }}>❄️</span>;
}

// 일정 행 — PrincipalListTab.TaskRow 동일 형식 + 시간(앞) + 상태배지(뒤).
//   [HH:MM] [Icon] 고객명  (기종×수량) · 지역  [상태]
function ScheduleRow({ task, onClick }) {
  const time = task.scheduled_at ? toKstHm(task.scheduled_at) : "미정";
  const kind = getKind(task);
  const main = getMainItem(task);
  const appliance = main?.appliance_types?.name || "";
  const qty = main?.qty || 1;
  const items = Array.isArray(task.task_items) ? task.task_items : [];
  const otherCount = Math.max(0, items.length - 1);
  const applianceText = appliance
    ? `(${appliance}${qty > 1 ? `×${qty}` : ""}${otherCount > 0 ? ` +${otherCount}` : ""})`
    : "";
  // "키워드" = region (district) — PrincipalListTab TaskRow 와 동일 소스.
  const region = task.district || "";
  const middleText = [applianceText, region].filter(Boolean).join(" · ");

  const isCancelled = task.status === "취소";

  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--bg-elevated, #1F1F1F)",
        border: "1px solid var(--border, #2A2A2A)",
        borderRadius: 8,
        padding: "8px 10px",
        display: "flex", alignItems: "center", gap: 8,
        minHeight: 38,
        cursor: onClick ? "pointer" : "default",
        opacity: isCancelled ? 0.45 : 1,
      }}
    >
      {/* 시간 */}
      <span className="mono" style={{
        fontSize: 11, fontWeight: 800,
        color: time === "미정" ? "var(--text-secondary)" : "var(--text-primary)",
        width: 38, flexShrink: 0, textAlign: "left",
      }}>{time}</span>
      {/* 아이콘 (PrincipalListTab 동일 컴포넌트) */}
      <div style={{ flexShrink: 0, width: 14, textAlign: "center" }}>
        <ServiceIcon kind={kind}/>
      </div>
      {/* 고객명 (primary) */}
      <span style={{
        flexShrink: 0, fontSize: 12, fontWeight: 500,
        color: "var(--text-primary)",
        maxWidth: 90,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{task.customer_name || "—"}</span>
      {/* 가운데 muted: (기종×수량) · region — PrincipalListTab.TaskRow 동일 */}
      <span style={{
        flex: 1, minWidth: 0,
        fontSize: 11, fontWeight: 400, color: "var(--text-secondary)",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>{middleText}</span>
      {/* 상태배지 */}
      <StatusBadge status={task.status}/>
    </div>
  );
}

// 빠른 칩
function PresetChip({ active, label, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: "6px 12px",
      background: active ? ACCENT : "var(--bg-secondary, #1A1A1A)",
      border: `1px solid ${active ? ACCENT : "var(--border, #2A2A2A)"}`,
      borderRadius: 999, fontSize: 11, fontWeight: 700,
      color: active ? "#fff" : "var(--text-secondary, #B5B0A8)",
      cursor: "pointer", fontFamily: "inherit",
    }}>{label}</button>
  );
}

export function UsolHScheduleTab({ principalCodes = [], onSelect }) {
  const today = toKstYmd(new Date());
  const [preset, setPreset] = useState("today");
  const [range, setRange] = useState(() => presetToRange("today"));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(today);
  const [draftEnd, setDraftEnd] = useState(today);

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 2026-06-06 — usol_h OR usol_n 둘 다 사용. 유솔 통합계정 (P003 = usol_h primary + usol_n) 측
  //   principalCodes = ['usol_h', 'usol_n'] 측 측 → IN 측 측 측 측 측 작업 측 측.
  const usolCodes = useMemo(
    () => principalCodes.filter(c => c === "usol_h" || c === "usol_n"),
    [principalCodes]
  );
  const usolActive = usolCodes.length > 0;

  // 측 측 측 → range 측 측
  function pickPreset(id) {
    setPreset(id);
    const r = presetToRange(id);
    setRange(r);
    setDraftStart(r.start);
    setDraftEnd(r.end);
  }

  // 측 측 측 측
  function applyCustomRange() {
    let s = draftStart, e = draftEnd;
    if (s && e && s > e) { const tmp = s; s = e; e = tmp; }
    setRange({ start: s, end: e });
    setPreset("");
    setPickerOpen(false);
  }

  // Fetch
  useEffect(() => {
    if (!usolActive) { setTasks([]); return; }
    let alive = true;
    setLoading(true); setError("");

    (async () => {
      // 유솔 통합 — usolCodes 측 측 principal_id 측 lookup (한 번)
      const { data: pdata, error: pErr } = await supabase
        .from("principals").select("id, code").in("code", usolCodes);
      if (pErr || !Array.isArray(pdata) || pdata.length === 0) {
        if (alive) { setError("유솔 principal id 조회 실패"); setLoading(false); }
        return;
      }
      const usolIds = pdata.map(p => p.id);
      const { startISO, endISO } = kstRangeToUtc(range.start, range.end);

      // 페이지네이션 loop (PAGE_SIZE=1000)
      const PAGE_SIZE = 1000;
      const MAX_PAGES = 20;
      const accumulated = [];
      for (let page = 0; page < MAX_PAGES; page++) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, error: qErr } = await supabase
          .from("tasks")
          .select(`
            id, task_no, customer_name, status, scheduled_at, district,
            task_items (
              id, qty, order_type,
              work_types ( id, name, service_types ( id, code ) ),
              appliance_types ( id, name )
            )
          `)
          .in("principal_id", usolIds)
          .gte("scheduled_at", startISO)
          .lt("scheduled_at", endISO)
          .order("scheduled_at", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to);
        if (qErr) {
          if (alive) { setError(qErr.message || "조회 실패"); setLoading(false); }
          return;
        }
        if (!data || data.length === 0) break;
        accumulated.push(...data);
        if (data.length < PAGE_SIZE) break;
      }

      // 측측 측측 (scheduled_at IS NULL) 측측 fetch — 측측측 측측 측 측 측 측.
      //   범위 측 측 측 측 측 측 측 측 측 측 측 측 측 측 (사장님 spec: 측 측 측).
      const { data: nullData } = await supabase
        .from("tasks")
        .select(`
          id, task_no, customer_name, status, scheduled_at, district,
          task_items (
            id, qty, order_type,
            work_types ( id, name, service_types ( id, code ) ),
            appliance_types ( id, name )
          )
        `)
        .in("principal_id", usolIds)
        .is("scheduled_at", null)
        .neq("status", "완료")
        .neq("status", "취소")
        .order("received_at", { ascending: false })
        .limit(50);
      if (Array.isArray(nullData)) accumulated.push(...nullData);

      if (!alive) return;
      setTasks(accumulated);
      setLoading(false);
    })().catch(e => { if (alive) { setError(e?.message || "에러"); setLoading(false); } });

    return () => { alive = false; };
  }, [usolActive, usolCodes.join(","), range.start, range.end]);

  // 측 측 측 측: KST 측 측 (NULL → "(일정미정)") + 측 측 측 측 시간 asc
  const grouped = useMemo(() => {
    const map = new Map();
    for (const t of tasks) {
      const key = t.scheduled_at ? toKstYmd(t.scheduled_at) : "__NULL__";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    }
    // 측 측 측 시간 asc 정측 (NULL 측 received_at desc 측 측 유지)
    for (const [k, arr] of map.entries()) {
      if (k === "__NULL__") continue;
      arr.sort((a, b) => String(a.scheduled_at || "").localeCompare(String(b.scheduled_at || "")));
    }
    // 측 측 측 정측 — 날짜 desc, NULL 측 측 측
    const entries = [...map.entries()].sort((a, b) => {
      if (a[0] === "__NULL__") return 1;
      if (b[0] === "__NULL__") return -1;
      return b[0].localeCompare(a[0]);
    });
    return entries;
  }, [tasks]);

  if (!usolActive) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)", fontSize: 12 }}>
        유솔홈케어 전용 일정 탭입니다.
      </div>
    );
  }

  return (
    <div style={{ padding: 16, paddingBottom: 80 }}>
      {/* 빠른 칩 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {QUICK_PRESETS.map(p => (
          <PresetChip key={p.id} active={preset === p.id} label={p.label} onClick={() => pickPreset(p.id)}/>
        ))}
      </div>

      {/* 측 측 측 + 측 측 측 측 측 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 12px", marginBottom: 14,
        background: "var(--bg-secondary, #1A1A1A)",
        border: "1px solid var(--border, #2A2A2A)",
        borderRadius: 10,
      }}>
        <span className="mono" style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 700 }}>
          {fmtRangeShort(range.start, range.end)}
        </span>
        <span style={{ flex: 1 }}/>
        <button type="button" onClick={() => {
          setDraftStart(range.start);
          setDraftEnd(range.end);
          setPickerOpen(v => !v);
        }} style={{
          display: "flex", alignItems: "center", gap: 4,
          background: "transparent", border: "1px solid var(--border, #2A2A2A)",
          borderRadius: 8, padding: "4px 10px",
          color: "var(--text-secondary, #B5B0A8)",
          fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        }}>
          날짜 변경 <ChevronDown size={12}/>
        </button>
      </div>

      {/* 측 측 측 */}
      {pickerOpen && (
        <div style={{
          padding: 12, marginBottom: 14,
          background: "var(--bg-secondary, #1A1A1A)",
          border: "1px solid var(--border, #2A2A2A)",
          borderRadius: 10,
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        }}>
          <input type="date" value={draftStart} onChange={(e) => setDraftStart(e.target.value)} style={dateInputStyle}/>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>~</span>
          <input type="date" value={draftEnd} onChange={(e) => setDraftEnd(e.target.value)} style={dateInputStyle}/>
          <button type="button" onClick={applyCustomRange} style={{
            padding: "6px 14px", background: ACCENT, color: "#fff",
            border: "none", borderRadius: 8,
            fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
          }}>적용</button>
        </div>
      )}

      {/* 결과 */}
      {loading && (
        <div style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)", fontSize: 12 }}>
          불러오는 중...
        </div>
      )}
      {!loading && error && (
        <div style={{ padding: 24, textAlign: "center", color: "#FF6B6B", fontSize: 12 }}>
          ⚠️ {error}
        </div>
      )}
      {!loading && !error && grouped.length === 0 && (
        <div style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)", fontSize: 12 }}>
          이 기간에 작업이 없어요
        </div>
      )}

      {!loading && !error && grouped.map(([ymd, arr]) => (
        <div key={ymd} style={{ marginBottom: 16 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            marginBottom: 6, padding: "0 2px",
          }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>
              {ymd === "__NULL__" ? "일정미정" : fmtDateHeader(ymd)}
            </span>
            <span style={{ flex: 1 }}/>
            <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>
              {arr.length}건
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {arr.map(task => (
              <ScheduleRow key={task.id} task={task} onClick={() => onSelect && onSelect(task)}/>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// "M/D ~ M/D" 또는 같은 날 "M월 D일"
function fmtRangeShort(s, e) {
  if (!s || !e) return "";
  if (s === e) {
    const [_, mo, dd] = s.split("-").map(Number);
    return `${mo}월 ${dd}일`;
  }
  const [_, mo1, dd1] = s.split("-").map(Number);
  const [, mo2, dd2] = e.split("-").map(Number);
  return `${mo1}/${dd1} ~ ${mo2}/${dd2}`;
}

const dateInputStyle = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
  padding: "6px 8px", borderRadius: 8,
  fontSize: 12, fontFamily: "inherit",
  // colorScheme — html.colorScheme (themes.js 측 측측) 측 측측 자동, 강제 X.
};

export default UsolHScheduleTab;
