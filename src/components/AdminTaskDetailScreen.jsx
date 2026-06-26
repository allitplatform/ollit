// V12-3 — 운영자 작업상세 재설계
// 영역 6개 (Header / MainCard / QuickActions / EngineerCard / InfoCard / CompletionNotice)
// + ExceptionActions (접힘: 출장비 / 수동완료 / 취소)
// 메인 "완료" 버튼 X (기사가 완료 처리 → 자동 업데이트)

import { useState, useEffect, useMemo } from "react";
import { ArrowLeft } from "lucide-react";
// 2026-06-06 — 기본 정보 편집 (5 필드 — update_task_basic RPC, Mig 099).
import { TaskBasicEditScreen } from "./TaskBasicEditScreen.jsx";
import { Chip } from "./Chip.jsx";
// 2026-06-26 — 공지 3단계: 운영자 → 기사 작업 메시지 (옵션 c 서버 저장 + 푸시).
import { SendTaskMessageModal } from "./admin/SendTaskMessageModal.jsx";
import { detectServiceType } from "../data/serviceTypes.js";
import { TaskCardMenu } from "./TaskCardMenu.jsx";
import { formatTimeOnly, formatDateTimeKST } from "../utils/dateLabel.js";
import { VisitOnlyDialog } from "./VisitOnlyDialog.jsx";
// 2026-06-03 — 품목별 취소 (PrincipalApp 측측 측측). admin_partial_cancel_item RPC 측측.
import { PartialCancelDialog } from "./CancelDialogs.jsx";
// 2026-05-27 Phase 2 — localStorage memos.js → Supabase task_memos
import { useTaskMemos, getMemoTypeLabel, getAuthorRoleEmoji } from "../lib/taskMemosDb.js";
// Phase 5 Step 0.C-1 — 유솔N 정산 사이클 카드 (조건 분기 / 다른 원청 영향 0)
import { UsolNSettlementCycleCard } from "./usol_n/UsolNSettlementCycleCard.jsx";
// 2026-05-29 — 결제 방식 라벨 표시 (현장결제 등 안전 정보 시각화)
import { PAYMENT_METHOD_LABELS } from "../data/paymentMethods.js";
// 2026-05-29 — 취소 정보 카드 측 사용자 이름 lookup (사장님 D2-b)
import { getUserById } from "../data/users.js";
// 2026-05-29 v2 — 이름 위주 표시 (D2) + 한국어 사유/원청 라벨
import { getCancelReasonLabel, getCancelActorLabel } from "../data/cancelReasons.js";
import { setTaskCancelInfo } from "../lib/cancelRpc.js";
// Phase 5 Step 0.C-3-b — 현장 완료 사진 (Supabase Storage / photos 테이블)
import { listPhotosByTask } from "../lib/photosDb.js";
// Phase 5 Step 0.C-3-c — 상태 변경 이력 (status_history 테이블) — 0.C-4 측 task_changes 통합으로 사용 제거
// import { listStatusHistory } from "../lib/statusHistoryDb.js";
// Phase 5 Step 0.C-4 — 변경 이력 audit log (task_changes 테이블 / Migration 039)
import { listTaskChanges } from "../lib/taskChangesDb.js";
// Phase 5 Step 0.C-9 — task_changes 변경 시 자동 refetch (변경 이력 카드 갱신)
import { useRealtimeTable } from "../hooks/useRealtimeSubscription.js";
// 작업 소요 시간 계산
import { calcTotalDuration } from "../utils/dateLabel.js";
// 2026-05-31 — Phase C Step 6 — per-item received_amount UI 측
import { getWorkTypeColors } from "../utils/workTypeColors.js";
import { setTaskItemReceivedAmount as apiSetItemReceived, getTaskByIdDb } from "../data/tasksDb.js";
// 2026-06-02 — 정산 대기 측 partial payload 측 측 → id 측 full re-fetch + normalize (유솔 PrincipalApp.TaskDetail 측 동일 spec).
import { v14NormalizeTask } from "../utils/v14Task.js";
// 2026-06-17 — visit_only 되돌리기 다이얼로그 (Mig 138 unmark_visit_only RPC).
import { UnmarkVisitOnlyDialog } from "./admin/UnmarkVisitOnlyDialog.jsx";

// state → 알약 라벨/색
const STATE_MAP = {
  done:      { label: "완료",   color: "#00875A" },
  active:    { label: "진행중", color: "#FF1B8D" },
  moving:    { label: "이동중", color: "#FF8F00" },
  waiting:   { label: "미배정", color: "var(--text-secondary)" },
  scheduled: { label: "예정",   color: "var(--text-primary)" },
};

// 2026-05-26 — task.status를 진실 소스로. !scheduledAt만으로 "미배정" 단정 X.
//   사고: 윤다희 YS-N-260526-046 — status='배정' + 기사 있음 + scheduled_at NULL
//         → 옛 코드는 거짓 "미배정" 표시. 새 코드는 status='배정' → "배정" 표시.
function getStateInfo(task) {
  if (task.type === "external") return { label: "외근", color: "#FF8F00" };
  const completedAt = task.completedAt || task.완료시간;
  const startedAt   = task.startedAt   || task.시작시간;
  if (completedAt)                return { label: "완료",   color: "#00875A" };
  if (startedAt && !completedAt)  return { label: "진행중", color: "#FF1B8D" };
  if (task.status === "미배정")   return { label: "미배정", color: "var(--text-secondary)" };
  if (task.status === "약속대기") return { label: "약속대기", color: "var(--text-secondary)" };
  if (task.status === "배정")     return { label: "배정",   color: "var(--text-primary)" };
  if (task.status === "확정")     return { label: "확정",   color: "var(--text-primary)" };
  if (task.status === "취소")     return { label: "취소",   color: "var(--text-tertiary)" };
  return STATE_MAP[task.state] || { label: task.status || "예정", color: "var(--text-primary)" };
}

