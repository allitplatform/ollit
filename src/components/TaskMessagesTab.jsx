// 2026-06-26 — 기사 PWA 메시지 탭 (💬). 옵션 c 서버 저장 메시지 목록.
//   진입: EngineerApp screen === "messages" (BottomNav 💬 메시지 탭).
//   동작:
//     · list_engineer_task_messages RPC (자기 to_user 행만)
//     · 카드: [작업번호 고객명] · 본문 · 작성일 (toKstYmd)
//     · 카드 클릭 → mark_engineer_task_message_read 호출 + 모달 표시
//     · 안 읽은 메시지 시각 표시 (NEW 배지)

import { useState, useEffect, useCallback } from "react";
import { EngineerBottomNav } from "./EngineerBottomNav.jsx";
import { listEngineerTaskMessages, markTaskMessageRead } from "../lib/taskMessagesDb.js";
import { toKstYmd } from "../utils/dateLabel.js";
import { X } from "lucide-react";

const ACCENT = "#FF1B8D";

export function TaskMessagesTab({ engineer, onTabChange, unreadCount = 0, onClickTask }) {
  const userId = engineer?.user_id || engineer?.userId || null;

  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [tick, setTick]       = useState(0);
  const [selected, setSelected] = useState(null);

  const reload = useCallback(() => setTick(v => v + 1), []);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      setError("기사 식별 실패 (재로그인 필요)");
      return;
    }
    let alive = true;
    setLoading(true);
    setError("");
    listEngineerTaskMessages({ userId, limit: 100 }).then(res => {
      if (!alive) return;
      if (!res.ok) {
        setError(res.error || "목록 실패");
        setItems([]);
      } else {
        setItems(res.items);
      }
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userId, tick]);

  async function handleOpen(msg) {
    setSelected(msg);
    if (!msg.read_at && userId) {
      // 비동기 read 마킹 (실패해도 UX 영향 X)
      markTaskMessageRead({ id: msg.id, userId }).then(() => reload());
    }
  }

  function handleClose() {
    setSelected(null);
  }

  function handleGotoTask() {
    if (!selected) return;
    setSelected(null);
    if (onClickTask && selected.task_id) onClickTask(selected.task_id);
  }

  const unreadMessagesCount = items.filter(m => !m.read_at).length;

  return (
    <div style={containerStyle}>
      <Header unread={unreadMessagesCount}/>
      <div style={bodyStyle}>
        {loading ? (
          <Empty>불러오는 중...</Empty>
        ) : error ? (
          <Empty>⚠️ {error}</Empty>
        ) : items.length === 0 ? (
          <Empty>받은 메시지가 없습니다</Empty>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map(msg => (
              <MessageCard
                key={msg.id}
                msg={msg}
                onClick={() => handleOpen(msg)}
              />
            ))}
          </div>
        )}
      </div>
      <EngineerBottomNav
        active="message"
        onChange={onTabChange}
        unreadCount={unreadCount}
        messageCount={unreadMessagesCount}
      />

      {selected && (
        <MessageDetailModal
          msg={selected}
          onClose={handleClose}
          onGotoTask={selected.task_id && onClickTask ? handleGotoTask : null}
        />
      )}
    </div>
  );
}

