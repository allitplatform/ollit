// 2026-06-26 — 운영자 → 기사 작업 메시지 작성 모달 (옵션 c).
//   진입: AdminTaskDetailScreen WorkInfoCard 의 📨 버튼.
//   동작:
//     · 빠른 템플릿 4개 → 누르면 입력창 채움 (편집 가능)
//     · 자유 텍스트 입력 → 전송 → admin_send_task_message RPC
//     · RPC 가 서버 저장 + pg_net 푸시 자동 (Mig 150)
//     · 토스트 "전송됨"

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { sendTaskMessage } from "../../lib/taskMessagesDb.js";

const ACCENT = "#FF1B8D";

const TEMPLATES = [
  "주소 확인 부탁드립니다.",
  "고객 부재중입니다.",
  "일정 변경 가능한가요?",
  "기타",
];

export function SendTaskMessageModal({ t, task, actorId, onClose, onSent }) {
  const [body, setBody]         = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState("");

  const toUserId = task?.assignedEngineerId || task?.engineerId || null;
  const engineerName = task?.engineer || task?.assignedEngineer || "(미배정)";
  const taskNo  = task?.taskNo  || task?.task_no  || "";
  const customer = task?.customer || task?.customerName || task?.customer_name || "";

  useEffect(() => {
    function handler(e) {
      if (e.key === "Escape" && !submitting) onClose?.();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, submitting]);

  function handleTemplate(text) {
    // "기타" 는 빈 상태로 — 자유 입력 유도.
    if (text === "기타") {
      setBody("");
      return;
    }
    setBody(text);
  }

  async function handleSubmit() {
    if (!body.trim())     { setError("메시지를 입력하세요"); return; }
    if (!actorId)         { setError("로그인 운영자 확인 실패"); return; }
    if (!toUserId)        { setError("기사 미배정 — 먼저 배정 필요"); return; }
    if (!task?.id)        { setError("작업 정보 확인 실패"); return; }
    setSubmitting(true);
    setError("");
    const res = await sendTaskMessage({
      taskId:   task.id,
      toUserId,
      body:     body.trim(),
      actorId,
    });
    setSubmitting(false);
    if (!res.ok) { setError(res.error || "전송 실패"); return; }
    onSent?.();
  }

  return (
    <div
      onClick={() => !submitting && onClose()}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1100, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true"
        style={{
          background: t.bg, color: t.text,
          border: `1px solid ${t.border}`, borderRadius: 14,
          width: "min(520px, 100%)",
          maxHeight: "min(85vh, 700px)",
          display: "flex", flexDirection: "column",
          fontFamily: "'Pretendard', sans-serif",
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* 헤더 */}
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          padding: "16px 20px",
          borderBottom: `1px solid ${t.border}`,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>
              📨 메시지 전송
            </div>
            <div style={{
              fontSize: 11, color: t.textSecondary, fontWeight: 600,
              marginTop: 3,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {taskNo ? `${taskNo} · ` : ""}{customer || "—"} · → {engineerName}
            </div>
          </div>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            disabled={submitting}
            aria-label="닫기"
            style={{
              background: "transparent", border: "none", padding: 6,
              cursor: submitting ? "default" : "pointer", color: t.text,
              display: "flex", alignItems: "center",
              flexShrink: 0,
            }}
          ><X size={20}/></button>
        </div>

        {/* 본문 */}
        <div style={{
          flex: 1, overflowY: "auto",
          padding: "16px 20px",
          display: "flex", flexDirection: "column", gap: 12,
        }}>
          <div>
            <div style={{
              fontSize: 11, fontWeight: 700, color: t.textSecondary,
              marginBottom: 8,
            }}>빠른 템플릿</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {TEMPLATES.map(tmpl => (
                <button
                  key={tmpl}
                  type="button"
                  onClick={() => handleTemplate(tmpl)}
                  style={{
                    padding: "6px 11px",
                    background: t.bgElevated,
                    border: `1px solid ${t.border}`,
                    borderRadius: 999,
                    color: t.textSecondary,
                    fontSize: 11, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >{tmpl}</button>
              ))}
            </div>
          </div>

          <div>
            <div style={{
              fontSize: 11, fontWeight: 700, color: t.textSecondary,
              marginBottom: 6,
            }}>메시지 <span style={{ color: ACCENT }}>*</span></div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              maxLength={500}
              autoFocus
              placeholder="기사에게 보낼 메시지"
              style={{
                width: "100%",
                padding: "10px 12px",
                background: t.bgElevated,
                border: `1px solid ${t.border}`,
                borderRadius: 8,
                color: t.text,
                fontSize: 13, fontWeight: 500,
                fontFamily: "inherit",
                boxSizing: "border-box",
                outline: "none",
                resize: "vertical",
                minHeight: 100,
                lineHeight: 1.5,
              }}
            />
            <div style={{
              fontSize: 10, color: t.textMuted, fontWeight: 600,
              textAlign: "right", marginTop: 4,
            }}>{body.length} / 500</div>
          </div>

          {error && (
            <div style={{
              padding: "10px 12px",
              background: "rgba(255,27,141,0.1)",
              border: `1px solid ${ACCENT}`,
              borderRadius: 8,
              color: ACCENT,
              fontSize: 12, fontWeight: 700,
            }}>⚠️ {error}</div>
          )}
        </div>

        {/* 푸터 */}
        <div style={{
          display: "flex", gap: 8,
          padding: "12px 20px",
          borderTop: `1px solid ${t.border}`,
        }}>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            disabled={submitting}
            style={{
              flex: 1, padding: "12px 0",
              background: t.bgSecondary || t.bgElevated,
              border: `1px solid ${t.border}`,
              borderRadius: 10,
              color: t.textSecondary,
              fontSize: 13, fontWeight: 700,
              cursor: submitting ? "default" : "pointer",
              fontFamily: "inherit",
            }}
          >취소</button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !body.trim() || !toUserId}
            style={{
              flex: 2, padding: "12px 0",
              background: (submitting || !body.trim() || !toUserId) ? t.border : ACCENT,
              border: "none",
              borderRadius: 10,
              color: "#fff",
              fontSize: 14, fontWeight: 800,
              cursor: (submitting || !body.trim() || !toUserId) ? "default" : "pointer",
              fontFamily: "inherit",
            }}
          >{submitting ? "전송 중..." : "📨 전송 (푸시 + 서버 저장)"}</button>
        </div>
      </div>
    </div>
  );
}

export default SendTaskMessageModal;
