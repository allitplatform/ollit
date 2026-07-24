// 2026-07-24 — 기사 PWA 메시지 탭 v2 (양방향 스레드, Mig 188 · 사장님 확정 시안).
//   구 버전(2026-06-26 읽기 전용 목록) 전면 개편:
//     · 스레드 목록 (v2 디자인 — 아바타/안읽음 띠/날짜 구분/미리보기 2줄)
//     · 스레드 클릭 → 채팅 화면 (MessageChatScreen 공용 — 종류 칩 + 말풍선)
//     · "✉️ 운영팀에 보내기" → 일반 스레드(작업 무관) 채팅으로 진입
//   props 는 구버전과 동일 (engineer / onTabChange / unreadCount / onClickTask).

import { useState, useEffect, useCallback, useMemo } from "react";
import { EngineerBottomNav } from "./EngineerBottomNav.jsx";
import { listEngineerMessageThreads } from "../lib/taskMessagesDb.js";
import {
  MessageThreadCard, MessageChatScreen, DaySectionLabel, groupThreadsByDay,
} from "./MessageCenter.jsx";

const ACCENT = "#FF1B8D";

export function TaskMessagesTab({ engineer, onTabChange, unreadCount = 0, onClickTask }) {
  const userId = engineer?.user_id || engineer?.userId || null;

  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [tick, setTick]       = useState(0);
  // 열려있는 스레드 { engineerUserId, taskId, taskNo, customerName } | null
  const [openThread, setOpenThread] = useState(null);

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
    listEngineerMessageThreads({ actorId: userId }).then(res => {
      if (!alive) return;
      if (!res.ok) { setError(res.error || "목록 실패"); setItems([]); }
      else setItems(res.items);
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userId, tick]);

  const unreadMessagesCount = useMemo(
    () => items.reduce((s, t) => s + (Number(t.unread_count) || 0), 0),
    [items]
  );
  const groups = useMemo(
    () => groupThreadsByDay(items, t => t.last_at),
    [items]
  );

  // ── 채팅 화면 분기 ──
  if (openThread) {
    return (
      <MessageChatScreen
        role="engineer"
        actorId={userId}
        thread={openThread}
        onBack={() => { setOpenThread(null); reload(); }}
        onSent={reload}
      />
    );
  }

  const renderGroup = (label, arr) => arr.length === 0 ? null : (
    <div key={label}>
      <DaySectionLabel>{label}</DaySectionLabel>
      {arr.map(t => (
        <MessageThreadCard
          key={`${t.task_id || "general"}`}
          avatarLabel={t.last_from_me ? "나" : "올"}
          avatarTone={t.last_from_me ? "eng" : "ops"}
          title={t.task_no ? `${t.customer_name || ""} 고객 건` : "운영팀"}
          kind={t.last_kind}
          taskLabel={t.task_no ? `${t.task_no}` : null}
          preview={t.last_body}
          previewFromMe={t.last_from_me}
          at={t.last_at}
          unread={Number(t.unread_count) || 0}
          onClick={() => setOpenThread({
            engineerUserId: userId,
            taskId: t.task_id || null,
            taskNo: t.task_no || null,
            customerName: t.customer_name || null,
          })}
        />
      ))}
    </div>
  );

  return (
    <div style={{
      minHeight: "100dvh", background: "var(--bg-primary)", color: "var(--text-primary)",
      paddingBottom: "calc(90px + env(safe-area-inset-bottom))",
    }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "16px 16px 12px",
      }}>
        <span style={{ fontSize: 17, fontWeight: 800 }}>💬 메시지</span>
        {unreadMessagesCount > 0 && (
          <span style={{
            background: "#F87171", color: "#fff", fontSize: 10, fontWeight: 800,
            borderRadius: 999, padding: "2px 8px",
          }}>{unreadMessagesCount}</span>
        )}
      </div>

      <div style={{ padding: "0 14px" }}>
        {loading && items.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, fontSize: 12, color: "var(--text-secondary)" }}>불러오는 중...</div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: 30, fontSize: 12, color: "var(--text-secondary)" }}>⚠️ {error}</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "36px 10px", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            아직 대화가 없어요<br/>아래 버튼으로 운영팀에 먼저 보내보세요
          </div>
        ) : (
          <>
            {renderGroup("오늘", groups.오늘)}
            {renderGroup("어제", groups.어제)}
            {renderGroup("이전", groups.이전)}
          </>
        )}

        {/* 운영팀에 보내기 — 일반 스레드(작업 무관) 채팅 진입 */}
        <button
          onClick={() => setOpenThread({ engineerUserId: userId, taskId: null })}
          style={{
            width: "100%", padding: 13, marginTop: 8,
            background: ACCENT, color: "#fff", border: "none", borderRadius: 12,
            fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
          }}>
          ✉️ 운영팀에 보내기
        </button>
      </div>

      <EngineerBottomNav
        active="message"
        onChange={onTabChange}
        unreadCount={unreadCount}
        messageCount={unreadMessagesCount}
      />
    </div>
  );
}
