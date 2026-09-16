// V11-10 — 추천 기사 (모든 활성 기사 점수 매김 + 지역 매칭 우선)
// V11-5 시드 구조 유지: engineer.workTypes.cleaning.zones[지역명] / role "main"|"sub"
// 정렬: 지역 매칭 등급(main > sub > possible > none) → 같은 등급 내 점수순
// tier: best (메인+70+) / good (메인 또는 60+) / possible (40+) / fallback (그 외)
//
// 2026-06-08 — recommendEngineersFromDb 추가 (DB 최신, async, 단순 메인/백업 필터).
//   AutoAssignScreen (= push_candidates 발사) 측만 새 함수로 전환.
//   옛 recommendEngineers (sync, 점수, localStorage) 는 AllEngineersModal 호환용 보존.
import { loadEngineers } from "../data/engineers.js";
import { loadTasks } from "../data/tasks.js";
import { loadRegions } from "../data/regions.js";
import { isRefrigerant, getServiceKind } from "./workTypeKind.js";
// 2026-07-14 — 지역명 표기 흔들림 흡수 ("남양주시"↔"남양주")
import { normalizeZoneName, zoneCoversRegion } from "../data/engineers.js";
import { supabase } from "../lib/supabase.js";

const RECOMMEND_THRESHOLD = 50; // isRecommended 기준

