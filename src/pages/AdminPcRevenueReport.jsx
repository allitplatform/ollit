// 2026-06-13 — PC "매출 리포트" 화면. 1단계 = 하루 리포트만.
//
// 사장님 spec:
//   · 개요 대시보드(AdminPcRevenuePanel)와 차별점: 날짜·월 자유 선택 (과거 포함).
//   · 금액 계산은 revenueStats 그대로 재사용 — 개요와 숫자 반드시 일치.
//   · 1단계 = 하루 리포트만 만들고 사장님 숫자 검증. 그담 월 전체(2단계 별도).
//
// 데이터:
//   · computeRevenueByYmRange(apiTasks, ymd, ymd, user)
//     → { total, engineer, principal, owner, byService, byServiceDetail, count }
//   · computeRevenueByPrincipal(apiTasks, ymd, ymd, user)
//     → [{ code, name, count, total, owner }, ...]
//   · AdminPcRevenuePanel period='today' = (todayYmd, todayYmd, user) 호출과 동일 입력
//     → 기본값(오늘) 진입 시 개요와 자동 일치.
//
// UI:
//   · 상단: 날짜 선택 (‹ 화살표 / 가운데 YYYY-MM-DD (요일) / native date input / "오늘" 버튼)
//   · 4카드: 총매출 / 기사 정산(파랑) / 원청 수수료(주황) / 회사 마진(핑크 ★)
//   · 종류별 2단: ❄ 세척 / ⚡ 냉매 — 건수·매출·마진
//   · 원청별 분포: 매출 내림차순 표
//
// 색 톤 — AdminPcRevenuePanel 과 동일.

import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Wallet, Calendar, Download } from "lucide-react";
import { todayYmd } from "../utils/dateLabel.js";
import {
  computeRevenueByYmRange,
  computeRevenueByPrincipal,
  computeRevenueByEngineer,
  getMonthRange,
} from "../utils/revenueStats.js";
// 2026-07-21 — 기사별 월 수익 CSV 다운로드 (사장님 spec: 출장비 포함, 엑셀에서 열림)
import { downloadEngineerEarningsCsv } from "../utils/engineerEarningsExport.js";

const COLOR_ENGINEER  = "#3B82F6";
const COLOR_PRINCIPAL = "#F59E0B";
const COLOR_CLEANING  = "#0EA5E9";
const COLOR_REFRI     = "#FFB800";

const fmtKRW   = (n) => `₩${(Number(n) || 0).toLocaleString("ko-KR")}`;
const fmtCount = (n) => `${Number(n) || 0}건`;

const KO_DOW = ["일", "월", "화", "수", "목", "금", "토"];
function dowOf(ymd) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return isNaN(dt.getTime()) ? "" : KO_DOW[dt.getDay()];
}

