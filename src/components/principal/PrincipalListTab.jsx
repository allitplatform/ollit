// 유솔홈케어 통합 포털 — "작업 현황" 탭
// 2026-05-23 — 1라운드: ListTab 측 측 측 (PrincipalApp.jsx 측 컴포넌트만 swap)
//
// 사장님 spec:
//   · 단일 행 컴팩트 리스트 (하루 100건+ 대응)
//   · 한 행 = 서비스 아이콘 + 고객명 + 채널 배지 + 기종×수량·지역·시간 + 기사 + 상태
//   · 상단: 전체 / 진행중 / 완료 카운트
//   · 필터 chip: 전체 / 미배정 / 확정 / 완료
//   · 검색: 고객명 / 주소 / 작업번호
//   · 다크 + 마젠타 (--accent 측 — AdminApp 측 측 측 catch)
//   · 채널 배지: usol_n 측 측 N 배지 (#2E9E54) / usol_h 측 측 X
//   · 서비스 아이콘: 본작업(세척) ❄️ 파랑(#378ADD) / 추가선택(냉매 측) ⚡ 앰버(#EF9F27)

import { useState, useMemo } from "react";
import { Search } from "lucide-react";

const N_BADGE_COLOR    = "#2E9E54";
const CLEAN_COLOR      = "#378ADD";
const REFRIGERANT_COLOR = "#EF9F27";
const DATE_TIME_COLOR  = "#F2B84B";   // 측 측 측 측 (앰버)

// task → 측 측 본작업 측 (workItems 측 측 측 측 측 catch)
//   사장님 spec — "세척류 항목(벽걸이/스탠드/1way/4way 등)이 하나라도 있으면 → 측 측"
//   판정: orderType='본작업' 측 측 측 측 측 측 측 (③ 단계 측 측 측 99.9% 정확)
//   fallback: 측 측 측 측 측 측 X 측 → appliance 측 측 측 키워드 catch
const MAIN_APPLIANCE_KEYWORDS = ["벽걸이", "스탠드", "1way", "2way", "4way", "투인원", "원형", "시스템멀티"];

function getMainItem(task) {
  const items = Array.isArray(task.workItems) ? task.workItems : [];
  // 1순위 — order_type='본작업' 측 측
  let main = items.find(it => (it.orderType || it.order_type) === "본작업");
  if (main) return main;
  // 2순위 — appliance 측 측 측 키워드 catch (order_type 측 측 X 측 측)
  main = items.find(it => {
    const a = String(it.appliance || "").trim();
    return MAIN_APPLIANCE_KEYWORDS.some(kw => a.includes(kw));
  });
  return main || null;
}

// task → 서비스 측 (main / addon)
function getServiceKind(task) {
  return getMainItem(task) ? "main" : "addon";
}

// task → status 배지 색상
function getStatusBadge(status) {
  switch (status) {
    case "완료":      return { color: "#1D9E75", bg: "rgba(29,158,117,0.12)" };
    case "확정":      return { color: "#03C75A", bg: "rgba(3,199,90,0.12)" };
    case "진행중":    return { color: "#F59E0B", bg: "rgba(245,158,11,0.12)" };
    case "배정":      return { color: "#3B82F6", bg: "rgba(59,130,246,0.12)" };
    case "미배정":    return { color: "#9CA3AF", bg: "rgba(156,163,175,0.14)" };
    case "취소":      return { color: "#EF4444", bg: "rgba(239,68,68,0.10)" };
    case "visit_only": return { color: "#A855F7", bg: "rgba(168,85,247,0.12)" };
    default:          return { color: "#9CA3AF", bg: "rgba(156,163,175,0.14)" };
  }
}

function getStatusLabel(status) {
  if (status === "visit_only") return "출장비만";
  return status || "—";
}

// 시간 측 — "HH:MM" 측 측 (scheduledTime 또는 ISO 측 측)
function formatTime(task) {
  if (task.scheduledTime) return String(task.scheduledTime).slice(0, 5);
  if (task.scheduledAt) {
    const d = new Date(task.scheduledAt);
    if (!isNaN(d.getTime())) {
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${hh}:${mm}`;
    }
  }
  return "—";
}

// 날짜 — 5/23 측 측
function formatDate(task) {
  const ymd = task.scheduledDate || task.requestedDate || "";
  const m = String(ymd).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${parseInt(m[2])}/${parseInt(m[3])}`;
}

// 채널 배지 (usol_n 측만 표시)
function ChannelBadge({ task }) {
  if (task.principalCode !== "usol_n") return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 16, height: 16, borderRadius: 4,
      background: N_BADGE_COLOR, color: "#fff",
      fontSize: 9, fontWeight: 800, lineHeight: 1,
      flexShrink: 0,
    }}>N</span>
  );
}

