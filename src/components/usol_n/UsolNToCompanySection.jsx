// 2026-06-01 Phase 5 S3 + accordion — UsolNSettleScreen ① 섹션 (유솔 → 회사 주차별).
// 구조 (정산월 드롭다운):
//   · 정산월 그룹 (최신 위): 2026-06 / 2026-05 / 2026-04
//   · 그룹 헤더 = "{YYYY-MM} ({주 수}주)" + 그 달 입금 총액
//   · 6월·5월 기본 펼침, 4월 접힘 (toggle)
//   · 그룹 안 주차 카드 (최신 입금주 위):
//       메인 = "M/D(요일) 입금" + 총액 (apr+may, 핑크)
//       부기 = "작업 M/D~M/D · 네이버 정산 N건" (라이브 카운트)
//       세부 = 4월분(회색) / 5월분(핑크)
//   · 6월+ 라이브 hook (6/8 입금주부터 신형식 net × 0.85 자동)
//
// 데이터 (4·5·6월 W22 까지):
//   · WEEKLY_DATA_FIXED 시트 기준 고정값. payYm = sunday + 1일 의 월.
//   · 네이버 정산 카운트 = supabase task_items 라이브 조회 (naver_settled_at 의 KST 월요일 → 주 키).
//
// 합 검증:
//   · 2026-06 (W22):        ₩19,267,867
//   · 2026-05 (W18~W21):   ₩61,392,200
//   · 2026-04 (W14~W17):    ₩6,707,936
//   · grand total:         ₩87,368,003
//   · APR + MAY:           ₩35,048,310 + ₩52,319,693 = ₩87,368,003 ✓

import { useMemo, useState } from "react";

const C_PINK_DEEP  = "#D4537E";   // 5월 / 핵심
const C_PINK_LIGHT = "#F8CDD9";
const C_GRAY       = "#9CA3AF";
const C_GRAY_BAR   = "#3A3A3A";   // 4월 / 보조
const C_GREEN      = "#1D9E75";

// ── 시트 기준 고정값 ────────────────────────────────────────
const APR_SETTLED_FIXED = 35_048_310;
const MAY_SETTLED_FIXED = 52_319_693;

// 주차별 표값 (정산주 = naver_settled_at 기준 월~일 KST).
//   monday/sunday  = 정산 기간 (naver_settled_at 이 이 안에 잡힌 task_items).
//   deposit       = sunday + 1일 = 다음 월요일 (= 유솔이 회사에 입금하는 날).
//   payYm         = deposit 의 월 (= 정산월 = 회사 입금월).
//   naverCount    = 그 정산주에 정산된 task_items 건수 (시트 기준 고정값, 라이브 X).
//   weeklyTotal   = 주간 실입금 합계 (현금·현장 포함, apr+may 보다 클 수 있음 — 표 그대로).
//   apr/may       = weeklyTotal 측 네이버 작업월(completed_at) 분포만 분류한 부분 합.
const WEEKLY_DATA_FIXED = [
  { weekKey: "2026-W14", monday: "2026-03-30", sunday: "2026-04-05", deposit: "2026-04-06", payYm: "2026-04", naverCount:   0, weeklyTotal:    408_000, apr:    408_000, may:          0 },
  { weekKey: "2026-W15", monday: "2026-04-06", sunday: "2026-04-12", deposit: "2026-04-13", payYm: "2026-04", naverCount:   3, weeklyTotal:    283_606, apr:    283_605, may:          0 },
  { weekKey: "2026-W16", monday: "2026-04-13", sunday: "2026-04-19", deposit: "2026-04-20", payYm: "2026-04", naverCount:  18, weeklyTotal:  1_136_493, apr:  1_136_492, may:          0 },
  { weekKey: "2026-W17", monday: "2026-04-20", sunday: "2026-04-26", deposit: "2026-04-27", payYm: "2026-04", naverCount:  72, weeklyTotal:  4_879_840, apr:  4_879_839, may:          0 },
  { weekKey: "2026-W18", monday: "2026-04-27", sunday: "2026-05-03", deposit: "2026-05-04", payYm: "2026-05", naverCount: 100, weeklyTotal:  6_514_822, apr:  6_338_919, may:    328_903 },
  { weekKey: "2026-W19", monday: "2026-05-04", sunday: "2026-05-10", deposit: "2026-05-11", payYm: "2026-05", naverCount: 302, weeklyTotal: 19_504_515, apr: 11_531_286, may:  8_186_673 },
  { weekKey: "2026-W20", monday: "2026-05-11", sunday: "2026-05-17", deposit: "2026-05-18", payYm: "2026-05", naverCount: 259, weeklyTotal: 16_958_937, apr:  7_014_562, may:  9_651_152 },
  { weekKey: "2026-W21", monday: "2026-05-18", sunday: "2026-05-24", deposit: "2026-05-25", payYm: "2026-05", naverCount: 284, weeklyTotal: 18_790_320, apr:  3_194_453, may: 15_146_252 },
  { weekKey: "2026-W22", monday: "2026-05-25", sunday: "2026-05-31", deposit: "2026-06-01", payYm: "2026-06", naverCount: 281, weeklyTotal: 19_267_868, apr:    261_154, may: 19_006_713 },
];

