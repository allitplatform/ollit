// 유솔 포털 — 내 작업 탭 (뷰 A 첫 화면 / 뷰 B 전체 목록)
// 2026-05-23 — 사장님 spec
//   · 뷰 A (기본): 한 줄 통계 + "오늘 작업" 카드 리스트 + "전체 보기" 버튼
//   · 뷰 B: 검색 + 필터 칩 + 전체 작업 리스트 (← 뒤로)
//   · fetch 분리: 뷰 A = 오늘+카운트만 / 뷰 B = 전체 (의도적 진입 시)
//   · KST 기준 오늘 비교 (utils/dateLabel.toKstYmd / todayYmd 사용)
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Search, ArrowLeft } from "lucide-react";
import { filterTasksForPrincipal } from "../../shared/tasks.js";
import { loadTasksForRole as getTasks } from "../../data/tasksDb.js";
import { v14NormalizeTask, v14FindTaskList } from "../../utils/v14Task.js";
import { useRealtimeTasks } from "../../hooks/useRealtimeSubscription.js";
import {
  fetchPrincipalTodayTasks,
  fetchPrincipalStatusCounts,
  fetchPrincipalListPaged,
} from "../../lib/principalDashboardDb.js";
import { getStatusBadge, getStatusLabel } from "../../utils/principalStatusBadge.js";
// 2026-06-09 — 출장비 (visit_fee) 공용 판별 / 배지.
import { isAllItemsVisit, hasAnyVisitItem } from "../../utils/visitFeeDetect.js";
import { VisitBadge } from "../common/VisitBadge.jsx";
// 2026-06-09 — 주소 잘림 사고 차단 (구/군/시 키워드 추출).
import { regionOrDistrictFromAddress } from "../../utils/districtKeyword.js";
// 2026-06-06 — 카운트 박스 공용 + DB count/필터 (KA/crikrin 측만).
import { CountBoxes } from "../CountBoxes.jsx";
import { fetchAllPrincipalCounts, fetchAllPrincipalTasks } from "../../lib/allPrincipalTasksDb.js";
// 2026-06-10 — PC 반응형 1차: 1024px 이상 PC 통합 테이블.
import { useIsPc } from "../../utils/useIsPc.js";
// 2026-06-11 — ServiceTag 다크/라이트 분기.
import { useIsDark } from "../../hooks/useIsDark.js";

const N_BADGE_COLOR     = "#2E9E54";
const CLEAN_COLOR       = "#378ADD";
const REFRIGERANT_COLOR = "#EF9F27";
const VISIT_COLOR       = "#9CA3AF";
const DATE_TIME_COLOR   = "#BA7517";
const MAGENTA           = "#FF4D9E";
const MAIN_APPLIANCE_KEYWORDS = ["벽걸이", "스탠드", "1way", "2way", "4way", "투인원", "원형", "시스템멀티"];

function getMainItem(task) {
  const items = Array.isArray(task.workItems) ? task.workItems : [];
  let main = items.find(it => (it.orderType || it.order_type) === "본작업");
  if (main) return main;
  main = items.find(it => {
    const a = String(it.appliance || "").trim();
    return MAIN_APPLIANCE_KEYWORDS.some(kw => a.includes(kw));
  });
  return main || null;
}
function getServiceKind(task) {
  // 2026-06-09 — visit 판별 공용 모듈 사용. (옛 인라인 task.status==='visit_only' 분기 → isAllItemsVisit)
  //   pure visit (status='visit_only' 또는 활성 items 전부 visit) → 'visit'.
  //   혼합 task (visit + 세척/냉매) 는 visit 가 아닌 main item 기준 분기 (혼합 시 VisitBadge 별도 표시).
  if (isAllItemsVisit(task)) return "visit";
  // 2026-06-06 — service code 기준 분기 (정확). workType 텍스트는 fallback.
  //   사고 이력: rowToTask 측 workItems[].workType 은 work_types.name 측 매핑돼
  //   '냉매_스탠드' / '세척_벽걸이' 같은 기종별 세분 이름. 사람 라벨('냉매충전')
  //   비교가 fail → 모두 'clean'로 떨어져 ❄️. (안현생 case).
  //   → serviceCode (work_types.service_types.code, rowToTask line 196 매핑) 1순위.
  const main = getMainItem(task);
  if (main) {
    const svc = String(main.serviceCode || main.service_code || "").toLowerCase();
    if (svc === "refrigerant") return "refrigerant";
    if (svc === "cleaning")    return "clean";
    // 옛 category_data.workItems 측 serviceCode 없는 경우 — workType 텍스트 패턴 fallback.
    const wt = String(main.workType || main.work_type || "");
    if (/냉매|가스|충전/.test(wt)) return "refrigerant";
    if (/세척|cleaning|clean/i.test(wt)) return "clean";
    return "clean";   // 최종 fallback (유솔H 본작업=세척 패턴 호환)
  }
  return "addon";
}