export function AdminTaskDetailScreen({ t, task: initialTask, onBack, onCancelTask, onPartialCancel, onVisitOnly, onMemoAdd, onEdit, onHistory, onAssign, onScheduleChange, onStatusChange, onMemoUpdate, user, apiEngineers = [], toast }) {
  // ════════════════════════════════════════════════════════════
  // 모든 hooks 측 측 측 (early return 측 측 측 측 측 — React #310 spec).
  // 2026-06-02 — early return 측 useTaskMemos 측 측 측 측 측 → hooks 순서 위반 발생 → fix.
  // ════════════════════════════════════════════════════════════
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  // 2026-06-26 — 운영자 → 기사 메시지 모달 (옵션 c).
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [sendStatus, setSendStatus] = useState("");  // 토스트 — "전송됨" / "전송 실패" 등
  const actorIdForMessage = user?.user_id || user?.userId || user?.id || null;
  const [showVisitOnlyDialog, setShowVisitOnlyDialog] = useState(false);
  // 2026-06-17 — visit_only 되돌리기 다이얼로그 (Mig 138).
  const [showUnmarkVisitOnlyDialog, setShowUnmarkVisitOnlyDialog] = useState(false);
  // 2026-06-03 — 품목별 취소 다이얼로그 (PartialCancelDialog).
  const [showPartialCancelDialog, setShowPartialCancelDialog] = useState(false);
  const [exceptionExpanded, setExceptionExpanded] = useState(false);
  // 2026-06-06 — 기본 정보 편집 모드 (5 필드 — update_task_basic RPC).
  const [editingBasic, setEditingBasic] = useState(false);

  // 2026-06-02 — id 측 full re-fetch + normalize (유솔 PrincipalApp.TaskDetail 측 동일).
  //   정산 대기에서 partial payload (id/customer_name/status 등)가 들어오면 상세 정보가 비기 때문에
  //   getTaskByIdDb로 full row 조회 → v14NormalizeTask로 정규화 → setTask.
  // 2026-06-02 — 깜빡임 개선: partial initial은 spinner 노출, full은 즉시 표시.
  // 2026-06-02 — 무한 스피너 해결: try/catch/finally로 감싸 fetch 실패 시 반드시 setLoading(false).
  //   실패 시 fetchError 상태로 안내 문구 표시 (영원히 안 멈추는 화면 방지).
  const isInitialFull = !!(initialTask?.task_no && initialTask?.address);
  const [task, setTask] = useState(initialTask);
  const [loading, setLoading] = useState(!isInitialFull);
  const [fetchError, setFetchError] = useState(null);
  useEffect(() => {
    setTask(initialTask);
    setLoading(!(initialTask?.task_no && initialTask?.address));
    setFetchError(null);
  }, [initialTask?.id]);
  useEffect(() => {
    if (!initialTask?.id) {
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const row = await getTaskByIdDb(initialTask.id);
        if (!alive) return;
        if (row) {
          const normalized = v14NormalizeTask(row);
          if (normalized) {
            setTask(normalized);
            setFetchError(null);
          } else {
            setFetchError("작업 정보 형식이 올바르지 않습니다");
          }
        } else {
          setFetchError("작업 정보를 찾을 수 없습니다");
        }
      } catch (e) {
        if (alive) setFetchError(e?.message || "작업 정보를 불러오지 못했습니다");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [initialTask?.id]);

  // 2026-05-27 — Supabase task_memos hook (realtime 자동 갱신).
  //   task null 측 safe — task?.id || null params 측 호출 spec (hooks 순서 보장).
  const { memos } = useTaskMemos(task?.id || null);

  // ════════════════════════════════════════════════════════════
  // 2026-06-02 — early return 측 측 → 메인 return 측 ternary (사장님 spec).
  //   early return 측 measure spec 측 sub-component 측 hooks 측 측 측 측 catch 측 측 measure 측 catch
  //   → 가장 안전한 spec: hooks 측 측 측 측 측 측 → ternary 측 표시 분기.
  // ════════════════════════════════════════════════════════════
  // 2026-06-06 — 기본 정보 편집 후 task 재조회 (update_task_basic RPC 호출 끝 호출용).
  async function refetchTaskBasic() {
    if (!task?.id) return;
    const row = await getTaskByIdDb(task.id);
    if (!row) return;
    const normalized = v14NormalizeTask(row);
    if (normalized) setTask(normalized);
  }

  const isExternal = task?.type === "external";
  // 2026-06-03 — 완료 작업 측측 ExceptionActions 노출 (사장님 spec).
  //   기존 `state !== "done"` 가드 제거 — adminFullCancel RPC가 완료 작업도 정상 처리 측측
  //   (v_was_completed 측측 측측 + 트리거 측측 payments 자동 0/0/0).
  //   외근(type='external')은 측측측 측측.
  const showException = !!task && !isExternal;

  function handleMenuAction(action, taskArg) {
    if (action === "call") {
      const phone = taskArg.phone;
      if (phone) window.location.href = `tel:${phone}`;
      return;
    }
    if (action === "engineer_call") {
      const phone = taskArg.engineerPhone;
      if (phone) window.location.href = `tel:${phone}`;
      else alert("프로 연락처가 없습니다");
      return;
    }
    if (action === "memo")        return onMemoAdd && onMemoAdd();
    if (action === "edit")        return onEdit && onEdit();
    if (action === "visit_only")  return setShowVisitOnlyDialog(true);
    if (action === "cancel")      return setShowCancelDialog(true);
  }

  // 2026-06-06 — 기본 정보 편집 모드 (모든 hooks 다 호출된 다음 위치라 안전).
  if (editingBasic && task) {
    return (
      <TaskBasicEditScreen
        t={t}
        task={task}
        actorUserId={user?.user_id || user?.userId || user?.id}
        accentColor={t?.accent || "#FF1B8D"}
        onClose={() => setEditingBasic(false)}
        onSaved={async () => { await refetchTaskBasic(); setEditingBasic(false); }}
      />
    );
  }

  // 측 단일 return — early return 측 측, ternary 측 분기 (사장님 spec — hooks 순서 측 위반 spec 측 제거).
  return (
    <div className="fade-in" style={{
      background: "var(--bg-primary)",
      minHeight: "100vh",
      // 2026-06-03 — 측측 ExceptionActions 측측 측측 측측 (iOS PWA safe-area + Shell paddingBottom 측측 측측 부족 측).
      paddingBottom: "calc(60px + env(safe-area-inset-bottom))",
    }}>
      {loading ? (
        <div style={{ padding: 16 }}>
          <button onClick={onBack} style={iconBtnStyle}>←</button>
          <div style={{ marginTop: 60, textAlign: "center", color: "var(--text-secondary)", fontSize: 12 }}>
            작업 정보 불러오는 중...
          </div>
        </div>
      ) : fetchError && !isInitialFull ? (
        <div style={{ padding: 16 }}>
          <button onClick={onBack} style={iconBtnStyle}>←</button>
          <div style={{ marginTop: 60, textAlign: "center", color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.6 }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
              정보를 불러오지 못했어요
            </div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 16 }}>
              {fetchError}
            </div>
            <button
              onClick={onBack}
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                padding: "8px 16px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              목록으로 돌아가기
            </button>
          </div>
        </div>
      ) : !task ? (
        <div style={{ padding: 16 }}>
          <button onClick={onBack} style={iconBtnStyle}>←</button>
          <div style={{ marginTop: 24, textAlign: "center", color: "var(--text-tertiary)" }}>
            작업 정보 없음
          </div>
        </div>
      ) : (
        <>
      <DetailHeader task={task} onBack={onBack} onMenuAction={handleMenuAction}/>
      {/* 2026-06-06 — 기본 정보 수정 버튼 (5 필드: 연락처/주소/고객명/희망일정/요청사항).
          정산/배정/상태 등은 별도 RPC 통해서만 — 본 버튼은 update_task_basic (Mig 099) 호출. */}
      <div style={{ padding: "12px 20px 0", display: "flex", justifyContent: "flex-end" }}>
        <button onClick={() => setEditingBasic(true)} style={{
          padding: "6px 14px",
          background: "transparent",
          border: `1px solid ${t?.accent || "#FF1B8D"}`,
          borderRadius: 8,
          color: t?.accent || "#FF1B8D",
          fontSize: 12, fontWeight: 700,
          cursor: "pointer", fontFamily: "inherit",
        }}>수정</button>
      </div>
      {/* 카드 1 — 상태 + 작업 종류 측 catch (변경 X) */}
      <MainCard task={task} onStatusChange={onStatusChange}/>
      {/* 카드 2 — 2026-05-26 D-2: 작업 정보 통합 (연락처/주소/일정 + 배정 프로 + 측 측 측 측)
            옛 QuickActions(3 버튼) + EngineerCard 측 WorkInfoCard 측 catch 합침.
            핸들러 측 catch (onAssign/onEdit/onScheduleChange/callCustomer). */}
      <WorkInfoCard
        task={task}
        apiEngineers={apiEngineers}
        onAssign={onAssign}
        onScheduleChange={onScheduleChange}
        onSendMessage={() => setShowMessageModal(true)}
      />
      {/* 카드 4 — 정산 정보 (작업 금액 + 추가금 + 합계 + 회사 수익 + 기사 분배) */}
      <SettlementInfoCard task={task}/>
      {/* 2026-05-31 — Phase C Step 6 — 작업 항목별 받은 돈 표시/수정 (신규 흐름 측만 input 노출).
            2026-06-02 — usol_n 측 측 — 정산 사이클 측 대체 (사장님 spec). */}
      {task.principalCode !== "usol_n" && <TaskItemsCard task={task}/>}
      {task.principalCode === "usol_n" && (
        <UsolNSettlementCycleCard
          taskId={task.id}
          paymentMethod={task.paymentMethod || task.payment_method || null}
        />
      )}
      {/* 카드 5 — 작업 시간 · 이력 통합 */}
      <WorkTimeHistoryCard task={task} onTaskRefresh={refetchTaskBasic}/>
      {/* 카드 6 — 요청사항 · 메모 */}
      <RequestMemoCard task={task} memos={memos} onMemoAdd={onMemoAdd}/>
      {/* 2026-05-29 v2 (D6) — CancelInfoCard 폐기. 변경 이력 카드 측 cancel 이벤트 빨강 강조로 대체. */}
      {/* 2026-05-22 — 냉매 충전 동의서 (있을 때만 노출, Phase 1) */}
      {task.consent?.signedAt && <ConsentCard consent={task.consent}/>}
      {/* 2026-05-22 — 재배정 요청 카드 (있을 때만 노출).
            2026-05-29 v2 (D7): status='취소' 면 숨김 (취소 우선, 재배정 의미 없음). */}
      {task.reassignRequest?.requestedAt && task.status !== "취소" && <ReassignRequestCard request={task.reassignRequest}/>}
      {/* 카드 7 — 작업 사진 */}
      <PhotoSection taskId={task.id} taskType={task.type}/>
      <CompletionNotice task={task}/>
      {/* 2026-06-17 — visit_only → 정상 작업 되돌리기 (운영자 전용 — RPC 가드 동일). */}
      {task && task.status === "visit_only" && (
        <div style={{
          margin: "0 16px 12px",
          padding: "12px 14px",
          background: "var(--accent-bg, rgba(255,27,141,0.06))",
          border: "1px solid var(--accent)",
          borderRadius: 10,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>🔄</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 800, color: "var(--text-primary)",
            }}>출장비만으로 처리된 작업</div>
            <div style={{
              fontSize: 11, color: "var(--text-secondary)", marginTop: 2, fontWeight: 600,
            }}>정상 작업으로 되돌릴 수 있습니다 (분배 자동 재계산)</div>
          </div>
          <button
            type="button"
            onClick={() => setShowUnmarkVisitOnlyDialog(true)}
            style={{
              padding: "8px 14px",
              background: "var(--accent)", color: "#fff",
              border: "none", borderRadius: 8,
              fontSize: 12, fontWeight: 800,
              cursor: "pointer", fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >되돌리기 →</button>
        </div>
      )}
      {showException && (
        <ExceptionActions
          expanded={exceptionExpanded}
          onToggle={() => setExceptionExpanded(!exceptionExpanded)}
          onVisitOnly={() => setShowVisitOnlyDialog(true)}
          onCancel={() => setShowCancelDialog(true)}
          onPartialCancel={() => setShowPartialCancelDialog(true)}
        />
      )}

      {/* 다이얼로그 */}
      {showCancelDialog && (
        <CancelDialog
          task={task}
          onClose={() => setShowCancelDialog(false)}
          onConfirm={(reasonId, memo) => {
            setShowCancelDialog(false);
            onCancelTask && onCancelTask(reasonId, memo);
          }}
        />
      )}

      {/* 2026-06-26 — 기사 메시지 전송 모달 (옵션 c). */}
      {showMessageModal && (
        <SendTaskMessageModal
          t={{
            bg: "var(--bg-primary)",
            text: "var(--text-primary)",
            textSecondary: "var(--text-secondary)",
            textMuted: "var(--text-tertiary, var(--text-secondary))",
            border: "var(--border)",
            bgElevated: "var(--bg-elevated)",
            bgSecondary: "var(--bg-secondary)",
          }}
          task={task}
          actorId={actorIdForMessage}
          onClose={() => setShowMessageModal(false)}
          onSent={() => {
            setShowMessageModal(false);
            setSendStatus("✓ 메시지 전송됨");
            setTimeout(() => setSendStatus(""), 2400);
          }}
        />
      )}

      {/* 메시지 전송 토스트 */}
      {sendStatus && (
        <div style={{
          position: "fixed", left: "50%", bottom: "calc(60px + env(safe-area-inset-bottom))",
          transform: "translateX(-50%)",
          background: "rgba(0, 135, 90, 0.95)", color: "#fff",
          padding: "10px 16px", borderRadius: 10,
          fontSize: 13, fontWeight: 700,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          zIndex: 1200,
          pointerEvents: "none",
        }}>{sendStatus}</div>
      )}
      {showVisitOnlyDialog && (
        <VisitOnlyDialog
          task={task}
          onClose={() => setShowVisitOnlyDialog(false)}
          onConfirm={(payload) => {
            setShowVisitOnlyDialog(false);
            onVisitOnly && onVisitOnly(payload);
          }}
        />
      )}
      {/* 2026-06-17 — visit_only → 정상 작업 되돌리기 다이얼로그 (Mig 138). */}
      {showUnmarkVisitOnlyDialog && (
        <UnmarkVisitOnlyDialog
          t={t}
          task={task}
          actor={user?.user_id || user?.userId || user?.id || null}
          onClose={() => setShowUnmarkVisitOnlyDialog(false)}
          onConfirmed={async () => {
            setShowUnmarkVisitOnlyDialog(false);
            await refetchTaskBasic();
          }}
        />
      )}
      {/* 2026-06-03 — 품목별(부분) 취소 다이얼로그 (PrincipalApp 측측 측측). */}
      {showPartialCancelDialog && (
        <PartialCancelDialog
          task={task}
          onClose={() => setShowPartialCancelDialog(false)}
          onConfirm={async (itemIds, reason) => {
            setShowPartialCancelDialog(false);
            if (onPartialCancel) await onPartialCancel(itemIds, reason);
          }}
        />
      )}
        </>
      )}
    </div>
  );
}

// ──────────────── 1. Header ────────────────
function DetailHeader({ task, onBack, onMenuAction }) {
  return (
    <header style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "14px 16px",
      borderBottom: "1px solid var(--border)",
      background: "var(--bg-secondary)",
    }}>
      <button onClick={onBack} style={iconBtnStyle}>
        <ArrowLeft size={14}/>
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>작업 상세</div>
        {(task.taskCode || task.principal) && (
          <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginTop: 2 }}>
            {task.taskCode || task.id}{task.principal ? ` · ${task.principal}` : ""}
          </div>
        )}
      </div>
      <TaskCardMenu task={task} onAction={onMenuAction}/>
    </header>
  );
}

