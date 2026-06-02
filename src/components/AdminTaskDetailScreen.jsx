// V12-3 — 운영자 작업상세 재설계
// 영역 6개 (Header / MainCard / QuickActions / EngineerCard / InfoCard / CompletionNotice)
// + ExceptionActions (접힘: 출장비 / 수동완료 / 취소)
// 메인 "완료" 버튼 X (기사가 완료 처리 → 자동 업데이트)

import { useState, useEffect, useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { Chip } from "./Chip.jsx";
import { detectServiceType } from "../data/serviceTypes.js";
import { TaskCardMenu } from "./TaskCardMenu.jsx";
import { formatTimeOnly, formatDateTimeKST } from "../utils/dateLabel.js";
import { VisitOnlyDialog } from "./VisitOnlyDialog.jsx";
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

export function AdminTaskDetailScreen({ t, task: initialTask, onBack, onCancelTask, onVisitOnly, onMemoAdd, onEdit, onHistory, onAssign, onScheduleChange, onStatusChange, onMemoUpdate, user }) {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showVisitOnlyDialog, setShowVisitOnlyDialog] = useState(false);
  const [exceptionExpanded, setExceptionExpanded] = useState(false);

  // 2026-06-02 — id 측 full re-fetch + normalize (유솔 PrincipalApp.TaskDetail 측 동일).
  //   정산 대기 측 partial payload (id/customer_name/status 등) 측 들어오면 측 정보 빈칸 catch.
  //   getTaskByIdDb 측 full row → v14NormalizeTask 측 normalize → setTask.
  //   김혜영 외 일정 누락 다수 측 측 해결.
  const [task, setTask] = useState(initialTask);
  useEffect(() => { setTask(initialTask); }, [initialTask]);
  useEffect(() => {
    if (!initialTask?.id) return;
    let alive = true;
    getTaskByIdDb(initialTask.id).then(row => {
      if (!alive || !row) return;
      const normalized = v14NormalizeTask(row);
      if (normalized) setTask(normalized);
    });
    return () => { alive = false; };
  }, [initialTask?.id]);

  if (!task) {
    return (
      <div style={{ padding: 16 }}>
        <button onClick={onBack} style={iconBtnStyle}>←</button>
        <div style={{ marginTop: 24, textAlign: "center", color: "var(--text-tertiary)" }}>
          작업 정보 없음
        </div>
      </div>
    );
  }

  // 2026-05-27 — Supabase task_memos hook (realtime 자동 갱신)
  const { memos } = useTaskMemos(task.id);
  const isExternal = task.type === "external";
  const showException = !isExternal && task.state !== "done";

  function handleMenuAction(action, taskArg) {
    if (action === "call") {
      const phone = taskArg.phone;
      if (phone) window.location.href = `tel:${phone}`;
      return;
    }
    // 2026-05-26 D-5 — 프로 연락 (옛 QuickActions contactEngineer 측 catch — ⋮ 메뉴 측 catch 측 catch)
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

  return (
    <div className="fade-in" style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
      <DetailHeader task={task} onBack={onBack} onMenuAction={handleMenuAction}/>
      {/* 카드 1 — 상태 + 작업 종류 측 catch (변경 X) */}
      <MainCard task={task} onStatusChange={onStatusChange}/>
      {/* 카드 2 — 2026-05-26 D-2: 작업 정보 통합 (연락처/주소/일정 + 배정 프로 + 측 측 측 측)
            옛 QuickActions(3 버튼) + EngineerCard 측 WorkInfoCard 측 catch 합침.
            핸들러 측 catch (onAssign/onEdit/onScheduleChange/callCustomer). */}
      <WorkInfoCard task={task} onAssign={onAssign} onScheduleChange={onScheduleChange}/>
      {/* 카드 4 — 정산 정보 (작업 금액 + 추가금 + 합계 + 회사 수익 + 기사 분배) */}
      <SettlementInfoCard task={task}/>
      {/* 2026-05-31 — Phase C Step 6 — 작업 항목별 받은 돈 표시/수정 (신규 흐름 측만 input 노출) */}
      <TaskItemsCard task={task}/>
      {task.principal === "usol_n" && (
        <UsolNSettlementCycleCard
          taskId={task.id}
          paymentMethod={task.paymentMethod || task.payment_method || null}
        />
      )}
      {/* 카드 5 — 작업 시간 · 이력 통합 */}
      <WorkTimeHistoryCard task={task}/>
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
      {showException && (
        <ExceptionActions
          expanded={exceptionExpanded}
          onToggle={() => setExceptionExpanded(!exceptionExpanded)}
          onVisitOnly={() => setShowVisitOnlyDialog(true)}
          onCancel={() => setShowCancelDialog(true)}
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
// 2026-05-26 D-2 — 작업 정보 카드 (연락처/주소/일정 + 배정 프로 + 고객 통화·일정 변경)
//   유솔앱 PrincipalApp.jsx:983~ 패턴 측 catch. 핸들러 100% 측 catch (onAssign / onEdit /
//   onScheduleChange / callCustomer 측 catch — 측 측 측 측 측 측 측 X).
function WorkInfoCard({ task, onAssign, onScheduleChange }) {
  function callCustomer() {
    if (task.phone) window.location.href = `tel:${task.phone}`;
  }
  const hasCustomerPhone = !!task.phone;
  const hasEngineer      = !!task.engineer;
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: hasEngineer ? "var(--text-primary)" : "var(--text-tertiary, var(--text-secondary))" }}>
              {hasEngineer ? task.engineer : "미배정"}
            </span>
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
function WorkTimeHistoryCard({ task }) {
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
    if (!reason && !actor && !at) return changes;
    const u = actorUid ? getUserById(actorUid) : null;
    const actorName = getCancelActorLabel({ actor, name: u?.name || null, principalCode });
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
};
const CHANGE_TYPE_LABEL = {
  schedule:   "일정 변경",
  engineer:   "기사 변경",
  items:      "항목 변경",
  extra_fee:  "추가금",
  cancel:     "작업 취소",
  visit_only: "출장비만",
  status:     "상태 변경",
};

function ChangeEntry({ entry }) {
  const icon  = CHANGE_TYPE_ICON[entry.change_type]  || "•";
  const label = CHANGE_TYPE_LABEL[entry.change_type] || entry.change_type;
  const who   = entry.changed_by_name || "—";
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
function ExceptionActions({ expanded, onToggle, onVisitOnly, onCancel }) {
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
          <ExceptionButton
            label="⛔ 작업 취소"
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
