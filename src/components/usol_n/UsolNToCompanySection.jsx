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
import { Check } from "lucide-react";
import {
  USOL_N_PID,
  WEEKLY_DATA_FIXED,
  fetchJuneLiveWeeks,
  fetchWeekItemsByMonday,
  getMonthlyEntriesOf,
  ymLabel,
  getKstToday,
  isDepositDone,
  isLiveRemitWeek,
  depositStatusLabel,
  mdLabel,
  C_PINK_DEPOSIT,
  C_GREEN_DONE,
  C_GRAY_MUTED,
  C_GRAY_BAR,
} from "../../lib/usolNWeeklyData.js";
// 2026-06-02 — 공유 드릴인 컴포넌트 + admin remit RPC.
import { WeekSettleDetail, getWeekRemitStatus } from "../principal/WeekSettleDetail.jsx";
import { fetchPrincipalRemitsForAdmin, confirmPrincipalRemit } from "../../lib/principalRemitDb.js";

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
export function UsolNToCompanySection({ onTaskClick = null } = {}) {
  const today = getKstToday();

  const [liveWeeks, setLiveWeeks] = useState([]);
  const [liveLoading, setLiveLoading] = useState(true);
  // 2026-06-09 — 컷오프(6/8) 이상 주차 시각 라벨을 실제 remit 상태로 결정.
  //   usol_n principal 의 principal_weekly_remittances 행 전체를 monday 키로 lookup.
  const [adminRemits, setAdminRemits] = useState([]);

  useEffect(() => {
    let alive = true;
    setLiveLoading(true);
    Promise.all([
      fetchJuneLiveWeeks(),
      fetchPrincipalRemitsForAdmin({ principalCodes: ["usol_n"], monthsBack: 3 }),
    ])
      .then(([ws, remitRes]) => {
        if (!alive) return;
        setLiveWeeks(ws);
        setAdminRemits(remitRes?.ok ? (remitRes.remits || []) : []);
        setLiveLoading(false);
      })
      .catch(err => {
        console.error("[UsolNToCompany.load]", err);
        if (alive) setLiveLoading(false);
      });
    return () => { alive = false; };
  }, []);

  // monday(YMD) → Map<principal_id, remit>
  const remitMapByMonday = useMemo(() => {
    const m = new Map();
    for (const r of adminRemits) {
      if (!r?.week_start) continue;
      if (!m.has(r.week_start)) m.set(r.week_start, new Map());
      m.get(r.week_start).set(r.principal_id, r);
    }
    return m;
  }, [adminRemits]);

  // week → { kind, remits }. 컷오프 이전 또는 데이터 없음 → null (라벨에서 옛 동작 폴백).
  function getRemitStatusFor(week) {
    if (!isLiveRemitWeek(week.deposit)) return null;
    const subMap = remitMapByMonday.get(week.monday);
    if (subMap && subMap.size > 0 && week.items && week.items.length > 0) {
      return getWeekRemitStatus(week.items, subMap);
    }
    // items 없음(시트 주차) 또는 remit map 비어있음 → USOL_N_PID 직접 lookup.
    const remit = subMap?.get(USOL_N_PID);
    if (!remit) return { kind: "expected", remits: [] };
    if (remit.confirmed_at) return { kind: "done", remits: [remit] };
    if (remit.remitted_at)  return { kind: "reported", remits: [remit] };
    return { kind: "expected", remits: [remit] };
  }

  const groups = useMemo(
    () => groupWeeksByPayYm([...WEEKLY_DATA_FIXED, ...liveWeeks]),
    [liveWeeks]
  );

  // 입금 예정/미확인 (= !isDepositDone) 있는 payYm 만 기본 펼침.
  const [openGroups, setOpenGroups] = useState({});
  useEffect(() => {
    setOpenGroups(prev => {
      const next = { ...prev };
      for (const g of groups) {
        if (!(g.payYm in next)) {
          next[g.payYm] = g.weeks.some(w => !isDepositDone(w.deposit, today, getRemitStatusFor(w)));
        }
      }
      return next;
    });
    // getRemitStatusFor 는 remitMapByMonday 에 dep — adminRemits 변경 시 재실행.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, today, remitMapByMonday]);

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
          getRemitStatusFor={getRemitStatusFor}
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
        <UsolNAdminWeekDetail
          week={selectedWeek}
          today={today}
          onBack={() => setSelectedWeek(null)}
          onTaskClick={onTaskClick}
        />
      )}
    </div>
  );
}

