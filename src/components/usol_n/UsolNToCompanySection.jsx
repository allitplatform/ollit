// 2026-06-01 Phase 5 S3 + accordion — UsolNSettleScreen ① 섹션 (유솔 → 회사 주차별).
// 2026-06-02 — 동적 월 분류 + deposit 기준 입금 완료/예정 시각 (공유 모듈 활용).
//
// 사장님 spec:
//   · 월별(payYm) 아코디언 — 입금 예정 있는 달만 기본 펼침.
//   · 그룹 헤더: 전부 완료면 초록, 예정 섞이면 핑크.
//   · 카드 시각: deposit ≤ 오늘 KST → "M/D 입금 완료" + 초록 + 체크.
//                 deposit > 오늘 KST → "M/D(요일) 입금 예정" + 2px 핑크 테두리 + 핑크.
//   · 동적 월 칸: 작업월(completed_at KST, NULL → task_no fallback) 분류, 0 인 달 숨김.
//   · 라이브 (W23~): fetchJuneLiveWeeks (cancel 필터 + monthlyAmounts).
//   · 시트 (W14~W22): WEEKLY_DATA_FIXED (monthlyAmounts 측 apr/may 미리 채움).
//
// 통일: 유솔 원청 PWA (PrincipalSettleTab) 와 동일 spec.
import { useMemo, useState, useEffect } from "react";
import { Check, X } from "lucide-react";
import {
  NAVER_NET_TO_COMPANY_FACTOR,
  WEEKLY_DATA_FIXED,
  fetchJuneLiveWeeks,
  fetchWeekItemsByMonday,
  getMonthlyEntriesOf,
  ymLabel,
  getKstToday,
  isDepositPast,
  depositStatusLabel,
  mdLabel,
  kstYmd,
  C_PINK_DEPOSIT,
  C_GREEN_DONE,
  C_GRAY_MUTED,
  C_GRAY_BAR,
} from "../../lib/usolNWeeklyData.js";

const C_PINK_DEEP = C_PINK_DEPOSIT;
const C_GREEN     = C_GREEN_DONE;
const C_GRAY      = C_GRAY_MUTED;

// 정산월 그룹 (payYm) 으로 그룹핑, 최신순 정렬, 주차도 최신순 (deposit 내림차순).
function groupWeeksByPayYm(weeks) {
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
  const today = getKstToday();

  const [liveWeeks, setLiveWeeks] = useState([]);
  const [liveLoading, setLiveLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLiveLoading(true);
    fetchJuneLiveWeeks()
      .then(ws => { if (alive) { setLiveWeeks(ws); setLiveLoading(false); } })
      .catch(err => {
        console.error("[UsolNToCompany.junLive]", err);
        if (alive) setLiveLoading(false);
      });
    return () => { alive = false; };
  }, []);

  const groups = useMemo(
    () => groupWeeksByPayYm([...WEEKLY_DATA_FIXED, ...liveWeeks]),
    [liveWeeks]
  );

  // 입금 예정 (deposit > today) 있는 payYm 만 기본 펼침.
  const [openGroups, setOpenGroups] = useState({});
  useEffect(() => {
    setOpenGroups(prev => {
      const next = { ...prev };
      for (const g of groups) {
        if (!(g.payYm in next)) {
          next[g.payYm] = g.weeks.some(w => !isDepositPast(w.deposit, today));
        }
      }
      return next;
    });
  }, [groups, today]);

  function toggleGroup(payYm) {
    setOpenGroups(o => ({ ...o, [payYm]: !o[payYm] }));
  }

  // 2026-06-02 — 주차 카드 클릭 → 드릴인 모달 (사장님 spec 재추가).
  //   bd44e3c 통일 리팩토링 측 누락 → 재구현.
  //   DB 조회 (fetchWeekItemsByMonday) — 시트 주차도 동작. 5월 초 측 DB 측 측 측 측 측 측 별개 spec.
  const [selectedWeek, setSelectedWeek] = useState(null);

  return (
    <div>
      {groups.map(g => (
        <GroupAccordion
          key={g.payYm}
          group={g}
          today={today}
          isOpen={!!openGroups[g.payYm]}
          onToggle={() => toggleGroup(g.payYm)}
          onWeekClick={(w) => setSelectedWeek(w)}
        />
      ))}
      {liveLoading && (
        <div style={{
          padding: "10px 12px", marginTop: 8,
          background: "rgba(255,255,255,0.02)",
          border: "1px dashed var(--border)",
          borderRadius: 10,
          fontSize: 10, color: C_GRAY, textAlign: "center",
        }}>
          6/8+ 라이브 정산 데이터 불러오는 중...
        </div>
      )}
      {selectedWeek && (
        <WeekDetailModal
          week={selectedWeek}
          today={today}
          onClose={() => setSelectedWeek(null)}
        />
      )}
    </div>
  );
}