// ymd ± 1일
function shiftYmd(ymd, delta) {
  if (!ymd) return ymd;
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + delta);
  const ny = dt.getFullYear();
  const nm = String(dt.getMonth() + 1).padStart(2, "0");
  const nd = String(dt.getDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

// "YYYY-MM" ± N개월
function shiftYm(ym, delta) {
  if (!ym) return ym;
  const [y, m] = ym.split("-").map(Number);
  const total = (y * 12) + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

// 그 달의 일수 (1~28/29/30/31)
function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

// ──────────────────────────────────────────────
// 본체
// ──────────────────────────────────────────────
export default function AdminPcRevenueReport({ t, apiTasks = [], user }) {
  const todayStr = todayYmd();
  const [selectedYmd, setSelectedYmd] = useState(todayStr);
  const [selectedYm, setSelectedYm]   = useState(todayStr.slice(0, 7));

  const dayTopRef = useRef(null);

  // 하루 dataset
  const day = useMemo(
    () => computeRevenueByYmRange(apiTasks, selectedYmd, selectedYmd, user),
    [apiTasks, selectedYmd, user]
  );
  const principals = useMemo(
    () => computeRevenueByPrincipal(apiTasks, selectedYmd, selectedYmd, user),
    [apiTasks, selectedYmd, user]
  );
  // 하루 기사별 — 회사 마진 내림차순 재정렬
  const engineersDay = useMemo(() => {
    const rows = computeRevenueByEngineer(apiTasks, selectedYmd, selectedYmd, user);
    return [...rows].sort((a, b) => (b.owner || 0) - (a.owner || 0));
  }, [apiTasks, selectedYmd, user]);

  // 월 dataset (= 그 달 1일~말일 범위 호출 — 개요 'month' 토글과 동일 입력)
  const monthRange = useMemo(() => {
    const [y, m] = selectedYm.split("-").map(Number);
    return getMonthRange(y, m);  // { start, end }
  }, [selectedYm]);
  const month = useMemo(
    () => computeRevenueByYmRange(apiTasks, monthRange.start, monthRange.end, user),
    [apiTasks, monthRange.start, monthRange.end, user]
  );
  // 월 기사별 — 회사 마진 내림차순 재정렬
  const engineersMonth = useMemo(() => {
    const rows = computeRevenueByEngineer(apiTasks, monthRange.start, monthRange.end, user);
    return [...rows].sort((a, b) => (b.owner || 0) - (a.owner || 0));
  }, [apiTasks, monthRange.start, monthRange.end, user]);

  // 일별 막대 dataset — 1일~말일 각 일 1회 호출 (같은 함수, 일치 보장)
  const dailySeries = useMemo(() => {
    const [y, m] = selectedYm.split("-").map(Number);
    const days = daysInMonth(y, m);
    const rows = [];
    for (let d = 1; d <= days; d++) {
      const ymd = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const r = computeRevenueByYmRange(apiTasks, ymd, ymd, user);
      rows.push({ ymd, day: d, total: r.total || 0, count: r.count || 0, owner: r.owner || 0 });
    }
    return rows;
  }, [apiTasks, selectedYm, user]);

  const maxDailyTotal = useMemo(() => {
    let m = 0;
    for (const r of dailySeries) if (r.total > m) m = r.total;
    return m;
  }, [dailySeries]);

  const isToday = selectedYmd === todayStr;
  const isThisMonth = selectedYm === todayStr.slice(0, 7);
  const dow = dowOf(selectedYmd);
  const sd  = day.byServiceDetail || {
    cleaning:    { total: 0, count: 0, owner: 0 },
    refrigerant: { total: 0, count: 0, owner: 0 },
  };

  function jumpDay(ymd) {
    setSelectedYmd(ymd);
    if (dayTopRef.current) {
      dayTopRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <div style={{ padding: "20px 24px 40px", maxWidth: 1400, margin: "0 auto" }}>
      {/* 헤더 */}
      <div ref={dayTopRef} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <Wallet size={22} style={{ color: t.accent }}/>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: t.text }}>매출 리포트</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
            날짜 자유 선택 · 개요 대시보드와 동일 dataset (revenueStats)
          </div>
        </div>
      </div>

      {/* 날짜 선택 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "12px 14px", marginBottom: 16,
        background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 10,
      }}>
        <div style={{ fontSize: 12, color: t.textMuted, fontWeight: 700, letterSpacing: 0.4, marginRight: 8 }}>
          📅 하루 리포트
        </div>
        <button onClick={() => setSelectedYmd(s => shiftYmd(s, -1))}
          aria-label="이전 날짜"
          style={{
            background: "transparent", border: `1px solid ${t.border}`,
            borderRadius: 8, padding: "7px 10px",
            color: t.text, cursor: "pointer", display: "flex",
            fontFamily: "inherit",
          }}>
          <ChevronLeft size={16}/>
        </button>
        <div style={{
          padding: "7px 14px",
          background: t.bgInset, border: `1.5px solid ${t.accent}`,
          borderRadius: 8,
          fontSize: 14, fontWeight: 800, color: t.text,
          minWidth: 160, textAlign: "center",
          fontVariantNumeric: "tabular-nums",
        }}>
          {selectedYmd} ({dow})
        </div>
        <button onClick={() => setSelectedYmd(s => shiftYmd(s, +1))}
          aria-label="다음 날짜"
          style={{
            background: "transparent", border: `1px solid ${t.border}`,
            borderRadius: 8, padding: "7px 10px",
            color: t.text, cursor: "pointer", display: "flex",
            fontFamily: "inherit",
          }}>
          <ChevronRight size={16}/>
        </button>
        <label style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "7px 12px",
          background: "transparent", border: `1px solid ${t.border}`,
          borderRadius: 8,
          fontSize: 12, fontWeight: 700, color: t.textMuted,
          cursor: "pointer", fontFamily: "inherit",
        }}>
          <Calendar size={13}/>
          <span>날짜 선택</span>
          <input type="date" value={selectedYmd}
            onChange={(e) => e.target.value && setSelectedYmd(e.target.value)}
            style={{
              border: "none", background: "transparent",
              fontFamily: "inherit", fontSize: 12, color: t.text,
              padding: 0, width: 0, opacity: 0, position: "absolute",
            }}/>
        </label>
        <button onClick={() => setSelectedYmd(todayStr)}
          disabled={isToday}
          style={{
            padding: "7px 14px",
            background: isToday ? "transparent" : t.accentBg,
            border: `1px solid ${isToday ? t.border : t.accent}`,
            borderRadius: 8,
            fontSize: 12, fontWeight: 700,
            color: isToday ? t.textMuted : t.accent,
            cursor: isToday ? "default" : "pointer",
            fontFamily: "inherit",
            opacity: isToday ? 0.6 : 1,
          }}>
          → 오늘
        </button>
        <div style={{ flex: 1 }}/>
        <div style={{ fontSize: 12, color: t.textSecondary }}>
          완료 <span className="mono" style={{ fontWeight: 700, color: t.text }}>{day.count || 0}</span>건
        </div>
      </div>

      {/* 4카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
        <BigCard t={t} label="총 매출" amount={day.total}        color={t.text}           emphasis="mid"/>
        <BigCard t={t} label="기사 정산" amount={day.engineer}    color={COLOR_ENGINEER}    emphasis="mid"/>
        <BigCard t={t} label="원청 수수료" amount={day.principal} color={COLOR_PRINCIPAL}   emphasis="mid"/>
        <BigCard t={t} label="회사 마진" amount={day.owner}        color={t.accent}          emphasis="big"/>
      </div>

      {/* 종류별 2단 */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
        marginBottom: 18,
      }}>
        <ServiceCard t={t} icon="❄" label="세척" color={COLOR_CLEANING} detail={sd.cleaning}/>
        <ServiceCard t={t} icon="⚡" label="냉매" color={COLOR_REFRI}    detail={sd.refrigerant}/>
      </div>

      {/* 원청별 분포 */}
      <div style={{
        background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 12,
        padding: "16px 20px",
        marginBottom: 14,
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: t.text, marginBottom: 12 }}>
          🏢 원청별 분포
        </div>
        {principals.length === 0 ? (
          <div style={{ padding: "30px 10px", textAlign: "center", color: t.textMuted, fontSize: 13 }}>
            해당 날짜 원청 매출 없음
          </div>
        ) : (
          <PrincipalTable t={t} rows={principals} dayTotal={day.total}/>
        )}
      </div>

      {/* 기사별 기여 (하루) */}
      <EngineerContributionTable
        t={t}
        rows={engineersDay}
        totalDataset={day}
        emptyText="해당 날짜 기사 기여 없음"
        title="👷 기사별 기여 (하루)"
      />

      {/* 0건 안내 */}
      {(day.count || 0) === 0 && (
        <div style={{
          marginTop: 14, padding: "16px 20px",
          background: t.bgInset, border: `1px dashed ${t.border}`, borderRadius: 10,
          fontSize: 12, color: t.textMuted, textAlign: "center",
        }}>
          {selectedYmd} 완료 작업이 없습니다 (트랙 A · isRemittanceTarget 기준).
        </div>
      )}

      {/* ────── 월 전체 리포트 ────── */}
      <div style={{
        marginTop: 30, paddingTop: 22,
        borderTop: `2px solid ${t.border}`,
      }}>
        {/* 월 헤더 + 월 선택 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <Wallet size={20} style={{ color: t.accent }}/>
          <div style={{ fontSize: 17, fontWeight: 800, color: t.text }}>월 전체 리포트</div>
          <div style={{ flex: 1 }}/>
          <div style={{ fontSize: 12, color: t.textSecondary }}>
            완료 <span className="mono" style={{ fontWeight: 700, color: t.text }}>{month.count || 0}</span>건
          </div>
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "12px 14px", marginBottom: 16,
          background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 10,
        }}>
          <button onClick={() => setSelectedYm(s => shiftYm(s, -1))}
            aria-label="이전 달"
            style={{
              background: "transparent", border: `1px solid ${t.border}`,
              borderRadius: 8, padding: "7px 10px",
              color: t.text, cursor: "pointer", display: "flex",
              fontFamily: "inherit",
            }}>
            <ChevronLeft size={16}/>
          </button>
          <div style={{
            padding: "7px 14px",
            background: t.bgInset, border: `1.5px solid ${t.accent}`,
            borderRadius: 8,
            fontSize: 14, fontWeight: 800, color: t.text,
            minWidth: 160, textAlign: "center",
            fontVariantNumeric: "tabular-nums",
          }}>
            {selectedYm.slice(0, 4)}년 {Number(selectedYm.slice(5, 7))}월
          </div>
          <button onClick={() => setSelectedYm(s => shiftYm(s, +1))}
            aria-label="다음 달"
            style={{
              background: "transparent", border: `1px solid ${t.border}`,
              borderRadius: 8, padding: "7px 10px",
              color: t.text, cursor: "pointer", display: "flex",
              fontFamily: "inherit",
            }}>
            <ChevronRight size={16}/>
          </button>
          <label style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "7px 12px",
            background: "transparent", border: `1px solid ${t.border}`,
            borderRadius: 8,
            fontSize: 12, fontWeight: 700, color: t.textMuted,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            <Calendar size={13}/>
            <span>월 선택</span>
            <input type="month" value={selectedYm}
              onChange={(e) => e.target.value && setSelectedYm(e.target.value)}
              style={{
                border: "none", background: "transparent",
                fontFamily: "inherit", fontSize: 12, color: t.text,
                padding: 0, width: 0, opacity: 0, position: "absolute",
              }}/>
          </label>
          <button onClick={() => setSelectedYm(todayStr.slice(0, 7))}
            disabled={isThisMonth}
            style={{
              padding: "7px 14px",
              background: isThisMonth ? "transparent" : t.accentBg,
              border: `1px solid ${isThisMonth ? t.border : t.accent}`,
              borderRadius: 8,
              fontSize: 12, fontWeight: 700,
              color: isThisMonth ? t.textMuted : t.accent,
              cursor: isThisMonth ? "default" : "pointer",
              fontFamily: "inherit",
              opacity: isThisMonth ? 0.6 : 1,
            }}>
            → 이번 달
          </button>
          <div style={{ flex: 1 }}/>
          <div style={{ fontSize: 11, color: t.textDim, fontFamily: "inherit" }}>
            {monthRange.start} ~ {monthRange.end}
          </div>
        </div>

        {/* 월 4카드 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
          <BigCard t={t} label="월 총매출"    amount={month.total}     color={t.text}           emphasis="mid"/>
          <BigCard t={t} label="기사 정산"     amount={month.engineer}  color={COLOR_ENGINEER}    emphasis="mid"/>
          <BigCard t={t} label="원청 수수료"   amount={month.principal} color={COLOR_PRINCIPAL}   emphasis="mid"/>
          <BigCard t={t} label="회사 마진"     amount={month.owner}     color={t.accent}          emphasis="big"/>
        </div>

        {/* 일별 막대그래프 */}
        <DailyBarChart
          t={t}
          series={dailySeries}
          maxTotal={maxDailyTotal}
          todayStr={todayStr}
          selectedYmd={selectedYmd}
          onPick={jumpDay}
        />

        {/* 기사별 기여 (월) */}
        <div style={{ marginTop: 14 }}>
          <EngineerContributionTable
            t={t}
            rows={engineersMonth}
            totalDataset={month}
            emptyText="이 달 기사 기여 없음"
            title="👷 기사별 기여 (이 달)"
            onDownload={(row) => downloadEngineerEarningsCsv({
              apiTasks, ym: selectedYm,
              engineerId: row.id, engineerName: row.name, user,
            })}
          />
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// 기사별 기여 표 (일·월 공용)
//   · 컬럼: 기사 / 건수 / 매출 / 기사 정산 / 회사 마진 / 비중%
//   · 회사 마진 내림차순 (호출 측에서 sort)
//   · 합계 행 = totalDataset (= 4카드와 동일 input·동일 함수 결과) → 자동 일치
//   · "(미배정)" row 도 그대로 노출 (합계 정합성)
//   · 비중% = (row.owner / totalDataset.owner) × 100. 총 마진이 0이면 "-" 표시
// ──────────────────────────────────────────────
function EngineerContributionTable({ t, rows, totalDataset, emptyText, title, onDownload }) {
  const totals = totalDataset || { count: 0, total: 0, engineer: 0, owner: 0 };

  // 합계 행 — rows 합산. totalDataset 과 동일해야 함 (검증용 — UI 표시는 totalDataset 그대로).
  let sumCount = 0, sumTotal = 0, sumEng = 0, sumOwner = 0;
  for (const r of rows) {
    sumCount += Number(r.count) || 0;
    sumTotal += Number(r.total) || 0;
    sumEng   += Number(r.engineer) || 0;
    sumOwner += Number(r.owner) || 0;
  }
  // dev 검증: 표 합계 ≠ 4카드 dataset 일 시 콘솔 경고 (운영 영향 없음).
  if (typeof window !== "undefined" && typeof console !== "undefined") {
    const mismatch =
      sumTotal !== Number(totals.total || 0) ||
      sumEng   !== Number(totals.engineer || 0) ||
      sumOwner !== Number(totals.owner || 0) ||
      sumCount !== Number(totals.count || 0);
    if (mismatch && rows.length > 0) {
      console.warn(
        "[EngineerContributionTable] 합계 불일치 — 표 합:", { sumCount, sumTotal, sumEng, sumOwner },
        " vs 4카드:", { count: totals.count, total: totals.total, engineer: totals.engineer, owner: totals.owner }
      );
    }
  }

  const denomOwner = Number(totals.owner) > 0 ? Number(totals.owner) : 1;

  return (
    <div style={{
      background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 12,
      padding: "16px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: t.text }}>{title}</div>
        <div style={{ flex: 1 }}/>
        <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 700 }}>
          {rows.length}명 · 회사 마진 내림차순
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: "30px 10px", textAlign: "center", color: t.textMuted, fontSize: 13 }}>
          {emptyText || "기사 기여 없음"}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {/* 헤더 */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "minmax(120px, 1.2fr) 70px minmax(130px, 1fr) minmax(130px, 1fr) minmax(130px, 1fr) 64px",
            gap: 10, alignItems: "center",
            padding: "8px 12px",
            fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: 0.4,
          }}>
            <span>기사</span>
            <span style={{ textAlign: "right" }}>건수</span>
            <span style={{ textAlign: "right" }}>매출</span>
            <span style={{ textAlign: "right" }}>기사 정산</span>
            <span style={{ textAlign: "right" }}>회사 마진</span>
            <span style={{ textAlign: "right" }}>비중</span>
          </div>

          {/* rows */}
          {rows.map((r) => {
            const pct = (Number(r.owner) / denomOwner) * 100;
            const isUnassigned = r.name === "(미배정)" || (!r.id && !r.name);
            return (
              <div key={r.id || r.name || "_"} style={{
                display: "grid",
                gridTemplateColumns: "minmax(120px, 1.2fr) 70px minmax(130px, 1fr) minmax(130px, 1fr) minmax(130px, 1fr) 64px",
                gap: 10, alignItems: "center",
                padding: "10px 12px",
                background: t.bgInset, borderRadius: 8,
                border: `1px solid ${t.border}`,
                opacity: isUnassigned ? 0.7 : 1,
              }}>
                <span style={{
                  fontSize: 13, fontWeight: 700, color: t.text,
                  display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0,
                }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.name || "—"}
                  </span>
                  {/* 2026-07-21 — 기사 월 수익 CSV (출장비 포함). 월 표에서만 노출 (onDownload prop). */}
                  {onDownload && !isUnassigned && (
                    <button onClick={() => onDownload(r)}
                      title={`${r.name} 이 달 수익 엑셀 다운로드`}
                      style={{
                        padding: "3px 6px", flexShrink: 0,
                        background: "transparent", border: `1px solid ${t.border}`,
                        borderRadius: 6, color: t.textSecondary,
                        cursor: "pointer", display: "inline-flex", alignItems: "center",
                        fontFamily: "inherit",
                      }}>
                      <Download size={12}/>
                    </button>
                  )}
                </span>
                <span className="mono" style={{
                  fontSize: 12, textAlign: "right", color: t.text, fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                }}>{fmtCount(r.count)}</span>
                <span className="mono" style={{
                  fontSize: 13, textAlign: "right", color: t.text, fontWeight: 800,
                  fontVariantNumeric: "tabular-nums",
                }}>{fmtKRW(r.total)}</span>
                <span className="mono" style={{
                  fontSize: 13, textAlign: "right", color: COLOR_ENGINEER, fontWeight: 800,
                  fontVariantNumeric: "tabular-nums",
                }}>{fmtKRW(r.engineer)}</span>
                <span className="mono" style={{
                  fontSize: 13, textAlign: "right", color: t.accent, fontWeight: 800,
                  fontVariantNumeric: "tabular-nums",
                }}>{fmtKRW(r.owner)}</span>
                <span className="mono" style={{
                  fontSize: 11, textAlign: "right", color: t.textSecondary, fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                }}>{Number(totals.owner) > 0 ? `${pct.toFixed(1)}%` : "—"}</span>
              </div>
            );
          })}

          {/* 합계 행 — totalDataset (4카드) 값 그대로. 표 rows 합과 일치해야 함. */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "minmax(120px, 1.2fr) 70px minmax(130px, 1fr) minmax(130px, 1fr) minmax(130px, 1fr) 64px",
            gap: 10, alignItems: "center",
            padding: "12px 12px",
            background: t.bgElevated,
            border: `1.5px solid ${t.accent}`, borderRadius: 8,
            marginTop: 4,
          }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: t.text }}>합계</span>
            <span className="mono" style={{
              fontSize: 12, textAlign: "right", color: t.text, fontWeight: 800,
              fontVariantNumeric: "tabular-nums",
            }}>{fmtCount(totals.count)}</span>
            <span className="mono" style={{
              fontSize: 14, textAlign: "right", color: t.text, fontWeight: 800,
              fontVariantNumeric: "tabular-nums",
            }}>{fmtKRW(totals.total)}</span>
            <span className="mono" style={{
              fontSize: 14, textAlign: "right", color: COLOR_ENGINEER, fontWeight: 800,
              fontVariantNumeric: "tabular-nums",
            }}>{fmtKRW(totals.engineer)}</span>
            <span className="mono" style={{
              fontSize: 14, textAlign: "right", color: t.accent, fontWeight: 800,
              fontVariantNumeric: "tabular-nums",
            }}>{fmtKRW(totals.owner)}</span>
            <span className="mono" style={{
              fontSize: 11, textAlign: "right", color: t.textMuted, fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
            }}>100%</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// 일별 매출 추이 막대그래프
