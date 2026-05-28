// Phase 5 Step 0.B — 유솔N · 진행 탭 (DB 전환)
// 2026-05-19 최초
// 2026-05-26 R2-3 — 검색바 / 필터칩 / TaskRowOperator 카드 통합
// 2026-05-28 — 2단계 페이징 (keyset + 서버 검색 + 가상 스크롤)
//   배경: Supabase Max rows 1000 한도로 옛 1092건 중 92건 잘림. 검색 시 옛 완료 작업 누락.
//   전략:
//     · 페이지 fetch 50건 (keyset 커서 received_at DESC + id DESC)
//     · 검색 시 서버 ILIKE 4필드 OR 기사명 매칭 (REGISTERED_USERS → engineerId 변환)
//     · 칩 카운트는 RPC usol_n_counts_by_status() 별도 호출 (검색·기사 필터 정합)
//     · 렌더는 react-virtuoso — 보이는 영역만 DOM, 무한 스크롤 endReached → loadMore
//     · 검색·필터 변경 시 reset cursor + 첫 페이지 + 카운트 RPC (병렬)
//     · realtime 알림은 reloadTick 으로 동일 경로 재호출
import { useState, useEffect, useMemo, useCallback } from "react";
import { Search } from "lucide-react";
import { Virtuoso } from "react-virtuoso";
import { fetchUsolNTasksPage } from "../../lib/usolNTasksDb.js";
import { findEngineerCodesByName } from "../../utils/engineerSearch.js";
import { supabase } from "../../lib/supabase.js";
import { TaskRowOperator } from "./UsolNAssignList.jsx";
import { useRealtimeTasks, useRealtimeTable } from "../../hooks/useRealtimeSubscription.js";

const PAGE_SIZE = 50;

// 칩 7개 (사장님 spec — 2026-05-27):
//   전체 (필터 해제) / 미배정 / 배정 / 확정 / 진행중 / 완료 / 취소
//   ※ '약속대기' / 'visit_only' 별도 칩 없음 — '전체' 에서만 노출.
const STATUS_FILTERS = [
  { id: "all",         label: "전체",   match: null },
  { id: "unassigned",  label: "미배정", match: "미배정" },
  { id: "assigned",    label: "배정",   match: "배정" },
  { id: "confirmed",   label: "확정",   match: "확정" },
  { id: "in_progress", label: "진행중", match: "진행중" },
  { id: "completed",   label: "완료",   match: "완료" },
  { id: "canceled",    label: "취소",   match: "취소" },
];