// ── 그룹 아코디언 (월별) ─────────────────────────────────────
function GroupAccordion({ group, today, isOpen, onToggle, onWeekClick, getRemitStatusFor }) {
  const [y, m] = group.payYm.split("-").map(Number);
  const monthLabel = `${y}년 ${m}월`;
  // 2026-06-09 — 컷오프(6/8) 이상 주차는 remit confirmed_at 있어야 완료.
  //   < 6/8 주차는 옛 isDepositPast 그대로 (4월·5월 완료 라벨 유지).
  const allDone = group.weeks.every(w => isDepositDone(w.deposit, today, getRemitStatusFor?.(w)));
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
              remitStatus={getRemitStatusFor?.(w)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── 주차 입금 카드 ──────────────────────────────────────────
//   메인 = depositStatusLabel(deposit, today, remitStatus) — 컷오프(6/8) 기반 4-state.
//   금액 = weeklyTotal (= 회사 실수령 = Σ(subtotal − 분배 principal_amount))
//   부제 (회색, 작은 글) = 유솔 정산금 (weeklySubtotal) — 라이브 주차(W23+)만 표시
//   부기 = 정산 기간 + 네이버 정산 N건
//   세부 = 동적 월 칸 (양수 달만, 최신=핑크/이전=회색)
// 2026-06-15 — 사장님 spec: 행 금액 = subtotal − principal_amount (저장값, 고정 ×0.85 금지).
function WeeklyDepositCard({ week, today, onClick, remitStatus = null }) {
  const total = week.weeklyTotal || 0;
  const subtotal = week.weeklySubtotal || 0;  // 유솔 정산금 (부제용, 라이브 주차만)
  const period = `${mdLabel(week.monday)}~${mdLabel(week.sunday)}`;
  const naverCount = week.naverCount || 0;
  const isDone = isDepositDone(week.deposit, today, remitStatus);
  const statusText = depositStatusLabel(week.deposit, today, remitStatus);
  // 2026-06-15 — 메인 금액은 진한 핑크/먹색. 옛 C_PINK_DEPOSIT(#D4537E) → #B8345F (진한 로즈).
  const amountColor = isDone ? C_GREEN_DONE : "#B8345F";
  const monthlyEntries = getMonthlyEntriesOf(week);

  return (
    <div onClick={onClick || undefined} style={{
      padding: "11px 14px",
      background: "var(--bg-secondary, #1A1A1A)",
      border: isDone ? "1px solid var(--border)" : `2px solid ${C_PINK_DEPOSIT}`,
      borderRadius: 10,
      cursor: onClick ? "pointer" : "default",
    }}>
      {/* 메인 — 시각(좌) + 회사 실수령(우) */}
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        gap: 8,
      }}>
        <span style={{
          fontSize: 13, fontWeight: 700, color: "var(--text-primary, #FAF8F5)",
          display: "inline-flex", alignItems: "center", gap: 4,
        }}>
          {isDone && <Check size={12} strokeWidth={3} style={{ color: C_GREEN_DONE }}/>}
          {statusText}
        </span>
        <span style={{
          fontSize: 18, fontWeight: 800,
          color: amountColor, lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.3px",
        }}>
          ₩{total.toLocaleString()}
        </span>
      </div>

      {/* 부제 — 유솔 정산금 (라이브 주차만, 회색 작은 글) */}
      {subtotal > 0 && (
        <div style={{
          display: "flex", justifyContent: "flex-end", marginTop: 2,
          fontSize: 9, color: C_GRAY, fontWeight: 500,
        }}>
          유솔 정산금 ₩{subtotal.toLocaleString()}
        </div>
      )}

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

// ── 드릴인 wrapper (admin mode) ───────────────────────────
// 사장님 spec (2026-06-02):
//   · 주차 카드 클릭 → 그 주 naver_settled KST 기간 DB task_items 조회 → 공유 컴포넌트 (WeekSettleDetail).
//   · 시트 주차 (W14~W22) 측도 동작 — 측 측 측 측 catch (DB 측 측 측 측 측 측 측 측 측 catch — 별개 spec).
//   · cancel 필터 (is_canceled / status='취소' 둘 다 제외) — fetchWeekItemsByMonday 측 measure 측.
//   · 액션: [입금 확인] (confirmPrincipalRemit) / 유솔 보고 대기 = 비활성.
//   · 화면·버튼 spec — 완료 기준 / deposit 표시 측 충돌 spec 측 다음 단계.
function UsolNAdminWeekDetail({ week, today, onBack, onTaskClick }) {
  const [items, setItems] = useState([]);
  const [remits, setRemits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);

  // 검색·필터 state
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    Promise.all([
      fetchWeekItemsByMonday(week.monday),
      fetchPrincipalRemitsForAdmin({ principalCodes: ["usol_n"], monthsBack: 3 }),
    ]).then(([itemsRes, remitsRes]) => {
      if (!alive) return;
      if (!itemsRes.ok) setError(itemsRes.error || "조회 실패");
      else setItems(itemsRes.items);
      if (remitsRes.ok) setRemits(remitsRes.remits || []);
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [week.monday, reloadTick]);

  // 측 주차 remit (week_start === week.monday).
  const weekRemits = useMemo(() => {
    const m = new Map();
    for (const r of remits) {
      if (r.week_start === week.monday) m.set(r.principal_id, r);
    }
    return m;
  }, [remits, week.monday]);

  // remitStatus — items 측 측 측 직접 remit 측 catch.
  const remitStatus = useMemo(() => {
    if (items.length > 0) {
      return getWeekRemitStatus(items, weekRemits);
    }
    const remit = weekRemits.get(USOL_N_PID);
    if (!remit) return { kind: "expected", remits: [] };
    if (remit.confirmed_at) return { kind: "done", remits: [remit] };
    if (remit.remitted_at)  return { kind: "reported", remits: [remit] };
    return { kind: "expected", remits: [remit] };
  }, [items, weekRemits]);

  async function handleConfirm() {
    const remitId = remitStatus.remits[0]?.id;
    if (!remitId) {
      alert("확인 측 remit row 측 없음");
      return;
    }
    const res = await confirmPrincipalRemit({ remitId });
    if (!res.ok) {
      alert("확인 실패: " + (res.error || "알 수 없는 오류"));
      return;
    }
    setReloadTick(v => v + 1);
  }

  // week → WeekSettleDetail spec 측 Date 측 + items 측.
  const wkForView = useMemo(() => {
    const [my, mm, md] = week.monday.split("-").map(Number);
    const [sy, sm, sd] = week.sunday.split("-").map(Number);
    return {
      ...week,
      key: week.weekKey,
      monday: new Date(my, mm - 1, md),
      sunday: new Date(sy, sm - 1, sd),
      mondayStr: week.monday,
      sundayStr: week.sunday,
      items,
    };
  }, [week, items]);

  return (
    <div style={modalOverlayStyle} onClick={onBack}>
      <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
        <WeekSettleDetail
          week={wkForView}
          loading={loading}
          error={error}
          actionMode="admin"
          remitStatus={remitStatus}
          onConfirm={handleConfirm}
          onBack={onBack}
          search={search} setSearch={setSearch}
          stageFilter={stageFilter} setStageFilter={setStageFilter}
          dateFilter={dateFilter} setDateFilter={setDateFilter}
          // 2026-06-02 — 줄 클릭 측 부모 task 상세 navigate (사장님 spec).
          //   PrincipalSettleTab.jsx:429 / UsolNSettleScreen.jsx:84 와 동일 payload.
          //   fetchWeekItemsByMonday 가 task_items.task_id + tasks 평탄화 측 측 measurement.
          onItemClick={onTaskClick ? (it) => onTaskClick({
            id:            it.task_id,
            task_no:       it.task_no,
            customer_name: it.customer_name,
            phone:         it.phone,
            address:       it.address,
            district:      it.district,
            scheduled_at:  it.scheduled_at,
            completed_at:  it.completed_at,
            received_at:   it.received_at,
            status:        it.task_status,
            principal_id:  it.principal_id,
          }) : null}
        />
      </div>
    </div>
  );
}

const modalOverlayStyle = {
  position: "fixed", inset: 0,
  background: "rgba(0,0,0,0.85)",
  zIndex: 9999,
  overflowY: "auto",
};
const modalContentStyle = {
  background: "var(--bg-primary, #0A0A0A)",
  minHeight: "100vh",
  width: "100%",
  // 2026-06-02 — iOS PWA black-translucent 상태바 보호. position:fixed 모달이 Shell 우회 → 자체 처리.
  paddingTop: "env(safe-area-inset-top)",
};

export default UsolNToCompanySection;