function MessageCard({ msg, onClick }) {
  const dateLabel = toKstYmd(msg.created_at) || "—";
  const isUnread = !msg.read_at;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "var(--bg-elevated)",
        border: `1px solid ${isUnread ? ACCENT : "var(--border)"}`,
        borderRadius: 10,
        padding: "12px 14px",
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "inherit",
        color: "var(--text-primary)",
      }}
    >
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        marginBottom: 6,
      }}>
        {isUnread && (
          <span style={{
            fontSize: 9, fontWeight: 800,
            padding: "2px 6px", borderRadius: 4,
            background: ACCENT, color: "#fff",
            letterSpacing: 0.3,
          }}>NEW</span>
        )}
        <span style={{
          flex: 1, minWidth: 0,
          fontSize: 12, fontWeight: 700,
          color: "var(--text-secondary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {msg.task_no || "—"}{msg.customer_name ? ` · ${msg.customer_name}` : ""}
        </span>
      </div>
      <div style={{
        fontSize: 13, color: "var(--text-primary)", fontWeight: 500,
        lineHeight: 1.5, marginBottom: 6,
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}>{msg.body}</div>
      <div style={{
        fontSize: 10, color: "var(--text-tertiary, var(--text-secondary))",
        fontWeight: 600,
      }}>{dateLabel}</div>
    </button>
  );
}

function MessageDetailModal({ msg, onClose, onGotoTask }) {
  useEffect(() => {
    function handler(e) { if (e.key === "Escape") onClose?.(); }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const dateLabel = toKstYmd(msg.created_at) || "—";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1100, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true"
        style={{
          background: "var(--bg-primary)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          width: "min(520px, 100%)",
          maxHeight: "min(85vh, 700px)",
          display: "flex", flexDirection: "column",
          fontFamily: "'Pretendard', sans-serif",
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 10, color: "var(--text-secondary)",
              fontWeight: 600, marginBottom: 4,
            }}>📨 운영자 메시지</div>
            <div style={{
              fontSize: 14, fontWeight: 800, color: "var(--text-primary)",
              wordBreak: "break-word",
            }}>
              {msg.task_no || "—"}{msg.customer_name ? ` · ${msg.customer_name}` : ""}
            </div>
            <div style={{
              fontSize: 11, color: "var(--text-secondary)",
              fontWeight: 600, marginTop: 4,
            }}>{dateLabel}</div>
          </div>
          <button
            type="button" onClick={onClose} aria-label="닫기"
            style={{
              background: "transparent", border: "none", padding: 6,
              cursor: "pointer", color: "var(--text-primary)",
              display: "flex", alignItems: "center",
              flexShrink: 0,
            }}
          ><X size={20}/></button>
        </div>

        <div style={{
          flex: 1, overflowY: "auto",
          padding: "18px 20px",
        }}>
          <div style={{
            fontSize: 14, lineHeight: 1.65, color: "var(--text-primary)",
            fontWeight: 500, whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}>{msg.body}</div>
        </div>

        <div style={{
          display: "flex", gap: 8,
          padding: "12px 20px",
          borderTop: "1px solid var(--border)",
        }}>
          {onGotoTask && (
            <button
              type="button" onClick={onGotoTask}
              style={{
                flex: 1, padding: "12px 0",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                color: "var(--text-secondary)",
                fontSize: 13, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >작업 보기 ›</button>
          )}
          <button
            type="button" onClick={onClose}
            style={{
              flex: onGotoTask ? 1 : 2, padding: "12px 0",
              background: ACCENT,
              border: "none", borderRadius: 10,
              color: "#fff",
              fontSize: 14, fontWeight: 800,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >확인</button>
        </div>
      </div>
    </div>
  );
}

function Header({ unread }) {
  return (
    <div style={{
      padding: "14px 16px",
      background: ACCENT,
      color: "#fff",
      flexShrink: 0,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: 10, color: "rgba(255,255,255,0.85)",
          marginBottom: 3, fontWeight: 500,
        }}>운영자 → 작업별 메시지</div>
        <div style={{
          fontSize: 18, fontWeight: 700, letterSpacing: "-0.3px",
        }}>📨 메시지</div>
      </div>
      {unread > 0 && (
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>안 읽음</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{unread}건</div>
        </div>
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

const containerStyle = {
  minHeight: "100vh",
  background: "var(--bg-primary)",
  color: "var(--text-primary)",
  fontFamily: "-apple-system, 'Pretendard', sans-serif",
  display: "flex", flexDirection: "column",
  paddingBottom: 80,
  overflowX: "hidden",
};

const bodyStyle = {
  flex: 1,
  overflowY: "auto",
  overflowX: "hidden",
  padding: 16,
  background: "var(--bg-secondary)",
};

export default TaskMessagesTab;