// ──────────────── 2. MainCard ────────────────
function MainCard({ task }) {
  const stateInfo = getStateInfo(task);
  const serviceType = detectServiceType(task);
  const isExternal = task.type === "external";
  const titleText = isExternal ? (task.note || "외근") : (task.customer || "—");

  // V14 Step 3.1 Fix C — 사이드바 + 우상단 알약 = 작업유형 색 박힘 (serviceType.color)
  // 옛: stateInfo.color (state별 색) → 신규: serviceType.color (작업유형 색)
  const sideColor = (serviceType && serviceType.color) || stateInfo.color;
  return (
    <div style={{ padding: "20px 20px 0" }}>
      <div style={{
        ...D1_CARD_STYLE,
        borderLeft: `4px solid ${sideColor}`,
        position: "relative",
      }}>
        {/* 우측 상단 상태 알약 — V14 Step 3.1: 작업유형 색 박힘 */}
        <div style={{
          position: "absolute", top: 12, right: 12,
          background: sideColor,
          color: "#fff",
          padding: "4px 12px", borderRadius: 20,
          fontSize: 10, fontWeight: 700,
        }}>
          {stateInfo.label}
        </div>

        {/* 작업 종류 칩 — V14: active=true 박기 (색 박힘) */}
        {!isExternal && (
          <Chip
            icon={serviceType.icon}
            label={serviceType.label}
            color={serviceType.color}
            size="sm"
            active={true}
          />
        )}

        {/* 고객명 / 외근 note (가장 큼) */}
        <div style={{
          fontSize: 22, fontWeight: 700, marginTop: 6,
          color: "var(--text-primary)", paddingRight: 56,
        }}>
          {titleText}
        </div>

        {/* 주소 */}
        {task.address && (
          <div style={{
            fontSize: 11, color: "var(--text-secondary)",
            marginTop: 6, lineHeight: 1.5,
          }}>
            📍 {task.address}
          </div>
        )}

        {/* 시간 + 작업 (V14 2B-1 fix — 기종 박기 / 작업유형은 별도 칩) */}
        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>
          🕐 {task.time || "—"}
          {task.state === "active" && task.startedAt && <> · 시작 {formatTimeOnly(task.startedAt)}</>}
          {Array.isArray(task.workItems) && task.workItems.length > 0 && (
            <> · {task.workItems.map(w => {
              const base = `${w.appliance || w.workType || "—"}${w.qty ? ` ×${w.qty}` : ""}`;
              return (w.isCanceled || w.is_canceled) ? `${base} (취소)` : base;
            }).join(", ")}</>
          )}
          {!task.workItems && (task.appliance || task.workType) && (
            <> · {task.appliance || task.workType}{task.qty ? ` ×${task.qty}` : ""}</>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────── 3. QuickActions ────────────────
// 2026-06-26 — 기사 연락 버튼 (📞/💬) 공통 스타일. phone 없으면 회색 비활성.
function engineerContactBtnStyle(active) {
  return {
    padding: "4px 8px",
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    cursor: active ? "pointer" : "default",
    opacity: active ? 1 : 0.35,
    fontSize: 13, fontWeight: 700,
    fontFamily: "inherit",
    lineHeight: 1,
  };
}

// 2026-05-26 D-2 — 작업 정보 카드 (연락처/주소/일정 + 배정 프로 + 고객 통화·일정 변경)
//   유솔앱 PrincipalApp.jsx:983~ 패턴 측 catch. 핸들러 100% 측 catch (onAssign / onEdit /
//   onScheduleChange / callCustomer 측 catch — 측 측 측 측 측 측 측 X).
function WorkInfoCard({ task, apiEngineers = [], onAssign, onScheduleChange, onSendMessage }) {
  function callCustomer() {
    if (task.phone) window.location.href = `tel:${task.phone}`;
  }
  // 2026-06-26 — 배정 기사 연락 (tel: / sms:).
  //   resolvedEngineerPhone 우선 사용:
  //     · task.engineerPhone (rowToTask 매핑 — PAYMENT_SELECT embed 에 phone 포함 시 동작)
  //     · 폴백: apiEngineers 에서 UUID 직접 매칭 (e.userId === assignedEngineerId)
  //   AdminTaskDetailScreen 이 getTaskByIdDb 로 task 재 fetch + setTask → AdminApp 의
  //   미리-패치는 덮어써짐 → 이 컴포넌트 안에서 apiEngineers 폴백 직접 계산 필요.
  const resolvedEngineerPhone = (() => {
    if (task.engineerPhone) return task.engineerPhone;
    const id = task.assignedEngineerId || task.engineerId || null;
    if (!id || !Array.isArray(apiEngineers) || apiEngineers.length === 0) return "";
    const eng = apiEngineers.find(e => e && e.userId === id);
    return (eng && (eng.phone || eng.연락처 || eng.전화)) || "";
  })();
  function callEngineer() {
    if (resolvedEngineerPhone) window.location.href = `tel:${resolvedEngineerPhone}`;
  }
  function smsEngineer() {
    if (!resolvedEngineerPhone) return;
    const taskNo   = task.taskNo   || task.task_no       || "";
    const customer = task.customer || task.customerName  || task.customer_name || "";
    const prefix = [taskNo, customer].filter(Boolean).join(" ").trim();
    const body = prefix ? `[${prefix}] ` : "";
    window.location.href = `sms:${resolvedEngineerPhone}?body=${encodeURIComponent(body)}`;
  }
  const hasCustomerPhone = !!task.phone;
  const hasEngineer      = !!task.engineer;
  const hasEngineerPhone = !!resolvedEngineerPhone;
  // 2026-06-26 — 진단: 기사 배정됐는데 폴백까지 다 실패해서 phone 0 일 때 콘솔.
  //   원인 추적용 — apiEngineers 미로딩 / userId 매칭 실패 / DB phone NULL 등.
  if (typeof console !== "undefined" && hasEngineer && !hasEngineerPhone) {
    console.warn("[WorkInfoCard] 기사 배정됨 but engineerPhone 빈 값",
      {
        engineer:           task.engineer,
        assignedEngineer:   task.assignedEngineer,
        assignedEngineerId: task.assignedEngineerId,
        engineerId:         task.engineerId,
        engineerPhone:      task.engineerPhone,
        apiEngineersLen:    apiEngineers.length,
        matchedFromList:    apiEngineers.find(e => e && e.userId === (task.assignedEngineerId || task.engineerId)) || null,
        taskCode:           task.taskCode || task.taskNo,
      }
    );
  }
  // 일정 표시
  const scheduledDisplay =
    task.scheduledDate && task.scheduledTime
      ? `${task.scheduledDate} ${task.scheduledTime}`
      : (task.scheduledDate || task.requestedDate)
        ? `${task.scheduledDate || task.requestedDate}${task.scheduledTime || task.requestedTime ? " " + (task.scheduledTime || task.requestedTime) : ""}`
        : "—";

  return (
    <div style={{ padding: D1_OUTER_PAD }}>
      <div style={D1_CARD_STYLE}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 12 }}>
          작업 정보
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
          <D2LabelRow label="연락처" value={task.phone || "—"} mono/>
          <D2LabelRow label="주소"   value={task.address || "—"} wrap/>
          <D2LabelRow label="일정"   value={scheduledDisplay} highlight/>
          {/* 2026-05-29 — 결제 방식 라벨 (선택값 있을 때만 / NULL 숨김) */}
          {task.paymentMethod && (
            <D2LabelRow label="💳 결제" value={PAYMENT_METHOD_LABELS[task.paymentMethod] || task.paymentMethod}/>
          )}
        </div>

        {/* 배정 프로 */}
        <div style={{
          paddingTop: 10, marginBottom: 12,
          borderTop: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        }}>
          <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>배정 프로</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: hasEngineer ? "var(--text-primary)" : "var(--text-tertiary, var(--text-secondary))" }}>
              {hasEngineer ? task.engineer : "미배정"}
            </span>
            {/* 2026-06-26 — 기사 전화·문자 (배정 기사 + phone 있을 때만 활성). */}
            <button
              type="button"
              onClick={callEngineer}
              disabled={!hasEngineerPhone}
              aria-label="기사에게 전화"
              title={hasEngineerPhone ? `전화 ${task.engineerPhone}` : "기사 연락처 없음"}
              style={engineerContactBtnStyle(hasEngineerPhone)}
            >📞</button>
            <button
              type="button"
              onClick={smsEngineer}
              disabled={!hasEngineerPhone}
              aria-label="기사에게 문자"
              title={hasEngineerPhone ? "문자 (작업번호 자동)" : "기사 연락처 없음"}
              style={engineerContactBtnStyle(hasEngineerPhone)}
            >💬</button>
            {/* 2026-06-26 — 개별 메시지 (옵션 c 서버 저장 + 푸시). hasEngineer 면 활성. */}
            <button
              type="button"
              onClick={onSendMessage}
              disabled={!hasEngineer}
              aria-label="기사에게 메시지 전송"
              title={hasEngineer ? "메시지 전송 (앱 푸시 + 메시지 탭 저장)" : "기사 미배정"}
              style={engineerContactBtnStyle(hasEngineer)}
            >📨</button>
            <button
              onClick={onAssign}
              style={{
                padding: "5px 12px",
                background: hasEngineer ? "var(--bg-secondary)" : "var(--accent)",
                border: hasEngineer ? "1px solid var(--border)" : "none",
                borderRadius: 8,
                color: hasEngineer ? "var(--text-secondary)" : "#fff",
                fontSize: 11, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {hasEngineer ? "변경 ›" : "배정 ›"}
            </button>
          </div>
        </div>

        {/* 측 측 측 측 — 고객 통화 / 일정 변경 */}
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={callCustomer}
            disabled={!hasCustomerPhone}
            style={{
              flex: 1, padding: 10,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              cursor: hasCustomerPhone ? "pointer" : "default",
              opacity: hasCustomerPhone ? 1 : 0.4,
              fontSize: 12, fontWeight: 700,
              color: "var(--text-primary)",
              fontFamily: "inherit",
            }}
          >
            📞 고객 통화
          </button>
          <button
            onClick={onScheduleChange || (() => alert("일정 변경 기능을 준비 중입니다"))}
            style={{
              flex: 1, padding: 10,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: 12, fontWeight: 700,
              color: "var(--text-primary)",
              fontFamily: "inherit",
            }}
          >
            📅 일정 변경
          </button>
        </div>
      </div>
    </div>
  );
}

function D2LabelRow({ label, value, mono, wrap, highlight }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start",
      justifyContent: "space-between", gap: 10,
    }}>
      <span style={{
        fontSize: 11, color: "var(--text-secondary)",
        fontWeight: 600, flexShrink: 0,
      }}>{label}</span>
      <span
        className={mono ? "mono" : ""}
        style={{
          fontSize: 13, fontWeight: 700,
          color: highlight ? "var(--accent)" : "var(--text-primary)",
          textAlign: "right",
          wordBreak: wrap ? "break-word" : "normal",
          whiteSpace: wrap ? "normal" : "nowrap",
        }}
      >{value}</span>
    </div>
  );
}

