// 2026-06-12 — AdminApp PC 작업 타임라인 (1024px+ 전용, 🅐 시간축).
//   기사별 행 × 시간 격자 (07~19시, % 균등 분배). 가로 스크롤 없음.
//   ⚠️ 처리 흐름은 별도 화면 (AdminPcFlowScreen) — 사이드바 항목 분리 (렉 해소).
//
// 2026-06-19 — 현재 시각 표시선 (now line) + 드래그&드롭 일정 조정 (1단계).
//   · 1분마다 갱신, 오늘 + 시간축 범위 내일 때만 노출.
//   · 같은 기사 행 내 좌우 드래그 → 30분 단위 스냅 → 확인 모달 → admin_reschedule_task RPC.
//   · 잠금: 진행중 / 완료 / 취소 / visit_only / 정산완료.
//   · 드래그 중 막대 자체 이동 + 새 시각 라벨 미리보기.

import { getCategoryMeta, getTaskDurationHours, categoryTint } from "../lib/serviceCatalog.js";
// 2026-10-07 — 타임라인 개편 (시안 v1): 왼쪽 미배정 목록 · 소속별 묶음 · 협력사 보기 전용
import { useSubcontractorIndex, subcontractorOfEngineer, subcontractorName, adminAssignTaskToSubcontractor, listSubcontractorCategories } from "../lib/subcontractorsDb.js";
import { ZONE_GROUPS } from "../utils/zoneGroups.js";
import { updateTaskDb, assignEngineerDb } from "../data/tasksDb.js";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { todayYmd, toKstYmd } from "../utils/dateLabel.js";

// 2026-06-20 trace — 모듈 로드 자체 확인 (HMR 미반영 진단).
console.log('[AdminPcTimelineScreen MODULE LOADED v2026-06-20-trace5]');
import { getTaskStatusColor } from "../utils/taskStatusColor.js";
import { getServiceKind, leakDisplayLabel } from "../utils/workTypeKind.js";
// 2026-07-11 — task 실질 취소 판정 (배지/목록/타임라인 일관).
import { isEffectivelyCanceled } from "../utils/taskCancelState.js";
// 2026-07-11 — visit_only 판정 (색 판정에서 냉매 등 prefill 잔존 workType 무시).
import { isPureVisitOnly, isAllItemsVisit } from "../utils/visitFeeDetect.js";
import { TimelineDatePicker } from "../components/TimelineDatePicker.jsx";
import { relocationLine } from "../utils/relocation.js";
import { listEngineerSkillsFromDb } from "../lib/engineerSkillsDb.js";
import { AdminPcDateNav, shiftDate } from "./AdminPcDateNav.jsx";
import { adminRescheduleTask, adminReassignTask, clearReassignRequest } from "../lib/adminTaskRpc.js";
import { supabase } from "../lib/supabase.js";
import { useOffDaysInRange } from "../hooks/useOffDaysInRange.js";
import { formatOffDayType, formatOffAlertText } from "../lib/offDaysDb.js";

const START_HOUR    = 5;             // 2026-10-08 — 7 → 5 (새벽 작업이 잘리지 않게)
const END_HOUR      = 24;
const TOTAL_HOURS   = END_HOUR - START_HOUR;  // 19
const LANE_HEIGHT   = 62;            // 2026-10-07 시안 v2 — 줄 높이 키움
const ENGINEER_COL  = 190;           // 2026-10-07 시안 v2 — 이름 16px + 아래 줄
// 2026-06-19 — 시간당 고정폭 (사장님 spec). 컨테이너 fit X → 가로 스크롤.
//   1시간 = 80px → 5~24시 = 19 × 80 = 1520px.
const HOUR_WIDTH       = 80;
const TIME_AREA_WIDTH  = HOUR_WIDTH * TOTAL_HOURS; // 1520
const SNAP_MINUTES  = 30;
const DRAG_THRESHOLD_PX = 5;
const UNASSIGNED_COL = 300;            // 왼쪽 미배정 목록 폭
const FOLD_KEY = "ollit_pc_timeline_fold_v1";   // 묶음 접힘 · "일 없는 기사" 펼침 기억 (기기별)
const DONE_STATUSES = new Set(["완료", "취소", "visit_only", "정산완료"]);

