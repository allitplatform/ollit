// Round 2 — 공유 취소 다이얼로그 (FullCancelDialog / PartialCancelDialog)
// 2026-05-25
//
// 사용처: PrincipalApp TaskDetail / AdminApp TaskDetail
// 호출자: 새 RPC 헬퍼 (cancelRpc.js) 호출 — 옛 어댑터와 섞지 말 것.

import { useState } from "react";

// ============================================================================
// 공통 — 모달 wrapper
// ============================================================================
function ModalShell({ children, onClose }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0,
      background: "rgba(0, 0, 0, 0.55)",
      zIndex: 9000,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 440,
        background: "var(--bg-elevated, #1A1A1A)",
        border: "1px solid var(--border, #2A2A2A)",
        borderRadius: 14,
        padding: 18,
        color: "var(--text-primary, #FAF8F5)",
        fontFamily: "-apple-system, 'Pretendard', sans-serif",
        maxHeight: "85vh", overflow: "auto",
      }}>
        {children}
      </div>
    </div>
  );
}

const TITLE_STYLE = { fontSize: 16, fontWeight: 800, marginBottom: 12 };
const LABEL_STYLE = { fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 6, display: "block" };
const TEXTAREA_STYLE = {
  width: "100%", minHeight: 70, padding: "10px 12px",
  background: "var(--bg-inset, #0F0F0F)",
  border: "1px solid var(--border, #2A2A2A)",
  borderRadius: 8,
  color: "var(--text-primary, #FAF8F5)",
  fontSize: 13, fontFamily: "inherit", resize: "vertical",
  boxSizing: "border-box", outline: "none",
};
const WARN_BOX_STYLE = {
  padding: "10px 12px",
  background: "rgba(239, 68, 68, 0.12)",
  border: "1px solid rgba(239, 68, 68, 0.35)",
  borderRadius: 8,
  fontSize: 12, lineHeight: 1.5,
  color: "#FCA5A5",
  marginBottom: 12,
};
const BTN_ROW_STYLE = { display: "flex", gap: 8, marginTop: 14 };
const BTN_BASE = {
  flex: 1, padding: "12px",
  borderRadius: 10, fontSize: 13, fontWeight: 700,
  fontFamily: "inherit", cursor: "pointer", border: "none",
};

// ============================================================================
// FullCancelDialog — 전체 취소 (사유 + 완료 건 경고)
// ============================================================================
export function FullCancelDialog({ task, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const wasCompleted = task?.status === "완료" || task?.status === "visit_only";
  const canSubmit = !!reason.trim() && !busy;

  async function handleConfirm() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <div style={TITLE_STYLE}>⛔ 작업 전체 취소</div>

      <div style={{ fontSize: 13, color: "#D1D5DB", marginBottom: 12, lineHeight: 1.5 }}>
        정말 취소하시겠습니까? 취소 시 작업 항목 전부가 취소 처리됩니다.
      </div>

      {wasCompleted && (
        <div style={WARN_BOX_STYLE}>
          ⚠️ 이 작업은 이미 <strong>완료</strong> 상태입니다.
          취소 시 정산이 <strong>0원</strong>으로 처리됩니다.
          <br/>(기사 수고비는 운영자가 작업상세 컨트롤에서 별도 조정.)
        </div>
      )}

      <label style={LABEL_STYLE}>사유 (필수)</label>
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="예: 고객 직접 연락 — 일정 안 맞음"
        style={TEXTAREA_STYLE}
        autoFocus
      />

      <div style={BTN_ROW_STYLE}>
        <button onClick={onClose} disabled={busy} style={{
          ...BTN_BASE,
          background: "var(--bg-secondary, #1F1F1F)",
          border: "1px solid var(--border, #2A2A2A)",
          color: "var(--text-secondary, #B5B0A8)",
          opacity: busy ? 0.5 : 1,
        }}>닫기</button>
        <button onClick={handleConfirm} disabled={!canSubmit} style={{
          ...BTN_BASE,
          background: canSubmit ? "#EF4444" : "#3A3A3A",
          color: "#fff",
          opacity: busy ? 0.7 : 1,
          cursor: canSubmit ? "pointer" : "not-allowed",
        }}>{busy ? "처리 중..." : "✓ 취소 처리"}</button>
      </div>
    </ModalShell>
  );
}

