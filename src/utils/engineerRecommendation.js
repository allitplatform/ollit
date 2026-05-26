// V11-10 — 추천 기사 (모든 활성 기사 점수 매김 + 지역 매칭 우선)
// V11-5 시드 구조 유지: engineer.workTypes.cleaning.zones[지역명] / role "main"|"sub"
// 정렬: 지역 매칭 등급(main > sub > possible > none) → 같은 등급 내 점수순
// tier: best (메인+70+) / good (메인 또는 60+) / possible (40+) / fallback (그 외)
import { loadEngineers } from "../data/engineers.js";
import { loadTasks } from "../data/tasks.js";
import { loadRegions } from "../data/regions.js";
import { isRefrigerant } from "./workTypeKind.js";

const RECOMMEND_THRESHOLD = 50; // isRecommended 기준

// 2026-05-26 C-2 — workType 정확일치 → isRefrigerant (DB "냉매점검(...)" 측 catch).
function getWorkTypeKey(task) {
  if (isRefrigerant(task)) return "refrigerant";
  return "cleaning";
}

// 지역명 → 서브그룹 (서울/경기/인천)
function getRegionSubgroup(regionName, regionsAll) {
  const r = (regionsAll || []).find(x => x.name === regionName);
  return r?.subgroupId || null;
}

// Step 5-5-C Phase 5 — engineer.skills 매칭 헬퍼
// Phase 4-D — 두 단계 lookup: 특정 원청 우선 → (전체) fallback
// 매칭 조건: workType 정확 + 원청 (단계별) + 지역 (전국 또는 zones 포함)
// 반환: { matched: boolean, grade: string, skill: row | null }
function matchSkill(engineer, task) {
  const skills = Array.isArray(engineer?.skills) ? engineer.skills : [];
  if (skills.length === 0) return { matched: false, grade: "", skill: null };

  const wt = String(task?.workType || "").trim();
  const r  = task?.region ? String(task.region).trim() : "";
  const tPid   = task?.principalId ? String(task.principalId).trim() : "";
  const tPname = task?.principal   ? String(task.principal).trim()   : "";

  // 원청 매칭 분기
  // 특정 원청 매칭: 시트 principal이 task.principalId 또는 task.principal과 정확 일치
  const isSpecificMatch = sP =>
    !!sP && sP !== "(전체)" && sP !== "전체"
    && (sP === tPid || sP === tPname);
  // (전체) / 전체 / 빈 매칭: 와일드카드 fallback
  const isGeneralMatch = sP =>
    !sP || sP === "(전체)" || sP === "전체";

  // 단계별 lookup — 매칭 조건(workType + 지역) 동일
  function findByPrincipalFilter(filterFn) {
    for (const s of skills) {
      const sWT = String(s.workType || "").trim();
      if (sWT !== wt) continue;
      const sP = String(s.principal || "").trim();
      if (!filterFn(sP)) continue;
      // 지역 매칭: zones 비어있음 / "전국" / 포함
      let zones = [];
      if (Array.isArray(s.zones)) zones = s.zones;
      else if (typeof s.zones === "string") zones = s.zones.split(",").map(z => z.trim()).filter(Boolean);
      const isAllRegion = zones.length === 0
        || zones.includes("전국")
        || zones.includes("(전국)");
      const regionMatch = !r || isAllRegion || zones.includes(r);
      if (!regionMatch) continue;
      return { matched: true, grade: String(s.grade || "").trim(), skill: s };
    }
    return null;
  }

  // Step 1: 특정 원청 우선 (KA / 올데이케어 / 등)
  const specific = findByPrincipalFilter(isSpecificMatch);
  if (specific) return specific;

  // Step 2: (전체) / 전체 와일드카드 fallback
  const general = findByPrincipalFilter(isGeneralMatch);
  if (general) return general;

  return { matched: false, grade: "", skill: null };
}