function loadFold() {
  try { const v = JSON.parse(localStorage.getItem(FOLD_KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch (_e) { return {}; }
}
function saveFold(v) {
  try { localStorage.setItem(FOLD_KEY, JSON.stringify(v)); } catch (_e) { /* 저장 실패는 무시 */ }
}
// 작업의 소요 시간(분) — 협력사 타임라인과 같은 표 (SERVICE_DURATION_HOURS)
function taskDurationMin(task) {
  return Math.max(30, Math.round(getTaskDurationHours(task) * 60));
}
function hm(min) {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}
// 지역 묶음(zoneGroups) 판정 — 기사: 지역 글자 / 작업: 주소·동네 글자
const REGION_WORDS = { seoul: ["서울"], gsouth: ["경기남부", "경기 남부"], geast: ["경기동부", "경기 동부"], gnorth: ["경기북부", "경기 북부"], incheon: ["인천"] };
function textInRegion(text, groupKey) {
  if (!groupKey) return true;
  const t = String(text || "");
  if (!t) return false;
  if ((REGION_WORDS[groupKey] || []).some(w => t.includes(w))) return true;
  const g = ZONE_GROUPS.find(x => x.key === groupKey);
  if (!g) return false;
  // 구 이름이 서울·인천에 겹치는 것(서구·중구 등)이 있다 → 인천은 "인천" 글자가 있을 때만, 서울은 인천·경기 글자가 없을 때만 구 이름으로 판단
  if (groupKey === "incheon") return false;
  if (groupKey === "seoul") return !t.includes("인천") && !t.includes("경기") && g.zones.some(z => t.includes(z));
  // 경기: "경기" 라고만 적힌 기사(남부·동부·북부 구분 없음)는 경기 묶음 어디에나 나온다
  if (t.includes("경기") && !/경기\s?(남부|동부|북부)/.test(t) && !g.zones.some(z => t.includes(z))) return true;
  return g.zones.some(z => t.includes(z));
}

// 일정 변경 잠금 상태 (사장님 spec — Mig 144 RPC 와 동일):
//   진행중 / 완료 / 취소 / visit_only / 정산완료.
const LOCKED_STATUSES = new Set(["진행중", "완료", "취소", "visit_only", "정산완료"]);

// 2026-07-09 — leak / install / other 색 누락 사고 정정.
//   getServiceKind → 'leak' / 'install' 반환하는데 여기 매핑 없어 fallback 회색 표시.
//   workTypeColors.js 표준 (세척 파랑 / 냉매 노랑 / 설치 보라 / 누설 빨강 / 그 외 핑크) 과 통일.
// 2026-07-11 — visit_only 판정 통일 (사장님 spec):
//   status='visit_only' 인데 workItems 첫 항목이 '냉매충전' 등이면 getServiceKind 는
//   'refrigerant' 반환 → 노랑 오표시. 접수함 전환 경로가 prefill 값을 안 지우면 재발.
//   → TaskBar 안에서 isPureVisitOnly(task) 우선 검사 → kind='visit' 강제.
const KIND_COLOR = {
  cleaning:    "#0EA5E9",
  refrigerant: "#FFB800",
  install:     "#8B5CF6",
  leak:        "#DC2626",
  visit:       "#FF1B8D",   // 2026-07-11 — 출장·visit_only 전용 핑크.
  other:       "#FF1B8D",
};
const KIND_COLOR_FALLBACK = "#FF1B8D";

// 2026-07-08 — "HH:MM" → 자정 기준 분. 실패 시 null.
function _hmToMinutes(hm) {
  if (!hm || typeof hm !== "string") return null;
  const m = hm.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

// 2026-07-09 — 노랑 (냉매) 만 검정, 나머지 (파랑/보라/빨강/핑크) 는 흰색.
const TEXT_ON_KIND = {
  cleaning:    "#fff",
  refrigerant: "#1A1A1A",
  install:     "#fff",
  leak:        "#fff",
  visit:       "#fff",   // 2026-07-11 — visit 도 핑크 배경이라 흰 글자.
  other:       "#fff",
};
const TEXT_ON_KIND_FALLBACK = "#fff";

export function AdminPcTimelineScreen({ apiTasks = [], apiEngineers = [], onTaskClick, onRefresh }) {
  // 2026-06-20 trace — 메인 컴포넌트 렌더 확인.
  console.log('[AdminPcTimelineScreen RENDER] apiTasks=', apiTasks.length, 'hasOnTaskClick=', !!onTaskClick);
  const [selectedDate, setSelectedDate] = useState(() => todayYmd());

  const today    = todayYmd();
  const isToday  = selectedDate === today;

  // 2026-06-19 — 검색 + 점프 + 강조 (사장님 spec).
  //   매칭: 고객명 / 주소 / 연락처 / 작업번호 — 날짜 무관, 완료/취소 포함.
  //   디바운스 300ms. 결과 클릭 → 해당 날짜로 점프 + 막대 핑크 강조 + 다른 막대
  //   흐림(opacity 0.3) + 가로 스크롤 가운데로.
  //   강조 해제: 검색창을 사용자가 비우거나 날짜를 수동(prev/next/today)으로 바꿀 때.
  const [searchQuery, setSearchQuery]     = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showResults, setShowResults]     = useState(false);
  const [highlightTaskId, setHighlightTaskId] = useState(null);
  const scrollWrapperRef = useRef(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(id);
  }, [searchQuery]);

  const searchResults = useMemo(() => {
    if (!debouncedQuery) return [];
    const q = debouncedQuery.toLowerCase();
    const matched = [];
    for (const t of (apiTasks || [])) {
      if (!t) continue;
      const scheduled = t.scheduledAt || t.scheduled_at;
      if (!scheduled) continue;                  // 일정 없는 작업은 점프 대상 X
      const fields = [
        t.customer, t.customerName, t.고객명,
        t.address, t.fullAddress, t.region,
        t.phone, t.전화번호,
        t.task_no, t.taskNo, t.taskCode,
      ].filter(Boolean).join(" ").toLowerCase();
      // 2026-07-21 — 전화번호 하이픈 무시 매칭 (숫자만 3자리 이상 입력 시).
      const qDigits = q.replace(/\D/g, "");
      const phoneDigits = qDigits.length >= 3
        ? String(t.phone || t.전화번호 || "").replace(/\D/g, "") : "";
      if (fields.includes(q) || (phoneDigits && phoneDigits.includes(qDigits))) matched.push(t);
    }
    matched.sort((a, b) => {
      const aT = new Date(a.scheduledAt || a.scheduled_at).getTime();
      const bT = new Date(b.scheduledAt || b.scheduled_at).getTime();
      return aT - bT;
    });
    return matched.slice(0, 10);
  }, [apiTasks, debouncedQuery]);

  // 검색창을 사용자가 직접 비웠을 때(빈 입력으로 onChange) 강조 해제.
  //   결과 클릭은 검색창 그대로 유지 → 이 effect 안 발화.
  useEffect(() => {
    if (searchQuery === "" && highlightTaskId) {
      setHighlightTaskId(null);
    }
  }, [searchQuery, highlightTaskId]);

  // 날짜 nav (prev/next/today) — 강조 해제 + 검색 드롭다운 닫기.
  const handleManualDate = useCallback((updater) => {
    setSelectedDate(prev => typeof updater === "function" ? updater(prev) : updater);
    setHighlightTaskId(null);
    setShowResults(false);
  }, []);

  // 검색 결과 클릭 → 그 작업 날짜로 점프 + 강조 + 가로 스크롤.
  function handleSelectResult(task) {
    const scheduled = task.scheduledAt || task.scheduled_at;
    if (!scheduled) return;
    const ymd = toKstYmd(scheduled);
    setSelectedDate(ymd);
    setHighlightTaskId(task.id || task.taskCode);
    setShowResults(false);
    // 가로 스크롤 — state 반영 후
    setTimeout(() => {
      const dt = new Date(scheduled);
      const h = dt.getHours();
      const m = dt.getMinutes();
      const taskCenterPx = ENGINEER_COL + (h - START_HOUR + m / 60) * HOUR_WIDTH + (HOUR_WIDTH / 2);
      const wrap = scrollWrapperRef.current;
      if (wrap) {
        const target = taskCenterPx - wrap.clientWidth / 2;
        wrap.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
      }
    }, 80);
  }

  // 2026-06-19 — 현재 시각 표시선 (KST). 1분마다 갱신, 오늘 + 범위 내일 때만 노출.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const nowH = now.getHours();
  const nowM = now.getMinutes();
  const showNowLine = isToday && nowH >= START_HOUR && nowH < END_HOUR;
  const nowPct = showNowLine
    ? (((nowH - START_HOUR) + nowM / 60) / TOTAL_HOURS) * 100
    : 0;
  const nowLabel = `${pad(nowH)}:${pad(nowM)}`;

  // 2026-10-07 — 필터 · 정렬 · 접힘
  const subIdx = useSubcontractorIndex();
  const [catFilter, setCatFilter]       = useState("");      // 종목 key
  const [regionFilter, setRegionFilter] = useState("");      // zoneGroups key
  const [affFilter, setAffFilter]       = useState("");      // "" | "direct" | "sub:<id>"
  const [sortMode, setSortMode]         = useState("count"); // count(오늘 건수 적은 순) | name
  const [showCanceled, setShowCanceled] = useState(false);   // 취소 막대(줄무늬) 표시 — 기본은 숨김(2026-07-09 결정 유지)
  const [fold, setFold] = useState(() => loadFold());
  const toggleFold = useCallback((key) => {
    setFold(prev => { const next = { ...prev, [key]: !prev[key] }; saveFold(next); return next; });
  }, []);
  // 끌어다 놓기 미리보기 — 놓을 자리의 점선 막대 + 말풍선 { laneKey, startMin, durMin, label, tip, bad }
  const [dropPreview, setDropPreview] = useState(null);

  // 협력사가 맡는 종목 (미배정 카드의 "○○로 넘기기") — 종목 code → [협력사 id]
  const [subCats, setSubCats] = useState(() => new Map());
  // 2026-10-07 — 기사별 기술 (기사 코드 → "세척·냉매"). 못 읽으면 빈 표 → 전처럼 지역 · 건수만.
  const [skillsByCode, setSkillsByCode] = useState(() => new Map());
  useEffect(() => {
    let alive = true;
    listEngineerSkillsFromDb().then(res => {
      if (!alive || !res || !res.ok) return;
      const m = new Map();
      for (const sk of (res.skills || [])) {
        const code = String(sk.engineerId || "");
        const name = String(sk.workType || "").replace("냉매충전", "냉매").replace(/_.*$/, "");
        if (!code || !name) continue;
        const set = m.get(code) || new Set();
        set.add(name);
        m.set(code, set);
      }
      const out = new Map();
      for (const [code, set] of m) out.set(code, [...set].slice(0, 4).join("·"));
      setSkillsByCode(out);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    let alive = true;
    listSubcontractorCategories().then(res => {
      if (!alive || !res.ok) return;
      const m = new Map();
      for (const r of (Array.isArray(res.by_sub) ? res.by_sub : [])) {
        if (!m.has(r.code)) m.set(r.code, []);
        m.get(r.code).push(r.subcontractor_id);
      }
      setSubCats(m);
    });
    return () => { alive = false; };
  }, []);

  const engOf = (t) => ({
    eid:   t.assignedEngineerId || t.assigned_engineer_id || t.engineerId || t.engineer_id || null,
    ename: String(t.assignedEngineer || t.engineer || "").trim(),
  });
  const matchCat = useCallback((t) => !catFilter || getCategoryMeta(t).key === catFilter, [catFilter]);

  // 그 날 타임라인에 올라가는 작업 (담당 기사가 있는 것만 — 미배정은 왼쪽 목록).
  //   취소 작업은 기본으로 숨긴다 (2026-07-09 결정). [취소 표시] 를 켜면 줄무늬 막대로 보인다.
  const todayTasks = useMemo(() => {
    return (apiTasks || []).filter(t => {
      if (!t) return false;
      if (isEffectivelyCanceled(t) && !showCanceled) return false;
      const scheduled = t.scheduledAt || t.scheduled_at;
      if (!scheduled) return false;
      if (toKstYmd(scheduled) !== selectedDate) return false;
      const { eid, ename } = engOf(t);
      if (!eid && !ename) return false;
      return matchCat(t);
    });
  }, [apiTasks, selectedDate, showCanceled, matchCat]);

  // 왼쪽 미배정 목록 — 끝나지 않았고 담당 기사가 없는 작업. 협력사로 넘긴 작업은 그 협력사 관리자 몫이라 뺀다.
  const unassigned = useMemo(() => {
    const list = (apiTasks || []).filter(t => {
      if (!t || isEffectivelyCanceled(t) || DONE_STATUSES.has(t.status) || t.status === "진행중") return false;
      const { eid, ename } = engOf(t);
      if (eid || ename) return false;
      if (t.subcontractorId || t.subcontractor_id) return false;
      if (!matchCat(t)) return false;
      if (regionFilter && !textInRegion(`${t.address || ""} ${t.region || ""} ${t.district || ""}`, regionFilter)) return false;
      return true;
    });
    const when = (t) => {
      const at = t.scheduledAt || t.scheduled_at;
      if (at) return new Date(at).getTime();
      if (t.requestedDate) return new Date(`${t.requestedDate}T${/^\d{1,2}:\d{2}/.test(t.requestedTime || "") ? t.requestedTime.slice(0, 5).padStart(5, "0") : "23:59"}:00`).getTime();
      return Infinity;
    };
    return list.sort((a, b) => when(a) - when(b));
  }, [apiTasks, matchCat, regionFilter]);

  // 2026-10-07 시안 v2 — 협력사로 넘겼고 기사가 아직 없는 작업 (왼쪽 목록 둘째 칸, 보기 전용)
  const subPending = useMemo(() => {
    const when = (t) => {
      const at = t.scheduledAt || t.scheduled_at;
      if (at) return new Date(at).getTime();
      if (t.requestedDate) return new Date(`${t.requestedDate}T${/^\d{1,2}:\d{2}/.test(t.requestedTime || "") ? t.requestedTime.slice(0, 5).padStart(5, "0") : "23:59"}:00`).getTime();
      return Infinity;
    };
    return (apiTasks || []).filter(t => {
      if (!t || isEffectivelyCanceled(t) || DONE_STATUSES.has(t.status) || t.status === "진행중") return false;
      if (!(t.subcontractorId || t.subcontractor_id)) return false;
      const { eid, ename } = engOf(t);
      if (eid || ename) return false;
      if (!matchCat(t)) return false;
      if (regionFilter && !textInRegion(`${t.address || ""} ${t.region || ""} ${t.district || ""}`, regionFilter)) return false;
      return true;
    }).sort((a, b) => when(a) - when(b));
  }, [apiTasks, matchCat, regionFilter]);

  // 달력의 "작업 있는 날" 점 — 이미 읽어 온 작업 목록의 일정 날짜 (취소 제외)
  const markedDates = useMemo(() => {
    const set = new Set();
    for (const t of (apiTasks || [])) {
      if (!t || isEffectivelyCanceled(t)) continue;
      const at = t.scheduledAt || t.scheduled_at;
      if (at) set.add(toKstYmd(at));
    }
    return set;
  }, [apiTasks]);

  // 2026-07-08 — 그 날 전 기사 휴무 fetch (name → offs[]).
  const { byNameDate: offByNameDate } = useOffDaysInRange(selectedDate, selectedDate);
  const offsByLaneName = useMemo(() => {
    const m = new Map();
    for (const [name, inner] of offByNameDate.entries()) {
      const arr = inner.get(selectedDate) || [];
      if (arr.length > 0) m.set(name, arr);
    }
    return m;
  }, [offByNameDate, selectedDate]);

  // 줄(기사) — 오늘 작업이 있는 기사 + 오늘 일 없는 기사(전체 기사 목록에서). 묶음 = 직영 / 협력사별.
  const { groups, allLanes } = useMemo(() => {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pickUuid = (...c) => { for (const v of c) if (typeof v === "string" && UUID_RE.test(v)) return v; return null; };
    const engs = (apiEngineers || []).filter(e => e && e.name);
    const findEng = (eid, ename) =>
      (eid && engs.find(e => e.userId === eid || e.id === eid || e.engineerId === eid))
      || (ename && engs.find(e => e.name === ename)) || null;

    const byKey = new Map();
    const laneFor = (eng, eid, ename, firstTask) => {
      const name = (eng && eng.name) || ename || "";
      const key = (eng && (eng.userId || eng.id)) || eid || name;
      if (!key) return null;
      if (!byKey.has(key)) {
        const subId = subcontractorOfEngineer(eng || name, subIdx)
          || (firstTask && (firstTask.subcontractorId || firstTask.subcontractor_id)) || null;
        byKey.set(key, {
          key, name, tasks: [],
          eid: (eng && eng.id) || eid || null,
          engineerUserId: pickUuid(eng && eng.userId, eng && eng.user_id, eid,
            firstTask && firstTask.assignedEngineerId, firstTask && firstTask.assigned_engineer_id),
          engineerCode: (eng && (eng.engineerId || eng.id)) || (eid && !UUID_RE.test(eid) ? eid : null),
          region: (eng && eng.region) || "",
          // 2026-10-07 — 기사 줄 아래에 기술 표시 ("설치 · 서울 · 1건")
          skillLabel: skillsByCode.get(String((eng && (eng.engineerId || eng.id)) || "")) || "",
          active: eng ? eng.active !== false : true,
          subId,
          groupKey: subId ? `sub:${subId}` : "direct",
          readOnly: !!subId,                       // 협력사 묶음 = 보기 전용 (배정은 협력사 관리자)
        });
      }
      return byKey.get(key);
    };

    for (const t of todayTasks) {
      const { eid, ename } = engOf(t);
      const lane = laneFor(findEng(eid, ename), eid, ename, t);
      if (lane) lane.tasks.push(t);
    }
    // 오늘 일 없는 기사도 줄로 (쉬는 기사 = 비활성 계정은 뺀다)
    for (const e of engs) {
      if (e.active === false) continue;
      laneFor(e, null, e.name, null);
    }

    let lanes = [...byKey.values()];
    if (regionFilter) lanes = lanes.filter(l => l.tasks.length > 0 ? (textInRegion(l.region, regionFilter) || !l.region) : textInRegion(l.region, regionFilter));
    if (affFilter)    lanes = lanes.filter(l => l.groupKey === affFilter);
    const live = (l) => l.tasks.filter(t => !isEffectivelyCanceled(t)).length;
    lanes.sort((a, b) => sortMode === "name"
      ? a.name.localeCompare(b.name, "ko")
      : (live(a) - live(b)) || a.name.localeCompare(b.name, "ko"));

    const gmap = new Map();
    for (const l of lanes) {
      if (!gmap.has(l.groupKey)) {
        gmap.set(l.groupKey, {
          key: l.groupKey, subId: l.subId, readOnly: l.readOnly,
          label: l.subId ? subcontractorName(l.subId, subIdx) : "직영",
          busy: [], idle: [], repeatOff: [], taskCount: 0,
        });
      }
      const g = gmap.get(l.groupKey);
      // 2026-10-07 (31) — 휴무 종류별 처리
      //   반복(정기) 휴무 + 오늘 작업 0건  → 줄을 숨긴다 (묶음 머리에 "정기 휴무 n명" 숫자만). 끌어다 놓을 대상도 아니다.
      //   반복 휴무인데 오늘 작업이 있음   → 줄 표시 + "⚠ 휴무일 작업" 배지
      //   하루·기간 휴무 + 오늘 작업 0건   → "오늘 일 없는 기사" 접힘 목록 안 (빗금 띠는 그대로)
      //   시간 휴무                        → 지금처럼 바로 보이는 줄
      const offs = offsByLaneName.get(l.name) || [];
      const repeatOff = offs.some(o => o.type === "repeat");
      const hourlyOff = offs.some(o => o.type === "hourly" || o.type === "휴무부분");
      if (repeatOff && l.tasks.length === 0) { g.repeatOff.push(l.name); continue; }
      l.offWork = repeatOff && live(l) > 0;
      if (l.tasks.length > 0 || hourlyOff) g.busy.push(l); else g.idle.push(l);
      g.taskCount += live(l);
    }
    // 2026-10-07 (30) — 협력사로 넘겼는데 담당 기사가 아직 없는 작업: 그 협력사 묶음 맨 위 "기사 미정 n건" 줄 (보기 전용)
    for (const t of (apiTasks || [])) {
      if (!t) continue;
      const sid = t.subcontractorId || t.subcontractor_id;
      if (!sid) continue;
      const { eid, ename } = engOf(t);
      if (eid || ename) continue;
      if (isEffectivelyCanceled(t) || DONE_STATUSES.has(t.status) || !matchCat(t)) continue;
      const gk = `sub:${sid}`;
      if (affFilter && affFilter !== gk) continue;
      if (!gmap.has(gk)) {
        gmap.set(gk, { key: gk, subId: sid, readOnly: true, label: subcontractorName(sid, subIdx), busy: [], idle: [], repeatOff: [], taskCount: 0 });
      }
      const g = gmap.get(gk);
      (g.pending || (g.pending = [])).push(t);
    }
    const glist = [...gmap.values()].sort((a, b) => (a.subId ? 1 : 0) - (b.subId ? 1 : 0) || a.label.localeCompare(b.label, "ko"));
    return { groups: glist, allLanes: lanes };
  }, [todayTasks, apiTasks, apiEngineers, subIdx, regionFilter, affFilter, sortMode, offsByLaneName, matchCat, skillsByCode]);

  const laneCount = allLanes.length;
  const busyCount = allLanes.filter(l => l.tasks.length > 0).length;

  // 필터 선택지 — 종목: 오늘 막대 + 미배정에 실제로 있는 것 / 소속: 직영 + 협력사
  const catOptions = useMemo(() => {
    const seen = new Map();
    for (const t of (apiTasks || [])) {
      if (!t) continue;
      const at = t.scheduledAt || t.scheduled_at;
      const { eid, ename } = engOf(t);
      const mine = (at && toKstYmd(at) === selectedDate) || (!eid && !ename && !DONE_STATUSES.has(t.status));
      if (!mine) continue;
      const m = getCategoryMeta(t);
      if (!seen.has(m.key)) seen.set(m.key, m);
    }
    return [...seen.values()];
  }, [apiTasks, selectedDate]);
  const subOptions = useMemo(() => [...subIdx.names.values()].filter(x => x.active !== false), [subIdx]);

  // 드래그 드롭 → 확인 모달.
  //   confirmInfo = { task, oldTime, newTime, newIso, onAccept, onCancel } | null
  const [confirmInfo, setConfirmInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  // 토스트 — { type: 'success' | 'error', message }
  const [toast, setToast] = useState(null);
  function showToast(type, message) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }

  // TaskBar 가 드래그 종료 시 호출.
  //   같은 lane → 시간만 변경 (adminRescheduleTask).
  //   다른 lane → 재배정 (adminReassignTask) — 기사 + 일정 동시.
  //   겹침 검사: 도착 lane(target) 의 활성 막대 기준 (사장님 spec).
  function handleTaskDragCommit({
    task, sourceLaneKey, targetLaneKey,
    oldIso, newIso, oldTime, newTime,
    newMinutes, durationMinutes,
    siblings, laneName,
    onAcceptUI, onCancelUI,
    isAssign = false,
  }) {
    const isReassign = !!isAssign || !!(targetLaneKey && sourceLaneKey && targetLaneKey !== sourceLaneKey);

    // 도착 lane 정보 lookup (재배정 시 새 기사 + target siblings 추출)
    let targetLane = null;
    let newEngineerUserId = null;     // ← UUID (RPC 인자)
    let newEngineerCode   = null;     // ← code (UUID lookup 실패 시 supabase 조회용)
    let newEngineerName   = laneName;
    let targetSiblings    = siblings || [];
    if (isReassign) {
      targetLane = allLanes.find(l => l.key === targetLaneKey);
      if (targetLane && targetLane.readOnly) {
        showToast("error", `${subcontractorName(targetLane.subId, subIdx)} 줄은 보기 전용입니다 — 배정은 ${subcontractorName(targetLane.subId, subIdx)} 관리자가 합니다`);
        onCancelUI && onCancelUI();
        return;
      }
      if (!targetLane) {
        showToast("error", "대상 기사 lane 식별 실패 — 새로고침 후 다시 시도");
        onCancelUI && onCancelUI();
        return;
      }
      // engineerUserId(UUID) 또는 engineerCode 중 하나라도 있으면 진행 (둘 다 없으면 거부).
      //   handleConfirmYes 가 UUID 없으면 code → supabase users 조회로 채움.
      if (!targetLane.engineerUserId && !targetLane.engineerCode && !targetLane.eid) {
        showToast("error", `'${targetLane.name}' 기사 ID 식별 실패 — 새로고침 후 다시 시도`);
        onCancelUI && onCancelUI();
        return;
      }
      newEngineerUserId = targetLane.engineerUserId || null;
      newEngineerCode   = targetLane.engineerCode  || (targetLane.eid && !targetLane.engineerUserId ? targetLane.eid : null);
      newEngineerName   = targetLane.name;
      const tid         = task.id || task.taskCode;
      targetSiblings    = targetLane.tasks.filter(t => (t.id || t.taskCode) !== tid);
    }

    // 겹침 검사 — target lane 기준 (재배정이면 도착 lane, 시간만이면 source lane)
    const newStart = Number(newMinutes) || 0;
    const dur      = Number(durationMinutes) || 60;
    const newEnd   = newStart + dur;
    const inactive = new Set(["완료", "취소", "visit_only"]);

    const conflicts = [];
    for (const t of (targetSiblings || [])) {
      if (inactive.has(t.status)) continue;
      const at = t.scheduledAt || t.scheduled_at;
      if (!at) continue;
      if (toKstYmd(at) !== selectedDate) continue;
      const dt = new Date(at);
      if (isNaN(dt.getTime())) continue;
      const s = dt.getHours() * 60 + dt.getMinutes();
      const e = s + taskDurationMin(t);          // 상대 막대의 실제 소요 시간
      if (newStart < e && s < newEnd) {
        conflicts.push({ task: t, start: s });
      }
    }
    conflicts.sort((a, b) => a.start - b.start);

    let conflict = null;
    if (conflicts.length > 0) {
      const first = conflicts[0];
      const timeStr = `${pad(Math.floor(first.start / 60))}:${pad(first.start % 60)}`;
      conflict = {
        laneName: newEngineerName,
        timeStr,
        extra: conflicts.length - 1,
      };
    }

    setDropPreview(null);
    setConfirmInfo({
      task,
      isAssign: !!isAssign,                 // 왼쪽 미배정 카드를 끌어다 놓은 경우
      isReassign: isReassign || !!isAssign,
      oldEngineerName: laneName,
      newEngineerName,
      newEngineerUserId,     // UUID 또는 null
      newEngineerCode,       // code 또는 null
      oldIso,
      newIso,
      oldTime,
      newTime,
      conflict,
      onAcceptUI,
      onCancelUI,
    });
  }

  // 화면 좌표 → 놓을 줄 · 시각 (30분 단위). 줄 밖이면 null, 보기 전용 줄이면 { ro: true }.
  function locateDrop(x, y) {
    const el = document.elementFromPoint(x, y);
    const laneEl = el && el.closest ? el.closest("[data-lane-key]") : null;
    if (!laneEl) return null;
    const lane = allLanes.find(l => l.key === laneEl.dataset.laneKey);
    if (!lane) return null;
    if (lane.readOnly) return { ro: true, lane };
    const rect = laneEl.getBoundingClientRect();
    if (rect.width <= 0) return null;
    let min = START_HOUR * 60 + ((x - rect.left) / rect.width) * TOTAL_HOURS * 60;
    min = Math.round(min / SNAP_MINUTES) * SNAP_MINUTES;
    min = Math.max(START_HOUR * 60, Math.min((END_HOUR - 1) * 60 + 30, min));
    return { lane, min };
  }
  function handleCardDragMove(task, x, y) {
    const hit = locateDrop(x, y);
    if (!hit) { setDropPreview(null); return; }
    if (hit.ro) {
      setDropPreview({ laneKey: hit.lane.key, bad: true, tip: `🔒 보기 전용 — 배정은 ${subcontractorName(hit.lane.subId, subIdx)} 관리자` });
      return;
    }
    setDropPreview({
      laneKey: hit.lane.key, startMin: hit.min, durMin: taskDurationMin(task),
      label: `${getCategoryMeta(task).icon} ${task.customer || ""}`,
      tip: `← ${hm(hit.min)} ${hit.lane.name} 배정 (놓으면 확인창)`,
    });
  }
  function handleCardDrop(task, x, y) {
    const hit = locateDrop(x, y);
    setDropPreview(null);
    if (!hit) return;
    if (hit.ro) {
      showToast("error", `${subcontractorName(hit.lane.subId, subIdx)} 줄에는 놓을 수 없습니다 — 배정은 ${subcontractorName(hit.lane.subId, subIdx)} 관리자가 합니다`);
      return;
    }
    const at = task.scheduledAt || task.scheduled_at;
    const oldTime = at ? `${toKstYmd(at) === selectedDate ? "" : toKstYmd(at).slice(5).replace("-", "/") + " "}${hm(new Date(at).getHours() * 60 + new Date(at).getMinutes())}`
      : (task.requestedTime ? `희망 ${task.requestedTime}` : "시간 미정");
    const newDate = new Date(`${selectedDate}T${hm(hit.min)}:00`);
    handleTaskDragCommit({
      task, isAssign: true,
      sourceLaneKey: "__unassigned__", targetLaneKey: hit.lane.key,
      oldIso: at || null, newIso: newDate.toISOString(),
      oldTime, newTime: hm(hit.min),
      newMinutes: hit.min, durationMinutes: taskDurationMin(task),
      siblings: [], laneName: "미배정",
    });
  }
  async function handleHandOver(task, subId) {
    const name = subcontractorName(subId, subIdx);
    if (!window.confirm(`이 작업을 ${name}로 넘깁니다.\n배정은 ${name} 관리자가 합니다.\n\n${task.customer || ""}`)) return;
    const res = await adminAssignTaskToSubcontractor(task.id, subId);
    if (!res.ok) { showToast("error", res.error || "넘기지 못했습니다"); return; }
    showToast("success", `${task.customer || "작업"} → ${name}로 넘김`);
    if (typeof onRefresh === "function") onRefresh();
  }
  // 종목을 맡는 협력사 (미배정 카드의 "○○로 넘기기") — 없으면 null
  const handOverTarget = (task) => {
    const m = getCategoryMeta(task);
    for (const code of [m.key, ...(m.codes || [])]) {
      const ids = subCats.get(code);
      if (ids && ids.length > 0) return ids[0];
    }
    return null;
  };

  async function handleConfirmYes() {
    if (!confirmInfo || busy) return;
    setBusy(true);
    const { task, isAssign, isReassign, newEngineerUserId, newEngineerCode, newEngineerName, newIso, newTime, onAcceptUI, onCancelUI } = confirmInfo;
    try {
      let res;
      if (isReassign) {
        // 2026-06-19 — UUID 우선, 없으면 code → supabase users 조회 fallback.
        //   apiEngineers 시트 캐시가 user_id(UUID) 없는 경우 안전망.
        let engineerUuid = newEngineerUserId;
        if (!engineerUuid && newEngineerCode) {
          const { data, error } = await supabase
            .from("users")
            .select("id")
            .eq("code", newEngineerCode)
            .maybeSingle();
          if (!error && data?.id) {
            engineerUuid = data.id;
          }
        }
        if (!engineerUuid) {
          showToast("error", `'${newEngineerName}' 기사 UUID 조회 실패`);
          onCancelUI && onCancelUI();
          setConfirmInfo(null);
          return;
        }
        if (isAssign) {
          // 미배정 카드를 끌어다 놓은 경우 — 기존 "배정" 저장(기사 + 상태 '배정' 을 한 번에)을 그대로 쓴다.
          //   서버의 상태 푸시(Mig 203)가 이 순간 담당 기사에게 "📥 작업 배정 완료" 를 보낸다.
          //   이어서 일정을 넣고 '확정' 으로 바꾼다 (배정 + 일정 확정).
          res = await assignEngineerDb(task.id, engineerUuid);
          if (res && res.ok) {
            const ur = await updateTaskDb(task.id, { scheduledAt: newIso, status: "확정" });
            if (!ur?.ok) res = { ok: false, error: `배정은 됐지만 일정 확정에 실패했습니다 — ${ur?.error || ""}` };
          }
        } else {
          res = await adminReassignTask(task.id, engineerUuid, newIso);
        }
      } else {
        res = await adminRescheduleTask(task.id, newIso);
      }
      if (!res || res.ok === false) {
        showToast("error", `변경 실패 — ${res?.error || "알 수 없는 오류"}`);
        onCancelUI && onCancelUI();
        setConfirmInfo(null);
        return;
      }
      // 2026-07-25 — 타임라인에서 기사를 바꿔도 '재배정 요청' 목록에 남던 버그.
      //   Mig 145 admin_reassign_task 는 기사/일정만 갱신하고
      //   category_data.reassignRequest 는 건드리지 않음 → 여기서 해제.
      //   시간만 끄는 단순 드래그(isReassign=false)에는 적용 X — 잘못 끌었을 때
      //   요청이 소리 없이 사라지면 안 되므로.
      if (isReassign && !isAssign) {
        try {
          const cr = await clearReassignRequest(task.id);
          if (!cr?.ok) console.warn("[clearReassignRequest]", cr?.error);
        } catch (e) {
          console.warn("[clearReassignRequest]", e?.message || e);
        }
      }
      const msg = isAssign
        ? `${task.customer || "작업"} 배정 완료 (${newEngineerName} · ${newTime})`
        : isReassign
        ? `${task.customer || "작업"} 재배정 완료 (${newEngineerName} · ${newTime})`
        : `${task.customer || "작업"} 일정 변경 완료 (${newTime})`;
      showToast("success", msg);
      onAcceptUI && onAcceptUI();
      setConfirmInfo(null);
      if (typeof onRefresh === "function") onRefresh();
    } catch (err) {
      console.error("[handleConfirmYes]", err);
      showToast("error", "변경 실패 — 네트워크 오류");
      onCancelUI && onCancelUI();
      setConfirmInfo(null);
    } finally {
      setBusy(false);
    }
  }

  function handleConfirmNo() {
    if (busy) return;
    if (confirmInfo && typeof confirmInfo.onCancelUI === "function") {
      confirmInfo.onCancelUI();
    }
    setConfirmInfo(null);
  }

  const selStyle = {
    border: "1px solid var(--border)", borderRadius: 9, padding: "6px 10px", fontSize: 13, fontWeight: 600,
    background: "var(--bg-elevated)", color: "var(--text-primary)", fontFamily: "inherit", cursor: "pointer", minHeight: 34,
  };
  return (
    <div style={{ display: "flex", alignItems: "stretch", minHeight: "100%" }}>
      {/* 왼쪽 미배정 목록 (타임라인 맨 위 "(미배정)" 줄 대신) */}
      <UnassignedPanel
        tasks={unassigned}
        subTasks={subPending}
        subLabel={subOptions.length === 1 ? subOptions[0].name : "협력사"}
        selectedDate={selectedDate}
        onOpen={onTaskClick}
        onDragMove={handleCardDragMove}
        onDrop={handleCardDrop}
        onDragCancel={() => setDropPreview(null)}
        handOverTarget={handOverTarget}
        handOverName={(id) => subcontractorName(id, subIdx)}
        onHandOver={handleHandOver}
      />

      <div style={{ flex: 1, minWidth: 0, padding: "16px 18px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.4px", marginRight: 4 }}>타임라인</div>
          {/* 2026-10-07 시안 v2 — 날짜를 누르면 달력(작업 있는 날 점), 옆에 어제·오늘·내일·모레 */}
          <TimelineDatePicker
            selectedDate={selectedDate}
            today={today}
            onChange={(ymd) => handleManualDate(ymd)}
            markedDates={markedDates}
          />
          <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>
            기사 {laneCount}명 중 {busyCount}명 · {todayTasks.filter(t => !isEffectivelyCanceled(t)).length}건
          </span>
          <span style={{ flex: 1 }}/>
          {/* 2026-06-19 — 검색창 */}
          <SearchBox
            query={searchQuery}
            onQueryChange={setSearchQuery}
            results={searchResults}
            showResults={showResults}
            setShowResults={setShowResults}
            onSelect={handleSelectResult}
          />
        </div>

        {/* 필터 · 정렬 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={selStyle} aria-label="종목">
            <option value="">종목 전체</option>
            {catOptions.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
          </select>
          <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)} style={selStyle} aria-label="지역">
            <option value="">지역 전체</option>
            {ZONE_GROUPS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
          </select>
          <select value={affFilter} onChange={e => setAffFilter(e.target.value)} style={selStyle} aria-label="소속">
            <option value="">소속 전체</option>
            <option value="direct">직영</option>
            {subOptions.map(x => <option key={x.id} value={`sub:${x.id}`}>{x.name}</option>)}
          </select>
          <select value={sortMode} onChange={e => setSortMode(e.target.value)} style={selStyle} aria-label="정렬">
            <option value="count">정렬: 오늘 건수 적은 순</option>
            <option value="name">정렬: 이름순</option>
          </select>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer" }}>
            <input type="checkbox" checked={showCanceled} onChange={e => setShowCanceled(e.target.checked)}/> 취소 표시
          </label>
          {(catFilter || regionFilter || affFilter) && (
            <button type="button" onClick={() => { setCatFilter(""); setRegionFilter(""); setAffFilter(""); }} style={{ ...selStyle, color: "var(--accent, #FF1B8D)", fontWeight: 700 }}>필터 지우기</button>
          )}
        </div>

        <TimeAxisView
          wrapperRef={scrollWrapperRef}
          groups={groups}
          fold={fold}
          onToggleFold={toggleFold}
          offsByLaneName={offsByLaneName}
          onTaskClick={onTaskClick}
          onTaskDragCommit={handleTaskDragCommit}
          onDragPreview={(pv) => {
            if (!pv) { setDropPreview(null); return; }
            const lane = allLanes.find(l => l.key === pv.laneKey);
            setDropPreview({
              ...pv,
              tip: lane ? (pv.cross ? `← ${hm(pv.startMin)} ${lane.name} 배정 (놓으면 확인창)` : `${hm(pv.startMin)} 로 변경 (놓으면 확인창)`) : "",
            });
          }}
          dropPreview={dropPreview}
          showNowLine={showNowLine}
          nowPct={nowPct}
          nowLabel={nowLabel}
          highlightTaskId={highlightTaskId}
        />
      </div>

      {confirmInfo && (
        <ConfirmDialog
          info={confirmInfo}
          busy={busy}
          onYes={handleConfirmYes}
          onNo={handleConfirmNo}
        />
      )}

      {toast && (
        <div style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          padding: "12px 16px",
          background: toast.type === "success" ? "rgba(16,185,129,0.95)" : "rgba(239,68,68,0.95)",
          color: "#fff",
          borderRadius: 10,
          fontSize: 13, fontWeight: 700,
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          zIndex: 1000,
          fontFamily: "inherit",
        }}>{toast.message}</div>
      )}
    </div>
  );
}

function ConfirmDialog({ info, busy, onYes, onNo }) {
  const customer = info.task.customer || info.task.고객명 || "작업";
  const headerLabel = info.isAssign ? "📌 배정 확인" : info.isReassign ? "🔄 재배정 확인" : "📅 일정 변경 확인";
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: 20,
    }}>
      <div style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: "20px 24px",
        maxWidth: 440,
        width: "100%",
        fontFamily: "inherit",
        boxShadow: "0 12px 48px rgba(0,0,0,0.35)",
      }}>
        <div style={{
          fontSize: 14, fontWeight: 700,
          color: "var(--text-secondary)",
          marginBottom: 6,
        }}>{headerLabel}</div>
        <div style={{
          fontSize: 16, fontWeight: 800,
          color: "var(--text-primary)",
          marginBottom: 14,
          letterSpacing: "-0.2px",
        }}>{customer}</div>
        {info.isReassign && (
          <div style={{
            fontSize: 14,
            color: "var(--text-primary)",
            marginBottom: 8,
            fontVariantNumeric: "tabular-nums",
          }}>
            <span style={{ color: "var(--text-secondary)" }}>{info.oldEngineerName || "기존"}</span>
            <span style={{ margin: "0 8px", color: "var(--text-secondary)" }}>→</span>
            <span style={{ color: "#8B5CF6", fontWeight: 800 }}>{info.newEngineerName || "—"}</span>
            <span style={{ marginLeft: 8, color: "var(--text-secondary)" }}>기사</span>
          </div>
        )}
        <div style={{
          fontSize: 14,
          color: "var(--text-primary)",
          marginBottom: info.conflict ? 12 : 18,
          fontVariantNumeric: "tabular-nums",
        }}>
          <span style={{ color: "var(--text-secondary)" }}>{info.oldTime}</span>
          <span style={{ margin: "0 8px", color: "var(--text-secondary)" }}>→</span>
          <span style={{ color: "#FF1B8D", fontWeight: 800 }}>{info.newTime}</span>
          <span style={{ marginLeft: 8, color: "var(--text-secondary)" }}>{info.isAssign ? "에 배정하고 일정을 확정할까요?" : "으로 변경할까요?"}</span>
        </div>
        {info.conflict && (
          <div style={{
            background: "rgba(255, 184, 0, 0.12)",
            border: "1px solid rgba(255, 184, 0, 0.55)",
            color: "#A06400",
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 12, fontWeight: 700,
            marginBottom: 16,
            lineHeight: 1.45,
          }}>
            ⚠️ {info.conflict.laneName} {info.conflict.timeStr} 시간대에 이미 작업 있음
            {info.conflict.extra > 0 && ` 외 ${info.conflict.extra}건`}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onNo}
            disabled={busy}
            style={{
              minHeight: 40,
              padding: "8px 16px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              borderRadius: 8,
              fontSize: 13, fontWeight: 700,
              cursor: busy ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              opacity: busy ? 0.6 : 1,
            }}
          >취소</button>
          <button
            type="button"
            onClick={onYes}
            disabled={busy}
            style={{
              minHeight: 40,
              padding: "8px 18px",
              background: "#FF1B8D",
              border: "none",
              color: "#fff",
              borderRadius: 8,
              fontSize: 13, fontWeight: 800,
              cursor: busy ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              opacity: busy ? 0.7 : 1,
            }}
          >{busy ? (info.isAssign ? "배정 중…" : "변경 중…") : (info.isAssign ? "배정" : "변경")}</button>
        </div>
      </div>
    </div>
  );
}

function TimeAxisView({ wrapperRef, groups, fold, onToggleFold, offsByLaneName, onTaskClick, onTaskDragCommit, onDragPreview, dropPreview, showNowLine, nowPct, nowLabel, highlightTaskId }) {
  const [offTip, setOffTip] = useState(null);      // 정기 휴무 이름 말풍선이 열린 묶음 key
  if (groups.length === 0) {
    return (
      <div style={{
        padding: "60px 20px",
        textAlign: "center",
        color: "var(--text-secondary)",
        fontSize: 13, fontWeight: 600,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 14,
      }}>조건에 맞는 기사가 없습니다</div>
    );
  }
  const renderLane = (lane, idle, alt = false) => (
    <Lane
      key={lane.key}
      lane={lane}
      idle={idle}
      alt={alt}
      offs={offsByLaneName.get(lane.name) || []}
      onTaskClick={onTaskClick}
      onTaskDragCommit={onTaskDragCommit}
      onDragPreview={onDragPreview}
      dropPreview={dropPreview && dropPreview.laneKey === lane.key ? dropPreview : null}
      highlightTaskId={highlightTaskId}
    />
  );
  // 묶음 머리 · 접힌 줄 — 두 칸을 다 차지하고, 가로로 밀어도 글자는 왼쪽에 붙어 있다
  const fullRow = (key, style, children, onClick) => (
    <div key={key} onClick={onClick} style={{
      gridColumn: "1 / -1", borderBottom: "1px solid var(--border)", cursor: onClick ? "pointer" : "default", ...style,
    }}>
      <div style={{ position: "sticky", left: 0, display: "inline-flex", alignItems: "center", gap: 8, height: "100%", padding: "0 14px", boxSizing: "border-box", maxWidth: "min(100%, 900px)" }}>
        {children}
      </div>
    </div>
  );

  return (
    <div
      ref={wrapperRef}
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        overflowX: "auto",         // 2026-06-19 — 가로 스크롤 (사장님 spec)
        overflowY: "hidden",
        position: "relative",
      }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: `${ENGINEER_COL}px ${TIME_AREA_WIDTH}px`,
        width: ENGINEER_COL + TIME_AREA_WIDTH,
      }}>
        <div style={{
          padding: "10px 14px",
          background: "var(--bg-elevated)",
          borderRight: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          fontSize: 11, fontWeight: 700,
          color: "var(--text-secondary)",
          letterSpacing: 0.5,
          // 가로 스크롤 시 기사 컬럼 헤더 고정.
          position: "sticky",
          left: 0,
          zIndex: 3,
        }}>기사</div>

        <div style={{
          borderBottom: "1px solid var(--border)",
          display: "flex",
          height: 34,
        }}>
          {Array.from({ length: TOTAL_HOURS }).map((_, i) => {
            const hour = START_HOUR + i;
            return (
              <div key={hour} style={{
                flex: 1,
                borderRight: i < TOTAL_HOURS - 1 ? "1px solid var(--border)" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11, fontWeight: 700,
                color: "var(--text-secondary)",
                boxSizing: "border-box",
              }}>{hour}시</div>
            );
          })}
        </div>

        {groups.map(g => {
          const closed = !!fold[`g:${g.key}`];
          const idleOpen = !!fold[`i:${g.key}`];
          return [
            fullRow(`h:${g.key}`, {
              // 2026-10-07 시안 v2 — 소속 색 띠 + 왼쪽 굵은 선 (직영 분홍 / 협력사 보라)
              height: 46, fontSize: 16, fontWeight: 800, color: "var(--text-primary)", position: "relative", zIndex: 4,
              background: g.readOnly
                ? "linear-gradient(90deg, rgba(139,92,246,0.20), rgba(139,92,246,0.02))"
                : "linear-gradient(90deg, rgba(233,24,96,0.18), rgba(233,24,96,0.02))",
              borderLeft: `5px solid ${g.readOnly ? "#8B5CF6" : "#E91860"}`,
            }, (
              <>
                <span style={{ width: 12, fontSize: 12 }}>{closed ? "▶" : "▼"}</span>
                <span>{g.label}</span>
                <small style={{ fontWeight: 600, color: "var(--text-secondary)", fontSize: 13 }}>{g.busy.length + g.idle.length}명 · 오늘 {g.taskCount}건{g.pending && g.pending.length > 0 ? ` · 기사 미정 ${g.pending.length}건` : ""}</small>
                {g.repeatOff.length > 0 && (
                  <span style={{ position: "relative", marginLeft: 12 }}>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setOffTip(v => v === g.key ? null : g.key); }} style={{
                      border: "none", cursor: "pointer", fontFamily: "inherit", background: "rgba(0,0,0,0.28)", borderRadius: 8, padding: "4px 9px",
                      fontSize: 12, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap",
                    }}>정기 휴무 {g.repeatOff.length}명</button>
                    {offTip === g.key && (
                      <span onClick={(e) => { e.stopPropagation(); setOffTip(null); }} style={{
                        position: "absolute", top: 30, left: 0, zIndex: 80, background: "#1A1A1A", color: "#fff",
                        fontSize: 12, fontWeight: 600, padding: "8px 11px", borderRadius: 8, whiteSpace: "nowrap",
                        boxShadow: "0 4px 14px rgba(0,0,0,0.35)", lineHeight: 1.6, cursor: "pointer",
                      }}>
                        <b style={{ display: "block", fontWeight: 800 }}>🏖️ 오늘 정기 휴무</b>
                        {g.repeatOff.join(", ")}
                      </span>
                    )}
                  </span>
                )}
                {g.readOnly && (
                  <span style={{ marginLeft: 12, fontSize: 12, fontWeight: 700, color: "var(--text-primary)", background: "rgba(0,0,0,0.28)", padding: "4px 9px", borderRadius: 8, whiteSpace: "nowrap" }}>
                    🔒 보기 전용 · 배정은 {g.label} 관리자
                  </span>
                )}
              </>
            ), () => onToggleFold(`g:${g.key}`)),
            // "기사 미정" 작업은 왼쪽 목록의 "배정 대기" 칸으로 옮겼다 (시안 v2)
            ...(closed ? [] : g.busy.map((l, i) => renderLane(l, false, i % 2 === 1))),
            ...(closed || g.idle.length === 0 ? [] : [
              fullRow(`f:${g.key}`, { height: 40, background: "var(--bg-secondary)", fontSize: 13.5, fontWeight: 600, color: "var(--text-secondary)", position: "relative", zIndex: 4, borderTop: "1px dashed var(--border)" }, (
                <>
                  <span style={{ width: 12 }}>{idleOpen ? "▾" : "▸"}</span>
                  <span>
                    <b style={{ color: "var(--text-primary)" }}>오늘 일 없는 {g.label} 기사 {g.idle.length}명</b>
                    {!idleOpen && !g.readOnly ? " · 펼치면 끌어다 배정 가능" : ""}
                  </span>
                </>
              ), () => onToggleFold(`i:${g.key}`)),
              ...(idleOpen ? g.idle.map((l, i) => renderLane(l, true, i % 2 === 1)) : []),
            ]),
          ];
        })}
      </div>

      {showNowLine && (
        <div style={{
          position: "absolute",
          top: 0, bottom: 0,
          // 2026-06-19 — 고정 px 폭 기반 (nowPct 폐기, ENGINEER_COL + 시각 비율 × TIME_AREA_WIDTH).
          left: `${ENGINEER_COL + (nowPct / 100) * TIME_AREA_WIDTH}px`,
          width: 0,
          pointerEvents: "none",
          zIndex: 5,
        }}>
          <div style={{
            position: "absolute",
            top: 34,
            bottom: 0,
            left: -1,
            width: 2,
            background: "#FF1B8D",
            boxShadow: "0 0 6px rgba(255, 27, 141, 0.45)",
          }}/>
          <div style={{
            position: "absolute",
            top: 6,
            left: -22,
            padding: "2px 6px",
            background: "#FF1B8D",
            color: "#fff",
            fontSize: 10, fontWeight: 800,
            borderRadius: 4,
            whiteSpace: "nowrap",
            fontVariantNumeric: "tabular-nums",
            boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
            letterSpacing: "-0.2px",
          }}>{nowLabel}</div>
        </div>
      )}
    </div>
  );
}

function Lane({ lane, idle = false, alt = false, offs = [], onTaskClick, onTaskDragCommit, onDragPreview, dropPreview, highlightTaskId }) {
  // 시간 영역 폭 측정용 ref — 드래그 거리(px → 분) 환산에 사용.
  const laneRef = useRef(null);
  // 2026-07-08 — 이 lane 그 날 휴무 (offs) 분류.
  //   fullDay = single/range/repeat/휴무종일 (있으면 laneName 옆에 🏖️ 배지 + 전체 회색 밴드)
  //   hourly  = hourly/휴무부분 (시간 밴드 렌더)
  const fullDayOffs = offs.filter(o => o.type === "single" || o.type === "range" || o.type === "repeat" || o.type === "휴무종일");
  const hourlyOffs  = offs.filter(o => o.type === "hourly" || o.type === "휴무부분");
  const hasFullDayOff = fullDayOffs.length > 0;
  const liveCount = lane.tasks.filter(t => !isEffectivelyCanceled(t)).length;
  const isDropTarget = !!dropPreview && !dropPreview.bad;
  // 2026-10-07 시안 v2 — 한 줄 걸러 배경색
  const baseBg = hasFullDayOff ? "rgba(148, 163, 184, 0.10)" : alt ? "var(--bg-secondary)" : "var(--bg-elevated)";
  return (
    <>
      <div style={{
        padding: "8px 16px",
        borderRight: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        background: hasFullDayOff ? "rgba(148, 163, 184, 0.14)" : alt ? "var(--bg-secondary)" : "var(--bg-elevated)",
        display: "flex", flexDirection: "column", justifyContent: "center",
        minHeight: LANE_HEIGHT, boxSizing: "border-box",
        // 가로 스크롤 시 각 행의 기사 셀도 고정 (헤더와 동일).
        position: "sticky",
        left: 0,
        zIndex: 6,
      }}>
        <span style={{
          fontSize: 16, fontWeight: 800,
          color: idle ? "var(--text-secondary)" : "var(--text-primary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {hasFullDayOff && <span style={{ marginRight: 4 }}>🏖️</span>}
          {lane.name}
          {lane.offWork && (
            <span title="정기 휴무일에 작업이 잡혀 있습니다" style={{
              marginLeft: 6, fontSize: 10.5, fontWeight: 800, padding: "1px 6px", borderRadius: 5,
              background: "rgba(249,115,22,0.16)", color: "#F97316", whiteSpace: "nowrap",
            }}>⚠ 휴무일 작업</span>
          )}
        </span>
        <small style={{
          fontSize: 12.5, color: "var(--text-secondary)", fontWeight: 600, marginTop: 2,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{[lane.skillLabel, lane.region, `${liveCount}건`].filter(Boolean).join(" · ")}</small>
      </div>

      <div
        ref={laneRef}
        data-lane-key={lane.key}
        data-lane-ro={lane.readOnly ? "1" : undefined}
        title={lane.readOnly ? "보기 전용 — 배정은 협력사 관리자가 합니다" : undefined}
        style={{
          position: "relative",
          borderBottom: "1px solid var(--border)",
          minHeight: LANE_HEIGHT,
          background: isDropTarget ? "var(--accent-bg, rgba(255,27,141,0.07))" : baseBg,
          outline: isDropTarget ? "2px dashed var(--accent, #FF1B8D)" : "none",
          outlineOffset: -2,
          opacity: idle && !isDropTarget ? 0.75 : 1,
        }}>
        {/* 2026-07-08 — 종일 휴무 표시 배너 (가로 100% 회색 밴드 + 라벨).
            2026-07-09 — 클릭 → 사유 팝업 (memo 없어도 타입/시간 라벨). */}
        {hasFullDayOff && (
          <div
            title={fullDayOffs.map(o => formatOffAlertText(o)).join("\n\n")}
            onClick={(ev) => {
              ev.stopPropagation();
              alert(fullDayOffs.map(o => formatOffAlertText(o)).join("\n\n"));
            }}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "repeating-linear-gradient(45deg, rgba(148,163,184,0.10) 0 8px, rgba(148,163,184,0.18) 8px 16px)",
              color: "var(--text-secondary)",
              fontSize: 11, fontWeight: 700,
              cursor: "pointer",
              zIndex: 1,
            }}>
            🏖️ {formatOffDayType(fullDayOffs[0].type)}
          </div>
        )}
        {/* 2026-07-08 — 시간 휴무 밴드. 클릭 → 사유 팝업. 밴드 위치가 시간대를 뜻하므로 아이콘만. */}
        {hourlyOffs.map((o, idx) => {
          const s = _hmToMinutes(o.startTime);
          const e = _hmToMinutes(o.endTime);
          if (s == null || e == null || e <= s) return null;
          const startMin = START_HOUR * 60;
          const totalMin = TOTAL_HOURS * 60;
          const leftPct  = Math.max(0, (s - startMin) / totalMin) * 100;
          const widthPct = Math.min(100 - leftPct, ((e - s) / totalMin) * 100);
          if (widthPct <= 0) return null;
          return (
            <div key={o.id || `hoff-${idx}`}
              title={formatOffAlertText(o)}
              onClick={(ev) => {
                ev.stopPropagation();
                alert(formatOffAlertText(o));
              }}
              style={{
                position: "absolute",
                top: 4, bottom: 4,
                left:  `${leftPct}%`,
                width: `${widthPct}%`,
                background: "repeating-linear-gradient(45deg, rgba(148,163,184,0.18) 0 6px, rgba(148,163,184,0.30) 6px 12px)",
                border: "1px solid rgba(100, 116, 139, 0.5)",
                borderRadius: 4,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--text-secondary)",
                fontSize: 11, fontWeight: 700,
                cursor: "pointer",
                zIndex: 2,
              }}>
              🏖️
            </div>
          );
        })}
        {Array.from({ length: TOTAL_HOURS - 1 }).map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${((i + 1) / TOTAL_HOURS) * 100}%`,
            top: 0, bottom: 0,
            width: 1,
            background: "var(--border)",
            opacity: 0.5,
          }}/>
        ))}
        {lane.tasks.map(task => {
          // 2026-06-19 — 같은 lane 의 다른 막대들 (자기 자신 제외) 을 TaskBar 에
          //   전달 → 드래그 commit 시 부모가 겹침 검사에 사용 (source lane 한정).
          const tid = task.id || task.taskCode;
          const siblings = lane.tasks.filter(t => (t.id || t.taskCode) !== tid);
          return (
            <TaskBar
              key={tid}
              task={task}
              laneRef={laneRef}
              sourceLaneKey={lane.key}
              readOnly={lane.readOnly}
              siblings={siblings}
              laneName={lane.name}
              onClick={() => onTaskClick?.(task)}
              onDragCommit={onTaskDragCommit}
              onDragPreview={onDragPreview}
              highlightTaskId={highlightTaskId}
            />
          );
        })}
        {/* 2026-10-07 — 놓을 자리 미리보기: 점선 막대 + 말풍선 */}
        {dropPreview && !dropPreview.bad && (() => {
          const totalMin = TOTAL_HOURS * 60;
          const leftPct  = Math.max(0, (dropPreview.startMin - START_HOUR * 60) / totalMin * 100);
          const widthPct = Math.min(100 - leftPct, (dropPreview.durMin / totalMin) * 100);
          const tipRight = leftPct + widthPct > 70;      // 오른쪽 끝에서는 말풍선을 막대 왼쪽에
          return (
            <>
              <div style={{
                position: "absolute", top: 5, height: LANE_HEIGHT - 10, left: `${leftPct}%`, width: `${widthPct}%`,
                borderRadius: 8, border: "2px dashed var(--accent, #FF1B8D)", background: "rgba(255,27,141,0.12)",
                color: "var(--accent, #FF1B8D)", fontSize: 11.5, fontWeight: 800, boxSizing: "border-box",
                display: "flex", alignItems: "center", padding: "0 8px", whiteSpace: "nowrap", overflow: "hidden",
                pointerEvents: "none", zIndex: 40,
              }}>{dropPreview.label || ""}</div>
              {dropPreview.tip && (
                <div style={{
                  position: "absolute", top: 10,
                  ...(tipRight ? { right: `calc(${100 - leftPct}% + 8px)` } : { left: `calc(${leftPct + widthPct}% + 8px)` }),
                  background: "#1A1A1A", color: "#fff", fontSize: 12, fontWeight: 700, padding: "6px 10px", borderRadius: 8,
                  whiteSpace: "nowrap", pointerEvents: "none", zIndex: 60, boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                }}>{tipRight ? dropPreview.tip.replace(/^← /, "") + " →" : dropPreview.tip}</div>
              )}
            </>
          );
        })()}
        {dropPreview && dropPreview.bad && (
          <div style={{
            position: "absolute", top: 10, left: 12, background: "#1A1A1A", color: "#fff", fontSize: 12, fontWeight: 700,
            padding: "6px 10px", borderRadius: 8, whiteSpace: "nowrap", pointerEvents: "none", zIndex: 60,
          }}>{dropPreview.tip}</div>
        )}
      </div>
    </>
  );
}

function TaskBar({ task, laneRef, sourceLaneKey, readOnly = false, siblings, laneName, onClick, onDragCommit, onDragPreview, highlightTaskId }) {
  // 2026-06-20 trace — TaskBar 렌더 확인 (조건부 return 위).
  console.log('[TaskBar RENDER]', task.id || task.taskCode, 'status=', task.status, 'isLocked=', LOCKED_STATUSES.has(task.status), 'hasOnClick=', !!onClick);
  const scheduled = task.scheduledAt || task.scheduled_at;
  // 좌측에 위치한 hooks (조건부 return 위) — Rules of Hooks.
  const [drag, setDrag] = useState(null);

  if (!scheduled) return null;
  const d = new Date(scheduled);
  if (isNaN(d.getTime())) return null;

  // base = 원래 일정 시각 (분 단위)
  const baseHours   = d.getHours();
  const baseMinutes = d.getMinutes();
  const baseTotalMin = baseHours * 60 + baseMinutes;

  // 잠금 — 상태 잠금 + 협력사 묶음(보기 전용: 배정은 협력사 관리자)
  const isLocked = LOCKED_STATUSES.has(task.status) || readOnly;
  // 막대 길이 = 서비스별 소요 시간 (협력사 타임라인과 같은 표)
  const durMin = taskDurationMin(task);

  // 표시 시각 (드래그 중이면 currentMinutes, 아니면 base)
  const shownTotalMin = drag ? drag.currentMinutes : baseTotalMin;
  const shownH = Math.floor(shownTotalMin / 60);
  const shownM = shownTotalMin % 60;

  // px 위치
  const hoursOffset = (shownTotalMin / 60) - START_HOUR;
  let leftPct  = (hoursOffset / TOTAL_HOURS) * 100;
  let widthPct = ((durMin / 60) / TOTAL_HOURS) * 100;

  if (leftPct < 0) {
    widthPct += leftPct;
    leftPct = 0;
  }
  if (leftPct + widthPct > 100) widthPct = 100 - leftPct;
  if (widthPct <= 0) return null;

  // 2026-07-11 — 출장 판정 최우선 (접수함 전환 경로가 workItems.workType 을 냉매 등으로
  //   prefill 한 상태에서 status='visit_only' 만 세팅되면 getServiceKind → 'refrigerant'
  //   → 노랑 오표시. 판정 함수 하나로 통일: isPureVisitOnly OR isAllItemsVisit.
  const isVisitOnly = isPureVisitOnly(task) || isAllItemsVisit(task);
  const kind = isVisitOnly ? 'visit' : getServiceKind(task);
  // 2026-10-06 — 막대 색은 종목 기준표에서 (출장만 한 건은 기존 출장 색 유지)
  const kindColor = isVisitOnly ? (KIND_COLOR[kind] || KIND_COLOR_FALLBACK) : getCategoryMeta(task).color;
  const textCol   = isVisitOnly ? (TEXT_ON_KIND[kind] || TEXT_ON_KIND_FALLBACK) : (getCategoryMeta(task).textOnColor || "#fff");

  // 2026-07-09 — status 별 시각 분기.
  //   · 취소 : todayTasks 필터에서 이미 제외 (아래 스타일 dead code).
  //   · visit_only : 종류색 (핑크) + dotted border + "출장 · " 접두 + opacity 0.5.
  //             (사장님 spec: 실질 매출 아니라 시각적으로 덜 강조. 있었다는 표시로 남김.)
  //   · 완료 / 정산완료 : opacity 0.5 흐림.
  const isCanceled  = isEffectivelyCanceled(task); // 2026-07-11 — 전항목 취소도 포함
  const isDone      = task.status === "완료" || task.status === "정산완료";
  // 2026-06-19 — 검색 강조 / 흐림.
  const tidStr = task.id || task.taskCode;
  const isHighlightActive = !!highlightTaskId;
  const isHighlighted    = isHighlightActive && highlightTaskId === tidStr;
  const isDimmed         = isHighlightActive && !isHighlighted;
  const baseOpacity = isDimmed ? 0.3
                    : isCanceled  ? 0.65
                    : isVisitOnly ? 0.5
                    : isDone      ? 0.4
                    : 1;
  const opacity = drag && drag.dragging ? 0.85 : baseOpacity;

  // 2026-06-19 — cross-lane 드래그 시각 강조 (다른 기사 lane 위에 올라간 상태).
  const isCrossLaneDrag = drag && drag.dragging && drag.targetLaneKey
    && drag.targetLaneKey !== sourceLaneKey;

  const customer = task.customer || task.고객명 || "—";
  const region   = task.region || task.district || task.지역 || "";
  const statusStyle = getTaskStatusColor(task.status);
  const baseTimeStr  = `${pad(baseHours)}:${pad(baseMinutes)}`;
  const shownTimeStr = `${pad(shownH)}:${pad(shownM)}`;
  const showPreview  = drag && drag.dragging && shownTotalMin !== baseTotalMin;
  const titleParts = [
    baseTimeStr,
    customer,
    region,
    kind === "refrigerant" ? "냉매"
      : kind === "cleaning" ? "세척"
      : kind === "install"  ? "설치"
      : kind === "leak"     ? leakDisplayLabel(task)
      : "",
    task.status || "",
    readOnly ? "보기 전용 — 배정은 협력사 관리자 (누르면 상세)" : "",
  ].filter(Boolean);
  const title = titleParts.join(" · ");

  function handlePointerDown(e) {
    // 2026-06-20 trace — 잠금 막대 클릭 누락 진단 (사장님 보고).
    console.log('[TaskBar PD]', { taskId: task.id || task.taskCode, status: task.status, isLocked, button: e.button, pointerId: e.pointerId, hasOnClick: !!onClick });
    // 좌클릭만
    if (e.button !== 0) { console.log('[TaskBar PD] non-left button, return'); return; }
    let captured = false;
    try { e.currentTarget.setPointerCapture(e.pointerId); captured = true; } catch (err) {
      console.log('[TaskBar PD] setPointerCapture FAILED', err);
    }
    console.log('[TaskBar PD] captured?', captured);
    // 2026-06-20 — 잠금 막대도 pointerdown 받음. 이동량 < 임계값이면 pointerup 측 onClick 호출 (작업상세).
    //   드래그 자체 차단은 handlePointerMove / handlePointerUp 의 locked 분기.
    setDrag({
      pointerId:  e.pointerId,
      startX:     e.clientX,
      startY:     e.clientY,
      baseMinutes: baseTotalMin,
      currentMinutes: baseTotalMin,
      deltaY:     0,
      targetLaneKey: sourceLaneKey,  // 처음엔 자기 lane
      dragging:   false,
      locked:     isLocked,
    });
    console.log('[TaskBar PD] setDrag called locked=', isLocked);
  }

  function handlePointerMove(e) {
    if (!drag) return;
    // 2026-06-20 — 잠금 막대: 시간/lane 갱신 안 함 (pointerup 측 이동량 검사만).
    if (drag.locked) return;
    const laneEl = laneRef?.current;
    if (!laneEl) return;
    const rect = laneEl.getBoundingClientRect();
    if (rect.width <= 0) return;
    const deltaX = e.clientX - drag.startX;
    const deltaY = e.clientY - drag.startY;
    const dragging = drag.dragging
      || Math.abs(deltaX) > DRAG_THRESHOLD_PX
      || Math.abs(deltaY) > DRAG_THRESHOLD_PX;

    // X: 시간 환산 + 30분 스냅 + 클램프
    const minutesDelta = (deltaX / rect.width) * TOTAL_HOURS * 60;
    let newMin = drag.baseMinutes + minutesDelta;
    newMin = Math.round(newMin / SNAP_MINUTES) * SNAP_MINUTES;
    const minStart = START_HOUR * 60;
    const maxStart = (END_HOUR - 1) * 60 + 30;
    newMin = Math.max(minStart, Math.min(maxStart, newMin));

    // 2026-06-19 — target lane 식별: 막대(ghost) 시각적 box 의 center 사용.
    //   이전: e.clientX/Y (커서) 사용 → 사용자가 막대 가장자리를 잡으면 커서가
    //   막대 box 밖에 있을 수 있어 시각/판정 불일치 (사장님 보고 사고).
    //   현재: pointer-events:none 으로 막대 hit-test 제외 + getBoundingClientRect
    //   로 막대 box center 추출 → 막대가 시각적으로 안착한 lane 정확히 식별.
    let targetLaneKey = sourceLaneKey;
    try {
      const barRect = e.currentTarget.getBoundingClientRect();
      const barCenterX = barRect.left + barRect.width / 2;
      const barCenterY = barRect.top + barRect.height / 2;
      const el = document.elementFromPoint(barCenterX, barCenterY);
      if (el) {
        const laneEl2 = el.closest && el.closest("[data-lane-key]");
        if (laneEl2 && laneEl2.dataset && laneEl2.dataset.laneKey && laneEl2.dataset.laneRo !== "1") {
          targetLaneKey = laneEl2.dataset.laneKey;
        }
      }
    } catch (_) {}

    setDrag(prev => prev ? {
      ...prev,
      currentMinutes: newMin,
      deltaY,
      targetLaneKey,
      dragging,
    } : null);
    // 놓을 자리 미리보기 (점선 막대 + 말풍선) — 줄을 옮기는 중일 때만. 같은 줄 안에서는 막대 자체가 움직인다.
    if (dragging && onDragPreview) {
      if (targetLaneKey !== sourceLaneKey) {
        onDragPreview({ laneKey: targetLaneKey, startMin: newMin, durMin, cross: true, label: `${getCategoryMeta(task).icon || ""} ${customer}` });
      } else {
        onDragPreview(null);
      }
    }
  }

  function handlePointerUp(e) {
    // 2026-06-20 trace — 잠금 막대 클릭 누락 진단.
    console.log('[TaskBar PU]', { taskId: task.id || task.taskCode, status: task.status, hasDrag: !!drag, locked: drag?.locked, hasOnClick: !!onClick });
    if (!drag) { console.log('[TaskBar PU] drag null — return (no onClick)'); return; }
    try { e.currentTarget.releasePointerCapture(drag.pointerId); } catch (_) {}
    // 2026-06-20 — 잠금 막대 클릭 처리: 이동량 < DRAG_THRESHOLD_PX 이면 onClick (작업상세).
    //   드래그 가능 막대의 클릭 분기(line 938~941)와 동일 로직 — wasDragging=false + movedTime/Lane=false 일 때 onClick.
    if (drag.locked) {
      const deltaX = e.clientX - drag.startX;
      const deltaY = e.clientY - drag.startY;
      const moved = Math.abs(deltaX) > DRAG_THRESHOLD_PX
                 || Math.abs(deltaY) > DRAG_THRESHOLD_PX;
      console.log('[TaskBar PU locked]', { deltaX, deltaY, moved, willCallOnClick: !moved && !!onClick });
      setDrag(null);
      if (!moved) onClick && onClick();
      return;
    }
    const wasDragging = drag.dragging;
    const movedTime  = drag.currentMinutes !== drag.baseMinutes;
    if (onDragPreview) onDragPreview(null);

    // 2026-06-19 — pointerup 시점에도 막대 box center 로 target lane 재추출.
    //   pointermove 와 같은 기준 사용 → 시각/판정 일치 보장 + stale closure 안전망.
    let finalTargetLaneKey = drag.targetLaneKey || sourceLaneKey;
    try {
      const barRect = e.currentTarget.getBoundingClientRect();
      const barCenterX = barRect.left + barRect.width / 2;
      const barCenterY = barRect.top + barRect.height / 2;
      const el = document.elementFromPoint(barCenterX, barCenterY);
      if (el) {
        const laneEl2 = el.closest && el.closest("[data-lane-key]");
        if (laneEl2 && laneEl2.dataset && laneEl2.dataset.laneKey && laneEl2.dataset.laneRo !== "1") {
          finalTargetLaneKey = laneEl2.dataset.laneKey;
        }
      }
    } catch (_) {}
    const movedLane = finalTargetLaneKey && finalTargetLaneKey !== sourceLaneKey;

    if (wasDragging && (movedTime || movedLane)) {
      const newH = Math.floor(drag.currentMinutes / 60);
      const newM = drag.currentMinutes % 60;
      const newDate = new Date(d);
      newDate.setHours(newH, newM, 0, 0);
      const newIso = newDate.toISOString();
      onDragCommit && onDragCommit({
        task,
        sourceLaneKey,
        targetLaneKey: finalTargetLaneKey,
        oldIso: scheduled,
        newIso,
        oldTime: baseTimeStr,
        newTime: `${pad(newH)}:${pad(newM)}`,
        newMinutes: drag.currentMinutes,
        durationMinutes: durMin,
        siblings,
        laneName,
        onAcceptUI: () => setDrag(null),
        onCancelUI: () => setDrag(null),
      });
    } else {
      setDrag(null);
      onClick && onClick();
    }
  }

  function handlePointerCancel() {
    if (!drag) return;
    setDrag(null);
    if (onDragPreview) onDragPreview(null);
  }

  return (
    <button
      onClick={(e) => { console.log('[TaskBar BTN onClick fired]', task.id || task.taskCode, 'isLocked=', isLocked); e.preventDefault(); }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      title={title}
      style={{
        position: "absolute",
        left:  `calc(${leftPct}% + 1px)`,
        top: 4,
        height: LANE_HEIGHT - 8,
        width: `calc(${widthPct}% - 2px)`,
        // 2026-07-09 — 취소면 회색 대각선 스트라이프 배경 (본래 색상 위에 오버레이).
        background: isCanceled
          ? `repeating-linear-gradient(45deg, ${kindColor}66 0 6px, ${kindColor}33 6px 12px)`
          : kindColor,
        border: isCrossLaneDrag
          ? "2px solid #8B5CF6"           // cross-lane: 보라
          : isHighlighted
            ? "2px solid #FF1B8D"
            : isCanceled
              ? `1px dashed ${kindColor}`
              : isVisitOnly
                ? `1px dotted ${kindColor}`  // 2026-07-09 — 출장비 dotted border
                : `1px solid ${kindColor}`,
        borderLeft: isCrossLaneDrag
          ? "4px solid #8B5CF6"
          : isHighlighted
            ? "4px solid #FF1B8D"
            : `4px solid ${kindColor}`,
        borderRadius: 5,
        color: textCol,
        fontFamily: "inherit",
        cursor: readOnly ? "pointer" : isLocked ? "default" : (drag && drag.dragging ? "grabbing" : "grab"),
        padding: "4px 8px",
        display: "flex",
        alignItems: "center",
        gap: 6,
        overflow: "hidden",
        textAlign: "left",
        boxSizing: "border-box",
        opacity,
        // 2026-08-04 — 사장님 제보: 휴무 빗금 밴드(zIndex 1~2)가 작업 칩(1)을 덮어
        //   휴무 시간대의 작업이 클릭 안 됨 → 칩 기본 z 를 밴드 위(3)로. 빈 빗금
        //   영역 클릭은 여전히 휴무 사유 팝업.
        zIndex: drag && drag.dragging ? 50 : (isHighlighted ? 8 : 3),
        boxShadow: isCrossLaneDrag
          ? "0 0 0 3px rgba(139, 92, 246, 0.35), 0 6px 18px rgba(0,0,0,0.4)"
          : isHighlighted
            ? "0 0 0 3px rgba(255, 27, 141, 0.35), 0 4px 14px rgba(255, 27, 141, 0.45)"
            : (drag && drag.dragging ? "0 4px 12px rgba(0,0,0,0.35)" : "none"),
        transform: drag && drag.dragging ? `translateY(${drag.deltaY}px)` : "none",
        transition: drag ? "none" : "left 0.15s ease, opacity 0.2s ease",
        touchAction: "none",
        // 2026-06-19 — drag 중 막대 hit-test 제외 → elementFromPoint(barCenter)
        //   가 막대 자체를 잡지 않고 아래 lane 시간 영역을 잡음.
        //   pointerCapture 는 별도라 막대 자체는 마우스 이벤트 계속 받음.
        pointerEvents: drag && drag.dragging ? "none" : "auto",
      }}>
      <div style={{
        flex: 1, minWidth: 0,
        display: "flex", flexDirection: "column", justifyContent: "center",
        gap: 1,
      }}>
        <span style={{
          fontSize: 12.5, fontWeight: 800,
          color: textCol,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          lineHeight: 1.2,
          // 2026-07-09 — 취소 시 취소선.
          textDecoration: isCanceled ? "line-through" : "none",
        }}>{isCanceled ? "취소 · " : isVisitOnly ? "출장 · " : isDone ? "✓ " : `${getCategoryMeta(task).icon || ""} `}{barWork(task)}{customer}</span>
        {showPreview ? (
          <span style={{
            fontSize: 11, fontWeight: 800,
            color: textCol,
            letterSpacing: "-0.1px",
            lineHeight: 1.1,
            fontVariantNumeric: "tabular-nums",
          }}>{baseTimeStr} → {shownTimeStr}</span>
        ) : (
          <span style={{
            fontSize: 11.5, fontWeight: 500,
            color: textCol,
            opacity: 0.88,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            lineHeight: 1.2,
          }}>{[relocationLine(task) || region, baseTimeStr].filter(Boolean).join(" · ")}</span>
        )}
      </div>
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: statusStyle.color,
        flexShrink: 0,
      }}/>
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────
// 2026-10-07 — 왼쪽 미배정 목록 (시안 v1). 카드를 기사 줄의 원하는 시간에 끌어다 놓으면 배정 + 일정 확정.
// ──────────────────────────────────────────────────────────────────
// 막대 첫 줄의 작업 이름 ("이전설치 · "). 이름이 없으면 빈 글자.
function barWork(task) {
  const items = Array.isArray(task.workItems) ? task.workItems.filter(w => w && !(w.isCanceled || w.is_canceled)) : [];
  const nm = String((items[0] && (items[0].workType || items[0].name)) || task.workType || "").replace(/_\(공통\)$/, "").trim();
  return nm ? `${nm} · ` : "";
}
// 희망(또는 잡힌) 시각이 이미 지났는가 — 배정 대기 카드의 빨간 ⚠ 표시용
function cardIsLate(task) {
  const at = task.scheduledAt || task.scheduled_at;
  let ts = null;
  if (at) ts = new Date(at).getTime();
  else if (task.requestedDate) {
    const rt = /^\d{1,2}:\d{2}/.test(String(task.requestedTime || "")) ? String(task.requestedTime).slice(0, 5).padStart(5, "0") : "23:59";
    ts = new Date(`${String(task.requestedDate).slice(0, 10)}T${rt}:00`).getTime();
  }
  return ts != null && !isNaN(ts) && ts < Date.now();
}

function cardWhen(task, selectedDate) {
  const at = task.scheduledAt || task.scheduled_at;
  if (at) {
    const d = new Date(at);
    if (!isNaN(d.getTime())) {
      const ymd = toKstYmd(at);
      return { has: true, text: `${ymd === selectedDate ? "" : `${d.getMonth() + 1}/${d.getDate()} `}${pad(d.getHours())}:${pad(d.getMinutes())}` };
    }
  }
  const rd = String(task.requestedDate || "").slice(0, 10);
  const rt = /^\d{1,2}:\d{2}/.test(String(task.requestedTime || "")) ? String(task.requestedTime).slice(0, 5) : "";
  if (rd && rt) {
    const [, m, dd] = rd.split("-");
    return { has: true, text: `${rd === selectedDate ? "" : `${Number(m)}/${Number(dd)} `}${rt}` };
  }
  if (rd) {
    const [, m, dd] = rd.split("-");
    return { has: false, text: `${Number(m)}/${Number(dd)} 시간 미정` };
  }
  return { has: false, text: "시간 미정" };
}
function cardItems(task) {
  const items = Array.isArray(task.workItems) ? task.workItems.filter(w => w && !(w.isCanceled || w.is_canceled)) : [];
  const names = items.map(w => {
    const ap = w.appliance && w.appliance !== "(공통)" ? w.appliance : "";
    const nm = String(w.workType || w.name || "").replace(/_\(공통\)$/, "");
    const q = Number(w.qty) > 1 ? ` ${w.qty}대` : "";
    return ap ? `${ap}${q}` : `${nm}${q}`;
  }).filter(Boolean);
  const first = names.length > 0 ? (names.length > 1 ? `${names[0]} 외 ${names.length - 1}` : names[0])
    : String(task.workType || "").replace(/_\(공통\)$/, "");
  const est = Number(task.estimateTotal || task.productPrice || 0);
  return [first, est > 0 ? `견적 ₩${est.toLocaleString("ko-KR")}` : ""].filter(Boolean).join(" · ");
}

// "기사 미정" 칩의 시각 글자 — 일정이 있으면 "10/8 14:00", 희망일만 있으면 그 날짜, 없으면 "시간 미정"
function pendingWhen(task) {
  const at = task.scheduledAt || task.scheduled_at;
  if (at) {
    const d = new Date(at);
    if (!isNaN(d.getTime())) return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const rd = String(task.requestedDate || "").slice(0, 10);
  if (rd) {
    const [, m, dd] = rd.split("-");
    const rt = /^\d{1,2}:\d{2}/.test(String(task.requestedTime || "")) ? ` ${String(task.requestedTime).slice(0, 5)}` : "";
    return `${Number(m)}/${Number(dd)}${rt}`;
  }
  return "시간 미정";
}

function UnassignedPanel({ tasks, subTasks = [], subLabel = "협력사", selectedDate, onOpen, onDragMove, onDrop, onDragCancel, handOverTarget, handOverName, onHandOver }) {
  const [tab, setTab] = useState("all");            // all / none(시간 미정) / has(시간 있음)
  const [dragging, setDragging] = useState(null);   // { id, x, y, label, color }
  const start = useRef(null);

  const rows = useMemo(() => tasks.map(t => ({ t, when: cardWhen(t, selectedDate) })), [tasks, selectedDate]);
  // 2026-10-07 시안 v2 — 둘째 칸: 협력사로 넘겼고 기사 미정인 작업 (보기 전용). 탭은 두 칸 모두에 적용한다.
  const subRows = useMemo(() => subTasks.map(t => ({ t, when: cardWhen(t, selectedDate) })), [subTasks, selectedDate]);
  const all = rows.length + subRows.length;
  const nNone = rows.filter(r => !r.when.has).length + subRows.filter(r => !r.when.has).length;
  const nHas  = all - nNone;
  const byTab = (r) => tab === "all" || (tab === "has" ? r.when.has : !r.when.has);
  const shown = rows.filter(byTab);
  const subShown = subRows.filter(byTab);
  const secHead = (text, n, purple) => (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, fontWeight: 700,
      padding: "8px 10px", borderRadius: 10, marginBottom: 8,
      background: purple ? "rgba(139,92,246,0.14)" : "rgba(233,24,96,0.12)", color: purple ? "#A78BFA" : "#FF5C93",
    }}><span>{text}</span><span>{n}</span></div>
  );

  const tabBtn = (key, text) => (
    <button key={key} type="button" onClick={() => setTab(key)} style={{
      fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 99, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
      border: tab === key ? "1px solid var(--text-primary)" : "1px solid var(--border)",
      background: tab === key ? "var(--text-primary)" : "transparent",
      color: tab === key ? "var(--bg-primary)" : "var(--text-secondary)",
    }}>{text}</button>
  );

  return (
    <div style={{
      width: UNASSIGNED_COL, flexShrink: 0, background: "var(--bg-elevated)", borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column", position: "sticky", top: 0, alignSelf: "flex-start", height: "100vh", boxSizing: "border-box",
    }}>
      <div style={{ padding: "16px 16px 10px", borderBottom: "1px solid var(--border)" }}>
        <b style={{ fontSize: 18, color: "var(--text-primary)" }}>배정 대기</b>
        <span style={{
          display: "inline-grid", placeItems: "center", minWidth: 24, height: 24, borderRadius: 99, marginLeft: 8, padding: "0 7px",
          background: rows.length > 0 ? "var(--danger, #E5484D)" : "var(--border)", color: "#fff", fontSize: 13, fontWeight: 800, boxSizing: "border-box",
        }}>{all}</span>
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {tabBtn("all", `전체 ${all}`)}
          {tabBtn("none", `시간 미정 ${nNone}`)}
          {tabBtn("has", `시간 있음 ${nHas}`)}
        </div>
      </div>

      <div style={{ padding: "10px 12px", overflowY: "auto", flex: 1, minHeight: 0 }}>
        {secHead("직영 미배정", shown.length, false)}
        {shown.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--text-secondary)", padding: "4px 10px 10px" }}>미배정 작업이 없습니다 ✓</div>
        )}
        {shown.map(({ t, when }) => {
          const cat = getCategoryMeta(t);
          const id = t.id || t.taskCode;
          const town = t.region || t.district || "";
          const subTarget = handOverTarget(t);
          const isDrag = dragging && dragging.id === id;
          return (
            <div
              key={id}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                if (e.target.closest && e.target.closest("[data-no-drag]")) return;
                try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_e) { /* 무시 */ }
                start.current = { id, x: e.clientX, y: e.clientY, moved: false, pointerId: e.pointerId };
              }}
              onPointerMove={(e) => {
                const st = start.current;
                if (!st || st.id !== id) return;
                if (!st.moved && Math.abs(e.clientX - st.x) < DRAG_THRESHOLD_PX && Math.abs(e.clientY - st.y) < DRAG_THRESHOLD_PX) return;
                st.moved = true;
                setDragging({ id, x: e.clientX, y: e.clientY, label: `${cat.icon} ${t.customer || ""}`, color: cat.color });
                onDragMove(t, e.clientX, e.clientY);
              }}
              onPointerUp={(e) => {
                const st = start.current;
                start.current = null;
                try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_e) { /* 무시 */ }
                if (!st || st.id !== id) return;
                setDragging(null);
                if (st.moved) onDrop(t, e.clientX, e.clientY);
                else if (onOpen) onOpen(t);                  // 끌지 않고 누르면 상세
              }}
              onPointerCancel={() => { start.current = null; setDragging(null); onDragCancel(); }}
              style={{
                border: isDrag ? "1px dashed var(--border)" : "1px solid var(--border)", borderRadius: 12, padding: "10px 12px 10px 14px", marginBottom: 8,
                position: "relative", background: "var(--bg-elevated)", cursor: isDrag ? "grabbing" : "grab",
                opacity: isDrag ? 0.35 : 1, userSelect: "none", touchAction: "none",
              }}>
              <span style={{ position: "absolute", left: 0, top: 8, bottom: 8, width: 4, borderRadius: "0 4px 4px 0", background: cat.color }}/>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 6, fontSize: 12, color: "var(--text-secondary)", fontWeight: 700 }}>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 6, marginRight: 4, background: categoryTint(cat.color, 0.16), color: cat.color }}>{cat.icon} {cat.short || cat.label}</span>
                  {town}
                </span>
                <em style={{ fontStyle: "normal", color: when.has ? "var(--accent, #FF1B8D)" : "var(--text-secondary)", flexShrink: 0 }}>{when.text}</em>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, margin: "3px 0 2px", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.customer || "—"}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {cardItems(t)}{t.principal && t.principal !== "올데이케어" ? ` · 원청 ${t.principal}` : ""}
              </div>
              {relocationLine(t) && (
                <div style={{ fontSize: 12, fontWeight: 700, color: "#6366F1", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{relocationLine(t)}</div>
              )}
              {subTarget && (
                <button type="button" data-no-drag="1" onClick={(e) => { e.stopPropagation(); onHandOver(t, subTarget); }} style={{
                  marginTop: 6, background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit",
                  fontSize: 12, fontWeight: 800, color: cat.color,
                }}>{handOverName(subTarget)}로 넘기기 ›</button>
              )}
            </div>
          );
        })}

        {/* 둘째 칸 — 협력사 배정 대기 (보기 전용: 끌 수 없고, 누르면 작업 상세) */}
        {subRows.length > 0 && (
          <div style={{ marginTop: 14 }}>
            {secHead(`🔒 ${subLabel} 배정 대기`, subShown.length, true)}
            {subShown.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--text-secondary)", padding: "4px 10px 10px" }}>이 조건에 해당하는 작업이 없습니다</div>
            )}
            {subShown.map(({ t, when }) => {
              const cat = getCategoryMeta(t);
              const id = t.id || t.taskCode;
              const town = t.region || t.district || "";
              const late = cardIsLate(t);
              return (
                <button key={id} type="button" onClick={() => onOpen && onOpen(t)} title="보기 전용 — 배정은 협력사 관리자 (누르면 상세)" style={{
                  display: "block", width: "100%", textAlign: "left", fontFamily: "inherit", cursor: "pointer",
                  border: "1px solid var(--border)", borderLeft: `4px solid ${cat.color}`, borderRadius: 12, padding: "10px 12px", marginBottom: 8,
                  background: "var(--bg-elevated)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 6, fontSize: 13, color: "var(--text-secondary)" }}>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.taskCode || t.taskNo || ""} · {cat.icon} {cat.label}</span>
                    <span style={{ flexShrink: 0, fontSize: 11, color: "#A78BFA", background: "rgba(139,92,246,0.16)", borderRadius: 6, padding: "1px 6px", fontWeight: 700 }}>보기 전용</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, margin: "4px 0 2px", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.customer || "—"}{town ? ` · ${town}` : ""}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {late
                      ? <span style={{ color: "#FF6B6B", fontWeight: 700 }}>⚠ {pendingWhen(t)} 지남</span>
                      : <span style={{ color: when.has ? "var(--accent, #FF1B8D)" : "var(--text-secondary)", fontWeight: 700 }}>{pendingWhen(t)}</span>}
                    {" · "}{cardItems(t)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)", fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5, background: "var(--bg-secondary)" }}>
        직영 카드는 오른쪽 기사 줄의 원하는 시간에 <strong>끌어다 놓으면</strong> 배정 + 시간이 한 번에 정해집니다. 누르면 상세.
        {subRows.length > 0 ? " 🔒 카드는 보기 전용입니다 (배정은 협력사 관리자)." : ""}
      </div>

      {/* 끌고 있는 카드 (커서를 따라다니는 작은 표식) */}
      {dragging && (
        <div style={{
          position: "fixed", left: dragging.x + 12, top: dragging.y + 12, zIndex: 2000, pointerEvents: "none",
          background: dragging.color, color: "#fff", fontSize: 12, fontWeight: 800, padding: "6px 10px", borderRadius: 8,
          boxShadow: "0 6px 18px rgba(0,0,0,0.35)", whiteSpace: "nowrap", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis",
        }}>{dragging.label}</div>
      )}
    </div>
  );
}

function pad(n) {
  return String(n).padStart(2, "0");
}

// ──────────────────────────────────────────────────────────────────
// 2026-06-19 — 검색창 + 드롭다운 (사장님 spec).
//   매칭: 고객명/주소/연락처/작업번호. 디바운스는 부모.
//   결과 형식: "M/D(요일) HH:MM · 고객 · 기사"
//   - 클릭 → 부모 onSelect (날짜 점프 + 강조 + 가로 스크롤).
//   - blur 시 드롭다운 닫음 (timeout 으로 클릭과 충돌 방지).
// ──────────────────────────────────────────────────────────────────
const KO_DOW = ["일", "월", "화", "수", "목", "금", "토"];

function SearchBox({ query, onQueryChange, results, showResults, setShowResults, onSelect }) {
  return (
    <div style={{
      position: "relative",
      flexShrink: 0,
      minWidth: 240,
    }}>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value);
          setShowResults(true);
        }}
        onFocus={() => setShowResults(true)}
        onBlur={() => {
          // 클릭과 충돌 방지 — blur 즉시 닫으면 onClick 발화 X.
          setTimeout(() => setShowResults(false), 180);
        }}
        placeholder="🔍 고객·주소·연락처·작업번호"
        style={{
          width: "100%",
          minHeight: 36,
          padding: "8px 12px",
          fontSize: 12,
          fontFamily: "inherit",
          border: "1px solid var(--border)",
          borderRadius: 8,
          background: "var(--bg-elevated)",
          color: "var(--text-primary)",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
      {showResults && query.trim() !== "" && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          left: 0,
          right: 0,
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          maxHeight: 360,
          overflowY: "auto",
          zIndex: 50,
        }}>
          {results.length === 0 ? (
            <div style={{
              padding: "12px 14px",
              fontSize: 12,
              color: "var(--text-secondary)",
              textAlign: "center",
            }}>검색 결과 없음</div>
          ) : (
            results.map((task, idx) => (
              <ResultRow
                key={task.id || task.taskCode || idx}
                task={task}
                onClick={() => onSelect(task)}
                isLast={idx === results.length - 1}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ResultRow({ task, onClick, isLast }) {
  const scheduled = task.scheduledAt || task.scheduled_at;
  const d = scheduled ? new Date(scheduled) : null;
  const validDate = d && !isNaN(d.getTime());
  const dateLabel = validDate
    ? `${d.getMonth() + 1}/${d.getDate()}(${KO_DOW[d.getDay()]})`
    : "—";
  const timeLabel = validDate ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "";
  const customer = task.customer || task.customerName || task.고객명 || "—";
  const engineer = task.assignedEngineer || task.engineer || "(미배정)";
  const isCanceled = task.status === "취소";
  const isDone = task.status === "완료" || task.status === "정산완료" || task.status === "visit_only";

  return (
    <button
      type="button"
      // pointerdown 으로 onClick 보다 먼저 잡아서 input blur 와 충돌 회피
      onPointerDown={(e) => { e.preventDefault(); onClick(); }}
      style={{
        width: "100%",
        padding: "9px 12px",
        background: "transparent",
        border: "none",
        borderBottom: isLast ? "none" : "1px solid var(--border)",
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "inherit",
        display: "flex", alignItems: "center", gap: 8,
        fontSize: 12,
        color: "var(--text-primary)",
        opacity: isCanceled ? 0.55 : 1,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-bg)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{
        fontSize: 11, fontWeight: 700,
        color: "var(--text-secondary)",
        whiteSpace: "nowrap",
        minWidth: 64,
        fontVariantNumeric: "tabular-nums",
      }}>{dateLabel}</span>
      <span style={{
        fontSize: 11, fontWeight: 800,
        color: "var(--text-primary)",
        fontVariantNumeric: "tabular-nums",
        minWidth: 42,
      }}>{timeLabel}</span>
      <span style={{ color: "var(--text-secondary)" }}>·</span>
      <span style={{
        flex: 1, minWidth: 0,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        fontWeight: 700,
      }}>{customer}</span>
      <span style={{ color: "var(--text-secondary)" }}>·</span>
      <span style={{
        whiteSpace: "nowrap",
        color: "var(--text-secondary)",
        fontWeight: 600,
      }}>{engineer}</span>
      {(isCanceled || isDone) && (
        <span style={{
          fontSize: 10, fontWeight: 700,
          padding: "1px 6px",
          borderRadius: 4,
          background: isCanceled ? "rgba(160,160,170,0.15)" : "rgba(61,184,138,0.15)",
          color: isCanceled ? "#9CA3AF" : "#3DB88A",
          flexShrink: 0,
        }}>{isCanceled ? "취소" : "완료"}</span>
      )}
    </button>
  );
}

export default AdminPcTimelineScreen;
