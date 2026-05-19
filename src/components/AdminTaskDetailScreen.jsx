// V12-3 — 운영자 작업상세 재설계
// 영역 6개 (Header / MainCard / QuickActions / EngineerCard / InfoCard / CompletionNotice)
// + ExceptionActions (접힘: 출장비 / 수동완료 / 취소)
// 메인 "완료" 버튼 X (기사가 완료 처리 → 자동 업데이트)

import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Chip } from "./Chip.jsx";
import { detectServiceType } from "../data/serviceTypes.js";
import { TaskCardMenu } from "./TaskCardMenu.jsx";
import { formatTimeOnly, formatDateTimeKST } from "../utils/dateLabel.js";
import { VisitOnlyDialog } from "./VisitOnlyDialog.jsx";
import { loadMemos } from "../data/memos.js";
// Phase 5 Step 0.C-1 — 유솔N 정산 사이클 카드 (조건 분기 / 다른 원청 영향 0)
import { UsolNSettlementCycleCard } from "./usol_n/UsolNSettlementCycleCard.jsx";
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

// state → 알약 라벨/색
const STATE_MAP = {
  done:      { label: "완료",   color: "#00875A" },
  active:    { label: "진행중", color: "#FF1B8D" },
  moving:    { label: "이동중", color: "#FF8F00" },
  waiting:   { label: "미배정", color: "var(--text-secondary)" },
  scheduled: { label: "예정",   color: "var(--text-primary)" },
};

// V14 Step 3.1 Fix D — V열 (scheduledAt) 유무 분기
// 옛: state 값 = '예정' / '대기'
// 신규: V열 있음 = '예정' / V열 없음 = '약속대기'
function getStateInfo(task) {
  if (task.type === "external") return { label: "외근", color: "#FF8F00" };
  // V14 — V열 (scheduledAt) 있음 = 일정 확정 / 없음 = 약속대기
  const scheduledAt = task.scheduledAt || task.confirmedAt || task.확정일시 || task.scheduledTime;
  const completedAt = task.completedAt || task.완료시간;
  const startedAt = task.startedAt || task.시작시간;
  if (completedAt) return { label: "완료", color: "#00875A" };
  if (startedAt && !completedAt) return { label: "진행중", color: "#FF1B8D" };
  if (task.state === "waiting" || task.status === "미배정" || !scheduledAt) {
    return { label: "미배정", color: "var(--text-secondary)" };
  }
  return STATE_MAP[task.state] || { label: "예정", color: "var(--text-primary)" };
}

