// 2026-06-01 Phase 5 S3 — UsolNSettleScreen ① 섹션 (유솔 → 회사 주차별).
// 시안: usoln_yusol_to_company_apr_may_split.
//
// 구조:
//   상단 요약: 총 받은 돈 (APR + MAY) + 4월/5월 가로 스택바.
//   주차별 카드: 9 주차 (2026-W14 ~ 2026-W22). 각 주 = 합계 + 4월(회색) / 5월(분홍) split.
//   6월+ 자동 hook: 정산예정금액 (settlement_expected) 백필 후 활성. 현재는 placeholder.
//
// 데이터 출처:
//   · 4월/5월 = 시트 기준 고정값 (S2 진단 결과 — legacy task_item.net_amount = gross 오염).
//     주차별 표값 = 사장님 시트 기준 9 주차 (TODO: 표 paste 후 WEEKLY_DATA_FIXED 채움).
//   · 6월+ = settlement_expected × 0.85 자동 합산 (백필 보류 — hook 만).
//
// 색 (시안):
//   · 5월 / 핵심금액 = 진분홍 #D4537E
//   · 4월 / 보조       = 회색 계열
//
// 변경 X:
//   기사 PWA / 운영자 ② 섹션 (UsolNToEngineerSection) / 정산 대기 한 줄 / 라우팅.
//   옛 fetchUsolNCompletedTaskItems + confirmPrincipalRemit 흐름은 6월 hook 활성 시 복귀.

import { useMemo } from "react";

const C_PINK_DEEP  = "#D4537E";   // 5월 / 핵심
const C_PINK_LIGHT = "#F8CDD9";
const C_GRAY       = "#9CA3AF";
const C_GRAY_BAR   = "#3A3A3A";   // 4월 / 보조
const C_GREEN      = "#1D9E75";

// ── 시트 기준 고정값 ────────────────────────────────────────
const APR_SETTLED_FIXED = 35_048_310;
const MAY_SETTLED_FIXED = 52_319_693;

// 주차별 표값 (월~일 KST, apr/may 작업월 split — 사장님 시트 2026-06-01 paste).
//   monday/sunday 는 ISO 날짜. apr+may = 그 주 유솔이 회사에 입금한 네이버 작업월 분류분.
//   현금/현장은 별도 (표의 "주간 합계" 보다 카드 total 이 약간 작을 수 있음 — 정상).
//   합 검증: APR sum = 35,048,310 ✓ / MAY sum = 52,319,693 ✓.
const WEEKLY_DATA_FIXED = [
  { weekKey: "2026-W14", monday: "2026-03-30", sunday: "2026-04-05", apr:    408_000, may:          0 },
  { weekKey: "2026-W15", monday: "2026-04-06", sunday: "2026-04-12", apr:    283_605, may:          0 },
  { weekKey: "2026-W16", monday: "2026-04-13", sunday: "2026-04-19", apr:  1_136_492, may:          0 },
  { weekKey: "2026-W17", monday: "2026-04-20", sunday: "2026-04-26", apr:  4_879_839, may:          0 },
  { weekKey: "2026-W18", monday: "2026-04-27", sunday: "2026-05-03", apr:  6_338_919, may:    328_903 },
  { weekKey: "2026-W19", monday: "2026-05-04", sunday: "2026-05-10", apr: 11_531_286, may:  8_186_673 },
  { weekKey: "2026-W20", monday: "2026-05-11", sunday: "2026-05-17", apr:  7_014_562, may:  9_651_152 },
  { weekKey: "2026-W21", monday: "2026-05-18", sunday: "2026-05-24", apr:  3_194_453, may: 15_146_252 },
  { weekKey: "2026-W22", monday: "2026-05-25", sunday: "2026-05-31", apr:    261_154, may: 19_006_713 },
];

