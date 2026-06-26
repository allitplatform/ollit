// 2026-05-27 — 운영자 PWA "전체 작업" 화면 (6원청, usol_n 제외)
// 2026-06-26 — 전면 재설계: idle-first (전체 로드 제거) + 서버 검색·칩 필터.
//   변경 전: 진입 시 6원청 전체 ~349건 fetch → 클라 5필드 .includes() 필터 → 칩도 클라.
//   변경 후:
//     · 진입 시 fetch 0 (빈 상태 + 큰 검색창 안내).
//     · 검색 (debounce 300ms) → fetchAllPrincipalTasks({ searchTerm, engineerIds, limit: 50 }) → 결과만.
//     · 칩 (원청 / 상태) 클릭 → 그 조건 서버 fetch → 결과만.
//     · 검색 + 칩 동시 AND.
//     · 기사명 검색 — apiEngineers 메모리에서 이름 매칭 → engineerIds 변환 → 서버 OR.
//   장점: 평소 트래픽 0. 검색·필터 명확 의도일 때만 fetch. 데이터 증가에 안전.
//   주의: limit 50 — 결과 많으면 "검색 좁히세요" 안내. 무한스크롤 X.
//
// 카드: UsolNAssignList.TaskRowOperator 재사용 (principalBadge prop).
// 정렬: 취소 맨 아래 / received_at desc — UsolN 과 일관 ('전체' 칩 + principal 결합 시만 의미).

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Search, ChevronDown, ChevronRight } from "lucide-react";
import {
  fetchAllPrincipalTasks,
  fetchAllPrincipalCounts,
  PRINCIPAL_CHIP_ORDER,
} from "../lib/allPrincipalTasksDb.js";
import { TaskRowOperator } from "./usol_n/UsolNAssignList.jsx";
import { useRealtimeTasks, useRealtimeTable } from "../hooks/useRealtimeSubscription.js";
import { CountBoxes } from "./CountBoxes.jsx";
import { formatMdHm } from "../utils/dateLabel.js";

// 한 페이지 크기. 무한스크롤로 다음 페이지 자동 로드.
const PAGE_SIZE = 50;
const ALL_STATUSES = ["미배정", "배정", "약속대기", "확정", "진행중", "완료", "취소", "visit_only"];

// 상태 칩 7개. 카운트는 표시 안 함 (재설계 spec — 라벨만).
const STATUS_FILTERS = [
  { id: "all",         label: "전체",   match: null },
  { id: "unassigned",  label: "미배정", match: "미배정" },
  { id: "assigned",    label: "배정",   match: "배정" },
  { id: "confirmed",   label: "확정",   match: "확정" },
  { id: "in_progress", label: "진행중", match: "진행중" },
  { id: "completed",   label: "완료",   match: "완료" },
  { id: "canceled",    label: "취소",   match: "취소" },
];

// 원청 칩 = "전체" + PRINCIPAL_CHIP_ORDER 6개
const PRINCIPAL_FILTERS = [
  { code: null, label: "전체" },
  ...PRINCIPAL_CHIP_ORDER,
];