export function AdminTaskDetailScreen({ t, task, onBack, onCancelTask, onVisitOnly, onMemoAdd, onEdit, onHistory, onAssign, onScheduleChange, onStatusChange, onMemoUpdate, user }) {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showVisitOnlyDialog, setShowVisitOnlyDialog] = useState(false);
  const [exceptionExpanded, setExceptionExpanded] = useState(false);

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

  const memos = loadMemos(task.id) || [];
  const isExternal = task.type === "external";
  const showException = !isExternal && task.state !== "done";

  function handleMenuAction(action, taskArg) {
    if (action === "call") {
      const phone = taskArg.phone;
      if (phone) window.location.href = `tel:${phone}`;
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
      {/* 카드 1 */}
      <MainCard task={task} onStatusChange={onStatusChange}/>
      {/* 카드 2 */}
      <QuickActions task={task} onScheduleChange={onScheduleChange}/>
      {/* 카드 3 */}
      <EngineerCard task={task} onEdit={onEdit} onAssign={onAssign}/>
      {/* 카드 4 — 정산 정보 (작업 금액 + 추가금 + 합계 + 회사 수익 + 기사 분배) */}
      <SettlementInfoCard task={task}/>
      {task.principal === "usol_n" && <UsolNSettlementCycleCard taskId={task.id}/>}
      {/* 카드 5 — 작업 시간 · 이력 통합 */}
      <WorkTimeHistoryCard task={task}/>
      {/* 카드 6 — 요청사항 · 메모 */}
      <RequestMemoCard task={task} memos={memos} onMemoAdd={onMemoAdd}/>
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
    <div style={{ padding: "16px 16px 0" }}>
      <div style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderLeft: `4px solid ${sideColor}`,
        borderRadius: 12,
        padding: 14,
        position: "relative",
        marginBottom: 14,
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
            <> · {task.workItems.map(w => `${w.appliance || w.workType || "—"}${w.qty ? ` ×${w.qty}` : ""}`).join(", ")}</>
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
// V14 2B-2 — 일정 변경 = onScheduleChange callback (AdminApp prompt + updateTask)
function QuickActions({ task, onScheduleChange }) {
  function callCustomer() {
    if (task.phone) window.location.href = `tel:${task.phone}`;
  }
  function contactEngineer() {
    if (task.engineerPhone) window.location.href = `tel:${task.engineerPhone}`;
  }

  const hasCustomerPhone = !!task.phone;
  const hasEngineer      = !!task.engineer;

  return (
    <div style={{ padding: "0 16px", marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <ActionButton icon="📞" label="고객 통화" onClick={callCustomer} disabled={!hasCustomerPhone}/>
        <ActionButton icon="💬" label="프로 연락" onClick={contactEngineer} disabled={!hasEngineer}/>
        <ActionButton icon="📅" label="일정 변경" onClick={onScheduleChange || (() => alert("일정 변경 기능을 준비 중입니다"))}/>
      </div>
    </div>
  );
}

function ActionButton({ icon, label, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, padding: 12,
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        cursor: disabled ? "default" : "pointer",
        textAlign: "center",
        opacity: disabled ? 0.4 : 1,
        fontFamily: "inherit",
      }}
    >
      <div style={{ fontSize: 18 }}>{icon}</div>
      <div style={{ fontSize: 9, color: "var(--text-primary)", fontWeight: 600, marginTop: 2 }}>
        {label}
      </div>
    </button>
  );
}

// ──────────────── 4. EngineerCard ────────────────
// V14 2B-1 fix — 기사 배정 = onAssign (RecommendScreen) / 기존 기사 변경 = onEdit
function EngineerCard({ task, onEdit, onAssign }) {
  if (task.type === "external") return null;

  if (!task.engineer) {
    return (
      <div style={{ padding: "0 16px", marginBottom: 8 }}>
        <div style={{
          padding: 12,
          background: "var(--bg-secondary)",
          border: "1px dashed var(--border)",
          borderRadius: 10,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            아직 프로 미배정
          </div>
          <button
            onClick={onAssign || onEdit}
            style={{
              marginTop: 8, padding: "6px 14px",
              background: "#FF1B8D",
              border: "none", borderRadius: 6,
              color: "#fff", fontSize: 11, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >프로 배정</button>
        </div>
      </div>
    );
  }

  const initial = task.engineer ? task.engineer[0] : "?";
  const isExpert = task.engineerRank === "expert" || task.engineerRank === "베테랑";

  return (
    <div style={{ padding: "0 16px", marginBottom: 8 }}>
      <div style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 12,
      }}>
        <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 6 }}>
          배정 프로
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "#FF1B8D", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, flexShrink: 0,
          }}>
            {initial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
              {task.engineer}
              {isExpert && (
                <span style={{ fontSize: 9, color: "#FF1B8D", marginLeft: 4 }}>
                  ⭐ 베테랑
                </span>
              )}
            </div>
            <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>
              {/* V14 Step 3 Fix 1 — 연락처 + 지역 박기 ('메인/보조/—' 박지 X) */}
              {task.engineerPhone ? task.engineerPhone : ""}
              {task.engineerPhone && task.region ? ` · ${task.region}` : (task.region ? task.region : "")}
            </div>
          </div>
          <button
            onClick={onAssign || onEdit}
            style={{
              padding: "4px 10px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text-secondary)",
              fontSize: 9, cursor: "pointer", fontFamily: "inherit",
            }}
          >변경</button>
        </div>
      </div>
    </div>
  );
}

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
    <div style={{ padding: "0 16px", marginBottom: 8 }}>
      <div style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 10, padding: 12,
      }}>
        <div style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 600, marginBottom: 8 }}>
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