function formatTime(task) {
  if (task.scheduledTime) return String(task.scheduledTime).slice(0, 5);
  if (task.scheduledAt) {
    const d = new Date(task.scheduledAt);
    if (!isNaN(d.getTime())) {
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${hh}:${mm}`;
    }
  }
  return "—";
}
function formatDate(task) {
  const ymd = task.scheduledDate || task.requestedDate || "";
  const m = String(ymd).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  // 2026-05-24 fix — 정규식 매칭 후에도 mm/dd 유효성 검사 (예: '2015-15-94' invalid date 방지)
  const mm = parseInt(m[2], 10);
  const dd = parseInt(m[3], 10);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return "";
  return `${mm}/${dd}`;
}

function ChannelBadge({ task }) {
  if (task.principalCode !== "usol_n") return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 16, height: 16, borderRadius: 4,
      background: N_BADGE_COLOR, color: "#fff",
      fontSize: 9, fontWeight: 800, lineHeight: 1, flexShrink: 0,
    }}>N</span>
  );
}
// 2026-06-06 — AdminApp WORK_TYPE_ICONS 매핑과 동일하게 정렬.
//   세척 → ❄️ (Snowflake) / 냉매충전 → ⚡ (Zap) / addon → ⚡ / visit → 🚗.
//   직전 수정 (clean=💧, refrigerant=❄️) 거꾸로 매핑 → 사장님 flag 받고 원위치.
//   색은 Principal 의미 부여 (파랑/주황/회색) 유지 — Admin 회색 통일과 다르지만 아이콘만 일치.
function ServiceIcon({ kind, size = 14 }) {
  if (kind === "visit")       return <span style={{ fontSize: size, color: VISIT_COLOR }}>🚗</span>;
  if (kind === "addon")       return <span style={{ fontSize: size, color: REFRIGERANT_COLOR }}>⚡</span>;
  if (kind === "refrigerant") return <span style={{ fontSize: size, color: REFRIGERANT_COLOR }}>⚡</span>;
  // clean (세척, 옛 유솔H 본작업 패턴)
  return <span style={{ fontSize: size, color: CLEAN_COLOR }}>❄️</span>;
}

// 2026-06-11 — 유솔H ↔ 유솔N 탭 전환 가속용 in-memory 캐시.
//   key = principalCodes.join(',')  (정렬된 형태로 들어오므로 그대로 사용)
//   value = { data, ts }
//   TTL = 60s. Realtime 이벤트 시 전체 invalidate.
//   두 번째 전환부터 fetch 생략 → 즉시 표시.
const PRINCIPAL_CACHE_TTL_MS = 60_000;

export function PrincipalListTab({ t, user, principalCodes, partnerCode, onSelect, selectedTaskId }) {
  // 2026-06-10 — PC 반응형 1차: 1024px 이상 PC 통합 테이블 (뷰 A/B/quickFilter 한 화면 흡수).
  const isPc = useIsPc();
  const [view, setView] = useState("today");   // 'today' | 'all'
  const [autoFocusSearchOnAll, setAutoFocusSearchOnAll] = useState(false);
  const goToAll = useCallback((focusSearch = false) => {
    setAutoFocusSearchOnAll(focusSearch);
    setView("all");
  }, []);

  // 2026-06-06 — KA/crikrin (isPartner) 측 카운트 박스 + quickFilter (운영자 spec 통일).
  //   usol_n/usol_h 측 측 측 측 측 측 측 측 측 측 측 측 측 측.
  // 2026-06-09 — 유솔H 측 KA 와 동일 헤더 spec (사장님 [B]):
  //   isUsolH 측 단일 코드 ["usol_h"] (통합계정 측 selectedUsolCode='usol_h' 또는 단일 계정).
  //   showPartnerHeader = isPartner || isUsolH — fetch / countBoxes / quickFilter 측 동일 동작.
  //   유솔N 측 X (네이버 월정산 본문 측 옛 그대로).
  const isPartner = !!partnerCode;
  const isUsolH = Array.isArray(principalCodes)
    && principalCodes.length === 1
    && principalCodes[0] === "usol_h";
  const showPartnerHeader = isPartner || isUsolH;
  const headerPrincipalCode = isPartner ? partnerCode : (isUsolH ? "usol_h" : null);
  const [partnerCounts, setPartnerCounts] = useState({ todayCreated: 0, todayCompleted: 0, confirmed: 0 });
  const [quickFilter, setQuickFilter] = useState(null);   // 'todayCreated' | 'todayCompleted' | 'confirmed' | null
  const [qfTasks, setQfTasks] = useState([]);
  const [qfLoading, setQfLoading] = useState(false);

  // 뷰 A — 오늘 작업 + 카운트
  const [todayTasks, setTodayTasks]   = useState([]);
  const [counts, setCounts]           = useState({ total: 0, inProgress: 0, completed: 0, canceled: 0 });
  const [loadingA, setLoadingA]       = useState(true);

  // 뷰 B — 전체 작업
  const [allTasks, setAllTasks]       = useState([]);
  const [loadingB, setLoadingB]       = useState(false);
  const [allLoaded, setAllLoaded]     = useState(false);

  // 2026-06-11 — 탭 전환 캐시 (뷰 A / partnerCounts 각각).
  //   Realtime 이벤트 또는 TTL 초과 시 invalidate. principalCodes 키별 보관.
  const cacheA = useRef(new Map());
  const cachePartner = useRef(new Map());

  // 2026-06-11 — PC 전용 서버 페이지네이션 (1000행 캡 회피 + DB ORDER BY).
  //   PC view='all' 진입 시 fetchPrincipalListPaged 100건 단위 fetch + 더 보기.
  //   activeOnly = true (default) → status IN ('배정','확정','진행중') = 활성만.
  //   검색 = 서버 ilike (customer_name/district/address/task_no). 디바운스 300ms.
  //   모바일 뷰는 옛 refetchB 유지 (회귀 0).
  const PC_PAGE_SIZE = 100;
  const [pcTasks,    setPcTasks]    = useState([]);
  const [pcTotal,    setPcTotal]    = useState(0);
  const [pcOffset,   setPcOffset]   = useState(0);
  const [pcHasMore,  setPcHasMore]  = useState(false);
  const [pcLoading,  setPcLoading]  = useState(false);
  const [activeOnly, setActiveOnly] = useState(true);
  const [pcSearchInput, setPcSearchInput] = useState("");
  const [pcSearch,      setPcSearch]      = useState("");
  // 검색 디바운스 300ms.
  useEffect(() => {
    const t = setTimeout(() => setPcSearch(pcSearchInput), 300);
    return () => clearTimeout(t);
  }, [pcSearchInput]);

  // PC 페이지 fetch. reset=true 측 첫 페이지부터 / false 측 append.
  const fetchPcPage = useCallback(async ({ reset = false, currentOffset = 0 } = {}) => {
    if (!Array.isArray(principalCodes) || principalCodes.length === 0) return;
    setPcLoading(true);
    // 검색어 있으면 자동으로 전체 status (activeOnly false 효과) — 사장님 spec.
    const effectiveActiveOnly = activeOnly && !pcSearch.trim();
    const res = await fetchPrincipalListPaged({
      principalCodes,
      activeOnly: effectiveActiveOnly,
      search: pcSearch,
      pageSize: PC_PAGE_SIZE,
      offset: currentOffset,
    });
    if (res.ok) {
      setPcTasks(prev => reset ? res.tasks : [...prev, ...res.tasks]);
      setPcTotal(res.total);
      setPcOffset(currentOffset + res.tasks.length);
      setPcHasMore(res.hasMore);
    }
    setPcLoading(false);
  }, [principalCodes, activeOnly, pcSearch]);

  // activeOnly / pcSearch / principalCodes 변경 시 첫 페이지 reset.
  useEffect(() => {
    if (!isPc) return;
    fetchPcPage({ reset: true, currentOffset: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOnly, pcSearch, JSON.stringify(principalCodes), isPc]);

  // 뷰 A fetch — 캐시 우선, force=true 시 재fetch.
  const refetchA = useCallback(async ({ force = false } = {}) => {
    if (!Array.isArray(principalCodes) || principalCodes.length === 0) {
      setLoadingA(false);
      return;
    }
    const cacheKey = principalCodes.join(",");
    if (!force) {
      const cached = cacheA.current.get(cacheKey);
      if (cached && Date.now() - cached.ts < PRINCIPAL_CACHE_TTL_MS) {
        setTodayTasks(cached.data.todayTasks);
        setCounts(cached.data.counts);
        setLoadingA(false);
        return;
      }
    }
    setLoadingA(true);
    const [todayRes, countsRes] = await Promise.all([
      fetchPrincipalTodayTasks({ principalCodes }),
      fetchPrincipalStatusCounts({ principalCodes }),
    ]);
    const todayTasksNext = todayRes.tasks || [];
    const countsNext = countsRes.ok
      ? countsRes.counts
      : { total: 0, inProgress: 0, completed: 0, canceled: 0 };
    cacheA.current.set(cacheKey, {
      data: { todayTasks: todayTasksNext, counts: countsNext },
      ts: Date.now(),
    });
    setTodayTasks(todayTasksNext);
    setCounts(countsNext);
    setLoadingA(false);
  }, [principalCodes]);

  // 뷰 B fetch — 전체
  const refetchB = useCallback(async () => {
    if (!Array.isArray(principalCodes) || principalCodes.length === 0) return;
    setLoadingB(true);
    try {
      // 2026-06-09 — 서버 사이드 principal 필터 (옛엔 null → tenant 전체 fetch 후 클라 분리).
      //   통합계정 [유솔H][유솔N] 탭 측 selectedUsolCode 기반 effectiveCodes 측 PrincipalApp 측 전달.
      //   usol_h 15건 / usol_n 1,340건 — 다른 원청 불러올 필요 X.
      const res = await getTasks("principal", user?.id || "principal", principalCodes);
      if (res && res.ok !== false) {
        const { list } = v14FindTaskList(res);
        if (Array.isArray(list)) {
          const normalized = list.map(v14NormalizeTask).filter(Boolean);
          // 서버 측 이미 필터됨 — filterTasksForPrincipal 측 redundant 측 안전망 (회귀 0).
          const filtered = filterTasksForPrincipal(normalized, principalCodes);
          setAllTasks(filtered);
          setAllLoaded(true);
        }
      }
    } catch (e) {
      console.error("[PrincipalListTab.refetchB]", e);
    } finally {
      setLoadingB(false);
    }
  }, [principalCodes, user?.id]);

  useEffect(() => {
    refetchA();
  }, [refetchA]);

  useEffect(() => {
    if (view === "all" && !allLoaded) refetchB();
  }, [view, allLoaded, refetchB]);

  // Realtime — 캐시 전체 invalidate 후 현재 뷰에 맞게 강제 refetch.
  useRealtimeTasks(() => {
    cacheA.current.clear();
    cachePartner.current.clear();
    if (view === "today") refetchA({ force: true });
    else { setAllLoaded(false); refetchB(); }
  });

  // 2026-06-06 — KA/crikrin: 카운트 박스 fetch (DB count:exact 3개, 자기 principalCode 측 측).
  // 2026-06-09 — 유솔H 측 동일 fetch (showPartnerHeader 측).
  // 2026-06-11 — 동일 코드 재진입 시 캐시 hit (TTL 60s) → fetch 생략.
  useEffect(() => {
    if (!showPartnerHeader || !headerPrincipalCode) return;
    let alive = true;
    const cacheKey = `partner:${headerPrincipalCode}`;
    const cached = cachePartner.current.get(cacheKey);
    if (cached && Date.now() - cached.ts < PRINCIPAL_CACHE_TTL_MS) {
      setPartnerCounts(cached.data);
      return;
    }
    fetchAllPrincipalCounts({ principalCodes: [headerPrincipalCode] })
      .then(res => {
        if (!alive || !res.ok) return;
        cachePartner.current.set(cacheKey, { data: res.counts, ts: Date.now() });
        setPartnerCounts(res.counts);
      });
    return () => { alive = false; };
  }, [showPartnerHeader, headerPrincipalCode]);

  // 2026-06-06 — quickFilter 활성 시 DB 측 측 측 측 fetch (필터 적용된 list).
  // 2026-06-09 — 유솔H 측 동일 동작 (showPartnerHeader 측).
  useEffect(() => {
    if (!showPartnerHeader || !headerPrincipalCode || !quickFilter) { setQfTasks([]); return; }
    let alive = true;
    setQfLoading(true);
    fetchAllPrincipalTasks({
      principalCodes: [headerPrincipalCode],
      quickFilter,
      limit: 1000,
    }).then(res => {
      if (!alive) return;
      if (res.ok) setQfTasks(res.tasks);
    }).finally(() => { if (alive) setQfLoading(false); });
    return () => { alive = false; };
  }, [showPartnerHeader, headerPrincipalCode, quickFilter]);

  // 2026-06-10 — PC (1024px 이상): 뷰 A/B/quickFilter 한 화면(ViewPcTable)으로 흡수.
  //   fetch 분리는 유지 — view='today' 측 가벼운 refetchA, 'all' 측 refetchB, quickFilter 측 qf fetch.
  if (isPc) {
    return (
      <ViewPcTable
        t={t}
        view={view}
        setView={setView}
        todayTasks={todayTasks}
        loadingA={loadingA}
        counts={counts}
        partnerCounts={partnerCounts}
        showPartnerHeader={showPartnerHeader}
        quickFilter={quickFilter}
        setQuickFilter={setQuickFilter}
        qfTasks={qfTasks}
        qfLoading={qfLoading}
        onSelect={onSelect}
        selectedTaskId={selectedTaskId}
        // 2026-06-11 — PC 서버 페이지네이션 (view='all').
        pcTasks={pcTasks}
        pcTotal={pcTotal}
        pcLoading={pcLoading}
        pcHasMore={pcHasMore}
        pcOffset={pcOffset}
        onLoadMore={() => fetchPcPage({ reset: false, currentOffset: pcOffset })}
        activeOnly={activeOnly}
        setActiveOnly={setActiveOnly}
        searchInput={pcSearchInput}
        setSearchInput={setPcSearchInput}
      />
    );
  }

  // showPartnerHeader + quickFilter 활성 시 → 필터 결과 뷰 (옛 today/all 측 측 측 측 measure).
  if (showPartnerHeader && quickFilter) {
    return (
      <ViewQuickFilter
        t={t}
        partnerCounts={partnerCounts}
        quickFilter={quickFilter}
        onQuickFilter={(k) => setQuickFilter(prev => prev === k ? null : k)}
        onClearFilter={() => setQuickFilter(null)}
        tasks={qfTasks}
        loading={qfLoading}
        onSelect={onSelect}
      />
    );
  }

  // 2026-06-06 — 카운트 박스 prop 측 isPartner 측 측 측 측 측 (usol 측 X).
  // 2026-06-09 — 유솔H 측에서도 동일 노출 (showPartnerHeader). 유솔N 측 X (네이버 본문 측).
  const countBoxesProps = showPartnerHeader ? {
    counts: partnerCounts,
    selected: quickFilter,
    onSelect: (k) => setQuickFilter(prev => prev === k ? null : k),
  } : null;

  if (view === "all") {
    return (
      <ViewAll
        tasks={allTasks}
        loading={loadingB}
        autoFocusSearch={autoFocusSearchOnAll}
        onBack={() => { setAutoFocusSearchOnAll(false); setView("today"); }}
        onSelect={onSelect}
        countBoxesProps={countBoxesProps}
      />
    );
  }
  return (
    <ViewToday
      todayTasks={todayTasks}
      counts={counts}
      loading={loadingA}
      onSeeAll={() => goToAll(false)}
      onSearchClick={() => goToAll(true)}
      onSelect={onSelect}
      countBoxesProps={countBoxesProps}
    />
  );
}

// 2026-06-06 — KA/crikrin 카운트 박스 필터 결과 뷰.
function ViewQuickFilter({ t, partnerCounts, quickFilter, onQuickFilter, onClearFilter, tasks, loading, onSelect }) {
  const sorted = useMemo(() => {
    const arr = [...(tasks || [])];
    arr.sort((a, b) => {
      const ra = a.received_at || "";
      const rb = b.received_at || "";
      return String(rb).localeCompare(String(ra));
    });
    return arr;
  }, [tasks]);
  return (
    <div style={{ padding: 16, paddingBottom: 80 }}>
      <CountBoxes counts={partnerCounts} selected={quickFilter} onSelect={onQuickFilter}/>
      <button onClick={onClearFilter} style={{
        marginBottom: 10, padding: "6px 12px",
        background: "transparent",
        border: "1px solid var(--border, #2A2A2A)",
        borderRadius: 8,
        color: "var(--text-secondary)",
        fontSize: 11, fontWeight: 700,
        cursor: "pointer", fontFamily: "inherit",
      }}>✕ 필터 해제</button>
      {loading && <div style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)", fontSize: 12 }}>불러오는 중...</div>}
      {!loading && sorted.length === 0 && (
        <div style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)", fontSize: 12 }}>
          해당하는 작업이 없습니다
        </div>
      )}
      {!loading && sorted.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sorted.map(task => {
            // 2026-06-06 — fetchAllPrincipalTasks 측 task_items (nested appliance_types/work_types) 측 반환.
            //   v14NormalizeTask 측 t.task_items 측 X (workItems / summaryItems / workType 측만).
            //   → task_items 측 workItems shape 측 측 measure normalize 측.
            //   누락 시 appliance 빈 값 → TaskRow 측 "(—)" 회귀.
            const workItems = (Array.isArray(task.task_items) ? task.task_items : []).map(it => ({
              workType:    it.work_types?.name || it.workType || "",
              appliance:   it.appliance_types?.name || it.appliance || "",
              qty:         it.qty || 1,
              serviceCode: it.work_types?.service_types?.code || it.service_code || null,
              orderType:   it.order_type || it.orderType || null,
            }));
            const adapted = v14NormalizeTask({
              ...task,
              customer: task.customer_name || task.customer,
              region:   task.district || task.region,
              principal: task.principalCode || task.principal_code || "",
              workItems,
            });
            return adapted ? <TaskRow key={adapted.id} task={adapted} onClick={() => onSelect(adapted)}/> : null;
          })}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 뷰 A — 첫 화면
// ════════════════════════════════════════════════════════════
function ViewToday({ todayTasks, counts, loading, onSeeAll, onSearchClick, onSelect, countBoxesProps }) {
  // 2026-05-25 — 취소 항목 맨 아래로. 그 외는 scheduled_at asc (fetchPrincipalTodayTasks 정렬 유지).
  const sortedToday = useMemo(() => {
    return [...todayTasks].sort((a, b) => {
      const ca = a.status === "취소" ? 1 : 0;
      const cb = b.status === "취소" ? 1 : 0;
      if (ca !== cb) return ca - cb;
      const sa = a.scheduledAt || a.scheduled_at || "";
      const sb = b.scheduledAt || b.scheduled_at || "";
      return String(sa).localeCompare(String(sb));
    });
  }, [todayTasks]);
  return (
    <div className="fade-in" style={{ padding: "16px 14px 80px" }}>
      {/* 2026-06-06 — isPartner (KA/crikrin) 측 측 상단 카운트 박스 */}
      {countBoxesProps && <CountBoxes {...countBoxesProps}/>}

      {/* 한 줄 통계 */}
      <div style={{
        fontSize: 12, color: "#B5B0A8", fontWeight: 600,
        marginBottom: 12, letterSpacing: 0.2,
      }}>
        전체 <Stat n={counts.total}/> · 활성 <Stat n={counts.inProgress}/> · 완료 <Stat n={counts.completed}/> · 취소 <Stat n={counts.canceled} danger/>
      </div>

      {/* 검색창 (탭 → 뷰 B + autoFocus). 직접 입력 X. */}
      <div onClick={onSearchClick} style={{
        position: "relative", marginBottom: 10, cursor: "pointer",
      }}>
        <Search size={14} style={{
          position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
          color: "#9CA3AF", pointerEvents: "none",
        }}/>
        <input
          type="text"
          readOnly
          tabIndex={-1}
          placeholder="고객명 · 주소 · 작업번호 · 상품주문번호 검색"
          onClick={(e) => { e.preventDefault(); e.currentTarget.blur(); onSearchClick(); }}
          onFocus={(e) => e.currentTarget.blur()}
          style={{
            width: "100%", padding: "10px 12px 10px 32px",
            background: "var(--bg-secondary, #161619)",
            border: "1px solid var(--border, #29292F)",
            borderRadius: 10,
            color: "var(--text-primary, #FAF8F5)",
            fontSize: 12, fontWeight: 600,
            fontFamily: "inherit", outline: "none",
            cursor: "pointer",
          }}
        />
      </div>

      {/* 전체 작업 보기 버튼 — 검색창 바로 아래 */}
      <button onClick={onSeeAll} style={seeAllButtonStyle}>
        전체 작업 {counts.total.toLocaleString()}건 보기 →
      </button>

      {/* 오늘 작업 섹션 */}
      <div style={{ marginTop: 22, marginBottom: 14, display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary, #FAF8F5)" }}>오늘 작업</span>
        {!loading && (
          <span style={{ fontSize: 11, color: "#9CA3AF" }}>{todayTasks.length}건</span>
        )}
      </div>

      {loading ? (
        <div style={loadingBoxStyle}>불러오는 중...</div>
      ) : todayTasks.length === 0 ? (
        <EmptyToday onSeeAll={onSeeAll}/>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sortedToday.map((task, idx) => (
            <TaskRow key={task.id || task.taskNo || idx} task={task} onClick={() => onSelect?.(task)}/>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ n, danger }) {
  // 2026-06-11 — danger = 취소 라벨 측 빨강 연한 톤 (principalStatusBadge 정합).
  return (
    <span style={{
      color: danger ? "#EF4444" : "var(--text-primary, #FAF8F5)",
      fontWeight: 800,
    }}>
      {(n || 0).toLocaleString()}
    </span>
  );
}

function EmptyToday({ onSeeAll }) {
  return (
    <div style={{
      padding: "40px 20px", textAlign: "center",
      background: "var(--bg-secondary, #1A1A1A)",
      border: "1px solid var(--border, #2A2A2A)",
      borderRadius: 12,
    }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>📭</div>
      <div style={{ fontSize: 13, color: "var(--text-primary, #FAF8F5)", fontWeight: 600, marginBottom: 4 }}>
        오늘 예정된 작업이 없어요
      </div>
      <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 14 }}>
        전체 작업 목록에서 확인해 보세요
      </div>
      <button onClick={onSeeAll} style={{
        background: "transparent", border: `1px solid ${MAGENTA}`,
        color: MAGENTA, padding: "7px 14px", borderRadius: 100,
        fontSize: 11, fontWeight: 700, fontFamily: "inherit",
        cursor: "pointer",
      }}>전체 보기 →</button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 뷰 B — 전체 목록 (옛 PrincipalListTab 동작)
// ════════════════════════════════════════════════════════════
function ViewAll({ tasks, loading, autoFocusSearch, onBack, onSelect, countBoxesProps }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const searchRef = useRef(null);

  useEffect(() => {
    if (autoFocusSearch && searchRef.current) {
      // 모바일 키보드 대응 — 마운트 직후 1tick 뒤
      const id = setTimeout(() => searchRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [autoFocusSearch]);

  const filtered = useMemo(() => {
    let list = tasks;
    // 기본 화면(검색 X + 필터 'all') 측 catch 완료/visit_only 측 catch.
    //   검색하면 측 catch / 필터 칩 측 catch 측 catch 측 catch 표시.
    const noSearch = !search.trim();
    if (filter === "all" && noSearch) {
      list = list.filter(x => x.status !== "완료" && x.status !== "visit_only");
    }
    if (filter === "미배정") list = list.filter(x => x.status === "미배정");
    else if (filter === "배정") list = list.filter(x => x.status === "배정");
    else if (filter === "확정") list = list.filter(x => x.status === "확정");
    else if (filter === "완료") list = list.filter(x => x.status === "완료" || x.status === "visit_only");
    else if (filter === "취소") list = list.filter(x => x.status === "취소");

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(x => {
        const cust = String(x.customer || "").toLowerCase();
        const addr = String(x.address || "").toLowerCase();
        const tno  = String(x.taskNo || x.taskCode || "").toLowerCase();
        if (cust.includes(q) || addr.includes(q) || tno.includes(q)) return true;
        // 상품주문번호 — workItems 측 productOrderId 측 매칭 (부분 일치)
        const items = Array.isArray(x.workItems) ? x.workItems : [];
        for (const it of items) {
          const poid = String(it.productOrderId || it.product_order_id || "").toLowerCase();
          if (poid && poid.includes(q)) return true;
        }
        return false;
      });
    }
    return [...list].sort((a, b) => {
      // 2026-05-25 — 취소 항목은 맨 아래로
      const ca = a.status === "취소" ? 1 : 0;
      const cb = b.status === "취소" ? 1 : 0;
      if (ca !== cb) return ca - cb;
      const ra = a.received_at || a.receivedAt || a.created_at || a.createdAt || "";
      const rb = b.received_at || b.receivedAt || b.created_at || b.createdAt || "";
      return String(rb).localeCompare(String(ra));
    });
  }, [tasks, filter, search]);

  return (
    <div className="fade-in" style={{ padding: "16px 14px 80px" }}>
      {/* 2026-06-06 — isPartner (KA/crikrin) 측 상단 카운트 박스 */}
      {countBoxesProps && <CountBoxes {...countBoxesProps}/>}

      {/* 헤더 — 뒤로 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <button onClick={onBack} style={{
          background: "var(--bg-secondary, #1A1A1A)",
          border: "1px solid var(--border, #2A2A2A)",
          borderRadius: 8, padding: "6px 8px",
          color: "var(--text-primary, #FAF8F5)",
          cursor: "pointer", display: "flex", alignItems: "center",
          fontFamily: "inherit",
        }}><ArrowLeft size={14}/></button>
        <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary, #FAF8F5)" }}>전체 작업</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#9CA3AF" }}>
          {loading ? "..." : `${filtered.length} / ${tasks.length}건`}
        </span>
      </div>

      {/* 검색 */}
      <div style={{ position: "relative", marginBottom: 10 }}>
        <Search size={14} style={{
          position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
          color: "#9CA3AF", pointerEvents: "none",
        }}/>
        <input
          ref={searchRef}
          type="text" value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="고객명 / 주소 / 작업번호 / 상품주문번호"
          style={{
            width: "100%", padding: "10px 12px 10px 32px",
            background: "var(--bg-secondary, #1A1A1A)",
            border: "1px solid var(--border, #2A2A2A)",
            borderRadius: 10,
            color: "var(--text-primary, #FAF8F5)",
            fontSize: 12, fontWeight: 600,
            fontFamily: "inherit", outline: "none",
          }}
        />
      </div>

      {/* 필터 chip */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { id: "all",    label: "전체" },
          { id: "미배정", label: "미배정" },
          { id: "배정",   label: "배정" },
          { id: "확정",   label: "확정" },
          { id: "완료",   label: "완료" },
          { id: "취소",   label: "취소" },
        ].map(opt => {
          const active = filter === opt.id;
          return (
            <button key={opt.id} onClick={() => setFilter(opt.id)} style={{
              padding: "6px 12px",
              background: active ? MAGENTA : "var(--bg-secondary, #1A1A1A)",
              color: active ? "#fff" : "var(--text-secondary, #B5B0A8)",
              border: `1px solid ${active ? MAGENTA : "var(--border, #2A2A2A)"}`,
              borderRadius: 100, fontSize: 11, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}>{opt.label}</button>
          );
        })}
      </div>

      {loading && tasks.length === 0 ? (
        <div style={loadingBoxStyle}>불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div style={{
          padding: "40px 20px", textAlign: "center",
          color: "#9CA3AF", fontSize: 12,
          background: "var(--bg-secondary, #1A1A1A)",
          border: "1px solid var(--border, #2A2A2A)",
          borderRadius: 8,
        }}>작업이 없습니다</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map((task, idx) => (
            <TaskRow key={task.id || task.taskNo || idx} task={task} onClick={() => onSelect?.(task)}/>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, onClick }) {
  const kind = getServiceKind(task);
  const status = getStatusBadge(task.status);
  const time = formatTime(task);
  const date = formatDate(task);
  // 2026-06-09 — 혼합 task (visit + 세척/냉매) 측 visit 배지 별도 표시.
  //   pure visit (kind='visit') 는 메인 아이콘 자체가 🚗 — 중복 표시 X.
  const showVisitBadge = kind !== "visit" && hasAnyVisitItem(task);
  // 2026-06-06 — 두 종류 fetch shape 모두 측측:
  //   · loadTasksForRole → rowToTask: workItems[] + flat appliance
  //   · fetchAllPrincipalTasks (카운트박스): task_items[] + nested appliance_types.name
  const items = Array.isArray(task.workItems) && task.workItems.length > 0
    ? task.workItems
    : (Array.isArray(task.task_items) ? task.task_items : []);
  const mainItem = getMainItem(task);
  const displayItem = mainItem || items[0] || {};
  const appliance = displayItem.appliance
    || displayItem.appliance_types?.name
    || task.appliance
    || "";
  const qty = displayItem.qty || task.qty || 1;
  const otherCount = Math.max(0, items.length - 1);
  // 2026-06-06 — appliance 빈 값일 때 "(—)" / 빈 괄호 측, 괄호째 생략.
  const applianceText = appliance
    ? `(${appliance}${qty > 1 ? `×${qty}` : ""}${otherCount > 0 ? ` +${otherCount}` : ""})`
    : "";
  const timeStr = [date, time !== "—" ? time : ""].filter(Boolean).join(" ");

  const isCancelled = task.status === "취소";
  return (
    <div onClick={onClick} style={{
      background: "var(--bg-elevated, #1F1F1F)",
      border: "1px solid var(--border, #2A2A2A)",
      borderRadius: 8,
      padding: "8px 10px",
      display: "flex", alignItems: "center", gap: 8,
      minHeight: 38,
      cursor: "pointer",
      opacity: isCancelled ? 0.45 : 1,
    }}>
      <div style={{ flexShrink: 0, width: 14, textAlign: "center" }}>
        <ServiceIcon kind={kind}/>
      </div>
      <span style={{
        flexShrink: 0, fontSize: 12, fontWeight: 500,
        color: "var(--text-primary, #FAF8F5)",
        maxWidth: 90,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{task.customer || "—"}</span>
      <ChannelBadge task={task}/>
      {showVisitBadge && <VisitBadge/>}
      <span style={{
        flex: 1, minWidth: 0,
        fontSize: 11, fontWeight: 400, color: "#888",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {(() => {
          // 2026-06-09 — region 비면 address 측 구/군/시 키워드 추출 (출장비 행 잘림 사고 차단).
          const regionLabel = regionOrDistrictFromAddress(task.region, task.address);
          return (
            <>
              {[applianceText, regionLabel].filter(Boolean).join(" · ")}
              {timeStr && (<>{(applianceText || regionLabel) ? " · " : ""}<span style={{ color: DATE_TIME_COLOR, fontWeight: 600 }}>{timeStr}</span></>)}
            </>
          );
        })()}
      </span>
      {task.assignedEngineer && (
        <span style={{
          flexShrink: 0, fontSize: 11, fontWeight: 500,
          color: "#ddd", background: "#2a2a2a",
          padding: "2px 8px", borderRadius: 4,
          whiteSpace: "nowrap",
        }}>{task.assignedEngineer}</span>
      )}
      <span style={{
        flexShrink: 0, fontSize: 10, fontWeight: 700,
        color: status.color, background: status.bg,
        padding: "2px 7px", borderRadius: 8,
        whiteSpace: "nowrap",
      }}>{getStatusLabel(task.status)}</span>
    </div>
  );
}

const seeAllButtonStyle = {
  width: "100%", marginTop: 18, padding: "12px 14px",
  background: "var(--bg-secondary, #1A1A1A)",
  border: "1px solid var(--border, #2A2A2A)",
  borderRadius: 10,
  color: "var(--text-primary, #FAF8F5)",
  fontSize: 12, fontWeight: 700,
  fontFamily: "inherit", cursor: "pointer",
};

const loadingBoxStyle = {
  padding: "40px 20px", textAlign: "center",
  color: "#9CA3AF", fontSize: 12,
};

// 2026-06-10 4차 — PC 표 컬럼 폭 (div + CSS Grid). 합 100, fr 단위로 부모 폭 비례 분배.
//   사장님 진단: <table>이 부모 max-width를 깨는 케이스 → div+grid로 회피.
// 2026-06-11 9차 — minmax(0, Xfr) 로 변경. 기본 fr 단위는 min-content 보장 때문에
//   긴 영문 이름(ZHANGHUIYING 등)이 들어간 행에서 컬럼 폭이 늘어나 다른 행과
//   정렬·폭이 어긋남. minmax(0, Xfr) 로 하한을 0으로 강제 → 내용 길이와 무관하게
//   fr 비율 고정. 텍스트는 셀의 ellipsis 로 잘림.
// 2026-06-11 — 기종·수량 셀에 작업종류 태그 인라인 → 26fr → 32fr 확대.
//   고객·지역·기사·시간·상태 미세 축소로 100 합산 유지.
const PC_GRID_COLS = "minmax(0, 18fr) minmax(0, 32fr) minmax(0, 13fr) minmax(0, 10fr) minmax(0, 14fr) minmax(0, 13fr)";
// 2026-06-10 8차 — 컬럼별 정렬 매핑.
//   사장님 spec: 고객·기종·지역·기사 = 왼쪽 / 시간·상태 = 가운데.
const PC_HEADER_COLS = [
  { label: "고객",      align: "left"   },
  { label: "기종·수량", align: "left"   },
  { label: "지역",      align: "left"   },
  { label: "시간",      align: "center" },
  { label: "기사",      align: "left"   },
  { label: "상태",      align: "center" },
];

// 2026-06-10 — PC (1024px 이상) 통합 테이블 — 뷰 A/B/quickFilter 한 화면 흡수.
//   상단: 한 줄 통계 + 필터 토글(오늘/전체) + 검색.
//   본문: sticky 헤더 테이블 (고객 / 기종·수량 / 지역 / 시간 / 기사 / 상태).
//   행 클릭 → onSelect(task) → PcShell 우측 패널에 상세 표시.
//   fetch 분리 유지: 'today' = 가벼운 refetchA / 'all' = refetchB (사장님 spec 보강).
function ViewPcTable({
  t,
  view, setView,
  todayTasks,
  loadingA,
  counts, partnerCounts,
  showPartnerHeader,
  quickFilter, setQuickFilter,
  qfTasks, qfLoading,
  onSelect,
  selectedTaskId,
  // 2026-06-11 — PC 서버 페이지네이션 (view='all').
  pcTasks, pcTotal, pcLoading, pcHasMore, pcOffset,
  onLoadMore,
  activeOnly, setActiveOnly,
  searchInput, setSearchInput,
}) {
  // 표시 데이터 선택. view='all' 측 서버 페이지네이션 (pcTasks). 클라 filter 폐기.
  let sourceTasks, sourceLoading, isServerPaged = false;
  if (quickFilter) {
    sourceTasks   = qfTasks;
    sourceLoading = qfLoading;
  } else if (view === "all") {
    sourceTasks   = pcTasks;
    sourceLoading = pcLoading;
    isServerPaged = true;
  } else {
    sourceTasks   = todayTasks;
    sourceLoading = loadingA;
  }

  return (
    <div style={{
      // 2026-06-10 7차 — 가운데 정렬 = 박스가 아닌 "셀 안 텍스트" 라는 사장님 재정의.
      //   wrapper는 다시 full-width (maxWidth/margin auto 폐기). 텍스트 가운데는
      //   각 셀(헤더+데이터) 에 textAlign: center 추가로 처리.
      //   폰트도 추가 확대 — 본문 15→17, 헤더 12→14, 상태 12→14.
      width: "100%",
      padding: "20px 24px 24px",
      minHeight: "100vh",
      background: t.bg,
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box",
    }}>
      {/* 상단 한 줄 — 통계 + 필터 토글 + 검색 */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        marginBottom: 14,
        flexWrap: "wrap",
      }}>
        {showPartnerHeader ? (
          <div style={{ flex: 1, minWidth: 0 }}>
            <CountBoxes
              counts={partnerCounts}
              selected={quickFilter}
              onSelect={(k) => setQuickFilter(prev => prev === k ? null : k)}
            />
          </div>
        ) : (
          <div style={{
            display: "flex",
            gap: 22,
            padding: "10px 16px",
            background: t.bgElevated,
            border: `1px solid ${t.border}`,
            borderRadius: 8,
          }}>
            <StatInline t={t} label="전체" value={counts.total}/>
            <StatInline t={t} label="활성" value={counts.inProgress} accent/>
            <StatInline t={t} label="완료" value={counts.completed}  muted/>
            <StatInline t={t} label="취소" value={counts.canceled}   danger/>
          </div>
        )}

        {/* 필터 토글 — quickFilter 미활성 때만. */}
        {!quickFilter && (
          <div style={{
            display: "flex",
            gap: 4,
            padding: 3,
            background: t.bgElevated,
            border: `1px solid ${t.border}`,
            borderRadius: 8,
          }}>
            {[
              { key: "today", label: "오늘" },
              { key: "all",   label: "전체" },
            ].map(b => {
              const active = view === b.key;
              return (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setView(b.key)}
                  style={{
                    padding: "6px 14px",
                    background: active ? t.accent : "transparent",
                    color: active ? "#fff" : t.textSecondary,
                    border: "none",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >{b.label}</button>
              );
            })}
          </div>
        )}

        {/* 2026-06-11 — view='all' 전용 "활성만" 토글 (default on).
            검색 입력 시 자동으로 전체 status 측 fetch (effectiveActiveOnly=false). */}
        {view === "all" && !quickFilter && (
          <button
            type="button"
            onClick={() => setActiveOnly?.(v => !v)}
            disabled={!!searchInput?.trim()}
            style={{
              padding: "7px 13px",
              background: activeOnly && !searchInput?.trim() ? t.accent : t.bgElevated,
              color:      activeOnly && !searchInput?.trim() ? "#fff"   : t.textSecondary,
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: searchInput?.trim() ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              opacity: searchInput?.trim() ? 0.5 : 1,
            }}
            title={searchInput?.trim() ? "검색 시 전체 status" : "활성만 / 전체 토글"}
          >
            {activeOnly && !searchInput?.trim() ? "활성만" : "전체 status"}
          </button>
        )}

        {/* 검색 — view='all' 측 서버 ilike. 그 외 측 옛 동작 (today 측 클라 측 검색 X 측 미지원). */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 12px",
          background: t.bgElevated,
          border: `1px solid ${t.border}`,
          borderRadius: 8,
          minWidth: 240,
        }}>
          <Search size={14} color={t.textMuted}/>
          <input
            type="text"
            value={searchInput || ""}
            onChange={(e) => setSearchInput?.(e.target.value)}
            placeholder="고객·지역·주소·작업번호 검색"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: t.text,
              fontSize: 12,
              fontFamily: "inherit",
            }}
          />
        </div>
      </div>

      {/* 테이블 */}
      <div style={{
        flex: 1,
        background: t.bgElevated,
        borderRadius: 10,
        border: `1px solid ${t.border}`,
        overflow: "auto",
      }}>
        {/* 2026-06-10 4차 — <table> 폐기 → div + CSS Grid. */}
        {/*   사장님 진단: <table>이 부모 max-width 깨는 케이스 확정. div는 표준 block 동작이라 */}
        {/*   부모 wrapper 1280 cap이 그대로 적용됨. 컬럼 폭은 PC_GRID_COLS fr 비례 분배. */}
        <div style={{ width: "100%", fontSize: 17 }}>
          {/* 헤더 행 — sticky */}
          <div style={{
            display: "grid",
            gridTemplateColumns: PC_GRID_COLS,
            alignItems: "center",
            position: "sticky",
            top: 0,
            background: t.bgElevated,
            zIndex: 2,
            borderBottom: `1px solid ${t.border}`,
          }}>
            {PC_HEADER_COLS.map(col => (
              <div key={col.label} style={{
                // 2026-06-11 — 헤더·본문 폰트 통일. uppercase / letterSpacing 0.4 폐기.
                //   본문 17 / 헤더 14 였던 차이 해소 → 둘 다 17.
                //   한국어 라벨 가독성 위해 letterSpacing 0.2 로 축소.
                padding: "13px 16px",
                fontSize: 17,
                fontWeight: 700,
                color: t.textMuted,
                letterSpacing: 0.2,
                textAlign: col.align,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>{col.label}</div>
            ))}
          </div>
          {/* 본문 행들 — 서버 페이지네이션 (view='all') 측 sourceTasks 그대로 사용. 클라 filter X. */}
          {sourceLoading && (sourceTasks?.length || 0) === 0 ? (
            <div style={pcEmptyCellStyle(t)}>불러오는 중...</div>
          ) : (sourceTasks?.length || 0) === 0 ? (
            <div style={pcEmptyCellStyle(t)}>표시할 작업 없음</div>
          ) : (
            <>
              {sourceTasks.map((task, idx) => (
                <PcTableRow
                  key={task.id || task.taskNo || idx}
                  t={t}
                  task={task}
                  isSelected={!!selectedTaskId && task.id === selectedTaskId}
                  onClick={() => onSelect?.(task)}
                />
              ))}
              {/* 더 보기 + 총 건수 (서버 페이지네이션 측만 표시). */}
              {isServerPaged && (
                <div style={{
                  padding: "16px 20px",
                  textAlign: "center",
                  borderTop: `1px solid ${t.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 14,
                  flexWrap: "wrap",
                }}>
                  <span style={{ fontSize: 13, color: t.textMuted, fontWeight: 600 }}>
                    {sourceTasks.length} / {pcTotal} 건
                  </span>
                  {pcHasMore && (
                    <button
                      type="button"
                      onClick={onLoadMore}
                      disabled={pcLoading}
                      style={{
                        padding: "8px 18px",
                        background: t.accent,
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: pcLoading ? "wait" : "pointer",
                        opacity: pcLoading ? 0.6 : 1,
                        fontFamily: "inherit",
                      }}
                    >{pcLoading ? "불러오는 중..." : "더 보기"}</button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatInline({ t, label, value, accent, muted, danger }) {
  // 2026-06-11 — danger = 빨강 연한 톤 (취소 라벨 측). principalStatusBadge 취소 색과 정합.
  const color = danger ? "#EF4444" : accent ? t.accent : muted ? t.textMuted : t.text;
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
      <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>{label}</span>
      <span className="mono" style={{ fontSize: 16, fontWeight: 800, color }}>{value ?? 0}</span>
    </div>
  );
}

function pcEmptyCellStyle(t) {
  return {
    padding: "56px 16px",
    textAlign: "center",
    color: t.textMuted,
    fontSize: 15,
  };
}

function PcTableRow({ t, task, isSelected, onClick }) {
  const items = Array.isArray(task.workItems) && task.workItems.length > 0
    ? task.workItems
    : (Array.isArray(task.task_items) ? task.task_items : []);
  // 2026-06-10 — 모바일 TaskRow(line 645-656)와 동일 로직.
  //   사고: 옛 코드는 items 전체 qty 합산 → "세척_스탠드 1 + 냉매점검 1" → "스탠드 ×2" 잘못 표시.
  //   수정: 대표 item만 qty 표시, 나머지 건수는 +N.
  const mainItem = getMainItem(task);
  const displayItem = mainItem || items[0] || {};
  const appliance = displayItem.appliance
    || displayItem.appliance_types?.name
    || task.appliance
    || "";
  const qty = displayItem.qty || task.qty || 1;
  const otherCount = Math.max(0, items.length - 1);
  const itemSummary = appliance
    ? `${appliance}${qty > 1 ? ` ×${qty}` : ""}${otherCount > 0 ? ` +${otherCount}` : ""}`
    : "—";
  // 2026-06-11 — 작업종류 태그 (기종 셀 인라인). 우선순위: refrigerant > clean > addon > visit.
  const serviceKind = getServiceKind(task);
  // 2026-06-10 — 모바일 TaskRow(line 689)와 동일 호출 — task.region 우선, 빈 값이면 address 키워드 추출.
  //   address 단일 인자로 호출하면 "서울특별시"가 먼저 매치돼 시/도까지만 나옴.
  const region = regionOrDistrictFromAddress(task.region, task.address || task.customerAddress) || "—";
  const time = formatTime(task);
  const engineer = task.assignedEngineer || task.engineer || "미배정";
  const statusLabel = getStatusLabel(task.status) || task.status || "—";
  const statusBadge = getStatusBadge(task.status);
  // 2026-06-10 4차 — <tr>/<td> 폐기 → div + grid 셀.
  // 2026-06-10 8차 — 셀별 textAlign 혼합 + 선택행 강조(다크+핑크 8% alpha).
  // 2026-06-11 9차 — alignItems: center 로 텍스트 셀 / status 배지 셀 vertical 정렬 통일.
  return (
    <div
      onClick={onClick}
      className="clickable"
      style={{
        display: "grid",
        gridTemplateColumns: PC_GRID_COLS,
        alignItems: "center",
        cursor: "pointer",
        borderBottom: `1px solid ${t.border}`,
        background: isSelected ? "rgba(255, 77, 158, 0.10)" : "transparent",
      }}
    >
      <div style={pcTdStyle(t, { fontWeight: 700, color: t.text, textAlign: "left" })}>{task.customer || task.customerName || "—"}</div>
      <div style={pcTdStyle(t, { textAlign: "left" })}>
        <ServiceTag kind={serviceKind}/>
        <span>{itemSummary}</span>
      </div>
      <div style={pcTdStyle(t, { textAlign: "left" })}>{region}</div>
      <div style={pcTdStyle(t, { textAlign: "center" })} className="mono">{time}</div>
      <div style={pcTdStyle(t, { textAlign: "left" })}>{engineer}</div>
      <div style={pcTdStyle(t, { textAlign: "center" })}>
        <span style={{
          display: "inline-block",
          fontSize: 14, fontWeight: 700,
          padding: "5px 13px",
          borderRadius: 999,
          background: statusBadge?.bg || t.bgInset || "rgba(255,255,255,0.08)",
          color: statusBadge?.color || t.textSecondary,
        }}>{statusLabel}</span>
      </div>
    </div>
  );
}

// 2026-06-11 — 작업종류 텍스트 칩 (이모지 X). 다크/라이트 양쪽 대응.
//   refrigerant(냉매) = warning 주황 / clean(세척) = info 파랑
//   / addon(추가) = 보라 / visit(출장) = 회색.
//   여러 종류 섞이면 getServiceKind 가 대표 1개 선택 (refrigerant 우선).
function ServiceTag({ kind }) {
  const isDark = useIsDark();
  const tokens = {
    refrigerant: {
      label: "냉매",
      light: { bg: "rgba(245, 158, 11, 0.14)", color: "#92400E" },
      dark:  { bg: "rgba(245, 158, 11, 0.22)", color: "#FCD34D" },
    },
    clean: {
      label: "세척",
      light: { bg: "rgba(59, 130, 246, 0.12)", color: "#1E40AF" },
      dark:  { bg: "rgba(59, 130, 246, 0.22)", color: "#93C5FD" },
    },
    addon: {
      label: "추가",
      light: { bg: "rgba(139, 92, 246, 0.12)", color: "#5B21B6" },
      dark:  { bg: "rgba(139, 92, 246, 0.22)", color: "#C4B5FD" },
    },
    visit: {
      label: "출장",
      light: { bg: "rgba(107, 114, 128, 0.14)", color: "#374151" },
      dark:  { bg: "rgba(156, 163, 175, 0.18)", color: "#D1D5DB" },
    },
  };
  const tok = tokens[kind];
  if (!tok) return null;
  const c = isDark ? tok.dark : tok.light;
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 6,
      fontSize: 13,
      fontWeight: 800,
      background: c.bg,
      color: c.color,
      marginRight: 8,
      letterSpacing: 0.2,
      verticalAlign: "middle",
    }}>{tok.label}</span>
  );
}

function pcTdStyle(t, extra) {
  return {
    // 2026-06-10 8차 — 행 높이 축소(18→11) + 강제 center 제거.
    //   호출처에서 셀별 textAlign override.
    // 2026-06-11 — 헤더 padding 13 와 통일 (헤더·본문 정렬 일관).
    //   모든 셀에 minWidth:0 + nowrap + ellipsis.
    //   긴 텍스트가 셀 폭 늘리는 사고 차단 → 모든 행 동일 높이/정렬.
    //   전체값은 우측 상세 패널에서 확인.
    //   주의: textOverflow ellipsis 는 block container + 텍스트 노드에서 작동.
    //   display:flex 두면 자식 텍스트 ellipsis 안 됨 → block 유지.
    padding: "13px 16px",
    color: t.textSecondary,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    ...extra,
  };
}

export default PrincipalListTab;
