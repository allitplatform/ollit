// V13-FINAL2 — 기사 PWA 하단 네비
// 2026-06-26 v2 — 6탭 — "공지" 탭 제거 → "메시지" 탭 신설 (작업별 운영자 메시지).
//   공지는 내정보 메뉴 안으로 이동. 메시지가 더 자주 + 즉시성 높음 → 빈도순 배치.
//   공지 팝업(앱 진입 자동 모달)은 탭과 무관하게 그대로 작동.
// 2026-07-24 — 💬 배지 자체 로드 (사장님 spec: "메시지 오면 탭에 1 뜨나?" → 안 뜨던 것 수리).
//   messageCount prop 은 아무도 안 넘기고 있었음 (탭 6곳이 각자 네비 렌더 — prop 관통 비용 큼).
//   → 네비가 스스로 안읽음 스레드 합계를 조회 (localStorage 로그인 user 사용).
//   탭 전환 시 네비 remount → 즉시 갱신 + 60초 폴링. 기사 역할 아닐 땐 0 (RPC 가 빈 목록).

import { useEffect, useState } from "react";
import { listEngineerMessageThreads } from "../lib/taskMessagesDb.js";

const TABS = [
  { id: "today",    label: "오늘",     icon: "🏠" },
  { id: "settle",   label: "정산",     icon: "💰" },
  { id: "cal",      label: "캘린더",   icon: "📅" },
  { id: "noti",     label: "알림",     icon: "🔔" },
  { id: "message",  label: "메시지",   icon: "💬" },
  { id: "me",       label: "내 정보",  icon: "👤" },
];

// messageCount = 메시지 탭 뱃지 (안 읽은 task_messages 개수). prop 이 오면 그 값 우선.
export function EngineerBottomNav({ active, onChange, unreadCount = 0, messageCount = 0 }) {
  const [autoMsgCount, setAutoMsgCount] = useState(0);
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const u = JSON.parse(localStorage.getItem("allit.user") || "null");
        const actor = u?.user_id || u?.userId || u?.id;
        if (!actor) return;
        const res = await listEngineerMessageThreads({ actorId: actor });
        if (!alive || !res?.ok) return;
        const sum = (res.items || []).reduce((s, t2) => s + (Number(t2.unread_count) || 0), 0);
        setAutoMsgCount(sum);
      } catch (_e) { /* 배지 실패는 조용히 */ }
    }
    load();
    const id = setInterval(load, 60000);
    return () => { alive = false; clearInterval(id); };
  }, [active]);   // 탭 전환 시 즉시 재조회 (읽고 나오면 바로 배지 소멸)
  const effectiveMsgCount = messageCount > 0 ? messageCount : autoMsgCount;
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      maxWidth: 420, margin: "0 auto",
      background: "var(--bg-primary)",
      borderTop: "1px solid var(--border)",
      display: "flex", justifyContent: "space-around",
      padding: "8px 4px 16px",
      zIndex: 100,
    }}>
      {TABS.map(tab => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange && onChange(tab.id)}
            style={{
              flex: 1, padding: "6px 4px",
              background: "transparent", border: "none",
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", flexDirection: "column",
              alignItems: "center", gap: 2,
              color: isActive ? "#FF1B8D" : "var(--text-secondary)",
              position: "relative",
            }}
          >
            <div style={{ position: "relative", fontSize: 18 }}>
              {tab.icon}
              {tab.id === "noti" && unreadCount > 0 && (
                <div style={{
                  position: "absolute", top: -4, right: -8,
                  minWidth: 14, height: 14, borderRadius: 7,
                  background: "#FF1B8D",
                  fontSize: 8, fontWeight: 700, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "0 4px",
                }}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </div>
              )}
              {tab.id === "message" && effectiveMsgCount > 0 && (
                <div style={{
                  position: "absolute", top: -4, right: -8,
                  minWidth: 14, height: 14, borderRadius: 7,
                  background: "#FF1B8D",
                  fontSize: 8, fontWeight: 700, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "0 4px",
                }}>
                  {effectiveMsgCount > 99 ? "99+" : effectiveMsgCount}
                </div>
              )}
            </div>
            <span style={{
              fontSize: 10,
              fontWeight: isActive ? 700 : 500,
            }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default EngineerBottomNav;