// 지역 점수 (0~40) — DB skills 단일 출처
// 2026-05-22 fix — 등급 화이트리스트 ("메인" / "백업"만 후보).
//   옛 spec: 그 외 등급 (빈 grade / "안 함" / null 등) → 10점 → capable 그룹 진입 → push 후보 포함.
//   사장님 spec: 그 외 등급 = 후보 X. 시트 row 측 옛 "메인" 측 남아있다가 사장님이 "안 함" 변경 시
//     deleteEngineerSkill 측 실패 (silent) 측 시트 row 그대로 남는 케이스 보호.
// 매칭 안 됨 → 0점 (regionMatch="none")
function calcRegionScore(engineer, task /*, regionsAll */) {
  const skillMatch = matchSkill(engineer, task);
  if (!skillMatch.matched) return 0;
  if (skillMatch.grade === "메인") return 40;
  if (skillMatch.grade === "백업") return 25;
  return 0;  // 등급 명시 없음 (빈 grade / "안 함" 등) → 후보 제외
}

// 기종 점수 (0~20). 시드 appliances는 빈 배열 → 모두 가능 가정 (18점)
function calcApplianceScore(engineer, task) {
  const wtKey = getWorkTypeKey(task);
  const wt    = engineer.workTypes?.[wtKey];
  if (!wt) return 0;

  const eApp = wt.appliances || [];
  const tItems = Array.isArray(task.workItems) && task.workItems.length > 0
    ? task.workItems.map(it => it.type || it.appliance).filter(Boolean)
    : (task.appliance ? [task.appliance] : []);

  if (eApp.length === 0) return 18;
  if (tItems.length === 0) return 15;

  const allMatched = tItems.every(t => eApp.includes(t));
  if (allMatched) return 20;
  const someMatched = tItems.some(t => eApp.includes(t));
  return someMatched ? 12 : 5;
}

// 일정 점수 (0~20)
function calcScheduleScore(engineer, task, allTasks) {
  const day = (task.scheduledAt || task.workDate || "").slice(0, 10);
  if (!day) return 15;

  const sameDay = (allTasks || []).filter(t =>
    (t.engineerId === engineer.id || t.engineer === engineer.name) &&
    (t.scheduledAt || t.workDate || "").startsWith(day) &&
    !["canceled"].includes(t.status)
  );
  if (sameDay.length === 0) return 20;
  if (sameDay.length === 1) return 15;
  if (sameDay.length === 2) return 10;
  if (sameDay.length === 3) return 5;
  return 0;
}

// 최근 활동 (0~10)
function calcRecentActivity(engineer, allTasks) {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const count = (allTasks || []).filter(t =>
    (t.engineerId === engineer.id || t.engineer === engineer.name) &&
    t.completedAt &&
    new Date(t.completedAt).getTime() > cutoff
  ).length;
  if (count >= 5) return 10;
  if (count >= 3) return 7;
  if (count >= 1) return 5;
  return 3;
}

// 등급 점수 (0~10)
function calcRatingScore(engineer) {
  const map = { expert: 10, career: 7, rookie: 4 };
  return map[engineer.careerLevel] || 5;
}

// regionMatch 결정
function getRegionMatch(regionScore) {
  if (regionScore >= 40) return "main";
  if (regionScore >= 25) return "sub";
  if (regionScore >= 10) return "possible";
  return "none";
}

// tier 분류
function getTier(score, regionMatch) {
  if (regionMatch === "main" && score >= 70) return "best";
  if (regionMatch === "main" || score >= 60)  return "good";
  if (score >= 40)                            return "possible";
  return "fallback";
}

