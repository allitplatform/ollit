// 운영자 유솔N · 배정 측 catch 리스트 (메인 측 catch)
// 2026-05-26 — 1단계 신규
//
// 사장님 spec:
//   · 메인 = "배정해야 할 작업 리스트"
//   · 필터: status IN ['배정','약속대기','미배정'] (statusIn fetch)
//            + reassignRequest 측 catch task (in-memory — '배정' 측 catch 측 catch task 측 catch 측 catch)
//            + status='배정' AND scheduledAt NULL 측 catch 측 catch (in-memory)
//   · 컴팩트 한 줄 카드 (PrincipalListTab TaskRow 측 catch — 운영자 전용 복제)
//   · 검색바 (고객명/주소/작업번호/상품주문번호)
//   · 상단 "배정 필요 N건" 측 catch + "전체 작업 측 catch" 버튼 → in_progress 탭
//
// 호환: 측 컴포넌트 측 catch 측 catch fetch (AdminApp apiTasks prop 측 catch X).

import { useState, useEffect, useMemo } from "react";
import { Search, Snowflake, Zap } from "lucide-react";
import { fetchUsolNTasks, isUsolNActionNeeded } from "../../lib/usolNTasksDb.js";
import { useRealtimeTasks, useRealtimeTable } from "../../hooks/useRealtimeSubscription.js";
import { formatYmdHm } from "../../utils/dateLabel.js";
import { statusLabel } from "../../utils/taskStatus.js";
// 2026-05-29 — 취소 row 사유/취소자 표시 (사장님 spec D2-b: users in-memory lookup)
import { getUserById } from "../../data/users.js";
// 2026-05-29 v2 — 이름 위주 표시 (D2) + 한국어 사유/원청 라벨
import { getCancelReasonShort, getCancelActorLabel } from "../../data/cancelReasons.js";

const CLEAN_COLOR       = "#378ADD";
const REFRIGERANT_COLOR = "#EF9F27";
const VISIT_COLOR       = "#9CA3AF";
const DATE_TIME_COLOR   = "#BA7517";
// 2026-05-26 — 핑크 통일: NAVER_GREEN 제거. 측 catch var(--accent) 측 catch (PrincipalApp 측 catch).

const MAIN_APPLIANCE_KEYWORDS = ["벽걸이", "스탠드", "1way", "2way", "4way", "투인원", "원형", "시스템멀티"];

function getMainItem(task) {
  const items = Array.isArray(task.task_items) ? task.task_items : (Array.isArray(task.workItems) ? task.workItems : []);
  // task_items (Supabase row) 측 catch '본작업' 또는 appliance 키워드 측 catch 측 catch
  let main = items.find(it => (it.orderType || it.order_type) === "본작업");
  if (main) return main;
  main = items.find(it => {
    const apName = it.appliance_types?.name || it.appliance || "";
    return MAIN_APPLIANCE_KEYWORDS.some(kw => String(apName).includes(kw));
  });
  return main || items[0] || null;
}

function getServiceKind(task) {
  // 2026-05-27 — 출장비 전용(visit_only) 분기. ServiceIcon "visit"→🚗 와 연결.
  //   원청 PWA PrincipalListTab.jsx 패턴 그대로.
  if (task?.status === "visit_only") return "visit";
  const main = getMainItem(task);
  if (!main) return "addon";
  const code = main?.work_types?.service_types?.code || main?.serviceCode || "";
  if (code === "cleaning") return "main";
  if (code === "refrigerant") return "addon";
  // fallback — work_type name 측 catch '세척' 측 catch '냉매' 측 catch
  const wt = String(main?.work_types?.name || main?.workType || "");
  if (wt.includes("세척")) return "main";
  if (wt.includes("냉매")) return "addon";
  return "main";
}

function ServiceIcon({ kind, size = 14 }) {
  if (kind === "visit") return <span style={{ fontSize: size, color: VISIT_COLOR }}>🚗</span>;
  if (kind === "addon") return <Zap size={size} style={{ color: REFRIGERANT_COLOR }}/>;
  return <Snowflake size={size} style={{ color: CLEAN_COLOR }}/>;
}

function getStatusBadge(status) {
  // 2026-05-27 — label은 공용 statusLabel() 사용 (visit_only → "출장비만").
  //   색(bg/color)은 status별 기존 분기 유지. 모르는 status는 회색 fallback.
  const label = statusLabel(status) || "—";
  if (status === "미배정")  return { bg: "rgba(255,59,92,0.18)",  color: "#FF3B5C", label };
  if (status === "배정")    return { bg: "rgba(234,88,12,0.18)",  color: "#EA580C", label };
  if (status === "약속대기") return { bg: "rgba(255,193,7,0.18)", color: "#FFC107", label };
  if (status === "확정")    return { bg: "rgba(29,158,117,0.18)", color: "#1D9E75", label };
  return { bg: "rgba(156,163,175,0.18)", color: "#9CA3AF", label };
}