export function UsolNInProgress({ onTaskClick }) {
  const [filterId, setFilterId] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm,  setSearchTerm]  = useState("");

  const [tasks, setTasks] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [counts, setCounts] = useState({});
  const [reloadTick, setReloadTick] = useState(0);

  // realtime — 변경 감지 시 reloadTick++ → 첫 페이지 + 카운트 재호출
  useRealtimeTasks(() => setReloadTick(v => v + 1));
  useRealtimeTable("task_items", () => setReloadTick(v => v + 1));

  // 검색 debounce — 300ms
  useEffect(() => {
    const id = setTimeout(() => setSearchTerm(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  // 검색어 → 기사 코드 배열 (REGISTERED_USERS name → engineerId)
  const engineerCodes = useMemo(
    () => findEngineerCodesByName(searchTerm),
    [searchTerm]
  );

  const currentFilter = STATUS_FILTERS.find(f => f.id === filterId) || STATUS_FILTERS[0];
  const statusIn = currentFilter.match ? [currentFilter.match] : null;

  // 첫 페이지 + 카운트 RPC — filterId / searchTerm / reloadTick 변경 시
  // engineerCodes 는 searchTerm 파생이라 deps 에 추가 X (무한 루프 방지). statusIn 도 filterId 파생.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFetchError("");
    setTasks([]);
    setCursor(null);
    setHasMore(false);

    const rpcArgs = {
      p_search: searchTerm || null,
      p_engineer_codes: engineerCodes.length > 0 ? engineerCodes : null,
    };

    Promise.all([
      fetchUsolNTasksPage({
        cursor: null,
        pageSize: PAGE_SIZE,
        statusIn,
        searchTerm,
        engineerCodes,
      }),
      supabase.rpc("usol_n_counts_by_status", rpcArgs),
    ]).then(([fetchRes, rpcRes]) => {
      if (!alive) return;
      if (!fetchRes.ok) {
        setFetchError(fetchRes.error || "불러오기 실패");
        setTasks([]);
        setCursor(null);
        setHasMore(false);
      } else {
        setTasks(fetchRes.tasks);
        setCursor(fetchRes.nextCursor);
        setHasMore(fetchRes.hasMore);
      }
      if (rpcRes.error) {
        console.error("[UsolNInProgress:counts RPC]", rpcRes.error);
        setCounts({});
      } else {
        setCounts(rpcRes.data || {});
      }
    }).catch(err => {
      if (!alive) return;
      console.error("[UsolNInProgress:fetch]", err);
      setFetchError(err?.message || "불러오기 예외");
    }).finally(() => {
      if (alive) setLoading(false);
    });

    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterId, searchTerm, reloadTick]);

  // 더보기 — Virtuoso endReached 콜백
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading || !cursor) return;
    setLoadingMore(true);
    try {
      const res = await fetchUsolNTasksPage({
        cursor,
        pageSize: PAGE_SIZE,
        statusIn,
        searchTerm,
        engineerCodes,
      });
      if (res.ok) {
        setTasks(prev => [...prev, ...res.tasks]);
        setCursor(res.nextCursor);
        setHasMore(res.hasMore);
      } else {
        console.error("[UsolNInProgress:loadMore]", res.error);
      }
    } finally {
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loadingMore, loading, cursor, statusIn?.[0], searchTerm, engineerCodes]);

  // 칩 카운트 — RPC 결과 직접 사용. "전체" = 모든 status 합계.
  const totalCount = useMemo(
    () => Object.values(counts).reduce((a, b) => a + (Number(b) || 0), 0),
    [counts]
  );
  const getChipCount = (filter) =>
    filter.match ? (Number(counts[filter.match]) || 0) : totalCount;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* 검색 (ViewAll 패턴 — Search icon + 좌측 padding) */}
      <div style={{ position: "relative", marginBottom: 10, flexShrink: 0 }}>
        <Search size={14} style={{
          position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
          color: "var(--text-tertiary, var(--text-secondary))", pointerEvents: "none",
        }}/>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="고객명 / 작업번호 / 주소 / 전화 / 기사명 검색"
          style={{
            width: "100%", padding: "10px 12px 10px 32px",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            color: "var(--text-primary)",
            fontSize: 12, fontWeight: 600,
            fontFamily: "inherit",
            boxSizing: "border-box",
            outline: "none",
          }}
        />
      </div>

      {/* 필터 chip — 7개 + 카운트 (RPC 직접) */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", flexShrink: 0 }}>
        {STATUS_FILTERS.map(filter => {
          const active = filterId === filter.id;
          const cnt = getChipCount(filter);
          return (
            <button
              key={filter.id}
              onClick={() => setFilterId(filter.id)}
              style={{
                padding: "6px 12px",
                background: active ? "var(--accent)" : "var(--bg-secondary)",
                color: active ? "#fff" : "var(--text-secondary)",
                border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 100,
                fontSize: 11, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {filter.label} {cnt.toLocaleString()}
            </button>
          );
        })}
      </div>

      <div style={{ ...sectionTitleStyle, flexShrink: 0 }}>
        {currentFilter.label}{" "}
        <span style={{ color: "var(--accent)", fontWeight: 700 }}>
          {getChipCount(currentFilter).toLocaleString()}
        </span>건
        {tasks.length < getChipCount(currentFilter) && (
          <span style={{ color: "var(--text-tertiary, var(--text-secondary))", marginLeft: 6, fontWeight: 500 }}>
            (현재 {tasks.length.toLocaleString()}건 표시 · 스크롤로 더 불러오기)
          </span>
        )}
      </div>

      {loading ? (
        <Empty>불러오는 중...</Empty>
      ) : fetchError ? (
        <Empty>⚠️ {fetchError}</Empty>
      ) : tasks.length === 0 ? (
        <Empty>해당 상태의 작업이 없습니다</Empty>
      ) : (
        <Virtuoso
          style={{ height: "calc(100dvh - 320px)", minHeight: 240 }}
          data={tasks}
          endReached={loadMore}
          increaseViewportBy={400}
          itemContent={(_idx, task) => (
            <div style={{ paddingBottom: 4 }}>
              <TaskRowOperator task={task} onClick={() => onTaskClick?.(task)}/>
            </div>
          )}
          components={{
            Footer: () => {
              if (loadingMore) {
                return (
                  <div style={{ padding: 12, textAlign: "center", fontSize: 11, color: "var(--text-secondary)" }}>
                    불러오는 중...
                  </div>
                );
              }
              if (!hasMore && tasks.length > 0) {
                return (
                  <div style={{ padding: 12, textAlign: "center", fontSize: 11, color: "var(--text-tertiary, var(--text-secondary))" }}>
                    모든 작업을 표시했습니다
                  </div>
                );
              }
              return null;
            },
          }}
        />
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

const sectionTitleStyle = {
  fontSize: 11, color: "var(--text-secondary)",
  marginBottom: 8, paddingLeft: 4,
};

export default UsolNInProgress;
