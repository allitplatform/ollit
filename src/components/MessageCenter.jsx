// 2026-07-24 — 기사↔운영자 메시지 창구 공용 컴포넌트 (Mig 188, 사장님 확정 설계).
//   설계: claude/올잇_설계확정_기사메시지창구_2026-07-24.md · 시안 v2 (아바타·안읽음 띠·날짜 구분) 승인.
//   구성:
//     · MessageThreadCard  — 스레드 목록 카드 (기사/운영자 공용, v2 디자인)
//     · MessageChatScreen  — 채팅 화면 (말풍선 + kind 칩 + 입력줄, role 공용)
//     · groupThreadsByDay  — 오늘/어제/이전 그룹 헬퍼
//   데이터: taskMessagesDb v2 (listThreadMessages / markThreadRead / engineerSendMessage / adminSendMessage)
//   ⚠️ CSS 변수(var(--bg-*, --text-*, --border, --accent)) 사용 — 기사·운영자 앱 공통 동작.

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Send, Trash2 } from "lucide-react";
import {
  listThreadMessages, markThreadRead,
  engineerSendMessage, adminSendMessage,
  MESSAGE_KINDS, MESSAGE_KIND_KO, MESSAGE_KIND_ICON,
} from "../lib/taskMessagesDb.js";

const ACCENT = "#FF1B8D";
const KIND_COLORS = {
  general:  { bg: "var(--bg-tertiary, rgba(128,128,128,0.15))", fg: "var(--text-secondary)" },
  assign:   { bg: "rgba(255,27,141,0.14)", fg: ACCENT },
  schedule: { bg: "rgba(96,165,250,0.15)", fg: "#60A5FA" },
  complete: { bg: "rgba(43,182,115,0.15)", fg: "#2BB673" },
  settle:   { bg: "rgba(139,92,246,0.15)", fg: "#8B5CF6" },
};

export function kindTagStyle(kind) {
  const c = KIND_COLORS[kind] || KIND_COLORS.general;
  return {
    fontSize: 9, fontWeight: 800, borderRadius: 4, padding: "2px 6px",
    background: c.bg, color: c.fg, whiteSpace: "nowrap", flexShrink: 0,
  };
}

// KST 기준 오늘/어제/이전 그룹
export function groupThreadsByDay(items, getAt) {
  const fmt = (d) => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
  const today = fmt(new Date());
  const yesterday = fmt(new Date(Date.now() - 86400000));
  const groups = { 오늘: [], 어제: [], 이전: [] };
  for (const it of items) {
    const at = getAt(it);
    const ymd = at ? fmt(new Date(at)) : "";
    if (ymd === today) groups.오늘.push(it);
    else if (ymd === yesterday) groups.어제.push(it);
    else groups.이전.push(it);
  }
  return groups;
}

export function timeLabel(at) {
  if (!at) return "";
  const d = new Date(at);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return "방금";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
  if (diff < 172800000) return "어제";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", month: "numeric", day: "numeric",
  }).format(d);
}

// ────────────────────────────────────────────
// 스레드 목록 카드 (v2 — 아바타 + 안읽음 띠 + 미리보기 2줄)
//   avatarLabel: "올"(운영팀) / 기사 이름 첫 글자
//   avatarTone : 'ops'(핑크) | 'eng'(파랑)
// ────────────────────────────────────────────
export function MessageThreadCard({
  avatarLabel, avatarTone = "eng",
  title, kind, taskLabel,
  preview, previewFromMe,
  at, unread = 0, onClick,
}) {
  const isUnread = unread > 0;
  const av = avatarTone === "ops"
    ? { background: "rgba(255,27,141,0.12)", color: ACCENT }
    : { background: "rgba(96,165,250,0.14)", color: "#60A5FA" };
  return (
    <button onClick={onClick} style={{
      width: "100%", display: "flex", gap: 10, alignItems: "flex-start",
      background: "var(--bg-elevated)",
      border: "1px solid var(--border)",
      borderLeft: isUnread ? `3.5px solid ${ACCENT}` : "1px solid var(--border)",
      borderRadius: 13, padding: 12, marginBottom: 7,
      cursor: "pointer", fontFamily: "inherit", textAlign: "left",
    }}>
      <span style={{
        width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 15, fontWeight: 800, ...av,
      }}>{avatarLabel}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: 14, fontWeight: 800, color: "var(--text-primary)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{title}</span>
          {taskLabel ? (
            <span style={kindTagStyle("general")}>{taskLabel}</span>
          ) : (
            kind && kind !== "general" && (
              <span style={kindTagStyle(kind)}>
                {MESSAGE_KIND_ICON[kind] || ""} {MESSAGE_KIND_KO[kind] || kind}
              </span>
            )
          )}
          <span style={{
            marginLeft: "auto", fontSize: 9.5, fontWeight: isUnread ? 800 : 600,
            color: isUnread ? ACCENT : "var(--text-tertiary, var(--text-secondary))",
            flexShrink: 0,
          }}>{timeLabel(at)}</span>
        </span>
        <span style={{
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          overflow: "hidden", marginTop: 4,
          fontSize: 12, lineHeight: 1.5,
          color: isUnread ? "var(--text-primary)" : "var(--text-secondary)",
          fontWeight: isUnread ? 600 : 400,
        }}>{previewFromMe ? "나: " : ""}{preview || "—"}</span>
      </span>
      {isUnread && (
        <span style={{
          minWidth: 20, height: 20, borderRadius: 999, background: ACCENT, color: "#fff",
          fontSize: 10, fontWeight: 800, display: "inline-flex",
          alignItems: "center", justifyContent: "center", padding: "0 6px",
          flexShrink: 0, alignSelf: "center",
        }}>{unread}</span>
      )}
    </button>
  );
}