// ── 헬퍼 ────────────────────────────────────────────────────
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
function dowKor(ymd) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  return DOW[new Date(y, m - 1, d).getDay()];
}
function mdLabel(ymd) {
  if (!ymd) return "";
  const [, mm, dd] = ymd.split("-");
  return `${Number(mm)}/${Number(dd)}`;
}
function depositLabel(ymd) {
  if (!ymd) return "";
  return `${mdLabel(ymd)}(${dowKor(ymd)}) 입금`;
}

// 정산월 그룹 (payYm) 으로 그룹핑, 최신순 정렬, 주차도 최신순 (deposit 내림차순).
//   total = Σ weeklyTotal (주간 실입금 합계, 현금·현장 포함).
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

// ── 6월+ 라이브 hook (placeholder) ───────────────────────────
// 6/8 입금주 (W23 deposit) 부터 신형식 net_amount × 0.85 자동 합산.
// 활성 시 fetchNaverSettledItemsInRange + group by week 측 settlement_expected 활용 (백필 후).
function getJuneLiveWeeks() {
  // TODO: 활성:
  //   fetchUsolNTaskItemsByNaverSettleRange(juneStart, juneEnd)
  //   .filter(neat 신형식 only)
  //   .group by week + payYm
  //   .sum settlement_expected * 0.85
  return [];
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
export function UsolNToCompanySection() {
  // 드롭다운 열림 상태 — 현재 캘린더 월만 기본 펼침. 헤더 클릭 시 토글.
  const [openGroups, setOpenGroups] = useState(() => {
    const d = new Date();
    const cur = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { [cur]: true };
  });

  const groups = useMemo(() => groupWeeksByPayYm(WEEKLY_DATA_FIXED), []);
  const junLiveWeeks = useMemo(() => getJuneLiveWeeks(), []);

  function toggleGroup(payYm) {
    setOpenGroups(o => ({ ...o, [payYm]: !o[payYm] }));
  }

  return (
    <div>
      {groups.map(g => (
        <GroupAccordion
          key={g.payYm}
          group={g}
          isOpen={!!openGroups[g.payYm]}
          onToggle={() => toggleGroup(g.payYm)}
        />
      ))}

      {/* 6월+ 라이브 hook (6/8 입금주부터 신형식 net 자동) */}
      <JuneAutoHookCard liveWeeks={junLiveWeeks}/>
    </div>
  );
}

// ── 그룹 아코디언 (월별) ─────────────────────────────────────
function GroupAccordion({ group, isOpen, onToggle }) {
  const [y, m] = group.payYm.split("-").map(Number);
  const monthLabel = `${y}년 ${m}월`;

  return (
    <div style={{
      marginBottom: 8,
      background: "var(--bg-elevated, #1F1F1F)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      overflow: "hidden",
    }}>
      {/* 헤더 (클릭 토글) */}
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

      {/* 펼침 — 주차 카드 */}
      {isOpen && (
        <div style={{
          padding: "0 10px 10px",
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          {group.weeks.map(w => (
            <WeeklyDepositCard key={w.weekKey} week={w}/>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 주차 입금 카드 ──────────────────────────────────────────
//   메인  = "M/D(요일) 입금" + weeklyTotal (주간 실입금 합계, 현금·현장 포함)
//   부기  = "M/D~M/D 정산 · 네이버 N건" (시트 기준 고정값)
//   세부  = 4월분 (회색) / 5월분 (핑크) — weeklyTotal 측 네이버 작업월 분포
function WeeklyDepositCard({ week }) {
  const total = week.weeklyTotal || 0;
  const period = `${mdLabel(week.monday)}~${mdLabel(week.sunday)}`;
  const naverCount = week.naverCount || 0;

  return (
    <div style={{
      padding: "11px 14px",
      background: "var(--bg-secondary, #1A1A1A)",
      border: "1px solid var(--border)",
      borderRadius: 10,
    }}>
      {/* 메인 — 입금일 + 주간 실입금 합계 */}
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

      {/* 부기 — 정산 기간 + 네이버 정산 건수 (표값) */}
      <div style={{
        marginTop: 4, fontSize: 10, color: C_GRAY,
      }}>
        {period} 정산 · 네이버 정산 {naverCount}건
      </div>

      {/* 세부 — 4월분 (회색) / 5월분 (핑크) */}
      <div style={{
        marginTop: 8, paddingTop: 8,
        borderTop: "1px dashed var(--border)",
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
        fontSize: 11,
      }}>
        <SplitItem dotColor={C_GRAY_BAR}  label="4월분" amount={week.apr} muted/>
        <SplitItem dotColor={C_PINK_DEEP} label="5월분" amount={week.may} highlight/>
      </div>
    </div>
  );
}

function SplitItem({ dotColor, label, amount, muted, highlight }) {
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
        color: highlight ? C_PINK_DEEP : (muted ? C_GRAY : "var(--text-primary)"),
        fontSize: 11,
      }}>
        ₩{(amount || 0).toLocaleString()}
      </span>
    </span>
  );
}

// ── 6월+ 라이브 hook 카드 (placeholder) ────────────────────
function JuneAutoHookCard({ liveWeeks }) {
  if (liveWeeks && liveWeeks.length > 0) {
    // 활성 — 라이브 주차 표시 (W23 onwards). 향후 구현.
    return (
      <div style={{
        marginTop: 10, padding: "12px 14px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 12,
      }}>
        <div style={{ fontSize: 11, color: C_GRAY, fontWeight: 700, marginBottom: 6 }}>
          2026-06 라이브 (6/8 입금주~)
        </div>
        {/* TODO: live week card render */}
      </div>
    );
  }
  return (
    <div style={{
      marginTop: 10, padding: "12px 14px",
      background: "rgba(255,255,255,0.02)",
      border: "1px dashed var(--border)",
      borderRadius: 12,
    }}>
      <div style={{ fontSize: 10, color: C_GRAY, lineHeight: 1.5 }}>
        ⓘ 6월+ 라이브 hook — 6/8 입금주 (W23+) 부터 신형식 net × 0.85 자동 합산 활성 예정.
        <br/>
        <span style={{ opacity: 0.75 }}>
          현재는 W22 (6/1 입금) 까지 시트 기준. settlement_expected 백필 후 라이브 활성.
        </span>
      </div>
    </div>
  );
}

export default UsolNToCompanySection;
