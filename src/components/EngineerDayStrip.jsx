// ============================================================
// EngineerDayStrip — 기사 하루 시간 격자 (08~23시, 1시간 칸) 공용 부품
// 2026-08-05 — 사장님 요청 3종 세트의 공통 부품:
//   ① 배정 추천 카드 (기존 RecommendCard 인라인 → 이 컴포넌트로 추출)
//   ② 전체 기사/재배정 모달 (기사 정보 없이 고르던 문제)
//   ③ 모바일 프로 목록 (기사가 언제 비는지 확인 어려움)
//
//   ri(routeInfo) = computeEngineerDayInfo() 결과:
//     { blocks, untimed, gaps, offRanges, fullOff, verdict, nowMin }
// ============================================================
import {
  buildDaySchedule, computeGaps, routeVerdict,
  DAY_START_MIN, DAY_END_MIN, fmtMin, hmToMin,
} from "../utils/assignRoute.js";

// 휴무 종일/부분 판정 — PC 타임라인(AdminPcTimelineScreen)과 동일한 type 기준.
const FULL_TYPES = ["single", "range", "repeat", "휴무종일"];
const HOUR_TYPES = ["hourly", "휴무부분"];

export function classifyOffs(offs = []) {
  const fullOff = offs.some(o =>
    FULL_TYPES.includes(o.type) || (!HOUR_TYPES.includes(o.type) && !o.startTime && !o.endTime)
  );
  const offRanges = offs
    .filter(o => HOUR_TYPES.includes(o.type) || (!FULL_TYPES.includes(o.type) && o.startTime && o.endTime))
    .map(o => ({ startMin: hmToMin(o.startTime), endMin: hmToMin(o.endTime) }))
    .filter(r => r.startMin != null && r.endMin != null && r.endMin > r.startMin);
  return { fullOff, offRanges };
}

// 기사 한 명의 하루 정보 (타임라인 + 동선 판정) 계산.
//   taskGu 없으면 verdict 는 여유 판정만 의미 있음 (good/far 안 나옴).
export function computeEngineerDayInfo({ apiTasks, engineerName, ymd, offs = [], taskGu = "", centroids = null, isToday = false }) {
  const { fullOff, offRanges } = classifyOffs(offs);
  const { blocks, untimed } = buildDaySchedule(apiTasks, engineerName, ymd);
  const nowMin = isToday
    ? (() => {
        const p = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" }).split(":");
        return Number(p[0]) * 60 + Number(p[1]);
      })()
    : null;
  const gaps = computeGaps(blocks, offRanges, undefined, nowMin);
  const verdict = routeVerdict({ taskGu, blocks, gaps, centroids, fullOff });
  return { blocks, untimed, gaps, offRanges, fullOff, verdict, nowMin };
}