export function AllTasksScreen({ onTaskClick, onBack, apiEngineers = [] }) {
  const [statusId, setStatusId] = useState("all");
  const [principalCode, setPrincipalCode] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm,  setSearchTerm]  = useState("");
  const [quickFilter, setQuickFilter] = useState(null);
  const [counts, setCounts] = useState({ todayCreated: 0, todayCompleted: 0, confirmed: 0 });

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading]   = useState(false);     // 초기/필터변경 fetch
  const [loadingMore, setLoadingMore] = useState(false); // 무한스크롤 다음 페이지 fetch
  const [hasMore, setHasMore]   = useState(false);
  const [offset, setOffset]     = useState(0);
  const [fetchError, setFetchError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  // '전체' 칩 + principal 결합 시 진행/완료/취소 3구간 분리. 기본 닫힘.
  const [completedOpen, setCompletedOpen] = useState(false);
  const [canceledOpen,  setCanceledOpen]  = useState(false);

  useRealtimeTasks(() => setReloadTick(v => v + 1));
  useRealtimeTable("task_items", () => setReloadTick(v => v + 1));

  // 무한스크롤 sentinel — 리스트 끝 div ref. body 가 스크롤 컨테이너라 root 명시.
  const bodyRef = useRef(null);
  const sentinelRef = useRef(null);

  // 검색어 debounce 300ms — 타이핑 중 매 키스트로크 fetch 방지.
  useEffect(() => {
    const id = setTimeout(() => setSearchTerm(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  // 기사명 → UUID 변환 (apiEngineers 메모리 — 새 DB 객체 0).
  //   ⚠️ 반드시 e.userId (DB users.id, UUID) — e.id 는 engineer code (E016) 라서
  //       assigned_engineer_id (UUID FK) 와 비교 시 400 invalid uuid 에러.
  //       engineersDb.rowToSheetShape 가 userId 필드를 UUID 로 채워줌 (2026-06-26).
  const engineerIdsForSearch = useMemo(() => {
    const kw = searchTerm.toLowerCase();
    if (!kw) return null;
    return apiEngineers
      .filter(e => e && e.name && String(e.name).toLowerCase().includes(kw))
      .map(e => e.userId)
      .filter(Boolean);
  }, [searchTerm, apiEngineers]);

  // 어떤 필터라도 활성? 활성 안 됐으면 fetch 0 (빈 상태 유지).
  //   statusId="all" + principalCode=null + searchTerm="" + quickFilter=null → idle.
  const hasAnyFilter = (
    !!searchTerm ||
    !!principalCode ||
    statusId !== "all" ||
    !!quickFilter
  );

  // 현재 필터 → fetch 파라미터 빌더. 페이지 0 / 무한스크롤 둘 다 같은 빌더 사용.
  const buildParams = useCallback((offsetArg) => {
    const params = {
      limit:  PAGE_SIZE,
      offset: offsetArg,
      searchTerm,
      engineerIds: engineerIdsForSearch,
      quickFilter,
      principalCodes: principalCode ? [principalCode] : null,
    };
    if (!quickFilter) {
      const f = STATUS_FILTERS.find(x => x.id === statusId);
      params.statusIn = (f && f.match) ? [f.match] : ALL_STATUSES;
    }
    return params;
  }, [searchTerm, engineerIdsForSearch, principalCode, statusId, quickFilter]);

  // 필터 변경 (검색·칩·quickFilter) 또는 reloadTick → 페이지 0 리셋 + fetch.
  //   ⚠️ 검색·칩 변경 = 새 검색 → 기존 tasks 비우고 offset 0 부터 다시.
  //      안 그러면 다른 조건 결과가 이어붙어 섞임.
  useEffect(() => {
    if (!hasAnyFilter) {
      setTasks([]);
      setOffset(0);
      setHasMore(false);
      setFetchError("");
      return;
    }
    let alive = true;
    setLoading(true);
    setFetchError("");
    fetchAllPrincipalTasks(buildParams(0))
      .then(res => {
        if (!alive) return;
        if (!res.ok) {
          setFetchError(res.error || "불러오기 실패");
          setTasks([]);
          setOffset(0);
          setHasMore(false);
        } else {
          const list = res.tasks || [];
          setTasks(list);
          setOffset(list.length);
          setHasMore(list.length >= PAGE_SIZE);
        }
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [buildParams, reloadTick, hasAnyFilter]);

  // 무한스크롤 다음 페이지 로드. 중복 가드: loading/loadingMore/!hasMore 면 무시.
  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore || !hasAnyFilter) return;
    setLoadingMore(true);
    try {
      const res = await fetchAllPrincipalTasks(buildParams(offset));
      if (!res.ok) {
        setFetchError(res.error || "불러오기 실패");
        setHasMore(false);
        return;
      }
      const list = res.tasks || [];
      setTasks(prev => [...prev, ...list]);
      setOffset(prev => prev + list.length);
      setHasMore(list.length >= PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, hasMore, hasAnyFilter, offset, buildParams]);

  // IntersectionObserver — sentinel 화면 진입 시 loadMore. body 가 스크롤 컨테이너.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = bodyRef.current;
    if (!sentinel || !root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root, rootMargin: "200px 0px" }  // 바닥 200px 전에 미리 트리거
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  // 상단 카운트 박스 3개 (가벼운 count:exact head — idle 에서도 표시).
  useEffect(() => {
    let alive = true;
    fetchAllPrincipalCounts().then(res => {
      if (alive && res.ok) setCounts(res.counts);
    });
    return () => { alive = false; };
  }, [reloadTick]);

  // '전체' 상태 칩 + (principal 있거나 quickFilter 있을 때) → 진행/완료/취소 3구간.
  //   특정 상태 칩 (예: 완료) 일 때는 평면 리스트.
  const buckets = useMemo(() => {
    if (statusId !== "all" || quickFilter) return null;
    return {
      ongoing:   tasks.filter(t => t.status !== "완료" && t.status !== "취소"),
      completed: tasks.filter(t => t.status === "완료"),
      canceled:  tasks.filter(t => t.status === "취소"),
    };
  }, [tasks, statusId, quickFilter]);

  const currentStatus = STATUS_FILTERS.find(f => f.id === statusId) || STATUS_FILTERS[0];
  const currentPrincipal = PRINCIPAL_FILTERS.find(p => p.code === principalCode);

  const principalLabelByCode = useMemo(() => {
    const m = new Map();
    for (const p of PRINCIPAL_CHIP_ORDER) m.set(p.code, p.label);
    return m;
  }, []);

  return (
    <div style={containerStyle}>
      <Header onBack={onBack} count={hasAnyFilter ? tasks.length : null}/>

      <div style={bodyStyle} ref={bodyRef}>
        {/* 상단 카운트 박스 — quickFilter 진입 (전역 통계). */}
        <CountBoxes
          counts={counts}
          selected={quickFilter}
          onSelect={(key) => setQuickFilter(prev => prev === key ? null : key)}
        />

        {quickFilter && (
          <button onClick={() => setQuickFilter(null)} style={{
            marginBottom: 10, padding: "6px 12px",
            background: "transparent",
            border: "1px solid var(--border, #2A2A2A)",
            borderRadius: 8,
            color: "var(--text-secondary)",
            fontSize: 11, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}>✕ 필터 해제</button>
        )}

        {/* ⭐ 큰 검색창 — 주인공. 위로 강조. */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <Search size={18} style={{
            position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
            color: "var(--text-tertiary, var(--text-secondary))", pointerEvents: "none",
          }}/>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="고객명 · 작업번호 · 주소 · 전화 · 기사 이름"
            style={{
              width: "100%", padding: "14px 14px 14px 40px",
              background: "var(--bg-secondary)",
              border: "1.5px solid var(--border)",
              borderRadius: 12,
              color: "var(--text-primary)",
              fontSize: 14, fontWeight: 600,
              fontFamily: "inherit",
              boxSizing: "border-box",
              outline: "none",
            }}
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput("")}
              aria-label="검색 지우기"
              style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                background: "transparent", border: "none",
                color: "var(--text-secondary)",
                cursor: "pointer", padding: 6,
                fontSize: 14,
                fontFamily: "inherit",
              }}
            >✕</button>
          )}
        </div>

        {/* 원청 칩 (전체 + 6개) — 라벨만, 카운트 제거 */}
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          {PRINCIPAL_FILTERS.map(p => {
            const active = principalCode === p.code;
            return (
              <button
                key={p.code || "_all"}
                onClick={() => setPrincipalCode(p.code)}
                style={chipStyle(active)}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* 상태 칩 (전체 + 6개) — 라벨만, 카운트 제거 */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          {STATUS_FILTERS.map(filter => {
            const active = statusId === filter.id;
            return (
              <button
                key={filter.id}
                onClick={() => setStatusId(filter.id)}
                style={chipStyle(active)}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        {/* 결과 영역 */}
        {!hasAnyFilter ? (
          <IdleHint/>
        ) : (
          <>
            <div style={sectionTitleStyle}>
              {currentPrincipal?.label || "전체"} · {currentStatus.label}{" "}
              <span style={{ color: "var(--accent)", fontWeight: 700 }}>
                {tasks.length.toLocaleString()}
              </span>건
              {hasMore && (
                <span style={{ color: "var(--text-tertiary, var(--text-secondary))", marginLeft: 6 }}>
                  (스크롤하면 더 불러옵니다)
                </span>
              )}
            </div>

            {loading ? (
              <Empty>불러오는 중...</Empty>
            ) : fetchError ? (
              <Empty>⚠️ {fetchError}</Empty>
            ) : tasks.length === 0 ? (
              <Empty>해당 조건의 작업이 없습니다</Empty>
            ) : buckets ? (
              <>
                {buckets.ongoing.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {buckets.ongoing.map(task => (
                      <TaskRowOperator
                        key={task.id}
                        task={task}
                        onClick={() => onTaskClick?.(task)}
                        principalBadge={principalLabelByCode.get(task.principalCode) || task.principalCode || ""}
                        timeStrOverride={task.scheduled_at ? formatMdHm(task.scheduled_at) : ""}
                      />
                    ))}
                  </div>
                )}
                {buckets.completed.length > 0 && (
                  <CollapseSection
                    title={`완료 ${buckets.completed.length.toLocaleString()}건`}
                    open={completedOpen}
                    onToggle={() => setCompletedOpen(v => !v)}
                  >
                    {buckets.completed.map(task => (
                      <TaskRowOperator
                        key={task.id}
                        task={task}
                        onClick={() => onTaskClick?.(task)}
                        principalBadge={principalLabelByCode.get(task.principalCode) || task.principalCode || ""}
                        timeStrOverride={task.scheduled_at ? formatMdHm(task.scheduled_at) : ""}
                      />
                    ))}
                  </CollapseSection>
                )}
                {buckets.canceled.length > 0 && (
                  <CollapseSection
                    title={`취소 ${buckets.canceled.length.toLocaleString()}건`}
                    open={canceledOpen}
                    onToggle={() => setCanceledOpen(v => !v)}
                  >
                    {buckets.canceled.map(task => (
                      <TaskRowOperator
                        key={task.id}
                        task={task}
                        onClick={() => onTaskClick?.(task)}
                        principalBadge={principalLabelByCode.get(task.principalCode) || task.principalCode || ""}
                        timeStrOverride={task.scheduled_at ? formatMdHm(task.scheduled_at) : ""}
                      />
                    ))}
                  </CollapseSection>
                )}
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {tasks.map(task => (
                  <TaskRowOperator
                    key={task.id}
                    task={task}
                    onClick={() => onTaskClick?.(task)}
                    principalBadge={principalLabelByCode.get(task.principalCode) || task.principalCode || ""}
                    timeStrOverride={task.scheduled_at ? formatMdHm(task.scheduled_at) : ""}
                  />
                ))}
              </div>
            )}

            {/* 무한스크롤 sentinel — root=body, 200px 전에 트리거. 결과 있을 때만 노출. */}
            {tasks.length > 0 && (
              <div ref={sentinelRef} style={{
                padding: "16px 0", textAlign: "center",
                color: "var(--text-tertiary, var(--text-secondary))",
                fontSize: 11, fontWeight: 600,
              }}>
                {loadingMore ? "불러오는 중..." : (hasMore ? " " : "— 끝 —")}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Header({ onBack, count }) {
  return (
    <div style={{
      padding: "14px 16px",
      background: "var(--accent)",
      color: "#fff",
      flexShrink: 0,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      {onBack && (
        <button
          onClick={onBack}
          style={{
            background: "rgba(255,255,255,0.18)",
            border: "none",
            color: "#fff",
            fontSize: 16,
            cursor: "pointer",
            padding: "4px 10px",
            borderRadius: 6,
            fontFamily: "inherit",
            flexShrink: 0,
          }}
        >←</button>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: 10, color: "rgba(255,255,255,0.85)",
          marginBottom: 3, fontWeight: 500,
        }}>
          6원청 · 검색 / 필터
        </div>
        <div style={{
          fontSize: 18, fontWeight: 700, letterSpacing: "-0.3px",
        }}>
          전체 작업
        </div>
      </div>
      {count != null && (
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>결과</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{count.toLocaleString()}건</div>
        </div>
      )}
    </div>
  );
}

function chipStyle(active) {
  return {
    padding: "6px 12px",
    background: active ? "var(--accent)" : "var(--bg-secondary)",
    color: active ? "#fff" : "var(--text-secondary)",
    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
    borderRadius: 100,
    fontSize: 11, fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit",
  };
}

// 진입 시(필터 0) 큰 안내 — "검색하거나 필터 선택" 유도.
function IdleHint() {
  return (
    <div style={{
      padding: "50px 20px", textAlign: "center",
      background: "var(--bg-secondary)",
      border: "1px dashed var(--border)",
      borderRadius: 12,
      color: "var(--text-secondary)",
    }}>
      <div style={{ fontSize: 42, marginBottom: 12, opacity: 0.6 }}>🔍</div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>
        검색하거나 필터를 선택하세요
      </div>
      <div style={{ fontSize: 11, fontWeight: 500, lineHeight: 1.6 }}>
        고객명 · 작업번호 · 주소 · 전화 · 기사 이름으로 검색<br/>
        또는 위의 원청 / 상태 칩 클릭
      </div>
    </div>
  );
}

function CollapseSection({ title, open, onToggle, children }) {
  return (
    <div style={{ marginTop: 14 }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          padding: "12px 14px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          display: "flex", alignItems: "center", gap: 8,
          cursor: "pointer",
          fontFamily: "inherit",
          color: "var(--text-secondary)",
          fontSize: 12, fontWeight: 700,
          textAlign: "left",
        }}
      >
        {open
          ? <ChevronDown  size={16} style={{ flexShrink: 0 }}/>
          : <ChevronRight size={16} style={{ flexShrink: 0 }}/>}
        <span style={{ flex: 1 }}>{title}</span>
      </button>
      {open && (
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Empty({ children }) {
  return (
    <div style={{
      padding: 40, textAlign: "center",
      color: "var(--text-secondary)", fontSize: 12,
      background: "var(--bg-secondary)",
      border: "1px dashed var(--border)",
      borderRadius: 10,
    }}>{children}</div>
  );
}

const containerStyle = {
  minHeight: "100vh",
  background: "var(--bg-primary)",
  color: "var(--text-primary)",
  fontFamily: "-apple-system, 'Pretendard', sans-serif",
  display: "flex", flexDirection: "column",
  overflowX: "hidden",
};

const bodyStyle = {
  flex: 1,
  overflowY: "auto",
  overflowX: "hidden",
  padding: 16, paddingBottom: 40,
  background: "var(--bg-secondary)",
};

const sectionTitleStyle = {
  fontSize: 11, color: "var(--text-secondary)",
  marginBottom: 8, paddingLeft: 4,
};

export default AllTasksScreen;