// ============================================================================
// PartialCancelDialog — 품목별 부분 취소 (체크박스 + 사유)
// ============================================================================
//   workItems: [{ id, workType, appliance, qty, unitPrice, subtotal, isCanceled }]
//   onConfirm(selectedItemIds: string[], reason: string) — 호출자가 RPC 반복 호출
export function PartialCancelDialog({ task, onClose, onConfirm }) {
  const items = Array.isArray(task?.workItems) ? task.workItems : [];
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const cancelableCount = items.filter(it => !it.isCanceled).length;
  const canSubmit = checkedIds.size > 0 && !!reason.trim() && !busy;

  function toggle(id) {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleConfirm() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await onConfirm([...checkedIds], reason.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <div style={TITLE_STYLE}>◐ 품목별 취소</div>

      <div style={{ fontSize: 13, color: "#D1D5DB", marginBottom: 12, lineHeight: 1.5 }}>
        취소할 품목을 선택하세요. 이미 취소된 품목은 회색 표시.
      </div>

      {cancelableCount === 0 ? (
        <div style={{ ...WARN_BOX_STYLE, color: "#FACC15", background: "rgba(250, 204, 21, 0.12)", borderColor: "rgba(250, 204, 21, 0.35)" }}>
          이 작업은 모든 품목이 이미 취소됐습니다.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12, maxHeight: 280, overflow: "auto" }}>
          {items.map(it => {
            const done = !!it.isCanceled;
            const checked = checkedIds.has(it.id);
            const label = [
              it.workType || it.work_type,
              it.appliance || it.appliance_type,
            ].filter(Boolean).join(" · ") || "—";
            const qty = it.qty || 1;
            const amount = Number(it.subtotal) || (Number(it.unitPrice) * qty) || 0;
            return (
              <label key={it.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px",
                background: done ? "rgba(156, 163, 175, 0.08)" : "var(--bg-inset, #0F0F0F)",
                border: `1px solid ${checked ? "#EF4444" : "var(--border, #2A2A2A)"}`,
                borderRadius: 8,
                cursor: done ? "not-allowed" : "pointer",
                opacity: done ? 0.55 : 1,
              }}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={done}
                  onChange={() => toggle(it.id)}
                  style={{ width: 16, height: 16, cursor: done ? "not-allowed" : "pointer" }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700,
                    color: done ? "#9CA3AF" : "var(--text-primary, #FAF8F5)",
                    textDecoration: done ? "line-through" : "none",
                  }}>{label} ×{qty}</div>
                  <div className="mono" style={{
                    fontSize: 11, color: "#9CA3AF", marginTop: 2,
                  }}>₩{amount.toLocaleString("ko-KR")}{done && " · 이미 취소됨"}</div>
                </div>
              </label>
            );
          })}
        </div>
      )}

      {cancelableCount > 0 && (
        <>
          <label style={LABEL_STYLE}>사유 (필수)</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="예: 고객 사유로 일부 품목 취소"
            style={TEXTAREA_STYLE}
          />
        </>
      )}

      <div style={BTN_ROW_STYLE}>
        <button onClick={onClose} disabled={busy} style={{
          ...BTN_BASE,
          background: "var(--bg-secondary, #1F1F1F)",
          border: "1px solid var(--border, #2A2A2A)",
          color: "var(--text-secondary, #B5B0A8)",
          opacity: busy ? 0.5 : 1,
        }}>닫기</button>
        <button onClick={handleConfirm} disabled={!canSubmit} style={{
          ...BTN_BASE,
          background: canSubmit ? "#EF4444" : "#3A3A3A",
          color: "#fff",
          opacity: busy ? 0.7 : 1,
          cursor: canSubmit ? "pointer" : "not-allowed",
        }}>{busy ? "처리 중..." : `✓ 선택 ${checkedIds.size}건 취소`}</button>
      </div>
    </ModalShell>
  );
}
