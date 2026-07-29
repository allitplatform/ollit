// 2026-07-26 — 접수 통계 허브 (모바일 개요 탭 📊 진입).
//   탭 2개: [원청별] 신규 (이 파일) / [지역별] 기존 RegionStatsScreen 재사용 (embedded).
//   원청별 산식 = AdminPcDashboard AdminPcTodayByPrincipal 과 동일, 기간만 확장:
//     · 접수     = created_at KST in range + status !== "취소" (트랙 무관 count)
//     · 완료     = completed_at KST in range + status === "완료" (트랙 무관 count)
//     · 회사 몫  = 완료 건 owner_amount 합 (gross, 운영비 전 — "이익" 아님)
//       ⚠️ usol_n 은 트랙 B (월정산) → 금액 미확정, "월정산" 표시 + 합계 제외.
//   ⚠️ 접수/완료 는 독립 집계 (이번주 접수한 게 이번주 완료 아님).
//   ⚠️ 읽기 전용. 정산 트리거 무손.

import React, { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { todayYmd, toKstYmd } from "../../utils/dateLabel.js";
import { RegionStatsScreen } from "./RegionStatsScreen.jsx";
// 2026-07-27 — 취소 숫자 클릭 → 목록 펼침 (사유 한국어 라벨)
import { getCancelReasonLabel } from "../../data/cancelReasons.js";
// 2026-07-29 — 사장님 요청 "모바일 접수현황에도 접수 시간대가 있으면 좋겠다".
//   PC 대시보드와 같은 컴포넌트를 공용으로 씀 (숫자 기준도 자동으로 같아짐).
import { HourlyReceivedChart, hourBucketIndexKst } from "./HourlyReceivedChart.jsx";

// 표시 순서·색 — receptionForm.js PRINCIPALS 색과 동기 (수동 복사).
const PRINCIPAL_ORDER = [
  { code: "allday",  name: "올데이케어",      color: "#FF1B8D" },
  { code: "KA",      name: "에어컨프로 (KA)", color: "#06B6D4" },
  { code: "KB",      name: "쿨가이 (KB)",     color: "#0891B2" },
  { code: "yongin",  name: "용인컴퍼니",      color: "#FFB800" },
  { code: "usol_h",  name: "유솔홈케어 H",    color: "#10B981" },
  { code: "usol_n",  name: "유솔홈케어 N",    color: "#03C75A" },
  { code: "crikrin", name: "크리크린",        color: "#7F77DD" },
];
const USOLN_CODE = "usol_n";

// 2026-07-29 — 사장님 요청: 기본은 '오늘', 날짜도 직접 고를 수 있게.
//   '직접' 옵션·산식은 RegionStatsScreen 과 동일하게 맞춤 (두 탭이 따로 놀면 헷갈림).
const PERIOD_OPTS = [
  { id: "today",  label: "오늘" },
  { id: "week",   label: "이번주" },
  { id: "month",  label: "이번달" },
  { id: "all",    label: "전체" },
  { id: "custom", label: "직접" },
];

function _startOfWeekMonYmd() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function _startOfMonthYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
// 2026-07-29 — 차트 제목용 기간 이름 ("오늘 접수 시간대" 처럼).
function _periodLabel(period) {
  if (period === "custom") return "선택 기간";
  return (PERIOD_OPTS.find(o => o.id === period) || {}).label || "";
}

function _range(period, customStart, customEnd) {
  const today = todayYmd();
  if (period === "today") return { start: today,               end: today };
  if (period === "week")  return { start: _startOfWeekMonYmd(), end: today };
  if (period === "month") return { start: _startOfMonthYmd(),   end: today };
  if (period === "custom") {
    // 한쪽만 고르면 그 하루. 거꾸로 골라도 알아서 뒤집는다 (사용자 실수 관대).
    let s = customStart || today;
    let e = customEnd   || s;
    if (s > e) { const tmp = s; s = e; e = tmp; }
    return { start: s, end: e };
  }
  return { start: "0000-01-01", end: "9999-12-31" };
}
const _won = (n) => (Number(n) || 0).toLocaleString("ko-KR");

// 2026-07-29 — 어제 날짜 (문자열 계산이라 시간대 사고가 안 난다).
function _prevYmd(ymd) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

// ─── 원청별 탭 ───────────────────────────────────────────
function PrincipalStatsTab({ t, apiTasks = [] }) {
  // 2026-07-29 — 기본값 week → today (사장님 요청).
  const [period, setPeriod] = useState("today");
  const [customStart, setCustomStart] = useState(() => todayYmd());
  const [customEnd,   setCustomEnd]   = useState(() => todayYmd());
  const [openCancel, setOpenCancel] = useState(null);   // 취소 목록 펼친 원청 code
  const { start, end } = useMemo(
    () => _range(period, customStart, customEnd),
    [period, customStart, customEnd]
  );

  const yesterYmd = useMemo(() => _prevYmd(todayYmd()), []);

  const { rows, totals, hourly, ydayHourly } = useMemo(() => {
    // 2026-07-29 — 접수 시간대 13버킷 [~8시, 9..19, 20시+].
    //   선택 기간 전체를 "몇 시에 들어왔나" 로 합산 (취소 포함 = 전체 유입).
    const hourlyArr = new Array(13).fill(0);
    // 어제 같은 그림 — "어제 이맘때 몇 건이었나" 비교용 (기간과 무관하게 항상 계산).
    const ydayArr = new Array(13).fill(0);
    const received = new Map();
    const canceled = new Map();   // 2026-07-27 — 사장님 spec: 취소도 보이게
    const cxList   = new Map();   // code → 취소 task 목록 (클릭 펼침용)
    const done     = new Map();
    const owner    = new Map();
    for (const tk of (apiTasks || [])) {
      if (!tk) continue;
      const code = String(tk.principalCode || tk.principal_code || "").trim();
      if (!code) continue;

      const created = tk.createdAt || tk.created_at;
      if (created) {
        const k = toKstYmd(created);
        // 어제 접수 — 선택 기간과 상관없이 항상 따로 센다 (비교 기준).
        if (k === yesterYmd) {
          const yIdx = hourBucketIndexKst(created);
          if (yIdx >= 0) ydayArr[yIdx] += 1;
        }
        if (k && k >= start && k <= end) {
          // 2026-07-27 v2 — 사장님 spec: 접수 = 전체 유입 (취소 포함).
          //   "61 접수 + 취소 13" 이 빼기처럼 읽힘 — 진짜 들어온 건 74. 취소는 그중 일부.
          received.set(code, (received.get(code) || 0) + 1);
          const hIdx = hourBucketIndexKst(created);
          if (hIdx >= 0) hourlyArr[hIdx] += 1;
          if (tk.status === "취소") {
            canceled.set(code, (canceled.get(code) || 0) + 1);
            if (!cxList.has(code)) cxList.set(code, []);
            cxList.get(code).push(tk);
          }
        }
      }
      const completed = tk.completedAt || tk.completed_at;
      if (completed && tk.status === "완료") {
        const k = toKstYmd(completed);
        if (k && k >= start && k <= end) {
          done.set(code, (done.get(code) || 0) + 1);
          if (code !== USOLN_CODE) {
            owner.set(code, (owner.get(code) || 0) + Number(tk.owner_amount ?? tk.ownerAmount ?? 0));
          }
        }
      }
    }
    const all = PRINCIPAL_ORDER.map(p => ({
      ...p,
      received: received.get(p.code) || 0,
      canceled: canceled.get(p.code) || 0,
      cxTasks:  cxList.get(p.code)   || [],
      done:     done.get(p.code)     || 0,
      owner:    owner.get(p.code)    || 0,
      isTrackB: p.code === USOLN_CODE,
    })).filter(r => r.received > 0 || r.done > 0 || r.canceled > 0);
    // 접수 많은 순 (동수면 완료 순)
    all.sort((a, b) => b.received - a.received || b.done - a.done);
    return {
      rows: all,
      hourly: hourlyArr,
      ydayHourly: ydayArr,
      totals: {
        received: all.reduce((s, r) => s + r.received, 0),
        canceled: all.reduce((s, r) => s + r.canceled, 0),
        done:     all.reduce((s, r) => s + r.done,     0),
        owner:    all.reduce((s, r) => s + (r.isTrackB ? 0 : r.owner), 0),
      },
    };
  }, [apiTasks, start, end, yesterYmd]);

  const maxReceived = Math.max(1, ...rows.map(r => r.received));

  // 2026-07-29 — "어제 이맘때 몇 건, 오늘 몇 건" 비교.
  //   ⚠️ 하루 총량끼리 비교하면 오전엔 무조건 지는 것처럼 보인다.
  //      그래서 '지금 시각까지 누적' 끼리만 비교한다.
  //   ⚠️ 어제 하루 한 건과의 비교라 표본이 1개다. 추세가 아니라 눈금으로만 쓸 것.
  const isToday = period === "today"
    || (period === "custom" && start === end && start === todayYmd());
  const cmp = useMemo(() => {
    if (!isToday) return null;
    const nowIdx = hourBucketIndexKst(new Date());
    if (nowIdx < 0) return null;
    let now = 0, yNow = 0;
    for (let i = 0; i <= nowIdx; i++) {
      now  += hourly[i]     || 0;
      yNow += ydayHourly[i] || 0;
    }
    const yAll = ydayHourly.reduce((s, v) => s + (v || 0), 0);
    if (yAll === 0) return null;                 // 어제 데이터가 없으면 비교 안 함
    const diff = yNow > 0 ? Math.round(((now - yNow) / yNow) * 100) : null;
    // 착지 예상 = 오늘누적 × (어제하루 ÷ 어제같은시각). 어제 패턴이 오늘도 같다고 가정.
    const projected = yNow > 0 ? Math.round(now * (yAll / yNow)) : null;
    return { now, yNow, yAll, diff, projected, nowIdx };
  }, [isToday, hourly, ydayHourly]);

  const chip = (opt) => {
    const on = period === opt.id;
    return (
      <button key={opt.id} type="button" onClick={() => setPeriod(opt.id)} style={{
        flex: 1, minWidth: 0, padding: "8px 0", textAlign: "center", whiteSpace: "nowrap",
        background: on ? t.accent : "transparent",
        border: `1px solid ${on ? t.accent : t.border}`,
        borderRadius: 10,
        color: on ? "#fff" : t.textSecondary,
        fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
      }}>{opt.label}</button>
    );
  };

  const totCell = (v, label, color) => (
    <div style={{
      flex: 1, textAlign: "center", minWidth: 0,
      background: t.bgElevated, border: `1px solid ${t.border}`,
      borderRadius: 10, padding: "10px 4px",
    }}>
      <div style={{
        fontSize: 18, fontWeight: 800, fontVariantNumeric: "tabular-nums",
        color: color || t.text, letterSpacing: "-0.5px",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{v}</div>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: t.textSecondary, marginTop: 2, whiteSpace: "nowrap" }}>{label}</div>
    </div>
  );

  return (
    <div style={{ padding: "12px 16px" }}>
      {/* 기간 칩 */}
      <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
        {PERIOD_OPTS.map(chip)}
      </div>

      {/* 2026-07-29 — '직접' 선택 시 시작일 ~ 종료일 달력.
            한쪽만 바꾸면 반대쪽을 따라가게 해서 "하루만 보기" 가 쉽게 된다. */}
      {period === "custom" && (
        <div style={{
          display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap",
          marginBottom: 8,
        }}>
          <input
            type="date"
            value={customStart}
            max={todayYmd()}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              setCustomStart(v);
              if (v > customEnd) setCustomEnd(v);
            }}
            style={{
              flex: 1, minWidth: 128, padding: "7px 8px",
              background: t.bgElevated, border: `1px solid ${t.border}`,
              borderRadius: 9, color: t.text,
              fontSize: 12, fontWeight: 700, fontFamily: "inherit", outline: "none",
            }}
            aria-label="시작일"
          />
          <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 700 }}>~</span>
          <input
            type="date"
            value={customEnd}
            max={todayYmd()}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              setCustomEnd(v);
              if (v < customStart) setCustomStart(v);
            }}
            style={{
              flex: 1, minWidth: 128, padding: "7px 8px",
              background: t.bgElevated, border: `1px solid ${t.border}`,
              borderRadius: 9, color: t.text,
              fontSize: 12, fontWeight: 700, fontFamily: "inherit", outline: "none",
            }}
            aria-label="종료일"
          />
          <button
            type="button"
            onClick={() => { const d = todayYmd(); setCustomStart(d); setCustomEnd(d); }}
            style={{
              padding: "6px 11px", background: "transparent",
              border: `1px solid ${t.border}`, borderRadius: 999,
              color: t.textSecondary, fontSize: 11, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
            }}>오늘로</button>
        </div>
      )}

      {/* 지금 보고 있는 기간 — 칩만 보면 며칠치인지 헷갈려서 항상 표시 */}
      <div style={{ fontSize: 10.5, color: t.textMuted, fontWeight: 600, marginBottom: 12 }}>
        {period === "all"
          ? "전체 기간"
          : (start === end ? `${start} (하루)` : `${start} ~ ${end}`)}
        {period !== "all" && " · KST 기준"}
      </div>

      {/* 2026-07-29 — 사장님 요청: "어제는 얼마인데 오늘 몇 개 들어왔나".
            같은 시각까지 누적끼리 비교 (하루 총량 비교는 오전에 항상 지는 것처럼 보임). */}
      {cmp && (
        <div style={{
          background: t.bgElevated, border: `1px solid ${t.border}`,
          borderRadius: 12, padding: "11px 13px", marginBottom: 12,
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: t.textSecondary }}>
              어제 이맘때
            </span>
            <span style={{ fontSize: 15, fontWeight: 800, color: t.textSecondary, fontVariantNumeric: "tabular-nums" }}>
              {cmp.yNow}건
            </span>
            <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 700 }}>→</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: t.textSecondary }}>오늘</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: t.text, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.5px" }}>
              {cmp.now}건
            </span>
            {cmp.diff !== null && (
              <span style={{
                fontSize: 12.5, fontWeight: 800, fontVariantNumeric: "tabular-nums",
                color: cmp.diff > 0 ? "#10B981" : cmp.diff < 0 ? "#FF3B5C" : t.textMuted,
              }}>
                {cmp.diff > 0 ? "▲" : cmp.diff < 0 ? "▼" : "="} {Math.abs(cmp.diff)}%
              </span>
            )}
          </div>
          <div style={{ fontSize: 10.5, color: t.textMuted, fontWeight: 600, marginTop: 5, lineHeight: 1.6 }}>
            어제 하루 {cmp.yAll}건
            {cmp.projected !== null && <> · 이 흐름이면 오늘 <b style={{ color: t.textSecondary }}>{cmp.projected}건</b> 예상</>}
            <br/>
            접수량은 광고비를 따라갑니다. 광고비가 어제와 다르면 이 숫자만으로 판단하지 마세요.
          </div>
        </div>
      )}

      {/* 합계 3칸 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {totCell(totals.received, "접수")}
        {totCell(totals.canceled, "취소", "#FF3B5C")}
        {totCell(totals.done, "완료", "#0EA5E9")}
        {totCell(`₩${_won(totals.owner)}`, "회사 몫 (유솔N 제외)", t.accent)}
      </div>

      {/* 원청별 리스트 */}
      <div style={{
        background: t.bgElevated, border: `1px solid ${t.border}`,
        borderRadius: 14, padding: "12px 14px",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, paddingBottom: 8,
          fontSize: 9.5, fontWeight: 700, color: t.textMuted,
        }}>
          <span style={{ width: 7, flexShrink: 0 }}/>
          <span style={{ flex: 1 }}>원청</span>
          <span style={{ width: 34, textAlign: "right" }}>접수</span>
          <span style={{ width: 30, textAlign: "right" }}>취소</span>
          <span style={{ width: 34, textAlign: "right" }}>완료</span>
          <span style={{ width: 82, textAlign: "right" }}>회사 몫</span>
        </div>

        {rows.length === 0 && (
          <div style={{ padding: "24px 0", textAlign: "center", fontSize: 12, color: t.textMuted }}>
            이 기간에 접수·완료가 없습니다
          </div>
        )}

        {rows.map((r, i) => (
          <div key={r.code} style={{
            padding: "9px 0",
            borderTop: i === 0 ? "none" : `1px solid ${t.border}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: r.color, flexShrink: 0 }}/>
              <span style={{
                flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: t.text,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{r.name}</span>
              <span style={{ width: 34, textAlign: "right", fontSize: 12.5, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: t.text }}>{r.received}</span>
              <span
                onClick={() => r.canceled > 0 && setOpenCancel(openCancel === r.code ? null : r.code)}
                style={{
                  width: 30, textAlign: "right", fontSize: 12, fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  color: r.canceled > 0 ? "#FF3B5C" : t.textMuted,
                  textDecoration: r.canceled > 0 ? "underline" : "none",
                  cursor: r.canceled > 0 ? "pointer" : "default",
                }}
              >{r.canceled}</span>
              <span style={{ width: 34, textAlign: "right", fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: t.textSecondary }}>{r.done}</span>
              <span style={{
                width: 82, textAlign: "right", fontVariantNumeric: "tabular-nums",
                fontSize: r.isTrackB ? 10.5 : 12, fontWeight: r.isTrackB ? 700 : 800,
                color: r.isTrackB ? "#03C75A" : t.text,
              }}>{r.isTrackB ? "월정산" : _won(r.owner)}</span>
            </div>
            <div style={{
              height: 4, borderRadius: 3, marginTop: 6, overflow: "hidden",
              background: t.bgInset || "rgba(255,255,255,0.06)",
            }}>
              <div style={{
                height: "100%", borderRadius: 3, background: r.color,
                width: `${Math.round((r.received / maxReceived) * 100)}%`,
                opacity: r.isTrackB ? 0.5 : 1,
              }}/>
            </div>
            {/* 2026-07-27 — 취소 숫자 클릭 시 목록 펼침 */}
            {openCancel === r.code && r.cxTasks.length > 0 && (
              <div style={{
                marginTop: 7, padding: "8px 10px",
                background: "rgba(255,59,92,0.06)",
                border: "1px solid rgba(255,59,92,0.25)",
                borderRadius: 9,
              }}>
                {r.cxTasks.map(ct => (
                  <div key={ct.id} style={{
                    fontSize: 11, color: t.textSecondary, lineHeight: 1.8,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    <span style={{ fontWeight: 800, color: t.text }}>{ct.customer || "고객 미상"}</span>
                    <span style={{ color: t.textMuted }}> · {ct.taskCode || ct.id}</span>
                    {(() => {
                      const raw = ct.cancelReason || (ct.categoryData && ct.categoryData.cancelReason) || "";
                      const label = raw ? (getCancelReasonLabel(raw) || raw) : "";
                      return label ? <span style={{ color: "#FF3B5C" }}> — {label}</span> : null;
                    })()}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {rows.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            paddingTop: 10, marginTop: 2, borderTop: `1px solid ${t.border}`,
          }}>
            <span style={{ width: 7, flexShrink: 0 }}/>
            <span style={{ flex: 1, fontSize: 12.5, fontWeight: 800, color: t.text }}>합계</span>
            <span style={{ width: 34, textAlign: "right", fontSize: 13, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: t.text }}>{totals.received}</span>
            <span style={{ width: 30, textAlign: "right", fontSize: 12.5, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: totals.canceled > 0 ? "#FF3B5C" : t.textMuted }}>{totals.canceled}</span>
            <span style={{ width: 34, textAlign: "right", fontSize: 12.5, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: t.textSecondary }}>{totals.done}</span>
            <span style={{ width: 82, textAlign: "right", fontSize: 12.5, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: t.accent }}>{_won(totals.owner)}</span>
          </div>
        )}
      </div>

      {/* 2026-07-29 — 접수 시간대 (PC 대시보드와 같은 컴포넌트).
            기간을 바꾸면 그 기간 전체를 시간대별로 합산해서 보여준다.
            "오늘" 일 때만 지금 시각 막대를 핑크로 강조. */}
      {hourly.some(c => c > 0) && (
        <div style={{
          background: t.bgElevated, border: `1px solid ${t.border}`,
          borderRadius: 14, padding: "10px 14px 12px", marginTop: 10,
        }}>
          <HourlyReceivedChart
            hourly={hourly}
            total={totals.received}
            title={`${_periodLabel(period)} 접수 시간대`}
            highlightNow={isToday}
            compare={cmp ? ydayHourly : null}
            compareLabel="어제"
            compact
          />
        </div>
      )}

      <div style={{ fontSize: 10, color: t.textMuted, marginTop: 10, lineHeight: 1.7 }}>
        회사 몫 = 운영비 빼기 전 금액 (이익 아님). 유솔N 은 월정산이라 금액 미확정.<br/>
        접수와 완료는 따로 셈 (이번 기간 접수 ≠ 이번 기간 완료).<br/>
        접수 = 전체 유입 (취소 포함) · 취소 = 그중 취소된 건 · 유효 접수 = 접수 − 취소.
      </div>
    </div>
  );
}

// ─── 허브 (헤더 + 탭 전환) ───────────────────────────────
export function StatsHubScreen({ t, apiTasks = [], user, onBack }) {
  const [tab, setTab] = useState("principal");

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
          📊 접수 통계
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: "flex", borderBottom: `1px solid ${t.border}` }}>
        {[
          { id: "principal", label: "원청별" },
          { id: "region",    label: "지역별" },
        ].map(x => {
          const on = tab === x.id;
          return (
            <button key={x.id} type="button" onClick={() => setTab(x.id)} style={{
              flex: 1, padding: "12px 0", textAlign: "center",
              background: "transparent", border: "none",
              boxShadow: on ? `inset 0 -2px 0 ${t.accent}` : "none",
              color: on ? t.accent : t.textSecondary,
              fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
            }}>{x.label}</button>
          );
        })}
      </div>

      {tab === "principal"
        ? <PrincipalStatsTab t={t} apiTasks={apiTasks}/>
        : <RegionStatsScreen t={t} apiTasks={apiTasks} user={user} embedded/>}
    </div>
  );
}