//   · 1일~말일 모두 표시 (0원도 빈 막대)
//   · 오늘 강조 = 핑크(accent) / 위 하루 리포트 선택일 = 보더 강조
//   · 클릭 → 하루 리포트로 jump (selectedYmd 변경 + scrollIntoView)
//   · 호버 툴팁 = native title (날짜·매출·건수)
// ──────────────────────────────────────────────
function DailyBarChart({ t, series, maxTotal, todayStr, selectedYmd, onPick }) {
  const denom = maxTotal > 0 ? maxTotal : 1;
  return (
    <div style={{
      background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 12,
      padding: "16px 20px",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
      }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: t.text }}>📈 일별 매출 추이</span>
        <div style={{ flex: 1 }}/>
        <Legend t={t} swatch={t.textMuted} label="일 매출"/>
        <Legend t={t} swatch={t.accent}    label="오늘"/>
      </div>

      {/* 막대 영역 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))`,
        gap: 4,
        alignItems: "end",
        height: 180,
        padding: "0 2px",
      }}>
        {series.map(r => {
          const pct = (r.total / denom) * 100;
          const isToday = r.ymd === todayStr;
          const isSelected = r.ymd === selectedYmd;
          const barColor = isToday ? t.accent : (r.total > 0 ? COLOR_PRINCIPAL : t.border);
          // 최소 1px 높이 (0원이라도 baseline)
          const heightPct = r.total > 0 ? Math.max(pct, 2) : 0;
          return (
            <button key={r.ymd}
              type="button"
              onClick={() => onPick(r.ymd)}
              title={`${r.ymd} · ${fmtKRW(r.total)} · ${r.count}건`}
              style={{
                display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "flex-end",
                height: "100%",
                background: "transparent", border: "none",
                padding: 0, cursor: "pointer", fontFamily: "inherit",
                minWidth: 0,
              }}>
              <div style={{
                width: "100%",
                height: `${heightPct}%`,
                background: barColor,
                borderRadius: "3px 3px 0 0",
                boxShadow: isSelected ? `inset 0 0 0 1.5px ${t.text}` : "none",
                transition: "height 0.25s ease",
              }}/>
            </button>
          );
        })}
      </div>

      {/* x축 라벨 — 5의 배수 + 1일·말일 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))`,
        gap: 4,
        marginTop: 6,
        padding: "0 2px",
        fontSize: 10, color: t.textMuted, fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
      }}>
        {series.map((r, i) => {
          const show = r.day === 1 || r.day === series.length || r.day % 5 === 0;
          const isToday = r.ymd === todayStr;
          return (
            <span key={r.ymd} style={{
              textAlign: "center",
              color: isToday ? t.accent : t.textMuted,
              fontWeight: isToday ? 800 : 600,
            }}>{show ? r.day : ""}</span>
          );
        })}
      </div>
    </div>
  );
}

function Legend({ t, swatch, label }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 10, color: t.textSecondary, fontWeight: 700,
    }}>
      <span style={{
        width: 10, height: 10, borderRadius: 2, background: swatch,
        border: `1px solid ${t.border}`,
      }}/>
      {label}
    </span>
  );
}

// ──────────────────────────────────────────────
// 카드 (4개 / emphasis: 'mid' | 'big')
// ──────────────────────────────────────────────
function BigCard({ t, label, amount, color, emphasis }) {
  const big = emphasis === "big";
  return (
    <div style={{
      background: t.bgElevated,
      border: `${big ? 2 : 1}px solid ${big ? color : t.border}`,
      borderRadius: 12,
      padding: big ? "18px 22px" : "16px 20px",
      display: "flex", flexDirection: "column", gap: 6,
      boxShadow: big ? `0 0 0 1px ${color}22` : "none",
    }}>
      <div style={{
        fontSize: 11, color: t.textMuted, fontWeight: 700, letterSpacing: 0.4,
      }}>{label}</div>
      <div className="mono" style={{
        fontSize: big ? 22 : 18,
        fontWeight: 800, color,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.4px",
        wordBreak: "keep-all",
      }}>{fmtKRW(amount)}</div>
    </div>
  );
}

// ──────────────────────────────────────────────
// 종류별 (세척 / 냉매)
// ──────────────────────────────────────────────
function ServiceCard({ t, icon, label, color, detail }) {
  const { total = 0, count = 0, owner = 0 } = detail || {};
  return (
    <div style={{
      background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 12,
      padding: "16px 20px",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: t.text }}>{label}</span>
        <div style={{ flex: 1 }}/>
        <span className="mono" style={{
          fontSize: 12, color: t.textSecondary, fontWeight: 700,
        }}>{fmtCount(count)}</span>
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
      }}>
        <LineStat t={t} label="매출" amount={total}  color={color}/>
        <LineStat t={t} label="마진" amount={owner}  color={t.accent}/>
      </div>
    </div>
  );
}

function LineStat({ t, label, amount, color }) {
  return (
    <div style={{
      background: t.bgInset, border: `1px solid ${t.border}`,
      borderRadius: 8, padding: "9px 12px",
      display: "flex", flexDirection: "column", gap: 3,
    }}>
      <span style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: 0.4 }}>{label}</span>
      <span className="mono" style={{
        fontSize: 14, fontWeight: 800, color,
        fontVariantNumeric: "tabular-nums",
      }}>{fmtKRW(amount)}</span>
    </div>
  );
}

// ──────────────────────────────────────────────
// 원청별 표
// ──────────────────────────────────────────────
function PrincipalTable({ t, rows, dayTotal }) {
  const denom = dayTotal > 0 ? dayTotal : 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(120px, 1.2fr) 70px minmax(140px, 1fr) minmax(140px, 1fr) 64px",
        gap: 10, alignItems: "center",
        padding: "8px 12px",
        fontSize: 10, color: t.textMuted, fontWeight: 700, letterSpacing: 0.4,
      }}>
        <span>원청</span>
        <span style={{ textAlign: "right" }}>건수</span>
        <span style={{ textAlign: "right" }}>매출</span>
        <span style={{ textAlign: "right" }}>마진</span>
        <span style={{ textAlign: "right" }}>비중</span>
      </div>
      {rows.map((r) => {
        const pct = (r.total / denom) * 100;
        return (
          <div key={r.code || r.name} style={{
            display: "grid",
            gridTemplateColumns: "minmax(120px, 1.2fr) 70px minmax(140px, 1fr) minmax(140px, 1fr) 64px",
            gap: 10, alignItems: "center",
            padding: "10px 12px",
            background: t.bgInset, borderRadius: 8,
            border: `1px solid ${t.border}`,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
              {r.name || r.code || "—"}
            </span>
            <span className="mono" style={{
              fontSize: 12, textAlign: "right", color: t.text, fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
            }}>{fmtCount(r.count)}</span>
            <span className="mono" style={{
              fontSize: 13, textAlign: "right", color: t.text, fontWeight: 800,
              fontVariantNumeric: "tabular-nums",
            }}>{fmtKRW(r.total)}</span>
            <span className="mono" style={{
              fontSize: 13, textAlign: "right", color: t.accent, fontWeight: 800,
              fontVariantNumeric: "tabular-nums",
            }}>{fmtKRW(r.owner)}</span>
            <span className="mono" style={{
              fontSize: 11, textAlign: "right", color: t.textSecondary, fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
            }}>{pct.toFixed(1)}%</span>
          </div>
        );
      })}
    </div>
  );
}