// 2026-05-26 D-5 — 옛 QuickActions / ActionButton / EngineerCard 측 catch.
//   D-2(c5f6fc4) 측 catch WorkInfoCard 측 catch 측 catch — 측 측 측 측 측 측 측 X.
//   contactEngineer 측 ⋮ 메뉴 'engineer_call' 측 catch 측 catch (D-5-a).
//   고객 통화 / 일정 변경 측 WorkInfoCard 측 측 측 측 측 측 측 측 측.

// ──────────────── 카드 4 — SettlementInfoCard (Phase 5 Step 0.C-4) ────────────────
// 작업 금액 + 추가금 + 합계 + 회사 수익 + 기사 분배
// 회사 수익 / 기사 분배 = payments 측 매핑 (task.engineer_amount / task.owner_amount)
function SettlementInfoCard({ task }) {
  const isExternal = task.type === "external";
  if (isExternal) return null;

  const isDone = task.state === "done";
  const baseAmount   = Number(task.estimateTotal || 0);
  const extraFeeAmt  = Number(task.extraFee || task.addonFee || 0);
  const extraReason  = task.extraReason || "";
  const sumTotal     = isDone ? baseAmount + extraFeeAmt : baseAmount;
  const engineerAmt  = Number(task.engineer_amount || 0);
  const ownerAmt     = Number(task.owner_amount || 0);
  const principalAmt = Number(task.principal_amount || 0);
  const hasPayment   = engineerAmt > 0 || ownerAmt > 0 || principalAmt > 0;

  return (
    <div style={{ padding: D1_OUTER_PAD }}>
      <div style={D1_CARD_STYLE}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 10 }}>
          💰 정산 정보
        </div>

        {sumTotal > 0 ? (
          <>
            {/* 작업 금액 */}
            <SettlementRow label="작업 금액" value={baseAmount}/>
            {/* 추가금 (있을 때만) */}
            {extraFeeAmt > 0 && (
              <>
                <SettlementRow label="+ 현장 추가금" value={extraFeeAmt} color="#F59E0B"/>
                {extraReason && (
                  <div style={{ fontSize: 9, color: "var(--text-tertiary, var(--text-secondary))", marginTop: 1, paddingLeft: 4, lineHeight: 1.5 }}>
                    ↳ 사유: {extraReason}
                  </div>
                )}
              </>
            )}
            {/* 합계 */}
            <div style={{ height: 1, background: "var(--border)", margin: "6px 0" }}/>
            <SettlementRow label="합계" value={sumTotal} color="var(--text-primary)" bold/>

            {hasPayment && (
              <>
                <div style={{ height: 1, background: "var(--border)", margin: "8px 0" }}/>
                <div style={{ fontSize: 9, color: "var(--text-secondary)", fontWeight: 600, marginBottom: 4 }}>
                  📊 분배
                </div>
                {engineerAmt  > 0 && <SettlementRow label="기사 분배" value={engineerAmt}  color="#06B6D4"/>}
                {ownerAmt     > 0 && <SettlementRow label="회사 수익" value={ownerAmt}     color="#1D9E75"/>}
                {principalAmt > 0 && <SettlementRow label="원청 수수료" value={principalAmt} color="#A855F7"/>}
              </>
            )}
          </>
        ) : (
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 600, textAlign: "center", padding: 6 }}>
            견적 미입력
          </div>
        )}

        {!isDone && sumTotal > 0 && (
          <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginTop: 6 }}>
            현장 추가금은 완료 시 입력
          </div>
        )}
      </div>
    </div>
  );
}

// 2026-05-26 D-3 — 유솔앱 LabelRow 톤 (라벨 12 textSecondary / 값 13 bold)
function SettlementRow({ label, value, color, bold }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      fontSize: bold ? 13 : 12, padding: "3px 0",
    }}>
      <span style={{
        color: bold ? "var(--text-primary)" : "var(--text-secondary)",
        fontWeight: bold ? 700 : 600,
      }}>{label}</span>
      <span style={{
        color: color || "var(--text-primary)",
        fontFamily: "inherit",
        fontWeight: bold ? 800 : 700,
      }}>
        {Number(value || 0).toLocaleString()}<span style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 500 }}> 원</span>
      </span>
    </div>
  );
}