// 2026-05-26 C-2 — workType 정확일치 → isRefrigerant (DB "냉매점검(...)" 측 catch).
// 2026-07-20 — 사장님 규칙: 설치/누설/누수 작업은 냉매 기사의 기능·지역으로 배정.
//   (5종 판정 getServiceKind 중 install/leak → refrigerant 로 귀속. 옛 2분법이
//    누설·설치 접수를 전부 "세척"으로 떨어뜨려 냉매 기사 지역이 무시되던 버그.)
function serviceKindToRecKey(kind) {
  if (kind === "refrigerant" || kind === "install" || kind === "leak") return "refrigerant";
  return "cleaning";
}
function getWorkTypeKey(task) {
  return serviceKindToRecKey(getServiceKind(task));
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
  // 2026-07-20 — DB skills workType은 "세척"/"냉매충전" 둘뿐인데 task.workType은
  //   "냉매점검(가정용)" 같은 변형이 있어 exact 매칭이 빠지던 것 — canonical 폴백 추가.
  const wtCanonical = serviceKindToRecKey(getServiceKind(task)) === "refrigerant" ? "냉매충전" : "세척";
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
      if (sWT !== wt && sWT !== wtCanonical) continue;
      const sP = String(s.principal || "").trim();
      if (!filterFn(sP)) continue;
      // 지역 매칭: zones 비어있음 / "전국" / 포함
      let zones = [];
      if (Array.isArray(s.zones)) zones = s.zones;
      else if (typeof s.zones === "string") zones = s.zones.split(",").map(z => z.trim()).filter(Boolean);
      const isAllRegion = zones.length === 0
        || zones.includes("전국")
        || zones.includes("(전국)");
      // 2026-07-14 — 표기 흔들림 흡수: "남양주시"↔"남양주" 등 (normalizeZoneName)
      const regionMatch = !r || isAllRegion
        || zones.some(z => zoneCoversRegion(z, r));   // 2026-07-20 — 시↔구 커버 포함
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
// ============================================================
// 2026-06-08 — 점수 폐기. recommendEngineersFromDb (DB 최신) 호출.
//   · 활성 기사만 (users.is_active=true)
//   · serviceCode (cleaning/refrigerant) 메인/백업 보유 (epp.level IN ('main','sub'))
//   · 지역: zones 비면 전국 통과 / zones 있으면 task.region in zones (또는 zones에 "전국")
//   · 점수/threshold/top-N/capable 제거. 메인 먼저, 그 다음 백업. 전원.
// 응답: { ok, main, sub, capable: [] } — capable 호환용 빈 배열 (호출처 변경 X).
export async function recommendEngineersGroupedAdapter(workType, principal, region) {
  const list = await recommendEngineersFromDb({
    workType:  workType  || "",
    principal: principal || "",
    region:    region    || "",
  });
  // 2026-07-15 — '지역 메인/백업' = 작업지 구를 명시 등록한 기사만.
  //   전국·지역 미설정 기사는 capable(전지역 가능) 그룹으로 분리 — 사장님 spec:
  //   "전국 기사가 메인기사로 다 뜨네". 자동배정 알림 대상엔 여전히 포함 (3그룹 합침).
  const main    = list.filter(e => e.regionHit === "zone" && e.level === "main");
  const sub     = list.filter(e => e.regionHit === "zone" && e.level === "sub");
  const capable = list.filter(e => e.regionHit !== "zone");
  return { ok: true, main, sub, capable };
}

// ============================================================
// 2026-06-08 — DB 직접 추천 (캐시 의존 0, 매번 fresh).
//   타임라인:
//     [1] epp + users JOIN — service_code + level IN ('main','sub') + active=true
//     [2] engineer_zones — user_id IN (...)
//     [3] 지역 필터 + 정렬 (main 먼저)
//   region 매칭: tasks.district / engineer_zones.district 같은 형식 (구/시) — exact + "전국" 확장.
// ============================================================

// task → serviceCode (텍스트 LIKE 폐기, serviceCode 1순위)
function _pickServiceCode(task) {
  const items = Array.isArray(task?.workItems) ? task.workItems : [];
  for (const it of items) {
    const c = String(it?.serviceCode || it?.service_code || "").toLowerCase();
    if (c === "cleaning" || c === "refrigerant") return c;
    // 2026-07-20 — 설치/누설 serviceCode → 냉매 기사 풀 (사장님 규칙)
    if (c === "install" || c === "leak") return "refrigerant";
  }
  return serviceKindToRecKey(getServiceKind(task));
}

export async function recommendEngineersFromDb(task) {
  const region  = String(task?.region || "").trim();
  const svcCode = _pickServiceCode(task);

  // [1] epp + users JOIN (활성 기사 + 해당 serviceCode 메인/백업)
  const { data: eppRows, error: eppErr } = await supabase
    .from("engineer_principal_permissions")
    .select(`
      user_id, level,
      users!engineer_principal_permissions_user_id_fkey (
        id, code, name, phone, is_active
      )
    `)
    .eq("service_code", svcCode)
    .in("level", ["main", "sub"])
    .eq("active", true);
  if (eppErr) {
    console.error("[recommendEngineersFromDb:epp]", eppErr);
    return [];
  }

  // user 활성 + duplicate (= 같은 user 의 NULL + 원청별 row) 정리:
  //   사장님 spec — 한 user 당 1 row (level 우선 main > sub).
  const byUserId = new Map();
  for (const r of eppRows || []) {
    if (!r.users || r.users.is_active !== true) continue;
    const prev = byUserId.get(r.user_id);
    if (!prev || (r.level === "main" && prev.level !== "main")) {
      byUserId.set(r.user_id, {
        id:     r.users.code,    // "E0xx" — push_candidates 호환 키
        userId: r.users.id,      // UUID — zones 조회 키
        name:   r.users.name,
        phone:  r.users.phone,
        level:  r.level,
      });
    }
  }
  const candidates = Array.from(byUserId.values());
  if (candidates.length === 0) return [];

  // [2] zones 조회 (활성 후보 user 만)
  const userIds = candidates.map(c => c.userId);
  const { data: ezRows, error: ezErr } = await supabase
    .from("engineer_zones")
    .select("user_id, district")
    .in("user_id", userIds)
    .eq("active", true);
  if (ezErr) {
    console.error("[recommendEngineersFromDb:zones]", ezErr);
    return [];
  }
  const zonesByUser = new Map();
  for (const z of ezRows || []) {
    if (!zonesByUser.has(z.user_id)) zonesByUser.set(z.user_id, []);
    zonesByUser.get(z.user_id).push(String(z.district || "").trim());
  }

  // [3] 지역 필터 + 매칭 방식 구분 (2026-07-15 사장님 발견:
  //   "전국" 기사가 모든 지역에서 '지역 메인'으로 떠서 진짜 지역 기사와 구분 안 됨).
  //   regionHit: "zone" = 작업지 구를 명시 등록한 기사 / "all" = 전국·지역 미설정·작업지 불명.
  const filtered = [];
  for (const c of candidates) {
    const zones = zonesByUser.get(c.userId) || [];
    const isAll = zones.length === 0 || zones.includes("전국");
    if (isAll || !region) {
      filtered.push({ ...c, regionHit: "all", zones });
      continue;
    }
    // 2026-07-20 — matchedZone 부착: RecommendCard 지역 줄이 비어 나오던 것
    //   (DB 후보에 cleanZones/matchedZone 없음 → infoText "") 표시 복구.
    const hit = zones.find(z => zoneCoversRegion(z, region));   // 2026-07-20 — 시↔구 커버 포함
    if (hit) {
      filtered.push({ ...c, regionHit: "zone", matchedZone: hit, zones });
    }
  }

  // [4] 정렬: 명시 지역 매칭 먼저 → main 먼저 → 이름순
  filtered.sort((a, b) => {
    const az = a.regionHit === "zone" ? 0 : 1;
    const bz = b.regionHit === "zone" ? 0 : 1;
    if (az !== bz) return az - bz;
    const ap = a.level === "main" ? 0 : 1;
    const bp = b.level === "main" ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return (a.name || "").localeCompare(b.name || "", "ko");
  });

  return filtered;
}