// ── 그룹 아코디언 (월별) ─────────────────────────────────────
function GroupAccordion({ group, today, isOpen, onToggle, onWeekClick }) {
  const [y, m] = group.payYm.split("-").map(Number);
  const monthLabel = `${y}년 ${m}월`;
  const allDone = group.weeks.every(w => isDepositPast(w.deposit, today));
  const headerColor = allDone ? C_GREEN_DONE : C_PINK_DEPOSIT;

  return (
    <div style={{
      marginBottom: 8,
      background: "var(--bg-elevated, #1F1F1F)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      overflow: "hidden",
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{
            fontSize: 11, color: C_GRAY, fontWeight: 700, width: 12, display: "inline-block",
            transition: "transform 0.15s",
            transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
          }}>▶</span>
          <span style={{ fontSize: 14, fontWeight: 800 }}>{monthLabel}</span>
          <span style={{ fontSize: 11, color: C_GRAY }}>{group.count}주</span>
          {allDone && (
            <Check size={13} strokeWidth={3} style={{ color: C_GREEN_DONE }}/>
          )}
        </div>
        <span style={{
          fontSize: 16, fontFamily: "inherit", fontWeight: 800,
          color: headerColor, lineHeight: 1,
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
            <WeeklyDepositCard
              key={w.weekKey}
              week={w}
              today={today}
              onClick={onWeekClick ? () => onWeekClick(w) : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── 주차 입금 카드 ──────────────────────────────────────────
//   메인 = "M/D 입금 완료" (초록 + 체크) or "M/D(요일) 입금 예정" (핑크 + 2px 테두리)
//   부기 = 정산 기간 + 네이버 정산 N건
//   세부 = 동적 월 칸 (양수 달만, 최신=핑크/이전=회색)
function WeeklyDepositCard({ week, today, onClick }) {
  const total = week.weeklyTotal || 0;
  const period = `${mdLabel(week.monday)}~${mdLabel(week.sunday)}`;
  const naverCount = week.naverCount || 0;
  const isPast = isDepositPast(week.deposit, today);
  const statusText = depositStatusLabel(week.deposit, today);
  const amountColor = isPast ? C_GREEN_DONE : C_PINK_DEPOSIT;
  const monthlyEntries = getMonthlyEntriesOf(week);

  return (
    <div onClick={onClick || undefined} style={{
      padding: "11px 14px",
      background: "var(--bg-secondary, #1A1A1A)",
      border: isPast ? "1px solid var(--border)" : `2px solid ${C_PINK_DEPOSIT}`,
      borderRadius: 10,
      cursor: onClick ? "pointer" : "default",
    }}>
      {/* 메인 — 시각(좌) + 금액(우) */}
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        gap: 8,
      }}>
        <span style={{
          fontSize: 13, fontWeight: 700, color: "var(--text-primary, #FAF8F5)",
          display: "inline-flex", alignItems: "center", gap: 4,
        }}>
          {isPast && <Check size={12} strokeWidth={3} style={{ color: C_GREEN_DONE }}/>}
          {statusText}
        </span>
        <span style={{
          fontSize: 16, fontFamily: "inherit", fontWeight: 800,
          color: amountColor, lineHeight: 1,
        }}>
          ₩{total.toLocaleString()}
        </span>
      </div>

      {/* 부기 — 정산 기간 + 네이버 정산 건수 */}
      <div style={{ marginTop: 4, fontSize: 10, color: C_GRAY }}>
        {period} 정산 · 네이버 정산 {naverCount}건
      </div>

      {/* 동적 월 칸 (양수만) */}
      {monthlyEntries.length > 0 && (
        <div style={{
          marginTop: 8, paddingTop: 8,
          borderTop: "1px dashed var(--border)",
          display: "grid",
          gridTemplateColumns: `repeat(${monthlyEntries.length}, 1fr)`,
          gap: 8, fontSize: 11,
        }}>
          {monthlyEntries.map(({ ym, amount }, idx) => {
            const isLatest = idx === monthlyEntries.length - 1;
            return (
              <SplitItem
                key={ym}
                dotColor={isLatest ? C_PINK_DEPOSIT : C_GRAY_BAR}
                label={ymLabel(ym)}
                amount={amount}
                highlight={isLatest}
                muted={!isLatest}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function SplitItem({ dotColor, label, amount, muted, highlight }) {
  return (
    <span style={{
      display: "flex", alignItems: "baseline", gap: 5,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: 1,
        background: dotColor, display: "inline-block", flexShrink: 0,
      }}/>
      <span style={{ color: C_GRAY, fontSize: 10 }}>{label}</span>
      <span style={{
        fontFamily: "inherit", fontWeight: 700,
        color: highlight ? C_PINK_DEPOSIT : (muted ? C_GRAY : "var(--text-primary)"),
        fontSize: 11,
      }}>
        ₩{(amount || 0).toLocaleString()}
      </span>
    </span>
  );
}

// ── 드릴인 모달 ────────────────────────────────────────────
// 사장님 spec:
//   · 주차 카드 클릭 → 그 주 naver_settled task_items DB 조회 → 모달 리스트 표시.
//   · 시트 주차 (W14~W22) 측도 동작 — 측 측 측 측 catch (DB 측 측 측 측 측 측 측 측 측 catch).
//   · cancel 필터 적용 (118건 기준 / sumNet × 0.85 round 측 카드 메인 일치).
//   · 5월 초 측 DB 측 measure 측 측 measure 측 측 < 헤더 — 별개 spec / 카드 측 시트값 그대로.
//   · ItemRow 날짜 KST 변환 (UTC slice 측 측 측 catch — 5/31→6/1 측 catch).
function WeekDetailModal({ week, today, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fetchWeekItemsByMonday(week.monday)
      .then(res => {
        if (!alive) return;
        if (!res.ok) {
          setError(res.error || "조회 실패");
          setItems([]);
        } else {
          setItems(res.items);
        }
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [week.monday]);

  // sumNet × 0.85 round (운영자 ① weeklyTotal 측 동일 measure).
  const sumNet = items.reduce((s, it) => s + (Number(it.net_amount) || 0), 0);
  const sumSubtotal = Math.round(sumNet * NAVER_NET_TO_COMPANY_FACTOR);

  const isPast = isDepositPast(week.deposit, today);
  const statusText = depositStatusLabel(week.deposit, today);
  const accentColor = isPast ? C_GREEN_DONE : C_PINK_DEPOSIT;

  const cardNaverCount = week.naverCount || 0;
  const cardTotal = week.weeklyTotal || 0;
  const dbCount = items.length;
  const showDriftNote = !loading && cardNaverCount > 0 && dbCount !== cardNaverCount;

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          marginBottom: 12, gap: 10,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 800,
              color: "var(--text-primary, #FAF8F5)",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              {isPast && <Check size={14} strokeWidth={3} style={{ color: C_GREEN_DONE }}/>}
              {mdLabel(week.monday)}~{mdLabel(week.sunday)} 정산 상세
            </div>
            <div style={{ fontSize: 10, color: C_GRAY, marginTop: 3, lineHeight: 1.5 }}>
              {statusText} · 카드 메인 {cardNaverCount}건 / ₩{cardTotal.toLocaleString()}
            </div>
          </div>
          <button onClick={onClose} style={closeButtonStyle} aria-label="닫기">
            <X size={16}/>
          </button>
        </div>

        {/* DB 조회 결과 헤더 */}
        <div style={{
          padding: "10px 12px", marginBottom: 10,
          background: `${accentColor}1A`,
          border: `1px solid ${accentColor}55`,
          borderRadius: 10,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: accentColor }}>
            DB 조회 {loading ? "..." : `${dbCount}건`}
          </span>
          <span style={{ fontSize: 13, fontWeight: 800, color: accentColor, fontFamily: "inherit" }}>
            ₩{sumSubtotal.toLocaleString()}
          </span>
        </div>

        {/* 시트값 ≠ DB 안내 (5월 초 측 catch) */}
        {showDriftNote && (
          <div style={{
            padding: "8px 10px", marginBottom: 10,
            background: "rgba(255,255,255,0.02)",
            border: "1px dashed var(--border)",
            borderRadius: 8,
            fontSize: 10, color: C_GRAY, lineHeight: 1.5,
          }}>
            ⓘ 카드 (시트값) {cardNaverCount}건 vs DB {dbCount}건 — DB 측 측 측 measure 측 measure 측 측 catch.
            카드 메인 측 시트값 그대로 표시.
          </div>
        )}

        {/* 리스트 */}
        {loading ? (
          <div style={emptyMsgStyle}>불러오는 중...</div>
        ) : error ? (
          <div style={{ ...emptyMsgStyle, color: "#EF4444" }}>⚠️ {error}</div>
        ) : items.length === 0 ? (
          <div style={emptyMsgStyle}>해당 주차 측 DB 측 정산 항목 없음</div>
        ) : (
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {items.map(it => <DetailItemRow key={it.id} item={it}/>)}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailItemRow({ item }) {
  // 2026-06-02 — KST 변환 (UTC slice 측 측 측 catch — 5/31→6/1).
  const naverYmd = kstYmd(item.naver_settled_at);
  const naverDate = naverYmd ? naverYmd.slice(5).replace("-", "/") : "";
  const label = item.appliance_types?.name || item.work_types?.name || item.description || item.order_type || "—";
  const qty = item.qty || 1;
  const net = Number(item.net_amount) || 0;
  const companyAmt = Math.round(net * NAVER_NET_TO_COMPANY_FACTOR);
  const orderId = item.product_order_id || "";

  return (
    <div style={{
      padding: "8px 10px", marginBottom: 4,
      background: "var(--bg-secondary, #1A1A1A)",
      border: "1px solid var(--border, #2A2A2A)",
      borderRadius: 6,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          flexShrink: 0,
          fontSize: 12, fontWeight: 600,
          color: "var(--text-primary, #FAF8F5)",
          maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{item.customer_name || "—"}</span>
        <span style={{
          flex: 1, minWidth: 0,
          fontSize: 11, color: C_GRAY,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          ({label}{qty > 1 ? `×${qty}` : ""})
          {naverDate && <> · <span style={{ color: "#BA7517", fontWeight: 600 }}>{naverDate}</span></>}
        </span>
        <span style={{
          flexShrink: 0,
          fontSize: 12, fontWeight: 700,
          color: C_PINK_DEPOSIT, fontFamily: "inherit",
        }}>₩{companyAmt.toLocaleString()}</span>
      </div>
      {orderId && (
        <div className="mono" style={{
          fontSize: 10, color: "#666",
          marginTop: 2, paddingLeft: 0, letterSpacing: 0.2,
        }}>
          {orderId} · {item.task_no}
        </div>
      )}
    </div>
  );
}

const modalOverlayStyle = {
  position: "fixed", inset: 0,
  background: "rgba(0,0,0,0.75)",
  zIndex: 9999,
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: 16,
};
const modalContentStyle = {
  background: "var(--bg-elevated, #1F1F1F)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: 16,
  width: "100%", maxWidth: 480,
  maxHeight: "85vh",
  overflowY: "auto",
};
const closeButtonStyle = {
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 8,
  width: 28, height: 28,
  cursor: "pointer",
  color: "var(--text-secondary)",
  display: "flex", alignItems: "center", justifyContent: "center",
  flexShrink: 0,
  fontFamily: "inherit",
};
const emptyMsgStyle = {
  padding: "20px 12px",
  textAlign: "center",
  color: "#9CA3AF",
  fontSize: 11,
};

export default UsolNToCompanySection;