// ──────────────── Phase C Step 6 — 작업 항목별 받은 돈 표시/수정 카드 ────────────────
// 2026-05-31 — task_items per-item 표시 + 신규 흐름 (non-usol_n / non-prepaid) 측 받은 돈 input.
// onBlur 측 setTaskItemReceivedAmount 호출 → DB 트리거 chain → tasks.received_total + extra_fee + compute_payment 자동 sync.
function TaskItemsCard({ task }) {
  if (task?.type === "external") return null;

  const items = Array.isArray(task?.workItems) ? task.workItems : [];
  const usesReceivedTotalFlow =
    task?.principalCode !== 'usol_n' && task?.paymentMethod !== 'prepaid';

  // local input state
  const [localReceived, setLocalReceived] = useState(() => {
    const init = {};
    for (const it of items) {
      if (!it || !it.id) continue;
      if (it.isCanceled) init[it.id] = "0";
      else if (it.receivedAmount != null) init[it.id] = String(it.receivedAmount);
      else init[it.id] = "";
    }
    return init;
  });
  const [saving, setSaving] = useState({});

  // task.workItems 측 외부 변경 (refetch) 시 sync — 사용자 입력 중이 아닌 row 측만 갱신
  useEffect(() => {
    setLocalReceived(prev => {
      const next = { ...prev };
      for (const it of items) {
        if (!it || !it.id) continue;
        if (saving[it.id]) continue; // 저장 중이면 skip
        const dbValue = it.isCanceled ? "0"
          : (it.receivedAmount != null ? String(it.receivedAmount) : "");
        // 기존 입력값과 DB 값이 다르면서 사용자 입력 흔적 없음 측 fresh init
        if (next[it.id] == null) next[it.id] = dbValue;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, items.map(i => `${i?.id}:${i?.receivedAmount}:${i?.isCanceled}`).join('|')]);

  async function handleBlur(itemId, originalValue) {
    const newValue = parseInt(localReceived[itemId] || "0", 10) || 0;
    const dbValue  = Number(originalValue ?? 0);
    if (newValue === dbValue) return;
    setSaving(prev => ({ ...prev, [itemId]: true }));
    try {
      const res = await apiSetItemReceived(itemId, newValue);
      if (!res || res.ok === false) {
        console.warn('[admin/TaskItemsCard] received_amount 저장 실패:', res?.error);
      }
    } catch (e) {
      console.warn('[admin/TaskItemsCard] received_amount 예외:', e?.message);
    } finally {
      setSaving(prev => ({ ...prev, [itemId]: false }));
    }
  }

  if (items.length === 0) return null;

  return (
    <div style={{ padding: D1_OUTER_PAD }}>
      <div style={D1_CARD_STYLE}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 10 }}>
          🔢 작업 항목별
        </div>

        {items.map((it, idx) => {
          const colors    = getWorkTypeColors(it.workType);
          const qty       = Number(it.qty) || 1;
          const unitPrice = Number(it.unitPrice) || 0;
          const subtotal  = Number(it.subtotal) || (unitPrice * qty);
          const isMain    = (it.orderType || it.order_type) !== '추가선택';
          const isCanceled = !!it.isCanceled;
          const canShowInput = usesReceivedTotalFlow && isMain && !isCanceled;
          const orderTypeLabel = it.orderType || it.order_type || "";

          return (
            <div key={it.id || idx} style={{
              borderTop: idx === 0 ? "none" : "1px solid var(--border)",
              padding: "10px 0",
              opacity: isCanceled ? 0.55 : 1,
            }}>
              {/* 헤더 — 아이콘 + work_type + appliance ×qty + 추가선택 라벨 + ✗ 취소 */}
              <div style={{
                display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap",
              }}>
                <span style={{ fontSize: 14, filter: isCanceled ? "grayscale(1)" : "none" }}>{colors.icon}</span>
                <span style={{
                  fontSize: 11, fontWeight: 800,
                  color: isCanceled ? "#9CA3AF" : colors.main,
                }}>
                  {colors.name}
                </span>
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  color: isCanceled ? "#9CA3AF" : "var(--text-primary)",
                  textDecoration: isCanceled ? "line-through" : "none",
                }}>
                  {it.appliance || colors.name} ×{qty}
                </span>
                {orderTypeLabel && (
                  <span style={{ fontSize: 9, color: "var(--text-tertiary)", fontWeight: 600 }}>
                    ({orderTypeLabel})
                  </span>
                )}
                {isCanceled && (
                  <span style={{
                    fontSize: 9, fontWeight: 800,
                    padding: "1px 5px", borderRadius: 999,
                    background: "#FCEBEB", color: "#A32D2D",
                    marginLeft: "auto",
                  }}>✗ 취소</span>
                )}
              </div>

              {/* 견적 */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                fontSize: 11, fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: canShowInput ? 6 : 0,
              }}>
                <span>견적 (단가 × {qty})</span>
                <span className="mono" style={{
                  color: isCanceled ? "var(--text-tertiary)" : "var(--text-primary)",
                  fontWeight: 700,
                  textDecoration: isCanceled ? "line-through" : "none",
                }}>
                  ₩{subtotal.toLocaleString("ko-KR")}
                </span>
              </div>

              {/* 받은 돈 input — 신규 흐름 + 메인 + 비-취소 측만 */}
              {canShowInput && (
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  gap: 8, marginTop: 4,
                }}>
                  <span style={{
                    fontSize: 11, color: "#D4537E", fontWeight: 800,
                    letterSpacing: 0.3, whiteSpace: "nowrap",
                  }}>
                    💰 받은 돈
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={localReceived[it.id] != null ? localReceived[it.id] : ""}
                    placeholder={String(subtotal)}
                    onChange={(e) => setLocalReceived(prev => ({ ...prev, [it.id]: e.target.value }))}
                    onBlur={() => handleBlur(it.id, it.receivedAmount)}
                    disabled={!!saving[it.id]}
                    style={{
                      width: 130,
                      padding: "5px 8px",
                      background: "var(--card-bg)",
                      border: `1px solid ${colors.main}`,
                      borderRadius: 6,
                      color: "var(--text-primary)",
                      fontSize: 13, fontWeight: 700,
                      textAlign: "right",
                      outline: "none",
                      fontFamily: "inherit",
                      opacity: saving[it.id] ? 0.5 : 1,
                    }}
                  />
                </div>
              )}

              {/* 가드 케이스 안내 (usol_n / prepaid) */}
              {!usesReceivedTotalFlow && isMain && !isCanceled && (
                <div style={{
                  fontSize: 9, color: "var(--text-tertiary)",
                  marginTop: 4, fontStyle: "italic",
                }}>
                  ↳ 가드 케이스 (usol_n / prepaid) — 옛 흐름 (extra_fee 직접 입력)
                </div>
              )}
            </div>
          );
        })}

        {/* 합계 표시 (신규 흐름) — DB 트리거가 자동 sync 한 task.received_total */}
        {usesReceivedTotalFlow && (
          <>
            <div style={{ height: 1, background: "var(--border)", margin: "10px 0 8px" }}/>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              fontSize: 13, fontWeight: 800,
            }}>
              <span style={{ color: "#D4537E", display: "flex", alignItems: "center", gap: 4 }}>
                💰 총 받은 돈
              </span>
              <span className="mono" style={{ color: "#D4537E", fontWeight: 800 }}>
                ₩{Number(task?.receivedTotal || 0).toLocaleString("ko-KR")}
              </span>
            </div>
            <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginTop: 3 }}>
              ↳ DB 트리거 자동 sync — 각 row 받은 돈 합 (비-취소).
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ──────────────── 카드 5 — WorkTimeHistoryCard (Phase 5 Step 0.C-4) ────────────────
// 작업 시간 (startedAt~completedAt + duration) + 진행 5단계 TimestampHistory + 변경 이력 TaskChangesSection
function WorkTimeHistoryCard({ task, onTaskRefresh }) {
  if (task.type === "external") return null;

  const startedAt   = task.startedAt;
  const completedAt = task.completedAt;
  const duration    = (startedAt && completedAt) ? calcTotalDuration(startedAt, completedAt) : null;

  return (
    <div style={{ padding: D1_OUTER_PAD }}>
      <div style={D1_CARD_STYLE}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 10 }}>
          🕐 작업 시간 · 이력
        </div>

        {/* 작업 시간 (시작~완료 + 총 소요) — 2026-05-26 D-4 LabelRow 톤 */}
        {(startedAt || completedAt) && (
          <div style={{
            padding: 10,
            background: "var(--bg-secondary)",
            borderRadius: 8, marginBottom: 10,
          }}>
            <D4TimeRow label="시작" value={formatDateTimeKST(startedAt)}/>
            <D4TimeRow label="완료" value={formatDateTimeKST(completedAt)}/>
            {duration && (
              <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 700 }}>총 소요</span>
                  <span style={{ fontSize: 13, color: "var(--accent)", fontWeight: 800, fontFamily: "inherit" }}>{duration}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 진행 5단계 (옛 TimestampHistory 영역) */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 700, marginBottom: 6 }}>
            진행 단계
          </div>
          <TimestampRows task={task}/>
        </div>

        {/* 2026-06-07 — 취소 정보 입력 카드 (status='취소' 일 때만 표시, 변경 이력 위) */}
        {task.status === "취소" && (
          <CancelInfoCard task={task} onSaved={onTaskRefresh}/>
        )}

        {/* 변경 이력 (task_changes) — 2026-05-29 v2: task 객체 전달 (synthetic cancel row 옛 작업 fallback) */}
        <TaskChangesSection task={task}/>
      </div>
    </div>
  );
}

function TimestampRows({ task }) {
  const rows = [
    { label: "접수",      value: task.createdAt },
    { label: "배정",      value: task.assignedAt },
    { label: "일정 확정", value: task.scheduledConfirmedAt },
    { label: "진행",      value: task.startedAt },
    { label: "완료",      value: task.completedAt },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {rows.map(r => (
        <D4TimeRow key={r.label} label={r.label} value={formatDateTimeKST(r.value)}/>
      ))}
    </div>
  );
}

// 2026-05-26 D-4 — 시간 row 측 catch (유솔앱 LabelRow 톤)
//   라벨 12 textSecondary / 값 13 mono textPrimary
function D4TimeRow({ label, value }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 10,
    }}>
      <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>{label}</span>
      <span className="mono" style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>
        {value || "—"}
      </span>
    </div>
  );
}

// 2026-06-07 — 취소 정보 입력 카드 (Mig 098 set_task_cancel_info RPC).
//   status='취소' 일 때만 표시. 취소자 4종 선택 + 사유 입력 + 저장.
//   기존 cancelActor/cancelReason prefill. 저장 → 부모가 task 재조회.
function CancelInfoCard({ task, onSaved }) {
  const cat = task?.categoryData || {};
  const [actorKind, setActorKind] = useState(task?.cancelActor || cat.cancelActor || "");
  const [reason, setReason] = useState(task?.cancelReason || cat.cancelReason || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  // task 변경 시 prefill 갱신 (재조회 후 server state 반영).
  useEffect(() => {
    setActorKind(task?.cancelActor || task?.categoryData?.cancelActor || "");
    setReason(task?.cancelReason || task?.categoryData?.cancelReason || "");
    setError("");
  }, [task?.id, task?.cancelActor, task?.cancelReason]);

  async function handleSave() {
    setError("");
    if (!actorKind) { setError("취소자를 선택해주세요"); return; }
    if (!String(reason).trim()) { setError("사유를 입력해주세요"); return; }
    setSaving(true);
    try {
      const res = await setTaskCancelInfo({ taskId: task.id, actorKind, reason });
      if (!res || res.ok === false) {
        const raw = String((res && res.error) || "").toLowerCase();
        if (raw.includes("could not find") || raw.includes("does not exist") || raw.includes("pgrst202") || raw.includes("function") && raw.includes("not exist")) {
          setError("RPC 미배포 — 사장님 SQL 실행 필요 (Migration 098)");
        } else {
          setError((res && res.error) || "저장 실패");
        }
        return;
      }
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
      onSaved && onSaved();
    } catch (e) {
      setError(e?.message || "저장 중 오류");
    } finally {
      setSaving(false);
    }
  }

  const KIND_OPTIONS = [
    { v: "operator", label: "운영자" },
    { v: "partner",  label: "유솔/원청" },
    { v: "engineer", label: "기사" },
    { v: "customer", label: "고객" },
  ];

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--border)" }}>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 700, marginBottom: 6 }}>
        📝 취소 정보
      </div>
      <div style={{
        padding: 10,
        background: "rgba(220,38,38,0.06)",
        border: "1px solid rgba(220,38,38,0.18)",
        borderRadius: 8,
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, marginBottom: 4 }}>
            취소자
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {KIND_OPTIONS.map(opt => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setActorKind(opt.v)}
                style={{
                  flex: 1, minWidth: 60,
                  padding: "6px 8px",
                  fontSize: 12, fontWeight: 700,
                  border: actorKind === opt.v ? "2px solid #DC2626" : "1px solid var(--border)",
                  background: actorKind === opt.v ? "rgba(220,38,38,0.12)" : "var(--bg-elevated)",
                  color: actorKind === opt.v ? "#DC2626" : "var(--text-primary)",
                  borderRadius: 6, cursor: "pointer",
                }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, marginBottom: 4 }}>
            사유
          </div>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="예: 고객 일정 변경 / 기사 사정 / 차량 사고 등"
            style={{
              width: "100%", boxSizing: "border-box",
              minHeight: 50, padding: 8, fontSize: 12,
              border: "1px solid var(--border)", borderRadius: 6,
              background: "var(--bg-elevated)", color: "var(--text-primary)",
              resize: "vertical", fontFamily: "inherit",
            }}
          />
        </div>
        {error && (
          <div style={{ fontSize: 11, color: "#DC2626", fontWeight: 600 }}>⚠️ {error}</div>
        )}
        {savedFlash && (
          <div style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}>✓ 저장됨</div>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "8px 12px",
            fontSize: 12, fontWeight: 700,
            border: "none", borderRadius: 6,
            background: saving ? "var(--bg-secondary)" : "#DC2626",
            color: saving ? "var(--text-secondary)" : "white",
            cursor: saving ? "default" : "pointer",
          }}>
          {saving ? "저장 중..." : "💾 저장"}
        </button>
      </div>
    </div>
  );
}