function SettlementRow({ label, value, color, bold }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      fontSize: bold ? 12 : 11, padding: "2px 0",
    }}>
      <span style={{
        color: bold ? "var(--text-primary)" : "var(--text-secondary)",
        fontWeight: bold ? 700 : 500,
      }}>{label}</span>
      <span style={{
        color: color || "var(--text-primary)",
        fontFamily: "inherit",
        fontWeight: bold ? 700 : 600,
      }}>
        {Number(value || 0).toLocaleString()}<span style={{ fontSize: 9, color: "var(--text-secondary)", fontWeight: 500 }}> 원</span>
      </span>
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
    <div style={{ padding: "0 16px", marginBottom: 12 }}>
      <div style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 10, padding: 12,
      }}>
        <div style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 600, marginBottom: 8 }}>
          🕐 작업 시간 · 이력
        </div>

        {/* 작업 시간 (시작~완료 + 총 소요) */}
        {(startedAt || completedAt) && (
          <div style={{
            padding: 8,
            background: "var(--bg-primary)",
            borderRadius: 6, marginBottom: 8,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 2 }}>
              <span style={{ color: "var(--text-secondary)" }}>시작</span>
              <span className="mono" style={{ color: "var(--text-primary)" }}>{formatDateTimeKST(startedAt)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 2 }}>
              <span style={{ color: "var(--text-secondary)" }}>완료</span>
              <span className="mono" style={{ color: "var(--text-primary)" }}>{formatDateTimeKST(completedAt)}</span>
            </div>
            {duration && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 4, paddingTop: 4, borderTop: "1px dashed var(--border)" }}>
                <span style={{ color: "#FF1B8D", fontWeight: 700 }}>총 소요</span>
                <span style={{ color: "#FF1B8D", fontWeight: 700, fontFamily: "inherit" }}>{duration}</span>
              </div>
            )}
          </div>
        )}

        {/* 진행 5단계 (옛 TimestampHistory 영역) */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: "var(--text-secondary)", fontWeight: 600, marginBottom: 4 }}>
            진행 단계
          </div>
          <TimestampRows task={task}/>
        </div>

        {/* 변경 이력 (task_changes) */}
        <TaskChangesSection taskId={task.id}/>
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
    <div>
      {rows.map((r, i) => (
        <div key={r.label} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: 10, paddingTop: i === 0 ? 0 : 2,
        }}>
          <span style={{ color: "var(--text-secondary)" }}>{r.label}</span>
          <span className="mono" style={{ color: "var(--text-primary)" }}>
            {formatDateTimeKST(r.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// 변경 이력 (task_changes 측 fetch) — 본문 측 inline 렌더
function TaskChangesSection({ taskId }) {
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

  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--border)" }}>
      <div style={{ fontSize: 9, color: "var(--text-secondary)", fontWeight: 600, marginBottom: 4 }}>
        📜 변경 이력{changes.length > 0 && <span style={{ color: "var(--text-tertiary, var(--text-secondary))", marginLeft: 4 }}>({changes.length})</span>}
      </div>
      {loading ? (
        <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>불러오는 중...</div>
      ) : error ? (
        <div style={{ fontSize: 9, color: "#ff4444" }}>⚠️ {error}</div>
      ) : changes.length === 0 ? (
        <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>변경 이력 X (새 작업부터 누적)</div>
      ) : (
        <div>
          {changes.map(ch => (
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
  return (
    <div style={{
      padding: 6,
      background: "var(--bg-primary)",
      borderRadius: 4, marginTop: 4,
      borderLeft: "2px solid #FF1B8D",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 10 }}>{icon}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-primary)" }}>{label}</span>
          <span style={{ fontSize: 8, color: "var(--text-tertiary, var(--text-secondary))" }}>· {who}</span>
        </div>
        <span className="mono" style={{ fontSize: 8, color: "var(--text-tertiary, var(--text-secondary))" }}>
          {formatDateTimeKST(entry.changed_at)}
        </span>
      </div>
      {entry.note && (
        <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.4 }}>
          ↳ {entry.note}
        </div>
      )}
    </div>
  );
}

// ──────────────── 카드 6 — RequestMemoCard (Phase 5 Step 0.C-4) ────────────────
// 옛 InfoCard 측 요청사항 + 메모 영역 분리.
function RequestMemoCard({ task, memos, onMemoAdd }) {
  return (
    <div style={{ padding: "0 16px", marginBottom: 12 }}>
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
  );
}

// ──────────────── 5. InfoCard (견적 + 메모) ────────────────
function InfoCard({ task, memos, onMemoAdd }) {
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

// ──────────────── 5.5 TimestampHistory ────────────────
function TimestampHistory({ task }) {
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
        <div key={step} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4, fontWeight: 600 }}>
            {step === "시작" ? "🔍 작업 전" : step === "완료" ? "✨ 작업 후" : `📷 ${step}`}
            <span style={{ color: "var(--text-tertiary, var(--text-secondary))", fontWeight: 400, marginLeft: 4 }}>
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
      fontSize: 10, color: "var(--text-secondary)",
      marginBottom: 8, fontWeight: 600,
    }}>
      📷 작업 사진{count != null && <span style={{ color: "var(--text-tertiary, var(--text-secondary))", marginLeft: 4 }}>({count})</span>}
    </div>
  );
}

const photoCardStyle = {
  margin: "0 16px 12px",
  padding: 12,
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 10,
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
    <div style={{ padding: "0 16px", marginBottom: 12 }}>
      <div style={{
        background: "var(--bg-tertiary)",
        border: "1px solid var(--border)",
        borderRadius: 10, padding: "10px 12px",
      }}>
        <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginBottom: 4 }}>
          ⏳ 프로가 작업 완료하면 자동으로 업데이트 됩니다
        </div>
        <div style={{ fontSize: 9, color: "var(--text-secondary)" }}>
          완료 후 사진과 정산 자동 표시
        </div>
      </div>
    </div>
  );
}

// ──────────────── 7. ExceptionActions (접힘) ────────────────
function ExceptionActions({ expanded, onToggle, onVisitOnly, onCancel }) {
  return (
    <div style={{ padding: "0 16px 24px" }}>
      <div style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 10, padding: "8px 12px",
        marginBottom: 4,
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
          <span style={{ fontSize: 11, color: "var(--text-primary)" }}>⚙️ 예외 처리</span>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{expanded ? "▲" : "▼"}</span>
        </button>
      </div>

      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 0" }}>
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
        padding: 10,
        background: "var(--bg-secondary)",
        border: `1px solid ${color || "var(--border)"}`,
        borderRadius: 8,
        color: color || "var(--text-secondary)",
        fontSize: 10, textAlign: "left",
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

export default AdminTaskDetailScreen;
