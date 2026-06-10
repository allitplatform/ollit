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

export function PrincipalListTab({ t, user, principalCodes, partnerCode, onSelect }) {
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
  const [counts, setCounts]           = useState({ total: 0, inProgress: 0, completed: 0 });
  const [loadingA, setLoadingA]       = useState(true);

  // 뷰 B — 전체 작업
  const [allTasks, setAllTasks]       = useState([]);
  const [loadingB, setLoadingB]       = useState(false);
  const [allLoaded, setAllLoaded]     = useState(false);

  // 뷰 A fetch
  const refetchA = useCallback(async () => {
    if (!Array.isArray(principalCodes) || principalCodes.length === 0) {
      setLoadingA(false);
      return;
    }
    setLoadingA(true);
    const [todayRes, countsRes] = await Promise.all([
      fetchPrincipalTodayTasks({ principalCodes }),
      fetchPrincipalStatusCounts({ principalCodes }),
    ]);
    setTodayTasks(todayRes.tasks || []);
    if (countsRes.ok) setCounts(countsRes.counts);
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

  // Realtime — 현재 뷰에 맞게 refetch
  useRealtimeTasks(() => {
    if (view === "today") refetchA();
    else { setAllLoaded(false); refetchB(); }
  });

  // 2026-06-06 — KA/crikrin: 카운트 박스 fetch (DB count:exact 3개, 자기 principalCode 측 측).
  // 2026-06-09 — 유솔H 측 동일 fetch (showPartnerHeader 측).
  useEffect(() => {
    if (!showPartnerHeader || !headerPrincipalCode) return;
    let alive = true;
    fetchAllPrincipalCounts({ principalCodes: [headerPrincipalCode] })
      .then(res => { if (alive && res.ok) setPartnerCounts(res.counts); });
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
        allTasks={allTasks}
        loadingA={loadingA}
        loadingB={loadingB}
        counts={counts}
        partnerCounts={partnerCounts}
        showPartnerHeader={showPartnerHeader}
        quickFilter={quickFilter}
        setQuickFilter={setQuickFilter}
        qfTasks={qfTasks}
        qfLoading={qfLoading}
        onSelect={onSelect}
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
        전체 <Stat n={counts.total}/> · 진행중 <Stat n={counts.inProgress}/> · 완료 <Stat n={counts.completed}/>
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

function Stat({ n }) {
  return (
    <span style={{ color: "var(--text-primary, #FAF8F5)", fontWeight: 800 }}>
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

// 2026-06-10 — PC (1024px 이상) 통합 테이블 — 뷰 A/B/quickFilter 한 화면 흡수.
//   상단: 한 줄 통계 + 필터 토글(오늘/전체) + 검색.
//   본문: sticky 헤더 테이블 (고객 / 기종·수량 / 지역 / 시간 / 기사 / 상태).
//   행 클릭 → onSelect(task) → PcShell 우측 패널에 상세 표시.
//   fetch 분리 유지: 'today' = 가벼운 refetchA / 'all' = refetchB (사장님 spec 보강).
function ViewPcTable({
  t,
  view, setView,
  todayTasks, allTasks,
  loadingA, loadingB,
  counts, partnerCounts,
  showPartnerHeader,
  quickFilter, setQuickFilter,
  qfTasks, qfLoading,
  onSelect,
}) {
  const [search, setSearch] = useState("");

  // 표시 데이터 선택.
  let sourceTasks, sourceLoading;
  if (quickFilter) {
    sourceTasks   = qfTasks;
    sourceLoading = qfLoading;
  } else if (view === "all") {
    sourceTasks   = allTasks;
    sourceLoading = loadingB;
  } else {
    sourceTasks   = todayTasks;
    sourceLoading = loadingA;
  }

  // 클라 검색 — 현재 표시 데이터에서.
  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return sourceTasks || [];
    return (sourceTasks || []).filter(task => {
      const text = [
        task.customer, task.customerName,
        task.region, task.address, task.customerAddress,
        task.assignedEngineer, task.engineer,
        task.taskCode, task.task_no,
      ].filter(Boolean).join(" ").toLowerCase();
      return text.includes(q);
    });
  }, [sourceTasks, q]);

  return (
    <div style={{
      padding: "20px 24px 24px",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      background: t.bg,
      // 2026-06-10 — 1920px에서 6컬럼 균등 분산이 휑함. 좌측 정렬 + 우측 여백 허용.
      maxWidth: 1280,
      width: "100%",
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
            <StatInline t={t} label="전체"   value={counts.total}/>
            <StatInline t={t} label="진행중" value={counts.inProgress} accent/>
            <StatInline t={t} label="완료"   value={counts.completed}  muted/>
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

        {/* 검색 */}
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="고객·지역·기사 검색"
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
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, tableLayout: "fixed" }}>
          {/* 2026-06-10 — 컬럼 폭 차등: 시간/상태 좁게, 고객/기종/지역 적정. */}
          <colgroup>
            <col style={{ width: "19%" }}/>{/* 고객     */}
            <col style={{ width: "26%" }}/>{/* 기종·수량 */}
            <col style={{ width: "14%" }}/>{/* 지역     */}
            <col style={{ width: "11%" }}/>{/* 시간     */}
            <col style={{ width: "16%" }}/>{/* 기사     */}
            <col style={{ width: "14%" }}/>{/* 상태     */}
          </colgroup>
          <thead style={{
            position: "sticky",
            top: 0,
            background: t.bgElevated,
            zIndex: 2,
          }}>
            <tr>
              {["고객", "기종·수량", "지역", "시간", "기사", "상태"].map(label => (
                <th key={label} style={{
                  padding: "10px 14px",
                  textAlign: "left",
                  fontSize: 10,
                  fontWeight: 700,
                  color: t.textMuted,
                  borderBottom: `1px solid ${t.border}`,
                  letterSpacing: 0.4,
                  textTransform: "uppercase",
                }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sourceLoading && filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={pcEmptyCellStyle(t)}>불러오는 중...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={pcEmptyCellStyle(t)}>표시할 작업 없음</td>
              </tr>
            ) : filtered.map((task, idx) => (
              <PcTableRow
                key={task.id || task.taskNo || idx}
                t={t}
                task={task}
                onClick={() => onSelect?.(task)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatInline({ t, label, value, accent, muted }) {
  const color = accent ? t.accent : muted ? t.textMuted : t.text;
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
      <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>{label}</span>
      <span className="mono" style={{ fontSize: 16, fontWeight: 800, color }}>{value ?? 0}</span>
    </div>
  );
}

function pcEmptyCellStyle(t) {
  return {
    padding: "40px 16px",
    textAlign: "center",
    color: t.textMuted,
    fontSize: 12,
  };
}

function PcTableRow({ t, task, onClick }) {
  const items = Array.isArray(task.workItems) && task.workItems.length > 0
    ? task.workItems
    : (Array.isArray(task.task_items) ? task.task_items : []);
  const mainItem = getMainItem(task) || items[0] || null;
  const appliance = mainItem
    ? (mainItem.appliance || mainItem.appliance_types?.name || mainItem.workType || "—")
    : "—";
  const totalQty = items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
  const itemSummary = totalQty > 1 ? `${appliance} ×${totalQty}` : appliance;
  // 2026-06-10 — 모바일 TaskRow(line 689)와 동일 호출 — task.region 우선, 빈 값이면 address 키워드 추출.
  //   address 단일 인자로 호출하면 "서울특별시"가 먼저 매치돼 시/도까지만 나옴.
  const region = regionOrDistrictFromAddress(task.region, task.address || task.customerAddress) || "—";
  const time = formatTime(task);
  const engineer = task.assignedEngineer || task.engineer || "미배정";
  const statusLabel = getStatusLabel(task.status) || task.status || "—";
  const statusBadge = getStatusBadge(task.status);
  return (
    <tr
      onClick={onClick}
      className="clickable"
      style={{
        cursor: "pointer",
        borderBottom: `1px solid ${t.border}`,
      }}
    >
      <td style={pcTdStyle(t, { fontWeight: 700, color: t.text })}>{task.customer || task.customerName || "—"}</td>
      <td style={pcTdStyle(t)}>{itemSummary}</td>
      <td style={pcTdStyle(t)}>{region}</td>
      <td style={pcTdStyle(t)} className="mono">{time}</td>
      <td style={pcTdStyle(t)}>{engineer}</td>
      <td style={pcTdStyle(t)}>
        <span style={{
          fontSize: 10, fontWeight: 700,
          padding: "3px 9px",
          borderRadius: 999,
          background: statusBadge?.bg || t.bgInset || "rgba(255,255,255,0.08)",
          color: statusBadge?.color || t.textSecondary,
        }}>{statusLabel}</span>
      </td>
    </tr>
  );
}

function pcTdStyle(t, extra) {
  return {
    padding: "11px 14px",
    color: t.textSecondary,
    ...extra,
  };
}

export default PrincipalListTab;