// ── 6월+ 자동 hook (placeholder) ─────────────────────────────
// settlement_expected 컬럼 백필 후 활성.
// 호출 시 빈 배열 반환 — UI 측 "백필 후 활성" 메시지.
function getJuneAutoWeeks() {
  // TODO: settlement_expected 백필 + 컬럼 추가 완료 후 활성:
  //   fetchUsolNTaskItemsByNaverSettleRange(juneStart, juneEnd)
  //   .group by naver_settled_at 주차 (KST)
  //   .sum settlement_expected × 0.85
  return [];
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
export function UsolNToCompanySection() {
  const totalFixed = APR_SETTLED_FIXED + MAY_SETTLED_FIXED;
  const aprPct = totalFixed > 0 ? (APR_SETTLED_FIXED / totalFixed) * 100 : 0;
  const mayPct = totalFixed > 0 ? (MAY_SETTLED_FIXED / totalFixed) * 100 : 0;

  const junWeeks = useMemo(() => getJuneAutoWeeks(), []);

  return (
    <div>
      {/* 상단 요약 — 총 받은 돈 + 4월/5월 스택바 */}
      <TopSummaryCard
        total={totalFixed}
        aprAmount={APR_SETTLED_FIXED}
        mayAmount={MAY_SETTLED_FIXED}
        aprPct={aprPct}
        mayPct={mayPct}
      />

      {/* 주차별 카드 — 9 주차 */}
      <div style={{
        fontSize: 11, fontWeight: 700, color: C_GRAY,
        margin: "16px 0 8px", paddingLeft: 2,
      }}>
        주차별 입금 (4월·5월 작업 정산 — 시트 기준 고정값)
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {WEEKLY_DATA_FIXED.map(w => (
          <WeeklyCard key={w.weekKey} week={w}/>
        ))}
      </div>

      {/* 6월+ 자동 hook (백필 후 활성) */}
      <JuneAutoHookCard junWeeks={junWeeks}/>
    </div>
  );
}

// ── 상단 요약 카드 ──────────────────────────────────────────
function TopSummaryCard({ total, aprAmount, mayAmount, aprPct, mayPct }) {
  return (
    <div style={{
      padding: "14px 16px", marginBottom: 6,
      background: "var(--bg-elevated, #1F1F1F)",
      border: "1px solid var(--border)",
      borderRadius: 12,
    }}>
      <div style={{
        fontSize: 11, color: C_GRAY, fontWeight: 600, marginBottom: 4,
      }}>
        유솔 → 회사 받은 돈 합계 (4월 + 5월)
      </div>
      <div style={{
        fontSize: 24, fontWeight: 800, fontFamily: "inherit",
        color: C_PINK_DEEP, marginBottom: 10, lineHeight: 1,
      }}>
        ₩{total.toLocaleString()}
      </div>

      <StackBar aprPct={aprPct} mayPct={mayPct}/>

      <div style={{
        marginTop: 10, display: "flex", flexDirection: "column", gap: 4,
      }}>
        <SplitRow
          dotColor={C_GRAY_BAR}
          label="4월 작업분"
          amount={aprAmount}
          pct={aprPct}
        />
        <SplitRow
          dotColor={C_PINK_DEEP}
          label="5월 작업분"
          amount={mayAmount}
          pct={mayPct}
          highlight
        />
      </div>
    </div>
  );
}

// ── 주차별 카드 ─────────────────────────────────────────────
function WeeklyCard({ week }) {
  const total = week.apr + week.may;
  const aprPct = total > 0 ? (week.apr / total) * 100 : 0;
  const mayPct = total > 0 ? (week.may / total) * 100 : 0;
  const isEmpty = total === 0;

  const md = s => s.slice(5).replace("-", "/");

  return (
    <div style={{
      padding: "11px 14px",
      background: "var(--bg-elevated, #1F1F1F)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      opacity: isEmpty ? 0.55 : 1,
    }}>
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        marginBottom: isEmpty ? 0 : 8, gap: 8,
      }}>
        <div style={{
          display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap",
        }}>
          <span style={{
            fontSize: 12, fontWeight: 700, color: "var(--text-primary, #FAF8F5)",
          }}>
            {week.weekKey}
          </span>
          <span style={{ fontSize: 11, color: C_GRAY }}>
            {md(week.monday)} ~ {md(week.sunday)}
          </span>
        </div>
        <span style={{
          fontSize: 14, fontFamily: "inherit", fontWeight: 800,
          color: isEmpty ? C_GRAY : C_PINK_DEEP,
        }}>
          {isEmpty ? "—" : `₩${total.toLocaleString()}`}
        </span>
      </div>

      {!isEmpty && (
        <>
          <StackBar aprPct={aprPct} mayPct={mayPct}/>
          <div style={{
            marginTop: 6, display: "flex", justifyContent: "space-between",
            fontSize: 10, color: C_GRAY,
          }}>
            <span>
              <span style={{
                display: "inline-block", width: 6, height: 6, borderRadius: 1,
                background: C_GRAY_BAR, marginRight: 5, verticalAlign: "middle",
              }}/>
              4월 <span style={{ fontFamily: "inherit", fontWeight: 700, marginLeft: 3 }}>
                ₩{week.apr.toLocaleString()}
              </span>
            </span>
            <span>
              <span style={{
                display: "inline-block", width: 6, height: 6, borderRadius: 1,
                background: C_PINK_DEEP, marginRight: 5, verticalAlign: "middle",
              }}/>
              5월 <span style={{ fontFamily: "inherit", fontWeight: 700, marginLeft: 3 }}>
                ₩{week.may.toLocaleString()}
              </span>
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ── 가로 스택바 (4월 회색 / 5월 분홍) ────────────────────────
function StackBar({ aprPct, mayPct }) {
  const h = 9;
  if (aprPct + mayPct <= 0) {
    return (
      <div style={{
        width: "100%", height: h, borderRadius: h / 2,
        background: "rgba(255,255,255,0.05)",
      }}/>
    );
  }
  return (
    <div style={{
      width: "100%", height: h, borderRadius: h / 2,
      background: "rgba(255,255,255,0.05)", overflow: "hidden",
      display: "flex",
    }}>
      {aprPct > 0 && (
        <div style={{
          width: `${aprPct}%`, height: "100%", background: C_GRAY_BAR,
        }}/>
      )}
      {mayPct > 0 && (
        <div style={{
          width: `${mayPct}%`, height: "100%", background: C_PINK_DEEP,
        }}/>
      )}
    </div>
  );
}

function SplitRow({ dotColor, label, amount, pct, highlight }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{
          width: 8, height: 8, borderRadius: 2, background: dotColor,
          display: "inline-block",
        }}/>
        <span style={{ fontSize: 11, color: C_GRAY, fontWeight: 600 }}>
          {label} <span style={{ fontSize: 10, marginLeft: 3 }}>
            ({pct.toFixed(0)}%)
          </span>
        </span>
      </div>
      <span style={{
        fontSize: 12, fontFamily: "inherit", fontWeight: 700,
        color: highlight ? C_PINK_DEEP : "var(--text-primary)",
      }}>
        ₩{amount.toLocaleString()}
      </span>
    </div>
  );
}

// ── 6월+ 자동 hook 카드 (placeholder) ────────────────────────
function JuneAutoHookCard({ junWeeks }) {
  return (
    <div style={{
      marginTop: 16, padding: "14px 16px",
      background: "rgba(255,255,255,0.02)",
      border: "1px dashed var(--border)",
      borderRadius: 12,
    }}>
      <div style={{
        fontSize: 11, color: C_GRAY, fontWeight: 700, marginBottom: 6,
      }}>
        6월+ 자동 계산 (정산예정금액 백필 후 활성)
      </div>
      {junWeeks.length === 0 ? (
        <div style={{ fontSize: 11, color: C_GRAY, lineHeight: 1.6 }}>
          ⓘ task_items.settlement_expected 컬럼 백필 완료 후 자동으로 6월+ 주차 표시.
          <br/>
          <span style={{ fontSize: 10, opacity: 0.75 }}>
            현재는 시트 기준 4월/5월 고정값만. settlement_expected = 네이버 정산예정금액 × 0.85.
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {junWeeks.map(w => <WeeklyCard key={w.weekKey} week={w}/>)}
        </div>
      )}
    </div>
  );
}

export default UsolNToCompanySection;