// 변경 이력 (task_changes 측 fetch) — 본문 측 inline 렌더
// 2026-05-29 v2 — 옛 작업 fallback (D6): task_changes 측 cancel 이벤트 없고 status='취소' 이면
//   category_data.cancel* 기반 synthetic cancel row 를 prepend (Migration 073 이전 cancel 호환).
function TaskChangesSection({ task }) {
  const taskId = task?.id;
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [reloadTick, setReloadTick] = useState(0);

  // Phase 5 Step 0.C-9 — task_id 측 task_changes 변경 시 자동 refetch
  useRealtimeTable("task_changes", () => setReloadTick(v => v + 1), taskId ? `task_id=eq.${taskId}` : null);

  useEffect(() => {
    if (!taskId) return;
    let alive = true;
    setLoading(true);
    setError("");
    listTaskChanges(taskId)
      .then(res => {
        if (!alive) return;
        if (!res.ok) {
          setError(res.error || "");
          setChanges([]);
        } else {
          setChanges(res.changes || []);
        }
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [taskId, reloadTick]);

  // 2026-05-29 v2 (D6) — synthetic cancel row: 옛 작업 (task_changes 측 cancel 없음) fallback.
  // 2026-06-07 — actor 없을 때 배정 기사 이름 fallback (usol_n 시트 sync 취소 대응).
  const displayChanges = useMemo(() => {
    if (!task || task.status !== "취소") return changes;
    const hasCancelChange = changes.some(c => c.change_type === "cancel");
    if (hasCancelChange) return changes;
    // 옛 cancel 정보 — 평탄화 키 우선 + category_data fallback
    const cat = task.categoryData || {};
    const reason       = task.cancelReason             || cat.cancelReason             || null;
    const actor        = task.cancelActor              || cat.cancelActor              || null;
    const actorUid     = task.cancelActorUserId        || cat.cancelActorUserId        || null;
    const principalCode = task.cancelActorPrincipalCode || cat.cancelActorPrincipalCode || null;
    const at           = task.cancelAt                 || cat.cancelAt                 || task.updatedAt || null;

    // 2026-06-07 — actor 없으면 배정 기사로 fallback (덮어쓰기 X).
    let actorName;
    if (actor || actorUid) {
      const u = actorUid ? getUserById(actorUid) : null;
      actorName = getCancelActorLabel({ actor, name: u?.name || null, principalCode });
    } else {
      const engUid  = task.assignedEngineerId || task.engineerId || null;
      const engUser = engUid ? getUserById(engUid) : null;
      const engName = engUser?.name || task.engineer || null;
      actorName = engName ? `기사 ${engName}` : getCancelActorLabel({ actor, name: null, principalCode });
    }

    if (!reason && !actor && !actorUid && !at && actorName === "—") return changes;

    const synthetic = {
      id:              "_synthetic_cancel",
      change_type:     "cancel",
      note:            reason || null,
      changed_at:      at,
      changed_by_name: actorName,
      _synthetic:      true,
    };
    return [synthetic, ...changes];
  }, [task, changes]);

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--border)" }}>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 700, marginBottom: 6 }}>
        📜 변경 이력{displayChanges.length > 0 && <span style={{ color: "var(--text-tertiary, var(--text-secondary))", marginLeft: 4 }}>({displayChanges.length})</span>}
      </div>
      {loading ? (
        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>불러오는 중...</div>
      ) : error ? (
        <div style={{ fontSize: 11, color: "#ff4444" }}>⚠️ {error}</div>
      ) : displayChanges.length === 0 ? (
        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>변경 이력 X (새 작업부터 누적)</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {displayChanges.map(ch => (
            <ChangeEntry key={ch.id} entry={ch}/>
          ))}
        </div>
      )}
    </div>
  );
}

const CHANGE_TYPE_ICON = {
  schedule:   "📅",
  engineer:   "👷",
  items:      "📋",
  extra_fee:  "💰",
  cancel:     "❌",
  visit_only: "🚗",
  status:     "🔄",
  // 2026-06-09 — Mig 098 추가
  create:     "✨",
};
const CHANGE_TYPE_LABEL = {
  schedule:   "일정 변경",
  engineer:   "기사 변경",
  items:      "항목 변경",
  extra_fee:  "추가금",
  cancel:     "작업 취소",
  visit_only: "출장비만",
  status:     "상태 변경",
  // 2026-06-09 — Mig 098 추가
  create:     "접수 (생성)",
};

function ChangeEntry({ entry }) {
  const icon  = CHANGE_TYPE_ICON[entry.change_type]  || "•";
  const label = CHANGE_TYPE_LABEL[entry.change_type] || entry.change_type;
  // 2026-06-09 — actor 표시 "{역할} {이름}".
  //   role + name 둘 다 있음 → "운영자 최수연"
  //   role 만 → "운영자"   (옛 행 — name snapshot 누락)
  //   name 만 → "최수연"   (옛 행 — role 컬럼 NULL, Mig 098 이전)
  //   둘 다 없음 → "시스템" (anon trigger / 외부 시트 / 시드 등)
  const role = entry.changed_by_role || "";
  const name = entry.changed_by_name || "";
  const who  = role && name ? `${role} ${name}`
             : role         ? role
             : name         ? name
             : "시스템";
  // 2026-05-29 v2 — cancel 이벤트 note 한국어 매핑 (reasonId → CANCEL_REASONS 라벨)
  const isCancel = entry.change_type === "cancel";
  const noteDisplay = isCancel
    ? (getCancelReasonLabel(entry.note) || entry.note)
    : entry.note;
  return (
    <div style={{
      padding: 8,
      background: isCancel ? "rgba(220,38,38,0.06)" : "var(--bg-secondary)",
      borderRadius: 8,
      borderLeft: `3px solid ${isCancel ? "#DC2626" : "var(--accent)"}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: 12 }}>{icon}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: isCancel ? "#DC2626" : "var(--text-primary)" }}>{label}</span>
          <span style={{ fontSize: 10, color: "var(--text-tertiary, var(--text-secondary))" }}>· {who}</span>
        </div>
        <span className="mono" style={{ fontSize: 10, color: "var(--text-tertiary, var(--text-secondary))", flexShrink: 0 }}>
          {formatDateTimeKST(entry.changed_at)}
        </span>
      </div>
      {noteDisplay && (
        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.5 }}>
          ↳ {noteDisplay}
        </div>
      )}
    </div>
  );
}

// ──────────────── 카드 6 — RequestMemoCard (Phase 5 Step 0.C-4) ────────────────
// 옛 InfoCard 측 요청사항 + 메모 영역 분리.
// 2026-05-27 — requestNote (DB request_note) + 기사 협의 메모 (callMemo) + 기사 일정변경 사유 (rescheduleReason).
//   세 값 모두 3곳 매핑 트랩으로 평탄화 — task.callMemo / task.rescheduleReason / task.rescheduledAt 직접 사용.
function RequestMemoCard({ task, memos, onMemoAdd }) {
  // 요청사항 본문 — task.requestNote (DB request_note 매핑) 우선, 옛 task.memo fallback.
  const requestText      = task.requestNote      || task.memo || "";
  const callMemo         = task.callMemo         || "";
  const rescheduleReason = task.rescheduleReason || "";
  const rescheduledAt    = task.rescheduledAt    || "";
  return (
    <div style={{ padding: D1_OUTER_PAD }}>
      <div style={D1_CARD_STYLE}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 10 }}>
          📝 요청사항
        </div>
        <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6, fontWeight: 500 }}>
          {requestText || "없음"}
        </div>

        {callMemo && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 700, marginBottom: 6 }}>
              📞 기사 협의 메모 (고객 통화)
            </div>
            <div style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.5, fontWeight: 500 }}>
              {callMemo}
            </div>
          </div>
        )}

        {rescheduleReason && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 700, marginBottom: 6 }}>
              🕐 기사 일정변경 사유
            </div>
            <div style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.5, fontWeight: 500 }}>
              {rescheduleReason}
            </div>
            {rescheduledAt && (
              <div style={{ fontSize: 10, color: "var(--text-tertiary, var(--text-secondary))", marginTop: 4 }}>
                {String(rescheduledAt).slice(0, 16).replace("T", " ")}
              </div>
            )}
          </div>
        )}

        {/* 2026-05-27 — DB task_memos: 작성자(이름·역할 이모지) + 시각(KST) + 본문 */}
        {memos.length > 0 && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 700, marginBottom: 6 }}>
              💬 메모 ({memos.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {memos.slice(0, 3).map((m) => (
                <div key={m.id} style={{
                  background: "var(--bg-secondary)",
                  borderRadius: 6, padding: "8px 10px",
                }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    fontSize: 10, color: "var(--text-tertiary, var(--text-secondary))",
                    marginBottom: 4, fontWeight: 600,
                  }}>
                    <span>{getMemoTypeLabel(m.memo_type)}</span>
                    <span>·</span>
                    <span>{getAuthorRoleEmoji(m.author_role)} {m.author_name || "—"}</span>
                    <span style={{ marginLeft: "auto" }}>
                      {m.created_at ? String(m.created_at).slice(0, 16).replace("T", " ") : ""}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.5 }}>
                    {m.body}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
          <button
            onClick={onMemoAdd}
            style={{
              fontSize: 12, color: "var(--accent)",
              background: "transparent", border: "none",
              cursor: "pointer", padding: 0, fontWeight: 700,
              fontFamily: "inherit",
            }}
          >＋ 메모 추가</button>
        </div>
      </div>
    </div>
  );
}

// 2026-05-26 D-5 — InfoCard dead code 제거 (어디서도 render 측 X).
//   견적 / 메모 측 catch 측 SettlementInfoCard + RequestMemoCard 측 catch 측 catch.
//   2026-05-26 D-5 — TimestampHistory dead code 제거 (WorkTimeHistoryCard 측 TimestampRows 측 catch 측 catch).
// eslint-disable-next-line no-unused-vars
function _DEAD_InfoCard({ task, memos, onMemoAdd }) {
  const isExternal = task.type === "external";
  const isDone = task.state === "done";
  const sumEstimate = task.estimateTotal || 0;
  // 2026-05-19 Phase 5 Step 0.C-3-a — extraFee 매핑 정정 (옛 addonFee 측 fallback)
  const extraFeeAmount = Number(task.extraFee || task.addonFee || 0);
  const extraReason    = task.extraReason || "";
  const sumTotal = isDone ? sumEstimate + extraFeeAmount : sumEstimate;

  return (
    <>
      {/* 견적 — V14 Phase 2: 견적 X (0 / null) → "견적 미입력" 표시 */}
      {!isExternal && (
        <div style={{ padding: "0 16px", marginBottom: 8 }}>
          <div style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 10, padding: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                💰 {isDone ? "최종 금액" : "견적 금액"}
              </div>
              {sumTotal > 0 ? (
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "inherit", color: "var(--text-primary)" }}>
                  {sumTotal.toLocaleString()}
                  <span style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 500 }}>원</span>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 600 }}>
                  견적 미입력
                </div>
              )}
            </div>
            {!isDone && sumTotal > 0 && (
              <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginTop: 4 }}>
                현장 추가금은 완료 시 입력
              </div>
            )}
            {isDone && extraFeeAmount > 0 && (
              <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 2 }}>
                  <span style={{ color: "var(--text-secondary)" }}>견적</span>
                  <span style={{ color: "var(--text-primary)", fontFamily: "inherit" }}>{sumEstimate.toLocaleString()}원</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                  <span style={{ color: "#F59E0B", fontWeight: 600 }}>+ 현장 추가금</span>
                  <span style={{ color: "#F59E0B", fontWeight: 600, fontFamily: "inherit" }}>{extraFeeAmount.toLocaleString()}원</span>
                </div>
                {extraReason && (
                  <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginTop: 4, paddingLeft: 4, lineHeight: 1.5 }}>
                    ↳ 사유: {extraReason}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 요청사항 + 메모 */}
      <div style={{ padding: "0 16px", marginBottom: 14 }}>
        <div style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 10, padding: 12,
        }}>
          <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>
            📝 요청사항
          </div>
          <div style={{ fontSize: 11, color: "var(--text-primary)", lineHeight: 1.5 }}>
            {task.memo || "없음"}
          </div>

          {memos.length > 0 && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>
                메모 ({memos.length})
              </div>
              {memos.slice(0, 3).map((m, i) => (
                <div key={i} style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.5 }}>
                  · {m.content}
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
            <button
              onClick={onMemoAdd}
              style={{
                fontSize: 10, color: "#FF1B8D",
                background: "transparent", border: "none",
                cursor: "pointer", padding: 0, fontWeight: 600,
                fontFamily: "inherit",
              }}
            >＋ 메모 추가</button>
          </div>
        </div>
      </div>
    </>
  );
}

// ──────────────── 5.5 TimestampHistory (dead — D-5 측 catch) ────────────────
// eslint-disable-next-line no-unused-vars
function _DEAD_TimestampHistory({ task }) {
  if (task.type === "external") return null;
  const rows = [
    { label: "접수",      value: task.createdAt },
    { label: "배정",      value: task.assignedAt },
    // 2026-05-15 fix — 이력 = "일어난 시점"(과거). scheduledAt은 "약속 시간"(미래)이라 의미 X.
    // scheduledConfirmedAt 추적 시스템 X → 항상 "—" 박힘 (별도 round에서 추적 추가).
    { label: "일정 확정", value: task.scheduledConfirmedAt },
    { label: "진행",      value: task.startedAt },
    { label: "완료",      value: task.completedAt },
  ];
  return (
    <div style={{ padding: "0 16px", marginBottom: 12 }}>
      <div style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 10, padding: 12,
      }}>
        <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 6 }}>
          🕐 이력
        </div>
        {rows.map((r, i) => (
          <div key={r.label} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            fontSize: 11, paddingTop: i === 0 ? 0 : 4,
          }}>
            <span style={{ color: "var(--text-secondary)" }}>{r.label}</span>
            <span className="mono" style={{ color: "var(--text-primary)" }}>
              {formatDateTimeKST(r.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────── 5.55 StatusHistorySection (Phase 5 Step 0.C-3-c) ────────────────
// status_history 측 SELECT → 타임라인 표시. 옛 작업 데이터 0건 = "변경 이력 X" 안내.
function StatusHistorySection({ taskId, taskType }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  useEffect(() => {
    if (taskType === "external" || !taskId) return;
    let alive = true;
    setLoading(true);
    setError("");
    listStatusHistory(taskId)
      .then(res => {
        if (!alive) return;
        if (!res.ok) {
          setError(res.error || "이력 조회 실패");
          setHistory([]);
        } else {
          setHistory(res.history || []);
        }
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [taskId, taskType]);

  if (taskType === "external") return null;
  if (!taskId) return null;
  if (loading) {
    return (
      <div style={historyCardStyle}>
        <HistorySectionLabel count={null}/>
        <div style={historyEmptyStyle}>불러오는 중...</div>
      </div>
    );
  }
  if (error) {
    return (
      <div style={historyCardStyle}>
        <HistorySectionLabel count={null}/>
        <div style={historyEmptyStyle}>⚠️ {error}</div>
      </div>
    );
  }
  if (history.length === 0) {
    return (
      <div style={historyCardStyle}>
        <HistorySectionLabel count={0}/>
        <div style={historyEmptyStyle}>변경 이력 X (새 작업부터 누적)</div>
      </div>
    );
  }

  return (
    <div style={historyCardStyle}>
      <HistorySectionLabel count={history.length}/>
      <div style={{ position: "relative", paddingLeft: 14 }}>
        {/* 좌측 세로 라인 */}
        <div style={{
          position: "absolute", left: 4, top: 4, bottom: 4,
          width: 1, background: "var(--border)",
        }}/>
        {history.map(entry => (
          <HistoryEntry key={entry.id} entry={entry}/>
        ))}
      </div>
    </div>
  );
}

function HistoryEntry({ entry }) {
  const from = entry.from_status || "—";
  const to   = entry.to_status   || "—";
  return (
    <div style={{ position: "relative", marginBottom: 8 }}>
      {/* dot */}
      <div style={{
        position: "absolute", left: -14, top: 4,
        width: 9, height: 9, borderRadius: "50%",
        background: "#FF1B8D",
        border: "2px solid var(--bg-secondary)",
      }}/>
      <div style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 600 }}>
        {from} → {to}
      </div>
      <div style={{ fontSize: 9, color: "var(--text-tertiary, var(--text-secondary))", marginTop: 1, fontFamily: "inherit" }}>
        {formatDateTimeKST(entry.changed_at)}
      </div>
      {entry.note && (
        <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.4 }}>
          ↳ {entry.note}
        </div>
      )}
    </div>
  );
}

function HistorySectionLabel({ count }) {
  return (
    <div style={{
      fontSize: 10, color: "var(--text-secondary)",
      marginBottom: 8, fontWeight: 600,
    }}>
      📜 변경 이력{count != null && <span style={{ color: "var(--text-tertiary, var(--text-secondary))", marginLeft: 4 }}>({count})</span>}
    </div>
  );
}

const historyCardStyle = {
  margin: "0 16px 12px",
  padding: 12,
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 10,
};

const historyEmptyStyle = {
  fontSize: 11, color: "var(--text-secondary)",
  textAlign: "center", padding: 10,
};

// ──────────────── 5.6 PhotoSection (Phase 5 Step 0.C-3-b) ────────────────
// listPhotosByTask 측 fetch → 그리드 표시. photos 0건 시 섹션 숨김.
// ──────────────────────────────────────────────
// 2026-05-22 — 냉매 충전 동의서 카드 (조회 전용)
// task.consent = { customerName, signatureUrl, signedAt }
// ──────────────────────────────────────────────
function ConsentCard({ consent }) {
  const customerName = consent?.customerName || "—";
  const signatureUrl = consent?.signatureUrl || "";
  const signedAt = consent?.signedAt || "";
  const signedAtLabel = signedAt ? formatDateTimeKST(signedAt) : "";

  return (
    <div style={{ padding: D1_OUTER_PAD }}>
    <div style={D1_CARD_STYLE}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>
          📝 냉매 충전 동의서
        </div>
        <div style={{ flex: 1 }}/>
        <span style={{
          padding: "3px 10px", borderRadius: 999,
          background: "rgba(29,158,117,0.18)",
          color: "#1D9E75",
          fontSize: 11, fontWeight: 700,
        }}>동의 완료</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <D4TimeRow label="고객" value={customerName}/>
        {signedAtLabel && <D4TimeRow label="시각" value={signedAtLabel}/>}
      </div>
      {signatureUrl && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 5 }}>서명</div>
          <img
            src={signatureUrl}
            alt="고객 서명"
            style={{
              maxWidth: "100%", maxHeight: 140,
              background: "#fff",
              border: "1px solid var(--border-color)",
              borderRadius: 8,
              display: "block",
            }}
          />
        </div>
      )}
    </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// 2026-05-22 — 재배정 요청 카드 (운영자 측 알림 + 안내)
// task.reassignRequest = { reason, requestedAt }
// ──────────────────────────────────────────────
function ReassignRequestCard({ request }) {
  const reason = request?.reason || "";
  const requestedAt = request?.requestedAt || "";
  const requestedAtLabel = requestedAt ? formatDateTimeKST(requestedAt) : "";

  return (
    <div style={{ padding: D1_OUTER_PAD }}>
    <div style={{
      ...D1_CARD_STYLE,
      background: "rgba(255,27,141,0.06)",
      border: "1px solid rgba(255,27,141,0.35)",
    }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#FF1B8D" }}>
          🔁 재배정 요청
        </div>
        <div style={{ flex: 1 }}/>
        <span style={{
          padding: "3px 10px", borderRadius: 999,
          background: "rgba(255,27,141,0.18)",
          color: "#FF1B8D",
          fontSize: 11, fontWeight: 700,
        }}>처리 대기</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {reason && (
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, flexShrink: 0 }}>사유</span>
            <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 700, textAlign: "right" }}>{reason}</span>
          </div>
        )}
        {requestedAtLabel && <D4TimeRow label="요청 시각" value={requestedAtLabel}/>}
      </div>
      <div style={{
        marginTop: 12, padding: "10px 12px",
        background: "rgba(255,184,0,0.10)",
        border: "1px solid rgba(255,184,0,0.30)",
        borderRadius: 8,
        fontSize: 12, color: "var(--text-primary)", lineHeight: 1.5, fontWeight: 500,
      }}>
        💡 위 [배정 프로] 카드 측 [변경] 버튼으로 다른 기사를 배정해 주세요.
      </div>
    </div>
    </div>
  );
}

// 2026-05-29 v2 (D6) — CancelInfoCard 폐기. 변경 이력 카드(TaskChangesSection) 측
//   cancel 이벤트 빨강 강조 + synthetic row(옛 작업 fallback) 으로 통합 표시.

function PhotoSection({ taskId, taskType }) {
  const [photos, setPhotos]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [zoomUrl, setZoomUrl] = useState(null);

  useEffect(() => {
    if (taskType === "external" || !taskId) return;
    let alive = true;
    setLoading(true);
    setError("");
    listPhotosByTask(taskId)
      .then(res => {
        if (!alive) return;
        if (!res.ok) {
          setError(res.error || "사진 조회 실패");
          setPhotos([]);
        } else {
          setPhotos(res.photos || []);
        }
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [taskId, taskType]);

  if (taskType === "external") return null;
  if (!taskId) return null;
  if (loading) {
    return (
      <div style={photoCardStyle}>
        <PhotoSectionLabel count={null}/>
        <div style={photoEmptyStyle}>불러오는 중...</div>
      </div>
    );
  }
  if (error) {
    return (
      <div style={photoCardStyle}>
        <PhotoSectionLabel count={null}/>
        <div style={photoEmptyStyle}>⚠️ {error}</div>
      </div>
    );
  }
  if (photos.length === 0) return null; // 사진 X = 섹션 숨김

  // step별 그룹
  const groups = {};
  photos.forEach(p => {
    const step = p.step || "기타";
    if (!groups[step]) groups[step] = [];
    groups[step].push(p);
  });
  const stepOrder = ["시작", "완료", "추가", "기타"];
  const sortedSteps = Object.keys(groups).sort((a, b) => {
    const ai = stepOrder.indexOf(a);
    const bi = stepOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div style={photoCardStyle}>
      <PhotoSectionLabel count={photos.length}/>
      {sortedSteps.map(step => (
        <div key={step} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6, fontWeight: 700 }}>
            {step === "시작" ? "🔍 작업 전" : step === "완료" ? "✨ 작업 후" : `📷 ${step}`}
            <span style={{ color: "var(--text-tertiary, var(--text-secondary))", fontWeight: 500, marginLeft: 4 }}>
              ({groups[step].length})
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
            {groups[step].map(p => (
              <button
                key={p.id}
                onClick={() => p.url && setZoomUrl(p.url)}
                style={{
                  padding: 0, border: "1px solid var(--border)", borderRadius: 6,
                  cursor: p.url ? "pointer" : "default",
                  overflow: "hidden", background: "var(--bg-secondary)",
                  aspectRatio: "1 / 1",
                }}
              >
                {p.url ? (
                  <img
                    src={p.url}
                    alt={`${step} 사진`}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    loading="lazy"
                  />
                ) : (
                  <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>URL X</div>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}

      {zoomUrl && (
        <div
          onClick={() => setZoomUrl(null)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 2000, padding: 16, cursor: "pointer",
          }}
        >
          <img
            src={zoomUrl}
            alt="확대"
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          />
        </div>
      )}
    </div>
  );
}

function PhotoSectionLabel({ count }) {
  return (
    <div style={{
      fontSize: 12, color: "var(--text-secondary)",
      marginBottom: 10, fontWeight: 700,
    }}>
      📷 작업 사진{count != null && <span style={{ color: "var(--text-tertiary, var(--text-secondary))", marginLeft: 4, fontWeight: 600 }}>({count})</span>}
    </div>
  );
}

const photoCardStyle = {
  margin: "0 20px 12px",
  padding: 16,
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 14,
};

const photoEmptyStyle = {
  fontSize: 11, color: "var(--text-secondary)",
  textAlign: "center", padding: 10,
};

// ──────────────── 6. CompletionNotice ────────────────
function CompletionNotice({ task }) {
  if (task.type === "external") return null;
  if (!["scheduled", "moving", "active"].includes(task.state)) return null;

  return (
    <div style={{ padding: D1_OUTER_PAD }}>
      <div style={D1_CARD_STYLE}>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 4 }}>
          ⏳ 프로가 작업 완료하면 자동으로 업데이트 됩니다
        </div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
          완료 후 사진과 정산 자동 표시
        </div>
      </div>
    </div>
  );
}

// ──────────────── 7. ExceptionActions (접힘) ────────────────
// 2026-05-26 D-5 — 톤 정돈 (글자/여백). 핸들러 측 catch — onVisitOnly / onCancel 측 catch.
// 2026-06-03 — 품목별(부분) 취소 측측 추가 (onPartialCancel).
function ExceptionActions({ expanded, onToggle, onVisitOnly, onCancel, onPartialCancel }) {
  return (
    <div style={{ padding: "0 20px 24px" }}>
      <div style={{
        ...D1_CARD_STYLE,
        padding: "10px 14px",
        marginBottom: expanded ? 8 : 0,
      }}>
        <button
          onClick={onToggle}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            width: "100%",
            background: "transparent", border: "none",
            cursor: "pointer", padding: 0,
            fontFamily: "inherit",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>⚙️ 예외 처리</span>
          <span style={{ fontSize: 12, color: "var(--text-tertiary, var(--text-secondary))" }}>{expanded ? "▲" : "▼"}</span>
        </button>
      </div>

      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <ExceptionButton
            label="🚗 출장비만 정산 (작업 못함)"
            onClick={onVisitOnly}
          />
          {/* 2026-06-03 — 품목별 취소 (PrincipalApp 측측 측측 / admin_partial_cancel_item RPC). */}
          {onPartialCancel && (
            <ExceptionButton
              label="◐ 품목별 취소"
              onClick={onPartialCancel}
              color="#F59E0B"
            />
          )}
          <ExceptionButton
            label="⛔ 작업 전체 취소"
            onClick={onCancel}
            color="#FF3D5A"
          />
        </div>
      )}
    </div>
  );
}

function ExceptionButton({ label, onClick, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "12px 14px",
        background: "var(--bg-elevated)",
        border: `1px solid ${color || "var(--border)"}`,
        borderRadius: 10,
        color: color || "var(--text-secondary)",
        fontSize: 12, fontWeight: 700, textAlign: "left",
        cursor: "pointer", fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}

// ──────────────── CancelDialog (간단 버전) ────────────────
function CancelDialog({ task, onClose, onConfirm }) {
  const reasons = [
    { id: "customer", emoji: "🙅", label: "고객 사정으로 취소" },
    { id: "schedule", emoji: "📅", label: "일정 조율 실패" },
    { id: "onsite",   emoji: "⚠️", label: "현장 작업 불가" },
    { id: "other",    emoji: "📝", label: "기타" },
  ];
  const [selectedId, setSelectedId] = useState("customer");
  const [memo, setMemo] = useState("");

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.7)", zIndex: 100,
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 480, maxHeight: "85vh",
        background: "var(--bg-secondary)", borderRadius: "16px 16px 0 0",
        padding: "20px 16px", overflow: "auto",
        fontFamily: "inherit",
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
          작업 취소
        </div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 16 }}>
          {task?.customer ? `${task.customer} · ` : ""}취소 사유를 선택해주세요
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {reasons.map(r => {
            const active = selectedId === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: 12,
                  background: "var(--bg-secondary)",
                  border: active ? "2px solid #FF3D5A" : "1px solid var(--border)",
                  borderRadius: 10, textAlign: "left",
                  cursor: "pointer", fontFamily: "inherit",
                  color: active ? "#FF3D5A" : "var(--text-primary)",
                  fontWeight: active ? 700 : 500,
                }}
              >
                <span style={{ fontSize: 18 }}>{r.emoji}</span>
                <span style={{ fontSize: 12 }}>{r.label}</span>
              </button>
            );
          })}
        </div>

        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="추가 메모 (선택)"
          style={{
            width: "100%", minHeight: 60, padding: 10,
            background: "var(--bg-tertiary)",
            border: "1px solid var(--border)",
            borderRadius: 8, fontSize: 12, fontFamily: "inherit",
            color: "var(--text-primary)", resize: "vertical",
            marginBottom: 14, boxSizing: "border-box",
          }}
        />

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: 12,
            background: "var(--bg-tertiary)",
            border: "1px solid var(--border)",
            borderRadius: 10, color: "var(--text-secondary)",
            fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
          }}>닫기</button>
          <button onClick={() => onConfirm(selectedId, memo)} style={{
            flex: 1, padding: 12,
            background: "#FF3D5A", border: "none",
            borderRadius: 10, color: "#fff",
            fontSize: 13, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}>취소 확정</button>
        </div>
      </div>
    </div>
  );
}

const iconBtnStyle = {
  width: 28, height: 28, borderRadius: "50%",
  background: "var(--bg-tertiary)",
  border: "none", fontSize: 14,
  cursor: "pointer", fontFamily: "inherit",
  color: "var(--text-primary)",
  display: "flex", alignItems: "center", justifyContent: "center",
};

// 2026-05-26 D-1 — 카드 골격 통일 (유솔앱 PrincipalApp.jsx:813~ TaskDetail 패턴)
//   · 측 카드 외부 wrapper: padding "0 20px" (측 catch 측 catch), marginBottom 측 catch 측 catch
//   · 측 카드 내부: var(--bg-elevated), borderRadius 14, padding 16, marginBottom 12
//   · 측 라벨: fontSize 12, fontWeight 700, color var(--text-secondary)
const D1_OUTER_PAD = "0 20px";
const D1_CARD_STYLE = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: 16,
  marginBottom: 12,
};
// eslint-disable-next-line no-unused-vars
const D1_LABEL_STYLE = {
  fontSize: 12, fontWeight: 700, color: "var(--text-secondary)",
};

export default AdminTaskDetailScreen;
