// Step 8+9 V7 — 출장비만 정산 다이얼로그
// 30,000원 고정 / 기사 100% / 사유 4개 + 메모
import { useState } from "react";
import { VISIT_FEE, VISIT_REASONS } from "../data/visitFee.js";

export function VisitOnlyDialog({ task, onConfirm, onClose }) {
  const [reason, setReason] = useState("wrong_type");
  const [memo, setMemo] = useState("");

  function handleConfirm() {
    const reasonObj = VISIT_REASONS.find(r => r.id === reason);
    onConfirm && onConfirm({
      taskId: task?.id,
      status: "visit_only",
      visitFee: VISIT_FEE.amount,
      engineerEarning: VISIT_FEE.engineerAmount,
      companyMargin: VISIT_FEE.companyAmount,
      principalFee: 0,
      reasonId: reason,
      reasonLabel: reasonObj?.label,
      memo,
      completedAt: new Date().toISOString(),
    });
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.7)", zIndex: 100,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480, maxHeight: "85vh",
          background: "var(--bg-primary)", borderRadius: "16px 16px 0 0",
          padding: "20px 16px", overflow: "auto",
          fontFamily: "-apple-system, 'Pretendard', sans-serif",
          color: "var(--text-primary)",
        }}
      >
        {/* 아이콘 박스 */}
        <div style={{
          textAlign: "center", marginBottom: 16,
          padding: "16px",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 12,
        }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>🚗</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>현장 작업 못함</div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
            방문은 했지만 작업을 못 한 경우
          </div>
        </div>

        {/* 출장비 박스 */}
        <div style={{
          background: "#FF1B8D",
          borderRadius: 14, padding: "14px 16px",
          textAlign: "center", marginBottom: 16,
          color: "#fff",
        }}>
          <div style={{ fontSize: 11, color: "#fff", opacity: 0.95, marginBottom: 4 }}>
            출장비 (고정)
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#fff", fontFamily: "inherit" }}>
            ₩{VISIT_FEE.amount.toLocaleString()}
          </div>
          <div style={{ fontSize: 9, color: "#fff", opacity: 0.85, marginTop: 4 }}>
            {VISIT_FEE.engineerShare >= 100
              ? "전액 프로 수고비 (회사 0 / 원청 0)"
              : `프로 ₩${VISIT_FEE.engineerAmount.toLocaleString()} (${VISIT_FEE.engineerShare}%) · 회사 ₩${VISIT_FEE.companyAmount.toLocaleString()}`}
          </div>
        </div>

        {/* 사유 선택 */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 500 }}>
            사유 선택
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {VISIT_REASONS.map(r => {
              const active = reason === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => setReason(r.id)}
                  style={{
                    padding: "10px 12px",
                    background: "var(--bg-secondary)",
                    border: active ? "2px solid var(--status-warning)" : "1px solid var(--border)",
                    borderRadius: 8, cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 14 }}>{r.emoji}</span>
                    <span style={{
                      fontSize: 13,
                      color: active ? "var(--status-warning)" : "var(--text-primary)",
                      fontWeight: active ? 600 : 500,
                    }}>{r.label}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-secondary)", paddingLeft: 22 }}>
                    {r.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 메모 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6, fontWeight: 500 }}>
            상세 메모 (선택)
          </div>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="예: 현장 가보니 천장형이 아닌 4way"
            rows={2}
            style={{
              width: "100%", background: "var(--bg-secondary)",
              border: "1px solid var(--border)", borderRadius: 8,
              padding: "10px 12px", color: "var(--text-primary)",
              fontSize: 12, fontFamily: "inherit",
              outline: "none", boxSizing: "border-box", resize: "vertical",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, background: "var(--bg-secondary)", border: "1px solid var(--border)",
            color: "var(--text-secondary)", fontSize: 14, fontWeight: 500,
            padding: 12, borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
          }}>닫기</button>
          <button onClick={handleConfirm} style={{
            flex: 2, background: "var(--status-warning)", border: "none",
            color: "#fff", fontSize: 14, fontWeight: 600,
            padding: 12, borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
          }}>출장비만 확정</button>
        </div>
      </div>
    </div>
  );
}

export default VisitOnlyDialog;