// 하루 격자 렌더. t 없으면 CSS 변수 폴백 (모달 등 t 미보유 화면).
export function EngineerDayStrip({ t = null, ri, showSummary = true }) {
  if (!ri) return null;
  const C = {
    bgInset: t?.bgInset || "var(--bg-tertiary, rgba(127,127,127,0.08))",
    border:  t?.border  || "var(--border)",
    text:    t?.text    || "var(--text-primary)",
    bg:      t?.bg      || "var(--bg-primary)",
    muted:   t?.textMuted || "var(--text-tertiary, var(--text-secondary))",
    second:  t?.textSecondary || "var(--text-secondary)",
  };
  const HOURS = [];
  for (let h = DAY_START_MIN / 60; h < DAY_END_MIN / 60; h++) HOURS.push(h);
  const busyByHour = new Map();
  for (const b of (ri.blocks || [])) {
    const h = Math.floor(b.startMin / 60);
    if (!busyByHour.has(h)) busyByHour.set(h, []);
    busyByHour.get(h).push(b);
  }
  const offHour = (h) => (ri.offRanges || []).some(r => r.startMin < (h + 1) * 60 && r.endMin > h * 60);

  return (
    <div>
      {ri.fullOff ? (
        <div style={{
          height: 26, borderRadius: 7,
          border: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 800, color: C.muted,
          background: `repeating-linear-gradient(45deg, transparent, transparent 6px, ${C.border} 6px, ${C.border} 7px)`,
        }}>🏖️ 이날 휴무</div>
      ) : (
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", gap: 2 }}>
            {HOURS.map((h) => {
              const jobs = busyByHour.get(h) || [];
              const isOff = offHour(h);
              const busy = jobs.length > 0;
              return (
                <div key={h}
                  title={busy ? jobs.map(j => `${j.label} ${j.gu || j.region || ""}`).join(" / ") : isOff ? "휴무" : `${h}시 비어 있음`}
                  style={{
                    flex: 1, height: 30, borderRadius: 4, minWidth: 0,
                    background: busy ? C.text
                      : isOff ? `repeating-linear-gradient(45deg, ${C.bgInset}, ${C.bgInset} 4px, ${C.border} 4px, ${C.border} 5px)`
                      : C.bgInset,
                    border: `1px solid ${busy ? C.text : C.border}`,
                    opacity: busy ? 0.85 : 1,
                    color: busy ? C.bg : C.muted,
                    fontSize: 8, fontWeight: busy ? 800 : 700,
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", gap: 1,
                    overflow: "hidden", whiteSpace: "nowrap", lineHeight: 1.1,
                  }}>
                  <span style={{ fontSize: 8.5, fontWeight: 800 }}>{String(h).padStart(2, "0")}</span>
                  {busy && (
                    <span style={{ fontSize: 7.5 }}>
                      {jobs.length > 1 ? `${jobs.length}건` : (jobs[0].gu || jobs[0].region || "●").slice(0, 3)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {ri.nowMin != null && ri.nowMin > DAY_START_MIN && ri.nowMin < DAY_END_MIN && (
            <div style={{
              position: "absolute", top: -2, bottom: -2,
              left: `${(ri.nowMin - DAY_START_MIN) / (DAY_END_MIN - DAY_START_MIN) * 100}%`,
              width: 2, background: "#E5484D", borderRadius: 1,
              pointerEvents: "none",
            }}/>
          )}
        </div>
      )}
      {showSummary && !ri.fullOff && (ri.blocks || []).length > 0 && (
        <div style={{
          fontSize: 9.5, color: C.second, marginTop: 3,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {(ri.blocks || []).map(b => `${b.label} ${b.gu || b.region || ""}`).join(" · ")}
          {ri.untimed > 0 ? ` · ⏳시간미정 ${ri.untimed}건` : ""}
        </div>
      )}
      {showSummary && !ri.fullOff && (ri.blocks || []).length === 0 && ri.untimed > 0 && (
        <div style={{ fontSize: 9.5, color: C.muted, marginTop: 3 }}>
          ⏳ 시간 미정 배정 {ri.untimed}건
        </div>
      )}
    </div>
  );
}

// 동선 뱃지 라벨 (추천/모달 공용)
export function verdictUi(ri) {
  const level = ri?.verdict?.level || "";
  const km = ri?.verdict?.km;
  const near = ri?.verdict?.nearGu || "";
  const MAP = {
    good:    { icon: "🟢", text: km === 0 ? "동선 좋음 · 같은 구" : `동선 좋음 · ${km}km`, color: "#059669" },
    free:    { icon: "🟢", text: "이날 일정 없음 — 어디든 가능", color: "#059669" },
    far:     { icon: "🟡", text: `이동 큼 · ${km}km (${near || "인근"}→)`, color: "#B45309" },
    full:    { icon: "⛔", text: "이날 여유 없음", color: "#DC2626" },
    off:     { icon: "🏖️", text: "이날 휴무", color: "#6B7280" },
    unknown: { icon: "·",  text: "동선 판정 불가", color: "#9CA3AF" },
  };
  return MAP[level] || null;
}
