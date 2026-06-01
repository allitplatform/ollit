// 2026-06-02 라이브 전환 — UsolNSettleScreen ① 섹션 (유솔 → 회사 주차별).
// 시트 고정값(WEEKLY_DATA_FIXED) → 우리 작업(usol_n + naver_settled) 라이브 데이터.
//
// 구조:
//   · 정산월 드롭다운 (payYm = 정산완료일 주의 다음 월요일 = 입금일 의 월).
//   · 최신월 기본 펼침. 헤더 클릭 토글.
//   · 주차 카드: 우리 작업 건수 + sum(net × 0.85) = 회사 받을 돈.
//   · 4월분 / 5월분 / 6월분 — 정산주 안 작업의 completed_at KST 월별 split.
//   · 클릭 → 그 주 우리 naver_settled 작업 리스트 모달.
//
// 데이터:
//   · supabase task_items WHERE principal_id=usol_n, naver_settled_at NOT NULL,
//     is_canceled=false, tasks.status != "취소".
//   · KST 월요일 키로 주차 그룹.
//
// 백필 후 (2026-06-01 backfill commit) — net_amount = 진짜 net, naver_settled_at = 진짜 정산일.

import { useMemo, useState, useEffect } from "react";
import { supabase } from "../../lib/supabase.js";

const USOL_N_PID = "22222222-2222-2222-2222-222222222006";

const C_PINK_DEEP  = "#D4537E";
const C_GRAY       = "#9CA3AF";
const C_GRAY_BAR   = "#3A3A3A";
const C_GREEN      = "#1D9E75";
const C_BLUE       = "#6AAAEC";

const NAVER_NET_TO_COMPANY_FACTOR = 0.85;

// ── KST 헬퍼 ─────────────────────────────────────────────
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

function kstYmd(utcIso) {
  if (!utcIso) return null;
  const utc = new Date(utcIso);
  if (isNaN(utc.getTime())) return null;
  const kst = new Date(utc.getTime() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10);
}

function kstYm(utcIso) {
  const ymd = kstYmd(utcIso);
  return ymd ? ymd.slice(0, 7) : null;
}

function mondayOfYmd(ymd) {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay();
  const off = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + off);
  return dt.toISOString().slice(0, 10);
}

function addDaysYmd(ymd, days) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function mdLabel(ymd) {
  if (!ymd) return "";
  const [, mm, dd] = ymd.split("-");
  return `${Number(mm)}/${Number(dd)}`;
}

function dowKor(ymd) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  return DOW[new Date(y, m - 1, d).getDay()];
}

function depositLabel(ymd) {
  if (!ymd) return "";
  return `${mdLabel(ymd)}(${dowKor(ymd)}) 입금`;
}

