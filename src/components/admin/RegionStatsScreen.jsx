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

// 2026-07-10 — 홈페이지 유입 판별 방식 (v3):
//   v1 (memo "[홈페이지 접수" 마커): 폐기 — task 필드에 마커 없음.
//   v2 (원청=올데이케어): 폐기 — 원청은 홈페이지 외 다른 소스도 포함 (부정확).
//   v3 (inquiries.task_id 기반): Mig 152 mark_inquiry_converted v2 가
//     DELETE 대신 UPDATE 로 inquiries.status='converted' + task_id 보존 →
//     converted inquiries 의 task_id 가 곧 "홈페이지에서 전환된 task" 집합.
//     ⚠️ 신규/과거 모두 정확 (Mig 152 이후 전환분).

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
  const [source, setSource]         = useState("all");
  const [inquiries, setInquiries]   = useState([]);
  // 홈페이지 전환 task_id Set (Mig 152 converted inquiries.task_id).
  const [homepageTaskIds, setHomepageTaskIds] = useState(() => new Set());
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    const actorId = user?.user_id || user?.id;
    if (!actorId) { setInquiries([]); setLoading(false); return () => { alive = false; }; }
    // 미처리 대기 (new / contacted) + 전환분 (converted, task_id 추출용) 동시 조회.
    Promise.all([
      listInquiries(actorId, "new"),
      listInquiries(actorId, "contacted"),
      listInquiries(actorId, "converted"),
    ]).then(([n, c, cv]) => {
      if (!alive) return;
      setInquiries([...(n || []), ...(c || [])]);
      // 홈페이지 전환 task_id Set — 홈페이지만 필터의 진실 소스.
      const ids = new Set();
      for (const r of (cv || [])) {
        if (r.task_id) ids.add(String(r.task_id));
      }
      setHomepageTaskIds(ids);
      console.log("[RegionStats] converted inquiries loaded — homepage tasks:", ids.size);
      setLoading(false);
    }).catch(e => {
      if (!alive) return;
      setError(String(e?.message || e));
      setInquiries([]);
      setHomepageTaskIds(new Set());
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
    // 홈페이지 필터 = converted inquiries.task_id 기반 (v3).
    const matched = inRange.filter(x => x && x.id && homepageTaskIds.has(String(x.id)));
    console.log("[RegionStats] HOMEPAGE_FILTER=" + JSON.stringify({
      totalInRange:    inRange.length,
      matchedHomepage: matched.length,
      homepageIds:     homepageTaskIds.size,
    }));
    return matched;
  }, [apiTasks, start, end, source, homepageTaskIds]);

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
  //   2026-07-10 — 미상 행 펼침용 원문 배열 unparsed 도 함께 수집.
  const { rows, unparsedSamples } = useMemo(() => {
    const map = new Map();
    const unparsed = []; // { addr, kind } 파싱 실패 (key === "미상")
    const push = (addr, kind) => {
      const { key, label } = parseRegion(addr);
      if (!map.has(key)) map.set(key, { key, label, tasks: 0, inquiries: 0, total: 0, unparsed: [] });
      const row = map.get(key);
      if (kind === "task") row.tasks += 1;
      else                 row.inquiries += 1;
      row.total += 1;
      if (key === "미상") {
        row.unparsed.push({ addr: String(addr || "").trim(), kind });
        unparsed.push(String(addr || "").trim());
      }
    };
    for (const tk of tasksInRange) {
      const addr = tk.address || tk.fullAddress || tk.주소 || "";
      push(addr, "task");
    }
    for (const iq of inquiriesInRange) {
      const addr = iq.address || iq.주소 || "";
      push(addr, "inquiry");
    }
    const sorted = [...map.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
    return { rows: sorted, unparsedSamples: unparsed };
  }, [tasksInRange, inquiriesInRange]);

  // 2026-07-10 — 미상 원문 콘솔 로그 (파서 개선 근거 확인용).
  useEffect(() => {
    if (unparsedSamples.length > 0) {
      const preview = unparsedSamples.slice(0, 20).map(a => a.slice(0, 60));
      console.log("[RegionStats] UNPARSED=" + JSON.stringify({
        count: unparsedSamples.length,
        sample: preview,
      }));
    }
  }, [unparsedSamples]);

  // 미상 행 펼침 상태 (원문 리스트 노출 토글).
  const [showUnparsed, setShowUnparsed] = useState(false);

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
        {source === "homepage" && (
          <div style={{
            fontSize: 10, color: t.textMuted, fontWeight: 600, marginTop: 4,
            padding: "4px 8px",
            background: t.bgInset || "rgba(148, 163, 184, 0.08)",
            borderRadius: 6,
            display: "inline-block",
          }}>
            ⓘ 판별: 접수함 converted 상태의 inquiries.task_id 기반.
            2026-06-28 (Mig 152) 이전 전환분은 소급 불가.
          </div>
        )}
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

      {/* 2026-07-10 — 상단 서울 25구 SVG 지도 + 옆 서울 외 리스트 */}
      {!loading && !error && rows.length > 0 && (
        <div style={{ padding: "6px 16px 8px" }}>
          <SeoulMapPanel t={t} rows={rows}/>
        </div>
      )}

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
            {rows.map((r, idx) => {
              const isUnparsed = r.key === "미상";
              const expanded = isUnparsed && showUnparsed;
              return (
                <div key={r.key} style={{
                  borderTop: idx === 0 ? "none" : `1px solid ${t.border}`,
                }}>
                  <button
                    type="button"
                    onClick={isUnparsed ? () => setShowUnparsed(v => !v) : undefined}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 0.8fr) minmax(0, 0.8fr) minmax(0, 0.8fr)",
                      gap: 8, padding: "10px 14px",
                      width: "100%",
                      alignItems: "center",
                      background: "transparent",
                      border: "none",
                      cursor: isUnparsed ? "pointer" : "default",
                      fontFamily: "inherit",
                      textAlign: "left",
                    }}>
                    <span style={{
                      fontSize: 13, fontWeight: 700, color: t.text,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      display: "flex", alignItems: "center", gap: 4,
                    }}>
                      {r.label}
                      {isUnparsed && (
                        <span style={{
                          fontSize: 10, color: t.textMuted, fontWeight: 700,
                        }}>{expanded ? "▲ 접기" : "▼ 원문 보기"}</span>
                      )}
                    </span>
                    <NumSpan t={t} n={r.total}     accent/>
                    <NumSpan t={t} n={r.tasks}/>
                    <NumSpan t={t} n={r.inquiries}/>
                  </button>
                  {/* 2026-07-10 — 미상 행 펼침: 손님이 실제 적은 주소 원문 나열 */}
                  {isUnparsed && expanded && r.unparsed.length > 0 && (
                    <div style={{
                      padding: "0 14px 12px",
                      display: "flex", flexDirection: "column", gap: 4,
                      background: t.bgInset || "rgba(148, 163, 184, 0.05)",
                    }}>
                      <div style={{
                        fontSize: 10, color: t.textMuted, fontWeight: 700,
                        letterSpacing: 0.3, paddingTop: 8,
                      }}>원문 {r.unparsed.length}건 (파서가 지역 못 잡음)</div>
                      {r.unparsed.map((u, i) => (
                        <div key={i} style={{
                          padding: "6px 8px",
                          background: t.bg,
                          border: `1px solid ${t.border}`,
                          borderRadius: 6,
                          fontSize: 12, fontFamily: "'Pretendard', sans-serif",
                          color: t.text,
                          wordBreak: "break-all",
                        }}>
                          <span style={{
                            fontSize: 9, color: t.textMuted, fontWeight: 700,
                            marginRight: 6,
                          }}>{u.kind === "task" ? "T" : "I"}</span>
                          {u.addr || "(빈 주소)"}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
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

// 2026-07-10 — 서울 25구 SVG 색칠 지도 + 옆 서울 외 지역 리스트.
//   지리적 100% 정확 아님 — 5x5 grid 근사 (방위 감각만).
//   셀 색: accent + fillOpacity (건수/최댓값 비율). 0건은 옅음.
//   호버: 셀 강조 + 하단 라벨.
const SEOUL_GU_GRID = [
  ["강서구","은평구","도봉구","강북구","노원구"],
  ["양천구","서대문구","종로구","성북구","중랑구"],
  ["영등포구","마포구","중구","동대문구","광진구"],
  ["구로구","용산구","성동구","강동구","송파구"],
  ["금천구","관악구","동작구","서초구","강남구"],
];

function SeoulMapPanel({ t, rows }) {
  const seoulCounts = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      if (r.key && r.key.startsWith("서울 ")) {
        m.set(r.label.replace("서울 ", ""), r.total);
      }
    }
    return m;
  }, [rows]);
  const nonSeoulRows = useMemo(
    () => rows.filter(r => !r.key || !r.key.startsWith("서울 ")),
    [rows]
  );
  const seoulTotal = useMemo(
    () => [...seoulCounts.values()].reduce((s, v) => s + v, 0),
    [seoulCounts]
  );
  const maxCount = useMemo(
    () => Math.max(1, ...seoulCounts.values()),
    [seoulCounts]
  );
  const [hovered, setHovered] = useState(null);

  const CELL = 76, GAP = 4, OUTER = 10;
  const size = OUTER * 2 + CELL * 5 + GAP * 4;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
      gap: 12,
      alignItems: "start",
    }}>
      {/* 서울 25구 지도 */}
      <div style={{
        background: t.bgElevated,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        padding: 10,
      }}>
        <div style={{
          display: "flex", alignItems: "baseline", justifyContent: "space-between",
          marginBottom: 6, padding: "0 4px",
        }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: t.text }}>서울 25구</span>
          <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700 }}>총 {seoulTotal}건</span>
        </div>
        <svg viewBox={`0 0 ${size} ${size}`} style={{ width: "100%", height: "auto", display: "block" }}>
          {SEOUL_GU_GRID.map((row, ri) => row.map((gu, ci) => {
            const count = seoulCounts.get(gu) || 0;
            const alpha = count === 0 ? 0.08 : 0.20 + 0.72 * (count / maxCount);
            const x = OUTER + ci * (CELL + GAP);
            const y = OUTER + ri * (CELL + GAP);
            const isHovered = hovered === gu;
            const textCol = count === 0 ? (t.textMuted || "#94a3b8")
                          : alpha > 0.55 ? "#fff"
                                         : (t.text || "#111");
            return (
              <g key={gu}
                onMouseEnter={() => setHovered(gu)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: count > 0 ? "pointer" : "default" }}>
                <rect
                  x={x} y={y} width={CELL} height={CELL} rx={7}
                  fill={t.accent || "#FF1B8D"}
                  fillOpacity={alpha}
                  stroke={isHovered ? (t.accent || "#FF1B8D") : (t.border || "#e5e7eb")}
                  strokeWidth={isHovered ? 2.5 : 1}
                />
                <text
                  x={x + CELL / 2} y={y + CELL / 2 - 4}
                  textAnchor="middle" fontSize="10" fontWeight="700"
                  fill={textCol}
                  style={{ pointerEvents: "none" }}>
                  {gu.replace(/구$/, "")}
                </text>
                <text
                  x={x + CELL / 2} y={y + CELL / 2 + 16}
                  textAnchor="middle" fontSize="15" fontWeight="800"
                  fill={textCol}
                  style={{ pointerEvents: "none", fontVariantNumeric: "tabular-nums" }}>
                  {count}
                </text>
              </g>
            );
          }))}
        </svg>
        {/* 하단 hover 라벨 */}
        <div style={{
          minHeight: 22, marginTop: 6, padding: "0 4px",
          fontSize: 11, color: t.textSecondary, fontWeight: 700,
        }}>
          {hovered
            ? <span>서울 {hovered} · <span className="mono" style={{ color: t.accent, fontWeight: 800 }}>{seoulCounts.get(hovered) || 0}건</span></span>
            : <span style={{ color: t.textMuted }}>셀 위에 마우스 올리면 상세 표시</span>}
        </div>
      </div>

      {/* 서울 외 지역 리스트 */}
      <div style={{
        background: t.bgElevated,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        padding: 10,
        display: "flex", flexDirection: "column", gap: 4,
        maxHeight: size + 40, overflowY: "auto",
      }}>
        <div style={{
          display: "flex", alignItems: "baseline", justifyContent: "space-between",
          padding: "0 4px", marginBottom: 4,
        }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: t.text }}>서울 외</span>
          <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700 }}>{nonSeoulRows.length}개 지역</span>
        </div>
        {nonSeoulRows.length === 0 ? (
          <div style={{
            padding: "18px 8px", textAlign: "center",
            color: t.textMuted, fontSize: 11, fontWeight: 600,
          }}>서울 외 접수 없음</div>
        ) : nonSeoulRows.map(r => (
          <div key={r.key} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "6px 8px",
            background: r.key === "미상" ? (t.bgInset || "rgba(148,163,184,0.08)") : "transparent",
            borderRadius: 6,
          }}>
            <span style={{
              fontSize: 12, fontWeight: 700,
              color: r.key === "미상" ? t.textMuted : t.text,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{r.label}</span>
            <span className="mono" style={{
              fontSize: 13, fontWeight: 800, color: t.accent,
              fontVariantNumeric: "tabular-nums",
            }}>{r.total}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RegionStatsScreen;
