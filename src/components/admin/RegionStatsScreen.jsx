// 2026-07-10 — 지역별 접수 현황 (AdminApp).
//   소스: tasks (실제 작업) + inquiries (미처리 홈페이지 접수) 합산.
//   ⚠️ 전환된 inquiries 는 Mig 120 로 DB 삭제됨 → 실제 주소는 tasks 에.
//     inquiries 는 "미처리 대기" (new/contacted) 만 잔존.
//   주소 파싱: parseRegion (관대). 못 잡으면 "미상".
//   표시: 시도/시군구별 건수 정렬, 기간 필터, 세부 breakdown (tasks vs inquiries).
//   ⚠️ 읽기 전용. 정산 트리거 무손.

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { todayYmd, toKstYmd } from "../../utils/dateLabel.js";
import { listInquiries } from "../../lib/inquiriesDb.js";
import { parseRegion } from "../../utils/regionParser.js";

const PERIOD_OPTS = [
  { id: "today",  label: "오늘" },
  { id: "week",   label: "이번주" },
  { id: "month",  label: "이번달" },
  { id: "all",    label: "전체" },
];

const SOURCE_OPTS = [
  { id: "all",       label: "전체" },
  { id: "homepage",  label: "홈페이지만" },
];

// 2026-07-10 — 홈페이지 유입 판별.
//   전환 로직 (AdminInquiriesScreen / AdminApp) 은 접수 시 memo 를
//   "[홈페이지 접수 ...] 희망 서비스: ..." 로 세팅.
//   저장 경로: tasksDb.js taskToRow — task.memo → DB request_note.
//   조회 경로: rowToTask — row.request_note → task.request / task.requestNote.
//   ⚠️ 초기 구현 버그: task.memo 만 검사 → 항상 false → "홈페이지만" 필터 0건.
//   정정: request / requestNote / memo / workMemo 모두 검사 (접수 경로별 필드 상이 대비).
const _HOMEPAGE_MARKER_RE = /\[홈페이지\s*접수/;
function _isFromHomepage(task) {
  if (!task) return false;
  const candidates = [task.request, task.requestNote, task.memo, task.workMemo];
  for (const m of candidates) {
    if (!m) continue;
    if (_HOMEPAGE_MARKER_RE.test(String(m))) return true;
  }
  return false;
}

// KST 기준 이번주 월요일 ymd.
function _startOfWeekMonYmd() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();  // 0=일 ~ 6=토
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function _startOfMonthYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function _rangeForPeriod(period) {
  const today = todayYmd();
  if (period === "today") return { start: today,                  end: today };
  if (period === "week")  return { start: _startOfWeekMonYmd(),   end: today };
  if (period === "month") return { start: _startOfMonthYmd(),     end: today };
  return { start: "0000-01-01", end: "9999-12-31" }; // all
}

export function RegionStatsScreen({ t, apiTasks = [], user, onBack }) {
  const [period, setPeriod]         = useState("today");
  // 2026-07-10 — 소스 필터 (전체 / 홈페이지만). 기본 전체.
  //   홈페이지만: tasks 는 memo "[홈페이지 접수" 접두만 / inquiries 는 전부 유입.
  const [source, setSource]         = useState("all");
  const [inquiries, setInquiries]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    const actorId = user?.user_id || user?.id;
    if (!actorId) { setInquiries([]); setLoading(false); return () => { alive = false; }; }
    // 미처리 대기 = new / contacted (spam / converted 제외).
    Promise.all([
      listInquiries(actorId, "new"),
      listInquiries(actorId, "contacted"),
    ]).then(([n, c]) => {
      if (!alive) return;
      setInquiries([...(n || []), ...(c || [])]);
      setLoading(false);
    }).catch(e => {
      if (!alive) return;
      setError(String(e?.message || e));
      setInquiries([]);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [user?.user_id, user?.id]);

  const { start, end } = useMemo(() => _rangeForPeriod(period), [period]);

  // tasks 는 created_at (접수 시각) KST 기준 필터. 취소 제외.
  // 2026-07-10 — source='homepage' 시 memo 접두 필터 추가.
  const tasksInRange = useMemo(() => {
    // 기간 안 취소 제외 dataset
    const inRange = (apiTasks || []).filter(x => {
      if (!x || x.status === "취소") return false;
      const created = x.createdAt || x.created_at || x.receivedAt || x.received_at;
      if (!created) return false;
      const k = toKstYmd(created);
      if (!k) return false;
      return k >= start && k <= end;
    });
    if (source !== "homepage") return inRange;
    // 홈페이지 필터 적용 + 진단 (마커 매칭 부재 시 실제 필드 값 샘플 로그)
    const matched = inRange.filter(_isFromHomepage);
    if (matched.length === 0 && inRange.length > 0) {
      // 2026-07-10 — 한 줄 JSON 로 출력 (콘솔 펼치기 없이 확인용).
      //   각 필드 앞 40자만 잘라서 노이즈 방지. principal 도 포함 —
      //   memo 파싱 대신 원청 기준 필터가 안정적인지 판단용.
      const cut = (v) => v == null ? null : String(v).slice(0, 40);
      const sample = inRange.slice(0, 3).map(x => ({
        code:          x.taskCode || x.task_no || x.id,
        principal:     x.principal || x.principalName || x.principalCode || x.principal_code,
        request:       cut(x.request),
        requestNote:   cut(x.requestNote),
        memo:          cut(x.memo),
        workMemo:      cut(x.workMemo),
      }));
      console.log("[RegionStats] SAMPLE=" + JSON.stringify({ total: inRange.length, sample }));
    }
    return matched;
  }, [apiTasks, start, end, source]);

  const inquiriesInRange = useMemo(() => {
    return (inquiries || []).filter(x => {
      const created = x.created_at || x.createdAt;
      if (!created) return false;
      const k = toKstYmd(created);
      if (!k) return false;
      return k >= start && k <= end;
    });
  }, [inquiries, start, end]);

  // 지역별 집계 — key = parseRegion(address).key
  const rows = useMemo(() => {
    const map = new Map();
    const push = (addr, kind) => {
      const { key, label } = parseRegion(addr);
      if (!map.has(key)) map.set(key, { key, label, tasks: 0, inquiries: 0, total: 0 });
      const row = map.get(key);
      if (kind === "task") row.tasks += 1;
      else                 row.inquiries += 1;
      row.total += 1;
    };
    for (const tk of tasksInRange) {
      const addr = tk.address || tk.fullAddress || tk.주소 || "";
      push(addr, "task");
    }
    for (const iq of inquiriesInRange) {
      const addr = iq.address || iq.주소 || "";
      push(addr, "inquiry");
    }
    return [...map.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  }, [tasksInRange, inquiriesInRange]);

  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const grandTasks = rows.reduce((s, r) => s + r.tasks, 0);
  const grandInquiries = rows.reduce((s, r) => s + r.inquiries, 0);

  return (
    <div style={{
      minHeight: "100vh",
      background: t.bg,
      color: t.text,
      paddingBottom: "calc(40px + env(safe-area-inset-bottom))",
      fontFamily: "'Pretendard', sans-serif",
    }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "14px 16px",
        borderBottom: `1px solid ${t.border}`,
        background: t.bgElevated,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <button onClick={onBack} style={{
          background: "transparent", border: "none", padding: 4,
          cursor: "pointer", color: t.text,
          display: "flex", alignItems: "center",
        }} aria-label="뒤로">
          <ArrowLeft size={20}/>
        </button>
        <div style={{ flex: 1, fontSize: 16, fontWeight: 800 }}>
          📍 지역별 접수 현황
        </div>
      </div>

      {/* 2026-07-10 — 소스 필터 (전체 / 홈페이지만) */}
      <div style={{ padding: "12px 16px 4px" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{
            fontSize: 10, color: t.textMuted, fontWeight: 700,
            letterSpacing: 0.3, marginRight: 4,
          }}>소스</span>
          {SOURCE_OPTS.map(opt => {
            const on = source === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSource(opt.id)}
                style={{
                  padding: "5px 12px",
                  background: on ? (t.bgInset || "rgba(255,255,255,0.06)") : "transparent",
                  border: `1px solid ${on ? t.text : t.border}`,
                  borderRadius: 999,
                  color: on ? t.text : t.textSecondary,
                  fontSize: 11, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}>{opt.label}</button>
            );
          })}
        </div>
      </div>

      {/* 기간 필터 */}
      <div style={{ padding: "8px 16px 8px" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PERIOD_OPTS.map(opt => {
            const on = period === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriod(opt.id)}
                style={{
                  padding: "6px 14px",
                  background: on ? t.accent : "transparent",
                  border: `1px solid ${on ? t.accent : t.border}`,
                  borderRadius: 999,
                  color: on ? "#fff" : t.textSecondary,
                  fontSize: 12, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}>{opt.label}</button>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, marginTop: 8 }}>
          {start} ~ {end} · {period === "all" ? "전체 기간" : "KST 기준"}
          {source === "homepage" && (
            <span style={{ marginLeft: 6, color: t.accent, fontWeight: 700 }}>· 홈페이지 유입만</span>
          )}
        </div>
      </div>

      {/* 요약 */}
      <div style={{ padding: "8px 16px 4px" }}>
        <div style={{
          display: "flex", gap: 10,
          padding: "12px 14px",
          background: t.bgElevated,
          border: `1px solid ${t.border}`,
          borderRadius: 10,
        }}>
          <Metric t={t} label="총 접수"  value={grandTotal}     accent/>
          <Metric t={t} label="작업"    value={grandTasks}/>
          <Metric t={t} label="대기 문의" value={grandInquiries}/>
          <Metric t={t} label="지역 수"  value={rows.length}/>
        </div>
      </div>

      {/* 표 */}
      <div style={{ padding: "10px 16px 20px" }}>
        {loading ? (
          <div style={{ padding: "20px", textAlign: "center", color: t.textMuted, fontSize: 12 }}>불러오는 중…</div>
        ) : error ? (
          <div style={{ padding: "20px", textAlign: "center", color: "#DC2626", fontSize: 12 }}>조회 실패: {error}</div>
        ) : rows.length === 0 ? (
          <div style={{
            padding: "24px 12px", textAlign: "center",
            color: t.textMuted, fontSize: 12,
            background: t.bgElevated, border: `1px solid ${t.border}`,
            borderRadius: 10,
          }}>이 기간 접수 없음</div>
        ) : (
          <div style={{
            background: t.bgElevated,
            border: `1px solid ${t.border}`,
            borderRadius: 10, overflow: "hidden",
          }}>
            {/* 헤더 */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 0.8fr) minmax(0, 0.8fr) minmax(0, 0.8fr)",
              gap: 8, padding: "9px 14px",
              borderBottom: `1px solid ${t.border}`,
              background: t.bgInset || "rgba(255,255,255,0.02)",
            }}>
              <Th t={t} align="left">지역</Th>
              <Th t={t} align="right">총계</Th>
              <Th t={t} align="right">작업</Th>
              <Th t={t} align="right">대기 문의</Th>
            </div>
            {rows.map((r, idx) => (
              <div key={r.key} style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 0.8fr) minmax(0, 0.8fr) minmax(0, 0.8fr)",
                gap: 8, padding: "10px 14px",
                borderTop: idx === 0 ? "none" : `1px solid ${t.border}`,
                alignItems: "center",
              }}>
                <span style={{
                  fontSize: 13, fontWeight: 700, color: t.text,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{r.label}</span>
                <NumSpan t={t} n={r.total}     accent/>
                <NumSpan t={t} n={r.tasks}/>
                <NumSpan t={t} n={r.inquiries}/>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ t, label, value, accent }) {
  return (
    <div style={{
      flex: 1, minWidth: 0,
      display: "flex", flexDirection: "column", gap: 2,
    }}>
      <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: 0.3 }}>{label}</span>
      <span className="mono" style={{
        fontSize: 16, fontWeight: 800,
        color: accent ? t.accent : t.text,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.2px",
      }}>{Number(value || 0).toLocaleString("ko-KR")}</span>
    </div>
  );
}
function Th({ t, align, children }) {
  return (
    <div style={{
      fontSize: 10, color: t.textMuted, fontWeight: 700,
      letterSpacing: 0.3,
      textAlign: align,
    }}>{children}</div>
  );
}
function NumSpan({ t, n, accent }) {
  return (
    <span className="mono" style={{
      fontSize: 13, fontWeight: 800,
      color: accent ? t.accent : t.text,
      textAlign: "right",
      fontVariantNumeric: "tabular-nums",
    }}>{Number(n || 0).toLocaleString("ko-KR")}</span>
  );
}

export default RegionStatsScreen;