// 서비스 아이콘
function ServiceIcon({ kind }) {
  if (kind === "addon") {
    return <span style={{ fontSize: 14, color: REFRIGERANT_COLOR }}>⚡</span>;
  }
  return <span style={{ fontSize: 14, color: CLEAN_COLOR }}>❄️</span>;
}

export function PrincipalListTab({ t, tasks, onSelect }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  // 카운트
  const counts = useMemo(() => ({
    total:      tasks.length,
    inProgress: tasks.filter(x => ["미배정", "배정", "확정", "진행중"].includes(x.status)).length,
    completed:  tasks.filter(x => x.status === "완료" || x.status === "visit_only").length,
  }), [tasks]);

  // 필터 + 정렬 (received_at desc — 최신 측)
  //   loadTasksForRole 측 측 received_at desc measurement, 측 — useMemo 측 측 측 측 측 측 측
  //   안전망: 측 측 측 측 측 received_at desc 측 측
  const filtered = useMemo(() => {
    let list = tasks;
    if (filter === "미배정") list = list.filter(x => x.status === "미배정");
    else if (filter === "확정")   list = list.filter(x => ["배정", "확정"].includes(x.status));
    else if (filter === "완료")   list = list.filter(x => x.status === "완료" || x.status === "visit_only");
    // "all" 측 측 — 측 task

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(x => {
        const cust = String(x.customer || "").toLowerCase();
        const addr = String(x.address || "").toLowerCase();
        const tno  = String(x.taskNo || x.taskCode || "").toLowerCase();
        return cust.includes(q) || addr.includes(q) || tno.includes(q);
      });
    }
    // 정렬 안전망 — received_at desc (NULL 측 측 측)
    return [...list].sort((a, b) => {
      const ra = a.received_at || a.receivedAt || a.created_at || a.createdAt || "";
      const rb = b.received_at || b.receivedAt || b.created_at || b.createdAt || "";
      return String(rb).localeCompare(String(ra));
    });
  }, [tasks, filter, search]);

  return (
    <div className="fade-in" style={{ padding: "16px 14px 80px" }}>
      {/* 측 카운트 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <CountCard label="전체"   value={counts.total}      accent />
        <CountCard label="진행중" value={counts.inProgress} />
        <CountCard label="완료"   value={counts.completed} />
      </div>

      {/* 검색 */}
      <div style={{ position: "relative", marginBottom: 10 }}>
        <Search size={14} style={{
          position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
          color: "var(--text-tertiary, #9CA3AF)", pointerEvents: "none",
        }}/>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="고객명 / 주소 / 작업번호"
          style={{
            width: "100%", padding: "10px 12px 10px 32px",
            background: "var(--bg-secondary, #1A1A1A)",
            border: "1px solid var(--border, #2A2A2A)",
            borderRadius: 10,
            color: "var(--text-primary, #FAF8F5)",
            fontSize: 12, fontWeight: 600,
            fontFamily: "inherit", outline: "none",
          }}
        />
      </div>

      {/* 필터 chip */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { id: "all",    label: "전체" },
          { id: "미배정", label: "미배정" },
          { id: "확정",   label: "확정" },
          { id: "완료",   label: "완료" },
        ].map(opt => {
          const active = filter === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setFilter(opt.id)}
              style={{
                padding: "6px 12px",
                background: active ? "var(--accent-gradient, #FF1B8D)" : "var(--bg-secondary, #1A1A1A)",
                color: active ? "#fff" : "var(--text-secondary, #B5B0A8)",
                border: `1px solid ${active ? "var(--accent-gradient, #FF1B8D)" : "var(--border, #2A2A2A)"}`,
                borderRadius: 100,
                fontSize: 11, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >{opt.label}</button>
          );
        })}
      </div>

      {/* 측 — 측 측 측 측 측 catch (AdminApp TaskCard 측 측: gap 6 / 개별 카드) */}
      {filtered.length === 0 ? (
        <div style={{
          padding: "40px 20px", textAlign: "center",
          color: "var(--text-tertiary, #9CA3AF)", fontSize: 12,
          background: "var(--bg-secondary, #1A1A1A)",
          border: "1px solid var(--border, #2A2A2A)",
          borderRadius: 8,
        }}>작업이 없습니다</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map((task, idx) => (
            <TaskRow
              key={task.id || task.taskNo || idx}
              task={task}
              onClick={() => onSelect?.(task)}
            />
          ))}
        </div>
      )}

      {/* 측 측 측 */}
      <div style={{
        marginTop: 10, fontSize: 10, color: "var(--text-tertiary, #9CA3AF)",
        textAlign: "center",
      }}>
        {filtered.length}건 / 전체 {tasks.length}건
      </div>
    </div>
  );
}

