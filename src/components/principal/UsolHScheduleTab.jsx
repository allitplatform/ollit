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
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { getStatusBadge, getStatusLabel } from "../../utils/principalStatusBadge.js";
// 2026-06-11 — PC 분기 (1024+).
import { useIsPc } from "../../utils/useIsPc.js";
import { useIsWide } from "../../utils/useIsWide.js";
// 2026-06-11 — 내 작업 측 PC 표 헬퍼 재사용.
import {
  PcTableRow,
  PC_GRID_COLS,
  PC_GRID_COLS_WIDE,
  PC_HEADER_COLS,
} from "./PrincipalListTab.jsx";
// 2026-06-11 — 폰트 표준 토큰.
import { TEXT } from "../../styles/textTokens.js";

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

export function UsolHScheduleTab({ t, principalCodes = [], onSelect }) {
  const isPc = useIsPc();
  const today = toKstYmd(new Date());
  // 2026-06-11 — PC default: 이번 달 / 모바일 default: 오늘 (옛 동작 유지).
  const [preset, setPreset] = useState(() => "today");
  const [range, setRange] = useState(() => presetToRange("today"));
  // PC 진입 시점 1회만 month preset 측 default 적용.
  useEffect(() => {
    if (isPc && preset === "today") {
      const r = presetToRange("month");
      setPreset("month");
      setRange(r);
      setDraftStart(r.start);
      setDraftEnd(r.end);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPc]);
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

  // 2026-06-11 — PC 분기. 모바일 옛 흐름은 아래 그대로 (회귀 0).
  if (isPc) {
    return (
      <ViewPcSchedule
        t={t}
        preset={preset}
        pickPreset={pickPreset}
        range={range}
        draftStart={draftStart}
        draftEnd={draftEnd}
        setDraftStart={setDraftStart}
        setDraftEnd={setDraftEnd}
        applyCustomRange={applyCustomRange}
        tasks={tasks}
        loading={loading}
        error={error}
        onSelect={onSelect}
      />
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

// ============================================================
// 2026-06-11 — PC 일정 화면 (사장님 spec — 캘린더 + 기간 표 + selectedTask aside).
//   레이아웃: 좌측 메인 (캘린더 + 표). 우측 X (selectedTask = PcShell aside).
//   캘린더 default = 이번 달. 날짜 클릭 → 표 = 그날 작업.
//   기간 칩/범위 변경 → 표 = 기간 작업.
// ============================================================
function ViewPcSchedule({
  t,
  preset, pickPreset,
  range,
  draftStart, draftEnd, setDraftStart, setDraftEnd,
  applyCustomRange,
  tasks, loading, error,
  onSelect,
}) {
  const isWide = useIsWide();
  const gridCols = isWide ? PC_GRID_COLS_WIDE : PC_GRID_COLS;

  // 캘린더 month (YYYY-MM) — default 이번 달. range 변경 시 시작일의 월 측 자동 동기화.
  const [calYm, setCalYm] = useState(() => toKstYmd(new Date()).slice(0, 7));
  useEffect(() => {
    if (range?.start) setCalYm(range.start.slice(0, 7));
  }, [range?.start]);

  // 선택된 날짜 (YMD) — null 측 "기간 전체" 표. 클릭 시 그날 표.
  const [selectedYmd, setSelectedYmd] = useState(null);

  // tasks 측 KST 측 day별 카운트 (캘린더 칸용).
  const dayCount = useMemo(() => {
    const m = new Map();
    for (const r of tasks) {
      if (!r.scheduled_at) continue;
      const ymd = toKstYmd(r.scheduled_at);
      m.set(ymd, (m.get(ymd) || 0) + 1);
    }
    return m;
  }, [tasks]);

  // 표 본문 — selectedYmd 있으면 그날 / 없으면 기간 전체. 날짜순 (scheduled_at asc).
  const tableTasks = useMemo(() => {
    const src = selectedYmd
      ? tasks.filter(r => r.scheduled_at && toKstYmd(r.scheduled_at) === selectedYmd)
      : tasks.filter(r => r.scheduled_at);
    return src
      .map(mapScheduleRowToTask)
      .sort((a, b) => String(a.scheduledAt || "").localeCompare(String(b.scheduledAt || "")));
  }, [tasks, selectedYmd]);

  const tableTitle = selectedYmd
    ? `${selectedYmd} 작업`
    : `${fmtRangeShort(range.start, range.end)} 작업`;

  return (
    <div style={{
      width: "100%",
      padding: "20px 24px 24px",
      minHeight: "100vh",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      gap: 16,
    }}>
      {/* 상단 — 빠른 칩 + 기간 입력 + 조회 */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        padding: "10px 14px",
        background: t.bgElevated,
        border: `1px solid ${t.border}`,
        borderRadius: 10,
      }}>
        {QUICK_PRESETS.map(p => (
          <PresetChip key={p.id} active={preset === p.id} label={p.label} onClick={() => {
            pickPreset(p.id);
            setSelectedYmd(null);   // 기간 변경 시 날짜 선택 해제 → 기간 표.
          }}/>
        ))}
        <span style={{ flex: 1 }}/>
        <input type="date" value={draftStart} onChange={(e) => setDraftStart(e.target.value)} style={dateInputStyle}/>
        <span style={{ fontSize: TEXT.META, color: t.textMuted }}>~</span>
        <input type="date" value={draftEnd} onChange={(e) => setDraftEnd(e.target.value)} style={dateInputStyle}/>
        <button type="button" onClick={() => { applyCustomRange(); setSelectedYmd(null); }} style={{
          padding: "7px 16px",
          background: t.accent || "#FF1B8D",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: TEXT.META,
          fontWeight: 800,
          cursor: "pointer",
          fontFamily: "inherit",
        }}>조회</button>
      </div>

      {error && (
        <div style={{ padding: 12, color: "#EF4444", fontSize: TEXT.META, textAlign: "center" }}>⚠️ {error}</div>
      )}

      {/* 캘린더 그리드 */}
      <ScheduleCalendar
        t={t}
        calYm={calYm}
        setCalYm={setCalYm}
        dayCount={dayCount}
        selectedYmd={selectedYmd}
        onSelectYmd={(ymd) => setSelectedYmd(prev => prev === ymd ? null : ymd)}
      />

      {/* 표 — 선택 날짜 또는 기간 전체 */}
      <div>
        <div style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          margin: "4px 4px 10px",
        }}>
          <span style={{ fontSize: TEXT.HEADER, fontWeight: 800, color: t.text }}>{tableTitle}</span>
          <span style={{ fontSize: TEXT.META, fontWeight: 600, color: t.textMuted }}>{tableTasks.length}건</span>
          {selectedYmd && (
            <button type="button" onClick={() => setSelectedYmd(null)} style={{
              marginLeft: "auto",
              background: "transparent",
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              padding: "5px 12px",
              color: t.textMuted,
              fontSize: TEXT.META,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}>날짜 선택 해제</button>
          )}
        </div>
        {loading ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: t.textMuted, fontSize: TEXT.META }}>
            불러오는 중...
          </div>
        ) : tableTasks.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: t.textMuted, fontSize: TEXT.META }}>
            해당 {selectedYmd ? "날짜" : "기간"}에 작업이 없습니다.
          </div>
        ) : (
          <div style={{
            background: t.bgElevated,
            border: `1px solid ${t.border}`,
            borderRadius: 10,
            overflow: "hidden",
          }}>
            <div style={{ width: "100%", fontSize: TEXT.BODY }}>
              {/* 헤더 */}
              <div style={{
                display: "grid",
                gridTemplateColumns: gridCols,
                alignItems: "center",
                borderBottom: `1px solid ${t.border}`,
                background: t.bgElevated,
              }}>
                {PC_HEADER_COLS.map(col => (
                  <div key={col.label} style={{
                    padding: "13px 16px",
                    fontSize: TEXT.HEADER,
                    fontWeight: 700,
                    color: t.textMuted,
                    letterSpacing: 0.2,
                    textAlign: col.align,
                  }}>{col.label}</div>
                ))}
              </div>
              {/* 본문 — PcTableRow 재사용. */}
              {tableTasks.map(task => (
                <PcTableRow
                  key={task.id}
                  t={t}
                  task={task}
                  isSelected={false}
                  onClick={() => onSelect?.(task)}
                  isWide={isWide}
                  gridCols={gridCols}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 캘린더 그리드 (7×N). 칸 = 날짜 + N건 배지.
//   오늘 = 핑크 강조. 선택일 = 핑크 배경. 일=빨강 / 토=파랑.
function ScheduleCalendar({ t, calYm, setCalYm, dayCount, selectedYmd, onSelectYmd }) {
  const [year, month] = calYm.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay  = new Date(year, month, 0);
  const startDow = firstDay.getDay(); // 0=일 .. 6=토
  const totalDays = lastDay.getDate();
  const todayYmd = toKstYmd(new Date());

  // 그리드 cells — 시작 공백 + 1..totalDays + 끝 공백 (7의 배수).
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    const p = new Date(year, month - 2, 1);
    setCalYm(`${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, "0")}`);
  };
  const nextMonth = () => {
    const n = new Date(year, month, 1);
    setCalYm(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <div style={{
      background: t.bgElevated,
      border: `1px solid ${t.border}`,
      borderRadius: 10,
      padding: "14px 16px",
    }}>
      {/* 월 헤더 + 이전/다음 */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
      }}>
        <button type="button" onClick={prevMonth} aria-label="이전 달" style={iconBtn(t)}>
          <ChevronLeft size={18}/>
        </button>
        <div style={{ fontSize: TEXT.BODY, fontWeight: 800, color: t.text }}>
          {year}년 {month}월
        </div>
        <button type="button" onClick={nextMonth} aria-label="다음 달" style={iconBtn(t)}>
          <ChevronRight size={18}/>
        </button>
      </div>

      {/* 요일 헤더 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
        {["일", "월", "화", "수", "목", "금", "토"].map((w, i) => (
          <div key={w} style={{
            textAlign: "center",
            padding: "6px 0",
            fontSize: TEXT.META,
            fontWeight: 800,
            letterSpacing: 0.5,
            color: i === 0 ? "#EF4444" : i === 6 ? "#3B82F6" : t.textMuted,
          }}>{w}</div>
        ))}
      </div>

      {/* 날짜 칸 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={`pad-${i}`} style={{ aspectRatio: "1.6/1" }}/>;
          const ymd = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const count = dayCount.get(ymd) || 0;
          const isToday = ymd === todayYmd;
          const isSelected = ymd === selectedYmd;
          const dow = (startDow + d - 1) % 7;
          const dateColor = dow === 0 ? "#EF4444" : dow === 6 ? "#3B82F6" : t.text;
          return (
            <button
              key={ymd}
              type="button"
              onClick={() => onSelectYmd(ymd)}
              style={{
                aspectRatio: "1.6/1",
                background: isSelected ? "rgba(255, 27, 141, 0.14)" : "transparent",
                border: `1px solid ${isSelected ? "#FF1B8D" : t.border}`,
                borderRadius: 8,
                padding: "6px 8px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                alignItems: "stretch",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "background 0.15s",
              }}
            >
              <span style={{
                fontSize: TEXT.META,
                fontWeight: isToday ? 800 : 700,
                color: isToday ? "#FF1B8D" : dateColor,
                textAlign: "left",
              }}>{d}</span>
              {count > 0 && (
                <span style={{
                  fontSize: TEXT.META,
                  fontWeight: 700,
                  color: t.textSecondary,
                  textAlign: "right",
                }}>{count}건</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 일정 fetch row (snake_case) → PcTableRow 가 받는 task shape 매핑.
//   v14NormalizeTask 미사용 — 일정 SELECT 측 가벼운 컬럼만 받음.
function mapScheduleRowToTask(row) {
  return {
    id: row.id,
    customer: row.customer_name || "",
    customerName: row.customer_name || "",
    task_no: row.task_no || "",
    taskCode: row.task_no || "",
    taskNo: row.task_no || "",
    status: row.status,
    scheduledAt: row.scheduled_at,
    region: row.district || "",
    address: row.address || "",
    customerAddress: row.address || "",
    assignedEngineer: "",
    engineer: "",
    workItems: (row.task_items || []).map(it => ({
      id: it.id,
      workType: it.work_types?.name,
      serviceCode: it.work_types?.service_types?.code,
      orderType: it.order_type,
      appliance: it.appliance_types?.name,
      qty: it.qty,
    })),
  };
}

// 아이콘 버튼 (이전/다음 달).
function iconBtn(t) {
  return {
    background: "transparent",
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    padding: "6px 8px",
    color: t.textSecondary,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "inherit",
  };
}

export default UsolHScheduleTab;
