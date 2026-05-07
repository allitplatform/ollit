// V12-3 — 운영자 작업상세 재설계
// 영역 6개 (Header / MainCard / QuickActions / EngineerCard / InfoCard / CompletionNotice)
// + ExceptionActions (접힘: 출장비 / 수동완료 / 취소)
// 메인 "완료" 버튼 X (기사가 완료 처리 → 자동 업데이트)

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Chip } from "./Chip.jsx";
import { detectServiceType } from "../data/serviceTypes.js";
import { TaskCardMenu } from "./TaskCardMenu.jsx";
import { VisitOnlyDialog } from "./VisitOnlyDialog.jsx";
import { loadMemos } from "../data/memos.js";

// state → 알약 라벨/색
const STATE_MAP = {
  done:      { label: "완료",   color: "#00875A" },
  active:    { label: "진행중", color: "#FF1B8D" },
  moving:    { label: "이동중", color: "#FF8F00" },
  waiting:   { label: "대기",   color: "var(--text-secondary)" },
  scheduled: { label: "예정",   color: "var(--text-primary)" },
};

function getStateInfo(task) {
  if (task.type === "external") return { label: "외근", color: "#FF8F00" };
  return STATE_MAP[task.state] || { label: "—", color: "var(--text-secondary)" };
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
      <MainCard task={task} onStatusChange={onStatusChange}/>
      <QuickActions task={task} onScheduleChange={onScheduleChange}/>
      <EngineerCard task={task} onEdit={onEdit} onAssign={onAssign}/>
      <InfoCard task={task} memos={memos} onMemoAdd={onMemoAdd}/>
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

  return (
    <div style={{ padding: "16px 16px 0" }}>
      <div style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderLeft: `4px solid ${stateInfo.color}`,
        borderRadius: 12,
        padding: 14,
        position: "relative",
        marginBottom: 14,
      }}>
        {/* 우측 상단 상태 알약 */}
        <div style={{
          position: "absolute", top: 12, right: 12,
          background: stateInfo.color,
          color: "#fff",
          padding: "4px 12px", borderRadius: 20,
          fontSize: 10, fontWeight: 700,
        }}>
          {stateInfo.label}
        </div>

        {/* 작업 종류 칩 */}
        {!isExternal && (
          <Chip
            icon={serviceType.icon}
            label={serviceType.label}
            color={serviceType.color}
            size="sm"
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
          {task.state === "active" && task.startedAt && <> · 시작 {task.startedAt}</>}
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
        <ActionButton icon="💬" label="기사 연락" onClick={contactEngineer} disabled={!hasEngineer}/>
        <ActionButton icon="📅" label="일정 변경" onClick={onScheduleChange || (() => alert("일정 변경 박지 X"))}/>
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
            아직 기사 미배정
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
          >기사 배정</button>
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
          배정 기사
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
              {task.engineerLevel === "main" ? "메인" : task.engineerLevel === "sub" ? "보조" : task.engineerLevel === "backup" ? "백업" : "—"}
              {task.region ? ` · ${task.region}` : ""}
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

// ──────────────── 5. InfoCard (견적 + 메모) ────────────────
function InfoCard({ task, memos, onMemoAdd }) {
  const isExternal = task.type === "external";
  const isDone = task.state === "done";
  const sumEstimate = task.estimateTotal || 0;
  const sumTotal = isDone ? sumEstimate + (task.addonFee || 0) : sumEstimate;

  return (
    <>
      {/* 견적 */}
      {!isExternal && task.estimateTotal != null && (
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
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "inherit", color: "var(--text-primary)" }}>
                {sumTotal.toLocaleString()}
                <span style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 500 }}>원</span>
              </div>
            </div>
            {!isDone && (
              <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginTop: 4 }}>
                현장추가는 완료 시 입력
              </div>
            )}
            {isDone && task.addonFee > 0 && (
              <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 4 }}>
                견적 {sumEstimate.toLocaleString()}원 + 현장추가 {task.addonFee.toLocaleString()}원
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
          ⏳ 기사가 작업 완료하면 자동으로 업데이트 됩니다
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