function CountCard({ label, value, accent }) {
  return (
    <div style={{
      flex: 1, padding: "10px 8px",
      background: accent ? "var(--accent-bg, rgba(255,27,141,0.08))" : "var(--bg-secondary, #1A1A1A)",
      border: `1px solid ${accent ? "var(--accent-border, rgba(255,27,141,0.40))" : "var(--border, #2A2A2A)"}`,
      borderRadius: 10, textAlign: "center",
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, marginBottom: 3,
        color: accent ? "var(--accent-gradient, #FF1B8D)" : "var(--text-tertiary, #9CA3AF)",
        letterSpacing: 0.5,
      }}>{label}</div>
      <div className="mono" style={{
        fontSize: 18, fontWeight: 800, fontFamily: "inherit",
        color: "var(--text-primary, #FAF8F5)",
      }}>{value.toLocaleString()}</div>
    </div>
  );
}

function TaskRow({ task, onClick }) {
  const kind = getServiceKind(task);
  const status = getStatusBadge(task.status);
  const time = formatTime(task);
  const date = formatDate(task);
  const items = Array.isArray(task.workItems) ? task.workItems : [];

  // 측 — 본작업 측 측 측 측 측 catch (사장님 spec)
  //   세척 본작업 측 measurement → 측 측 측 측 ⚡ measurement 측 → 측 측 측 / 측 측 측
  const mainItem = getMainItem(task);
  const displayItem = mainItem || items[0] || {};
  const appliance = displayItem.appliance || task.appliance || "";
  const qty = displayItem.qty || task.qty || 1;
  // 측 측 — 본작업 측 측 측 측 측 측 측 측 추가선택 측 (송풍팬 측), 측 측 측 측 측 +N 측 측
  const otherCount = mainItem ? Math.max(0, items.length - 1) : Math.max(0, items.length - 1);

  // 기종 측 (앰버 측 측 측 측 측 측 측)
  const applianceText = `(${appliance || "—"}${qty > 1 ? `×${qty}` : ""}${otherCount > 0 ? ` +${otherCount}` : ""})`;
  const timeStr = [date, time !== "—" ? time : ""].filter(Boolean).join(" ");

  return (
    <div
      onClick={onClick}
      style={{
        // AdminApp TaskCard 측 측 catch: bgElevated + radius 8 + padding 8x10 + minHeight 38
        background: "var(--bg-elevated, #1F1F1F)",
        border: "1px solid var(--border, #2A2A2A)",
        borderRadius: 8,
        padding: "8px 10px",
        display: "flex", alignItems: "center", gap: 8,
        minHeight: 38,
        cursor: "pointer",
      }}
    >
      {/* 1. 서비스 아이콘 */}
      <div style={{ flexShrink: 0, width: 14, textAlign: "center" }}>
        <ServiceIcon kind={kind}/>
      </div>

      {/* 2. 고객명 — AdminApp 측 측: 12 / 500 / maxWidth 90 */}
      <span style={{
        flexShrink: 0,
        fontSize: 12, fontWeight: 500,
        color: "var(--text-primary, #FAF8F5)",
        maxWidth: 90,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{task.customer || "—"}</span>

      {/* 3. N 배지 (usol_n 측만) */}
      <ChannelBadge task={task}/>

      {/* 4. 정보 텍스트 — flex:1, ellipsis (11 / 400 / #888) — 측 측 측 측 #F2B84B */}
      <span style={{
        flex: 1, minWidth: 0,
        fontSize: 11, fontWeight: 400,
        color: "#888",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {applianceText}
        {task.region ? ` · ${task.region}` : ""}
        {timeStr && (
          <>
            {" · "}
            <span style={{ color: DATE_TIME_COLOR, fontWeight: 600 }}>{timeStr}</span>
          </>
        )}
      </span>

      {/* 5. 기사명 칩 — AdminApp 측 측: 11 / 500 / #ddd / #2a2a2a / radius 4 */}
      {task.assignedEngineer && (
        <span style={{
          flexShrink: 0,
          fontSize: 11, fontWeight: 500,
          color: "#ddd",
          background: "#2a2a2a",
          padding: "2px 8px", borderRadius: 4,
          whiteSpace: "nowrap",
        }}>{task.assignedEngineer}</span>
      )}

      {/* 6. 상태 배지 — AdminApp 측 측: 10 / 700 / padding 2x7 / radius 8 */}
      <span style={{
        flexShrink: 0,
        fontSize: 10, fontWeight: 700,
        color: status.color, background: status.bg,
        padding: "2px 7px", borderRadius: 8,
        whiteSpace: "nowrap",
      }}>{getStatusLabel(task.status)}</span>
    </div>
  );
}

export default PrincipalListTab;