export function UsolNAssignList({ onTaskClick, onSeeAll }) {
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [search, setSearch]   = useState("");
  const [reloadTick, setReloadTick] = useState(0);

  // realtime — tasks / task_items 변경 시 refetch
  useRealtimeTasks(() => setReloadTick(v => v + 1));
  useRealtimeTable("task_items", () => setReloadTick(v => v + 1));

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    // 2026-05-26 — fetch 범위 측 catch (확정/진행중 측 catch reassignRequest 측 catch task 측 catch 측 catch).
    //   완료/취소/visit_only 측 catch — isUsolNActionNeeded 측 catch 측 catch in-memory filter 측 catch 측 catch.
    fetchUsolNTasks({
      statusIn: ["미배정", "약속대기", "배정", "확정", "진행중"],
      limit: 500,
      offset: 0,
    }).then(res => {
      if (!alive) return;
      if (!res.ok) {
        setError(res.error || "불러오기 실패");
        setTasks([]);
      } else {
        setTasks(res.tasks || []);
      }
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadTick]);

  // 배정 필요 필터 — 단일 헬퍼 isUsolNActionNeeded 적용.
  //   fetch 측 catch 측 catch usol_n 측 catch 측 catch → skipPrincipalCheck:true.
  //   확정/진행중 측 catch reassignRequest 측 catch task 측 catch 측 catch — fetch 측 catch in-memory filter 측 catch 측 catch.
  const actionNeeded = useMemo(
    () => tasks.filter(t => isUsolNActionNeeded(t, { skipPrincipalCheck: true })),
    [tasks]
  );

  // 검색 필터
  // 2026-05-28 — 기사명 매칭 추가 (AllTasksScreen v18 패턴, cea449b 참고).
  //   fetchUsolNTasks 가 users in-memory JOIN 으로 task.assignedEngineer 채움.
  const filtered = useMemo(() => {
    if (!search.trim()) return actionNeeded;
    const q = search.trim().toLowerCase();
    return actionNeeded.filter(t => {
      const cust = String(t.customer_name || "").toLowerCase();
      const addr = String(t.address || "").toLowerCase();
      const tno  = String(t.task_no || "").toLowerCase();
      const eng  = String(t.assignedEngineer || "").toLowerCase();
      if (cust.includes(q) || addr.includes(q) || tno.includes(q) || (eng && eng.includes(q))) return true;
      // 상품주문번호 — task_items 측 catch
      const items = Array.isArray(t.task_items) ? t.task_items : [];
      for (const it of items) {
        const poid = String(it.product_order_id || "").toLowerCase();
        if (poid && poid.includes(q)) return true;
      }
      return false;
    });
  }, [actionNeeded, search]);

  const totalCount = actionNeeded.length;
  // 2026-05-26 — 상단 핑크 박스는 "진짜 미배정"만 셈 (개요 탭 진입 카드와 동일 기준).
  //   리스트(filtered)는 그대로 — 미배정/약속대기/배정 모두 노출.
  //   fetch limit=500 + 활성 usol_n 280건 → 한 페이지에 다 들어옴 (페이징 X).
  const unassignedCount = useMemo(
    () => tasks.filter(t => t.status === "미배정").length,
    [tasks]
  );

  return (
    <div className="fade-in" style={{ padding: "4px 0" }}>
      {/* 상단 요약 — "배정 필요 N건" */}
      <div style={{
        padding: "10px 12px",
        background: "var(--accent-bg)",
        border: "1px solid var(--accent)",
        borderRadius: 10,
        marginBottom: 12,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ fontSize: 14 }}>📋</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--accent)" }}>
          미배정 {unassignedCount}건
        </span>
        <span style={{ fontSize: 11, color: "var(--text-secondary)", marginLeft: "auto" }}>
          미배정 · 약속대기 · 배정(일정 협의)
        </span>
      </div>

      {/* 검색 */}
      <div style={{ position: "relative", marginBottom: 10 }}>
        <Search size={13} style={{
          position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
          color: "var(--text-tertiary, var(--text-secondary))", pointerEvents: "none",
        }}/>
        <input
          type="text" value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="고객명 / 주소 / 작업번호 / 상품주문번호 / 기사명"
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "8px 10px 8px 30px",
            background: "var(--bg-inset, var(--bg-secondary))",
            border: "1px solid var(--border)",
            borderRadius: 8, color: "var(--text-primary)",
            fontSize: 12, fontFamily: "inherit", outline: "none",
          }}
        />
      </div>

      {/* 전체 작업 보기 버튼 → in_progress 탭 */}
      {onSeeAll && (
        <button onClick={onSeeAll} style={{
          width: "100%", padding: "10px 12px",
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: 8,
          color: "var(--text-primary)",
          fontSize: 12, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
          marginBottom: 12,
        }}>
          전체 작업 보기 (진행 탭으로) →
        </button>
      )}

      {/* 리스트 */}
      {loading ? (
        <Empty>불러오는 중...</Empty>
      ) : error ? (
        <Empty color="#FF3B5C">⚠️ {error}</Empty>
      ) : filtered.length === 0 ? (
        <Empty>{search.trim() ? "검색 결과가 없어요" : "배정 필요한 작업이 없어요"}</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {filtered.map(task => (
            <TaskRowOperator
              key={task.id}
              task={task}
              onClick={() => onTaskClick?.(task)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// 운영자 전용 측 catch 카드 — PrincipalListTab.TaskRow 측 catch (ChannelBadge X, 측 catch 측 catch 추가)
// 2026-05-26 R2-3 — export 측 catch (UsolNInProgress 측 catch 측 catch 재사용 — 카드 1곳)
// 2026-05-27 — principalBadge prop 추가 (옵션). 6원청 "전체 작업" 화면에서 원청 배지 표시용.
//   UsolN 호출 (미지정) — 기존 동작 유지. 새 화면 호출 — 기사 배지 왼쪽에 회색 pill 노출.
export function TaskRowOperator({ task, onClick, principalBadge = null }) {
  const kind = getServiceKind(task);
  const status = getStatusBadge(task.status);
  const mainItem = getMainItem(task);
  const items = Array.isArray(task.task_items) ? task.task_items : [];

  const appliance = mainItem?.appliance_types?.name || mainItem?.appliance || "";
  const qty = mainItem?.qty || 1;
  const otherCount = Math.max(0, items.length - 1);
  // 2026-06-06 — appliance 빈 값일 때 "(—)" 측 빈 괄호 측 측 측, 괄호째 생략.
  //   사장님 spec — KA/crikrin 등 원청 작업 측 appliance 비어있는 경우 다수.
  const applianceText = appliance
    ? `(${appliance}${qty > 1 ? `×${qty}` : ""}${otherCount > 0 ? ` +${otherCount}` : ""})`
    : "";

  // 지역 — district 또는 address 측 catch 측 catch
  const region = task.district || String(task.address || "").split(/\s+/)[0] || "";

  // 시간 — scheduled_at 측 catch
  const timeStr = task.scheduled_at ? formatYmdHm(task.scheduled_at) : "";

  // 2026-06-06 — applianceText / region 빈 값일 때 leading " · " 측 측 측 측 측.
  const beforeTime = [applianceText, region].filter(Boolean).join(" · ");

  // 측 catch 측 catch
  const cat = task.category_data || {};
  const hasReassignReq = !!(cat?.reassignRequest?.requestedAt);
  // 2026-05-26 — 측 catch 측 catch 측 catch (fetchUsolNTasks 측 catch users in-memory JOIN 측 catch 측 catch)
  const engineerName = task.assignedEngineer || task.assigned_engineer || "";
  // 2026-05-26 — 완료 측 catch 흐릿 (사장님 spec — UsolNInProgress '전체' 탭 측 catch)
  const isCompleted = task.status === "완료";

  // 2026-05-29 — 취소 row 사유/취소자/시각 한 줄. status='취소' 일 때만 표시.
  //   평탄화 키 우선 (rowToTask + v14NormalizeTask + _v14NormalizeTask), category_data fallback.
  //   옛 데이터 (cancel 정보 없음) → "정보 없음 + updated_at" fallback (사장님 D3-c).
  const isCancelled = task.status === "취소";
  const cancelInfo = (() => {
    if (!isCancelled) return null;
    const reason        = task.cancelReason             || cat.cancelReason             || null;
    const actor         = task.cancelActor              || cat.cancelActor              || null;
    const actorUid      = task.cancelActorUserId        || cat.cancelActorUserId        || null;
    const principalCode = task.cancelActorPrincipalCode || cat.cancelActorPrincipalCode || null;
    const at            = task.cancelAt                 || cat.cancelAt                 || task.updated_at || null;

    const u    = actorUid ? getUserById(actorUid) : null;
    const name = u?.name || null;

    // 2026-05-29 v2 — 이름 위주 (D2): 역할 라벨 제거. 이름 우선, 없으면 원청 한국 라벨 / fallback.
    const actorLabel = (actor || name) ? getCancelActorLabel({ actor, name, principalCode }) : null;
    const atShort = at ? formatYmdHm(at) : "";

    if (!reason && !actorLabel) {
      return `정보 없음${atShort ? ` · ${atShort}` : ""}`;
    }
    // 2026-05-29 v2 — 한국어 사유 (reasonId → CANCEL_REASONS 라벨 매핑)
    const reasonShort = getCancelReasonShort(reason, 12) || "—";
    const parts = [reasonShort];
    if (actorLabel) parts.push(actorLabel);
    if (atShort)    parts.push(atShort);
    return parts.join(" · ");
  })();

  return (
    <div
      onClick={onClick}
      className="clickable"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        cursor: "pointer",
        opacity: isCompleted ? 0.5 : 1,
        display: "flex", flexDirection: "column",
      }}
    >
      <div style={{
        padding: "8px 10px",
        display: "flex", alignItems: "center", gap: 8,
        minHeight: 38,
      }}>
      <div style={{ flexShrink: 0, width: 14, textAlign: "center" }}>
        <ServiceIcon kind={kind}/>
      </div>
      <span style={{
        flexShrink: 0, fontSize: 12, fontWeight: 600,
        color: "var(--text-primary)",
        maxWidth: 80,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{task.customer_name || "—"}</span>

      <span style={{
        flex: 1, minWidth: 0,
        fontSize: 11, color: "var(--text-secondary)",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {beforeTime}
        {timeStr && (<>{beforeTime ? " · " : ""}<span style={{ color: DATE_TIME_COLOR, fontWeight: 600 }}>{timeStr}</span></>)}
      </span>

      {/* 측 catch 측 catch — 재배정 요청 (핑크 = --accent).
           2026-05-29 v2 (D7): status='취소' 면 숨김 (취소 우선, 재배정 의미 없음). */}
      {hasReassignReq && !isCancelled && (
        <span style={{
          fontSize: 9, fontWeight: 800,
          color: "var(--accent)",
          background: "var(--accent-bg)",
          border: "1px solid var(--accent)",
          padding: "2px 6px", borderRadius: 999,
          flexShrink: 0, whiteSpace: "nowrap",
        }} title={cat.reassignRequest.reason || ""}>
          🔁 재배정
        </span>
      )}

      {/* 2026-05-27 — 원청 배지 (옵션, 6원청 화면에서만 표시). 기사 배지 왼쪽. */}
      {principalBadge && (
        <span style={{
          flexShrink: 0, fontSize: 10, fontWeight: 700,
          color: "var(--text-secondary)",
          background: "var(--bg-secondary)",
          padding: "2px 7px", borderRadius: 4,
          whiteSpace: "nowrap",
          border: "1px solid var(--border)",
        }}>{principalBadge}</span>
      )}

      {/* 2026-05-26 — 측 catch 측 측 측 측 측 (PrincipalListTab.TaskRow 패턴).
            옛 "🕐 일정 협의" 배지 측 catch — 사장님 결정 🅐. */}
      {engineerName && (
        <span style={{
          flexShrink: 0, fontSize: 11, fontWeight: 500,
          color: "var(--text-primary)",
          background: "var(--bg-secondary)",
          padding: "2px 8px", borderRadius: 4,
          whiteSpace: "nowrap",
        }}>{engineerName}</span>
      )}

      {/* 상태 배지 */}
      <span style={{
        fontSize: 10, fontWeight: 700,
        padding: "2px 7px", borderRadius: 8,
        background: status.bg, color: status.color,
        flexShrink: 0, whiteSpace: "nowrap",
      }}>{status.label}</span>
      </div>

      {/* 2026-05-29 — 취소 row 사유/취소자/시각 한 줄 (status='취소' 일 때만 / D5-a 회색) */}
      {isCancelled && cancelInfo && (
        <div style={{
          padding: "4px 10px 8px 32px",
          fontSize: 10, fontWeight: 500,
          color: "var(--text-secondary)",
          borderTop: "1px dashed var(--border)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          ❌ {cancelInfo}
        </div>
      )}
    </div>
  );
}

function Empty({ children, color }) {
  return (
    <div style={{
      padding: "40px 16px", textAlign: "center",
      color: color || "var(--text-secondary)",
      fontSize: 12, fontWeight: 600,
      background: "var(--bg-elevated)",
      border: "1px dashed var(--border)",
      borderRadius: 10,
    }}>{children}</div>
  );
}

export default UsolNAssignList;