// 날짜 구분 라벨
export function DaySectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
      color: "var(--text-tertiary, var(--text-secondary))",
      margin: "12px 4px 7px",
    }}>{children}</div>
  );
}

// ────────────────────────────────────────────
// 채팅 화면 — role: 'engineer' | 'admin'
//   thread: { engineerUserId, engineerName?, taskId?, taskNo?, customerName? }
// ────────────────────────────────────────────
export function MessageChatScreen({ role, actorId, thread, onBack, onSent, onDelete }) {
  const isAdmin = role === "admin";
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput]     = useState("");
  const [kind, setKind]       = useState("general");
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState("");
  const [askDelete, setAskDelete] = useState(false);   // 🗑 2단 확인
  const bottomRef = useRef(null);
  const engineerUserId = thread?.engineerUserId;
  const taskId = thread?.taskId || null;

  const reload = useCallback(async () => {
    if (!actorId || !engineerUserId) return;
    const res = await listThreadMessages({ actorId, engineerUserId, taskId });
    if (res.ok) {
      setItems(res.items);
      // 2026-07-24 — 사장님 발견: 읽어도 배지 안 사라짐 → 화면에 보이는 순간마다 읽음 처리.
      //   (진입 1회만 하던 방식 폐기 — 채팅 열려 있는 동안 새로 온 메시지도 즉시 읽음)
      const hasIncomingUnread = res.items.some(m =>
        (isAdmin ? m.from_engineer : !m.from_engineer) && !m.read_at
      );
      if (hasIncomingUnread) {
        markThreadRead({ actorId, engineerUserId, taskId }).catch(() => {});
      }
    }
    setLoading(false);
  }, [actorId, engineerUserId, taskId, isAdmin]);

  useEffect(() => {
    setLoading(true);
    reload();
    const iv = setInterval(reload, 15000);   // 15초 폴링 (푸시 보조)
    return () => clearInterval(iv);
  }, [reload]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items.length]);

  async function handleSend() {
    const body = input.trim();
    if (!body || busy) return;
    setBusy(true); setErr("");
    const res = isAdmin
      ? await adminSendMessage({ actorId, engineerUserId, taskId, kind, body })
      : await engineerSendMessage({ actorId, taskId, kind, body });
    if (res.ok) {
      setInput("");
      await reload();
      onSent?.();
    } else {
      setErr(res.error || "전송 실패");
    }
    setBusy(false);
  }

  const headerTitle = thread?.taskNo
    ? `${thread.taskNo} · ${thread.customerName || ""}`
    : (isAdmin ? (thread?.engineerName || "기사") : "운영팀");

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100dvh", background: "var(--bg-primary)", color: "var(--text-primary)",
    }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "14px 14px 12px", borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        <button onClick={onBack} aria-label="뒤로" style={{
          background: "transparent", border: "none", padding: 4,
          color: "var(--text-primary)", cursor: "pointer", display: "flex",
        }}><ArrowLeft size={18}/></button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 15, fontWeight: 800,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{headerTitle}</div>
          {thread?.taskNo && (
            <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 1 }}>
              {isAdmin ? (thread?.engineerName || "") : "작업 대화"}
            </div>
          )}
        </div>
        {/* 2026-07-24 — 휴지통 (사장님 spec). onDelete 있는 쪽(운영자)만 노출. */}
        {onDelete && (
          <button onClick={() => setAskDelete(true)} aria-label="대화 삭제" style={{
            background: "transparent", border: "1px solid var(--border)",
            borderRadius: 8, padding: "7px 9px",
            color: "#F87171", cursor: "pointer", display: "flex", flexShrink: 0,
          }}><Trash2 size={15}/></button>
        )}
      </div>

      {/* 삭제 2단 확인 배너 */}
      {askDelete && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 14px", flexShrink: 0,
          background: "rgba(248,113,113,0.1)", borderBottom: "1px solid rgba(248,113,113,0.4)",
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#F87171", flex: 1 }}>
            이 대화를 삭제할까요? (양쪽에서 사라짐)
          </span>
          <button onClick={() => setAskDelete(false)} style={{
            padding: "7px 12px", background: "transparent",
            border: "1px solid var(--border)", borderRadius: 8,
            fontSize: 11.5, fontWeight: 700, color: "var(--text-secondary)",
            cursor: "pointer", fontFamily: "inherit",
          }}>취소</button>
          <button onClick={() => { setAskDelete(false); onDelete(); }} style={{
            padding: "7px 12px", background: "#F87171",
            border: "none", borderRadius: 8,
            fontSize: 11.5, fontWeight: 800, color: "#fff",
            cursor: "pointer", fontFamily: "inherit",
          }}>삭제</button>
        </div>
      )}

      {/* 메시지 */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 8px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 30, fontSize: 12, color: "var(--text-secondary)" }}>
            불러오는 중...
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, fontSize: 12, color: "var(--text-secondary)" }}>
            첫 메시지를 보내보세요
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {items.map(m => {
              // from_engineer 기준: 내 말풍선 = (기사면 from_engineer) / (운영자면 !from_engineer)
              const mine = isAdmin ? !m.from_engineer : !!m.from_engineer;
              // 2026-07-24 — 보낸 사람 이름 (사장님 spec: 운영자 여러 명일 때 누가 답했는지).
              //   · 기사 화면: 운영팀 말풍선에 이름 표시
              //   · 운영자 화면: 같은 편(운영팀) 말풍선이라도 다른 운영자가 보낸 건 이름 표시
              const showName =
                (!mine && m.from_name) ||
                (mine && isAdmin && m.from_user !== actorId && m.from_name);
              return (
                <div key={m.id} style={{ display: "contents" }}>
                {showName && (
                  <span style={{
                    fontSize: 9.5, fontWeight: 700,
                    color: "var(--text-tertiary, var(--text-secondary))",
                    alignSelf: mine ? "flex-end" : "flex-start",
                    margin: mine ? "0 6px -3px 0" : "0 0 -3px 6px",
                  }}>{m.from_name}</span>
                )}
                <div style={{
                  maxWidth: "80%",
                  alignSelf: mine ? "flex-end" : "flex-start",
                  background: mine ? ACCENT : "var(--bg-elevated)",
                  color: mine ? "#fff" : "var(--text-primary)",
                  border: mine ? "none" : "1px solid var(--border)",
                  borderRadius: 13,
                  borderBottomRightRadius: mine ? 4 : 13,
                  borderBottomLeftRadius: mine ? 13 : 4,
                  padding: "9px 12px",
                  fontSize: 13, lineHeight: 1.55,
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                  {m.kind && m.kind !== "general" && (
                    <span style={{
                      display: "inline-block", fontSize: 9, fontWeight: 800,
                      opacity: 0.85, marginBottom: 3, marginRight: 4,
                    }}>{MESSAGE_KIND_ICON[m.kind]} {MESSAGE_KIND_KO[m.kind]}</span>
                  )}
                  {m.body}
                  <span style={{
                    display: "block", fontSize: 8.5, opacity: 0.65, marginTop: 4,
                    textAlign: mine ? "right" : "left",
                  }}>
                    {timeLabel(m.created_at)}{mine && m.read_at ? " · 읽음" : ""}
                  </span>
                </div>
                </div>
              );
            })}
            <div ref={bottomRef}/>
          </div>
        )}
      </div>

      {/* 종류 칩 + 입력줄 */}
      <div style={{ flexShrink: 0, padding: "8px 12px calc(12px + env(safe-area-inset-bottom))", borderTop: "1px solid var(--border)" }}>
        {err && (
          <div style={{ fontSize: 11, color: "#F87171", fontWeight: 700, marginBottom: 6 }}>⚠️ {err}</div>
        )}
        <div style={{ display: "flex", gap: 5, marginBottom: 8, flexWrap: "wrap" }}>
          {MESSAGE_KINDS.map(k => {
            const on = kind === k;
            const c = KIND_COLORS[k];
            return (
              <button key={k} onClick={() => setKind(k)} style={{
                padding: "5px 10px", borderRadius: 999,
                fontSize: 10, fontWeight: 800, fontFamily: "inherit", cursor: "pointer",
                background: on ? c.bg : "var(--bg-secondary, transparent)",
                border: `1px solid ${on ? c.fg : "var(--border)"}`,
                color: on ? c.fg : "var(--text-secondary)",
              }}>
                {MESSAGE_KIND_ICON[k]} {MESSAGE_KIND_KO[k]}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              // 2026-07-24 — 사장님 spec: 엔터 = 보내기 (Shift+엔터 = 줄바꿈)
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            enterKeyHint="send"
            rows={1}
            placeholder=""
            style={{
              flex: 1, minWidth: 0, resize: "none",
              background: "var(--bg-elevated)", border: "1px solid var(--border)",
              borderRadius: 10, padding: "11px 12px",
              fontSize: 13, color: "var(--text-primary)", fontFamily: "inherit",
              outline: "none", lineHeight: 1.4, maxHeight: 90,
            }}
          />
          <button onClick={handleSend} disabled={busy || !input.trim()} aria-label="보내기" style={{
            width: 44, flexShrink: 0,
            background: (busy || !input.trim()) ? "var(--bg-tertiary, #444)" : ACCENT,
            border: "none", borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", cursor: (busy || !input.trim()) ? "default" : "pointer",
          }}><Send size={16}/></button>
        </div>
      </div>
    </div>
  );
}