// ── 라이브 fetch ─────────────────────────────────────────
// usol_n + naver_settled_at NOT NULL + 활성 (취소 제외) 측측 task_items 페이지 fetch.
async function fetchUsolNNaverSettledItems() {
  const PAGE_SIZE = 1000;
  const MAX_PAGES = 30;
  const all = [];
  for (let p = 0; p < MAX_PAGES; p++) {
    const offset = p * PAGE_SIZE;
    const { data, error } = await supabase
      .from("task_items")
      .select(
        `id, task_id, naver_settled_at, net_amount, subtotal, is_canceled,
         product_order_id, order_type,
         tasks!inner ( id, task_no, customer_name, address, district,
                       principal_id, status, completed_at )`
      )
      .eq("tasks.principal_id", USOL_N_PID)
      .not("naver_settled_at", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      console.error("[UsolNToCompany.fetch] page", p, error);
      return [];
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  // 활성 + task.status != '취소'
  return all.filter(it => !it.is_canceled && it.tasks?.status !== "취소");
}

// ── 주차 그룹 (naver_settled_at KST 월요일 키) ─────────────
function groupItemsByWeek(items) {
  const weekMap = new Map();
  for (const it of items) {
    const settledYmd = kstYmd(it.naver_settled_at);
    if (!settledYmd) continue;
    const monday = mondayOfYmd(settledYmd);
    if (!monday) continue;
    if (!weekMap.has(monday)) {
      const sunday = addDaysYmd(monday, 6);
      const deposit = addDaysYmd(sunday, 1);   // 다음 월요일 = 입금일
      const payYm = deposit.slice(0, 7);
      weekMap.set(monday, {
        weekKey: monday,
        monday, sunday, deposit, payYm,
        items: [],
        count: 0,
        sumNet: 0,
        monthSplit: {},   // "YYYY-MM" → sum (net) for completed_at KST 월별
      });
    }
    const wk = weekMap.get(monday);
    wk.items.push(it);
    wk.count += 1;
    const net = Number(it.net_amount) || 0;
    wk.sumNet += net;
    const cm = kstYm(it.tasks?.completed_at);
    if (cm) wk.monthSplit[cm] = (wk.monthSplit[cm] || 0) + net;
  }
  // 주차 → weeklyTotal (회사 받을 돈 × 0.85)
  for (const wk of weekMap.values()) {
    wk.weeklyTotal = Math.round(wk.sumNet * NAVER_NET_TO_COMPANY_FACTOR);
  }
  return [...weekMap.values()].sort((a, b) => b.monday.localeCompare(a.monday));
}

// 정산월(payYm) 그룹 — 최신월 위.
function groupByPayYm(weeks) {
  const map = new Map();
  for (const w of weeks) {
    if (!map.has(w.payYm)) map.set(w.payYm, []);
    map.get(w.payYm).push(w);
  }
  const groups = [...map.entries()].map(([payYm, list]) => ({
    payYm,
    weeks: list.slice().sort((a, b) => b.deposit.localeCompare(a.deposit)),
    total: list.reduce((s, w) => s + (w.weeklyTotal || 0), 0),
    count: list.length,
  }));
  groups.sort((a, b) => b.payYm.localeCompare(a.payYm));
  return groups;
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
export function UsolNToCompanySection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openGroups, setOpenGroups] = useState(() => {
    const d = new Date();
    const cur = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { [cur]: true };
  });
  const [selectedWeek, setSelectedWeek] = useState(null);  // 모달

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fetchUsolNNaverSettledItems().then(arr => {
      if (!alive) return;
      setItems(arr);
      setLoading(false);
    }).catch(err => {
      if (!alive) return;
      console.error("[UsolNToCompany.load]", err);
      setError(err.message || "라이브 fetch 실패");
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const weeks  = useMemo(() => groupItemsByWeek(items), [items]);
  const groups = useMemo(() => groupByPayYm(weeks), [weeks]);

  function toggleGroup(payYm) {
    setOpenGroups(o => ({ ...o, [payYm]: !o[payYm] }));
  }

  if (loading) {
    return <div style={emptyBoxStyle}>불러오는 중...</div>;
  }
  if (error) {
    return <div style={{ ...emptyBoxStyle, color: "#ff4444" }}>⚠️ {error}</div>;
  }
  if (groups.length === 0) {
    return <div style={emptyBoxStyle}>naver_settled 작업 없음</div>;
  }

  return (
    <div>
      {groups.map(g => (
        <GroupAccordion
          key={g.payYm}
          group={g}
          isOpen={!!openGroups[g.payYm]}
          onToggle={() => toggleGroup(g.payYm)}
          onWeekClick={(wk) => setSelectedWeek(wk)}
        />
      ))}

      {selectedWeek && (
        <WeekDetailModal
          week={selectedWeek}
          onClose={() => setSelectedWeek(null)}
        />
      )}
    </div>
  );
}

// ── 그룹 아코디언 ────────────────────────────────────────
function GroupAccordion({ group, isOpen, onToggle, onWeekClick }) {
  const [y, m] = group.payYm.split("-").map(Number);
  const monthLabel = `${y}년 ${m}월`;
  return (
    <div style={{
      marginBottom: 8,
      background: "var(--bg-elevated, #1F1F1F)",
      border: "1px solid var(--border)",
      borderRadius: 12, overflow: "hidden",
    }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%", padding: "12px 14px",
          background: "transparent", border: "none",
          color: "var(--text-primary)",
          cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{
            fontSize: 11, color: C_GRAY, fontWeight: 700, width: 12, display: "inline-block",
            transition: "transform 0.15s",
            transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
          }}>▶</span>
          <span style={{ fontSize: 14, fontWeight: 800 }}>{monthLabel}</span>
          <span style={{ fontSize: 11, color: C_GRAY }}>{group.count}주</span>
        </div>
        <span style={{
          fontSize: 16, fontFamily: "inherit", fontWeight: 800,
          color: C_PINK_DEEP, lineHeight: 1,
        }}>
          ₩{group.total.toLocaleString()}
        </span>
      </button>

      {isOpen && (
        <div style={{
          padding: "0 10px 10px",
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          {group.weeks.map(w => (
            <WeeklyDepositCard key={w.weekKey} week={w} onClick={() => onWeekClick(w)}/>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 주차 입금 카드 ──────────────────────────────────────────
function WeeklyDepositCard({ week, onClick }) {
  const total = week.weeklyTotal || 0;
  const period = `${mdLabel(week.monday)}~${mdLabel(week.sunday)}`;
  const months = Object.keys(week.monthSplit || {}).sort();  // 작업월 분포 (오름차순)

  return (
    <button
      onClick={onClick}
      style={{
        padding: "11px 14px",
        background: "var(--bg-secondary, #1A1A1A)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        cursor: "pointer", textAlign: "left", fontFamily: "inherit",
        color: "var(--text-primary)",
        width: "100%",
      }}
    >
      {/* 메인 — 입금일 + 주간 회사 받을 돈 */}
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        gap: 8,
      }}>
        <span style={{
          fontSize: 13, fontWeight: 700, color: "var(--text-primary, #FAF8F5)",
        }}>
          {depositLabel(week.deposit)}
        </span>
        <span style={{
          fontSize: 16, fontFamily: "inherit", fontWeight: 800,
          color: C_PINK_DEEP, lineHeight: 1,
        }}>
          ₩{total.toLocaleString()}
        </span>
      </div>

      {/* 부기 — 정산 기간 + 우리 작업 건수 */}
      <div style={{
        marginTop: 4, fontSize: 10, color: C_GRAY,
      }}>
        {period} 정산 · 우리 작업 {week.count}건
      </div>

      {/* 세부 — 작업월 분포 (completed_at KST 월별) */}
      {months.length > 0 && (
        <div style={{
          marginTop: 8, paddingTop: 8,
          borderTop: "1px dashed var(--border)",
          display: "grid",
          gridTemplateColumns: `repeat(${Math.min(months.length, 3)}, 1fr)`,
          gap: 8, fontSize: 11,
        }}>
          {months.map(ym => {
            const [, mm] = ym.split("-");
            const amt = Math.round((week.monthSplit[ym] || 0) * NAVER_NET_TO_COMPANY_FACTOR);
            const isPink = ym === months[months.length - 1];  // 최신 월 = 핑크 (대개 정산월에 가까운 작업월)
            return (
              <SplitItem
                key={ym}
                dotColor={isPink ? C_PINK_DEEP : C_GRAY_BAR}
                label={`${Number(mm)}월분`}
                amount={amt}
                highlight={isPink}
              />
            );
          })}
        </div>
      )}
    </button>
  );
}

function SplitItem({ dotColor, label, amount, highlight }) {
  const isZero = !amount || amount <= 0;
  return (
    <span style={{
      display: "flex", alignItems: "baseline", gap: 5,
      opacity: isZero ? 0.5 : 1,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: 1,
        background: dotColor, display: "inline-block", flexShrink: 0,
      }}/>
      <span style={{ color: C_GRAY, fontSize: 10 }}>{label}</span>
      <span style={{
        fontFamily: "inherit", fontWeight: 700,
        color: highlight ? C_PINK_DEEP : "var(--text-primary)",
        fontSize: 11,
      }}>
        ₩{(amount || 0).toLocaleString()}
      </span>
    </span>
  );
}

// ── 주 클릭 모달 — 작업 리스트 ────────────────────────────
function WeekDetailModal({ week, onClose }) {
  const period = `${mdLabel(week.monday)}~${mdLabel(week.sunday)}`;
  const sorted = useMemo(() => {
    return [...week.items].sort((a, b) => {
      const aT = a.naver_settled_at || "";
      const bT = b.naver_settled_at || "";
      return aT.localeCompare(bT);
    });
  }, [week]);

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 700, color: "var(--text-primary, #FAF8F5)",
            }}>
              {depositLabel(week.deposit)}
            </div>
            <div style={{ fontSize: 10, color: C_GRAY, marginTop: 2 }}>
              {period} 정산 · {week.count}건 ·{" "}
              <span style={{ color: C_PINK_DEEP, fontWeight: 700 }}>
                ₩{week.weeklyTotal.toLocaleString()}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={closeButtonStyle}>✕</button>
        </div>

        <div style={{
          maxHeight: 400, overflowY: "auto",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          {sorted.map(it => (
            <ItemRow key={it.id} item={it}/>
          ))}
        </div>
      </div>
    </div>
  );
}

function ItemRow({ item }) {
  const t = item.tasks || {};
  const settledYmd = kstYmd(item.naver_settled_at);
  const companyReceive = Math.round((Number(item.net_amount) || 0) * NAVER_NET_TO_COMPANY_FACTOR);
  return (
    <div style={{
      padding: 10,
      background: "var(--bg-secondary, #1A1A1A)",
      border: "1px solid var(--border)",
      borderRadius: 8,
    }}>
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        gap: 6, marginBottom: 2,
      }}>
        <span style={{
          fontSize: 12, fontWeight: 700,
          color: "var(--text-primary, #FAF8F5)",
        }}>
          {t.customer_name || "—"}
        </span>
        <span style={{
          fontSize: 12, fontFamily: "inherit", fontWeight: 700,
          color: C_PINK_DEEP,
        }}>
          ₩{companyReceive.toLocaleString()}
        </span>
      </div>
      <div style={{ fontSize: 9, color: C_GRAY, lineHeight: 1.4 }}>
        {t.task_no || "—"} · {t.address || "주소 없음"}
        <br/>
        정산 {settledYmd}
      </div>
    </div>
  );
}

// ── 스타일 ──────────────────────────────────────────────
const emptyBoxStyle = {
  padding: 24, textAlign: "center",
  color: C_GRAY, fontSize: 11,
  background: "var(--bg-secondary)",
  border: "1px dashed var(--border)",
  borderRadius: 10,
};

const modalOverlayStyle = {
  position: "fixed", inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 200, padding: 16,
};

const modalContentStyle = {
  width: "100%", maxWidth: 480,
  maxHeight: "90vh", overflowY: "auto",
  background: "var(--bg-elevated, #1F1F1F)",
  border: "1px solid var(--border)",
  borderRadius: 14, padding: 16,
  fontFamily: "inherit",
};

const modalHeaderStyle = {
  display: "flex", alignItems: "flex-start", justifyContent: "space-between",
  marginBottom: 14, gap: 8,
};

const closeButtonStyle = {
  background: "transparent", border: "none",
  color: C_GRAY, fontSize: 16,
  cursor: "pointer", padding: 4,
  fontFamily: "inherit", flexShrink: 0,
};

export default UsolNToCompanySection;