// V11-10 — 모든 활성 기사 점수 매김 (지역 매칭 0이어도 추천)
export function recommendEngineers(task, options = {}) {
  if (!task) return [];

  const engineers = options.engineers
    || (() => { try { return loadEngineers(); } catch { return []; } })();
  const tasksAll  = (() => { try { return loadTasks(); } catch { return []; } })();
  const regionsAll = (() => { try { return loadRegions(); } catch { return []; } })();
  const wtKey     = getWorkTypeKey(task);

  // 활성 기사만 (status: "off" 제외)
  // 단, 해당 작업 종류를 하는 기사 우선 — 그러나 V11-10 catch는 "모든 기사"라
  // 작업 종류가 등록되지 않은 기사도 후보로 포함 (점수만 낮음).
  const activeEngineers = engineers.filter(e => e.status !== "off");

  if (activeEngineers.length === 0) return [];

  const scored = activeEngineers.map(engineer => {
    const reasons = [];

    const regionScore    = calcRegionScore(engineer, task, regionsAll);
    const applianceScore = calcApplianceScore(engineer, task);
    const scheduleScore  = calcScheduleScore(engineer, task, tasksAll);
    const activityScore  = calcRecentActivity(engineer, tasksAll);
    const ratingScore    = calcRatingScore(engineer);

    const score        = regionScore + applianceScore + scheduleScore + activityScore + ratingScore;
    const regionMatch  = getRegionMatch(regionScore);
    const tier         = getTier(score, regionMatch);

    // 추천 이유 칩
    if (regionMatch === "main")      reasons.push({ icon: "📍", text: "메인 지역",  weight: "high" });
    else if (regionMatch === "sub")  reasons.push({ icon: "📍", text: "서브 지역",  weight: "medium" });
    else if (regionMatch === "possible") reasons.push({ icon: "📍", text: "인근 지역", weight: "medium" });
    else                              reasons.push({ icon: "📍", text: "지역 외",   weight: "low" });

    if (applianceScore >= 18) reasons.push({ icon: "🔧", text: "기종 OK", weight: "medium" });
    if (scheduleScore  >= 18) reasons.push({ icon: "📅", text: "일정 여유", weight: "high" });
    else if (scheduleScore <= 5) reasons.push({ icon: "⚠️", text: "일정 빡빡", weight: "low" });
    if (activityScore  >= 7)  reasons.push({ icon: "🔥", text: "최근 활발", weight: "medium" });
    if (engineer.careerLevel === "expert") reasons.push({ icon: "⭐", text: "베테랑", weight: "medium" });

    return {
      engineer,
      score,
      breakdown: { regionScore, applianceScore, scheduleScore, activityScore, ratingScore },
      reasons,
      regionMatch,
      isRecommended: score >= RECOMMEND_THRESHOLD,
      tier,
    };
  });

  // 정렬: 지역 매칭 등급 우선 → 같은 등급 내 점수순
  const regionPriority = { main: 4, sub: 3, possible: 2, none: 1 };
  scored.sort((a, b) => {
    const ap = regionPriority[a.regionMatch] || 0;
    const bp = regionPriority[b.regionMatch] || 0;
    if (ap !== bp) return bp - ap;
    return b.score - a.score;
  });

  return scored.slice(0, options.limit || 5);
}

export const RECOMMEND_INFO = {
  threshold: RECOMMEND_THRESHOLD,
  weights:   { region: 40, appliance: 20, schedule: 20, activity: 10, rating: 10 },
  tiers:     ["best", "good", "possible", "fallback"],
};

// ============================================================
// Phase 3-10 — 시트 getRecommendedEngineers 대체 어댑터
// 시그니처: (workType, principal, region) — 옛 GAS 호출과 동일
// 응답: { ok: true, main, sub, capable } — main/sub/capable은 engineer 객체 배열
// ============================================================
// regionMatch 분류:
//   · "main"     → main 그룹 (지역 메인)
//   · "sub"      → sub 그룹 (지역 백업)
//   · "possible" → capable 그룹 (인접 지역)
//   · "none"     → 제외
//
// 평탄화: { engineer, score, tier, reasons, ... } → engineer 객체 그대로
//        (AdminApp.jsx 호출처가 eng.name / eng.id 등 직접 접근)
// 비동기 시그니처 (async) 유지 — 호출처 await 호환.
export async function recommendEngineersGroupedAdapter(workType, principal, region) {
  const task = {
    workType: workType || "",
    principal: principal || "",
    region: region || "",
  };
  const scored = recommendEngineers(task, { limit: 999 });

  const main    = scored.filter(s => s.regionMatch === "main").map(s => s.engineer);
  const sub     = scored.filter(s => s.regionMatch === "sub").map(s => s.engineer);
  const capable = scored.filter(s => s.regionMatch === "possible").map(s => s.engineer);

  return { ok: true, main, sub, capable };
}
