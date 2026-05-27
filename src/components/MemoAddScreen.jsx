// Step 8+9 V8 — 메모 추가 화면
// 카드 [⋯] → "메모 추가" → 이 화면
// 타입 라디오 (일반/통화/이슈) + textarea + [저장]
// 2026-05-27 Phase 2 — localStorage memos.js → Supabase task_memos (saveMemoAsync)
import { useState } from "react";
import { saveMemoAsync, MEMO_TYPES } from "../lib/taskMemosDb.js";

export function MemoAddScreen({ task, user, onBack, onSaved }) {
  const [type, setType] = useState("general");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  async function handleSave() {
    const trimmed = content.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError("");
    const res = await saveMemoAsync({
      taskId:   task?.id,
      memoType: type,
      body:     trimmed,
      user,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error || "저장 실패");
      return;
    }
    onSaved?.(res.memo);
    onBack?.();
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
      fontFamily: "-apple-system, 'Pretendard', sans-serif",
    }}>
      {/* 헤더 */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "var(--bg-primary)",
        borderBottom: "1px solid var(--border)",
        padding: "12px 16px",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <button onClick={onBack} style={{
          background: "transparent", border: "none",
          color: "var(--text-primary)", fontSize: 20,
          cursor: "pointer", padding: 4, fontFamily: "inherit",
        }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>메모 추가</div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
            {task?.customer || "—"} · {task?.region || "—"}
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {/* 타입 선택 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 500 }}>
            메모 타입
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {MEMO_TYPES.map(m => {
              const active = type === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => setType(m.id)}
                  style={{
                    padding: "10px 12px",
                    background: active ? "var(--accent-soft)" : "var(--bg-secondary)",
                    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                    borderRadius: 8, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 8,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{m.emoji}</span>
                  <span style={{
                    fontSize: 13,
                    color: active ? "var(--accent)" : "var(--text-primary)",
                    fontWeight: active ? 600 : 500,
                  }}>{m.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 내용 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6, fontWeight: 500 }}>
            메모 내용
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="메모를 입력하세요..."
            rows={6}
            autoFocus
            style={{
              width: "100%",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "10px 12px",
              color: "var(--text-primary)",
              fontSize: 13,
              fontFamily: "inherit",
              outline: "none",
              boxSizing: "border-box",
              resize: "vertical",
              minHeight: 120,
            }}
          />
        </div>

        {error && (
          <div style={{
            marginBottom: 12, padding: "8px 12px",
            background: "rgba(239,68,68,0.10)",
            border: "1px solid #EF4444", borderRadius: 8,
            color: "#EF4444", fontSize: 12, fontWeight: 600,
          }}>⚠️ {error}</div>
        )}

        {/* 버튼 */}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onBack} disabled={saving} style={{
            flex: 1,
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            fontSize: 14, fontWeight: 500,
            padding: 12, borderRadius: 10,
            cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit",
            opacity: saving ? 0.6 : 1,
          }}>취소</button>
          <button
            onClick={handleSave}
            disabled={!content.trim() || saving}
            style={{
              flex: 2,
              background: content.trim() && !saving ? "var(--accent)" : "var(--bg-secondary)",
              border: "none",
              color: content.trim() && !saving ? "#fff" : "var(--text-tertiary)",
              fontSize: 14, fontWeight: 600,
              padding: 12, borderRadius: 10,
              cursor: content.trim() && !saving ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              opacity: content.trim() && !saving ? 1 : 0.6,
            }}
          >{saving ? "저장 중..." : "저장"}</button>
        </div>
      </div>
    </div>
  );
}

export default MemoAddScreen;
