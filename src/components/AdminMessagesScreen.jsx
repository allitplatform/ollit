// 2026-07-24 — 운영자 기사 메시지함 (신규, Mig 188 · 사장님 확정 시안 v2).
//   진입: 개요 탭 접수함 아래 "💬 기사 메시지함" 카드 (안읽음 배지).
//   구성: 필터 칩 [전체/안읽음/요청] + 스레드 목록 (기사 이름 주인공) + 채팅 (MessageChatScreen 공용).
//   요청 = kind !== 'general' 인 마지막 메시지 스레드.

import { useState, useEffect, useCallback, useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { adminListMessageThreads, adminDeleteMessageThread } from "../lib/taskMessagesDb.js";
import {
  MessageThreadCard, MessageChatScreen, DaySectionLabel, groupThreadsByDay,
} from "./MessageCenter.jsx";

const ACCENT = "#FF1B8D";

// 2026-08-05 — initialEngineer: { userId, name } 가 오면 그 기사 대화를 바로 연다
//   (프로 탭 카드 💬 버튼 — 사장님 요청). 목록 화면 거치지 않고 즉시 채팅 진입.
export function AdminMessagesScreen({ user, onBack, initialEngineer = null }) {
  const actorId = user?.user_id || user?.userId || user?.id || null;

  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [tick, setTick]       = useState(0);
  const [filter, setFilter]   = useState("all");   // all | unread | request
  const [query, setQuery]     = useState("");      // 2026-07-24 — 검색 (사장님 spec)
  const [openThread, setOpenThread] = useState(null);

  const reload = useCallback(() => setTick(v => v + 1), []);

  // 2026-08-05 — 특정 기사 대화 바로 열기 (마운트 1회 소비)
  useEffect(() => {
    if (!initialEngineer?.userId) return;
    setOpenThread({
      engineerUserId: initialEngineer.userId,
      engineerName:   initialEngineer.name || "",
      taskId: null, taskNo: null, customerName: null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!actorId) return;
    let alive = true;
    setLoading(true); setError("");
    adminListMessageThreads({ actorId }).then(res => {
      if (!alive) return;
      if (!res.ok) { setError(res.error || "목록 실패"); setItems([]); }
      else setItems(res.items);
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [actorId, tick]);

  // 2026-07-24 — 실시간 보강 (사장님 spec "실시간 안 되나?"):
  //   푸시 도착(notification:added)·화면 복귀 시 목록 즉시 갱신 + 30초 폴링 보조.
  useEffect(() => {
    const onPush = () => reload();
    const onVis = () => { if (document.visibilityState === "visible") reload(); };
    window.addEventListener("notification:added", onPush);
    document.addEventListener("visibilitychange", onVis);
    const iv = setInterval(reload, 30000);
    return () => {
      window.removeEventListener("notification:added", onPush);
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(iv);
    };
  }, [reload]);

  const totalUnread = useMemo(
    () => items.reduce((s, t) => s + (Number(t.unread_count) || 0), 0),
    [items]
  );
  const requestCount = useMemo(
    () => items.filter(t => t.last_kind && t.last_kind !== "general").length,
    [items]
  );
  const filtered = useMemo(() => {
    let arr = items;
    if (filter === "unread")  arr = arr.filter(t => (Number(t.unread_count) || 0) > 0);
    if (filter === "request") arr = arr.filter(t => t.last_kind && t.last_kind !== "general");
    // 2026-07-24 — 검색 (사장님 spec): 기사 이름 · 기사 코드 · 작업번호 · 고객명 · 마지막 내용
    const q = query.trim().toLowerCase();
    if (q) {
      arr = arr.filter(t => {
        const hay = [t.engineer_name, t.engineer_code, t.task_no, t.customer_name, t.last_body]
          .filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
    return arr;
  }, [items, filter, query]);
  const groups = useMemo(
    () => groupThreadsByDay(filtered, t => t.last_at),
    [filtered]
  );

  if (openThread) {
    return (
      <MessageChatScreen
        role="admin"
        actorId={actorId}
        thread={openThread}
        onBack={() => { setOpenThread(null); reload(); }}
        onSent={reload}
        onDelete={async () => {
          // 2026-07-24 — 휴지통 (사장님 spec): 스레드 소프트 삭제 → 목록 복귀.
          const res = await adminDeleteMessageThread({
            actorId,
            engineerUserId: openThread.engineerUserId,
            taskId: openThread.taskId || null,
          });
          if (res.ok) { setOpenThread(null); reload(); }
        }}
      />
    );
  }

  const chips = [
    { key: "all",     label: `전체 ${items.length}` },
    { key: "unread",  label: `안읽음 ${totalUnread > 0 ? totalUnread : 0}` },
    { key: "request", label: `요청 ${requestCount}` },
  ];

  const renderGroup = (label, arr) => arr.length === 0 ? null : (
    <div key={label}>
      <DaySectionLabel>{label}</DaySectionLabel>
      {arr.map(t => (
        <MessageThreadCard
          key={`${t.engineer_user}-${t.task_id || "general"}`}
          avatarLabel={(t.engineer_name || "기").slice(0, 1)}
          avatarTone="eng"
          title={t.engineer_name || t.engineer_code || "기사"}
          kind={t.last_kind}
          taskLabel={t.task_no ? `${t.task_no} ${t.customer_name || ""}`.trim() : null}
          preview={t.last_body}
          previewFromMe={!!t.last_from_me}
          at={t.last_at}
          unread={Number(t.unread_count) || 0}
          onClick={() => setOpenThread({
            engineerUserId: t.engineer_user,
            engineerName: t.engineer_name || "",
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
      paddingBottom: "calc(30px + env(safe-area-inset-bottom))",
    }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "16px 16px 12px", borderBottom: "1px solid var(--border)",
      }}>
        <button onClick={onBack} aria-label="뒤로" style={{
          background: "transparent", border: "none", padding: 4,
          color: "var(--text-primary)", cursor: "pointer", display: "flex",
        }}><ArrowLeft size={18}/></button>
        <span style={{ fontSize: 16, fontWeight: 800 }}>💬 기사 메시지함</span>
        {totalUnread > 0 && (
          <span style={{
            background: "#F87171", color: "#fff", fontSize: 10, fontWeight: 800,
            borderRadius: 999, padding: "2px 8px",
          }}>{totalUnread}</span>
        )}
      </div>

      <div style={{ padding: "12px 14px" }}>
        {/* 2026-07-24 — 검색 (사장님 spec) */}
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="🔍 기사 · 작업번호 · 고객 · 내용"
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "10px 12px", marginBottom: 10,
            background: "var(--bg-elevated)", border: "1px solid var(--border)",
            borderRadius: 9, fontSize: 12.5, color: "var(--text-primary)",
            fontFamily: "inherit", outline: "none",
          }}
        />
        {/* 필터 칩 */}
        <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
          {chips.map(c => {
            const on = filter === c.key;
            return (
              <button key={c.key} onClick={() => setFilter(c.key)} style={{
                padding: "6px 12px", borderRadius: 999,
                fontSize: 10.5, fontWeight: 800, fontFamily: "inherit", cursor: "pointer",
                background: on ? "rgba(255,27,141,0.1)" : "var(--bg-secondary, transparent)",
                border: `1px solid ${on ? ACCENT : "var(--border)"}`,
                color: on ? ACCENT : "var(--text-secondary)",
              }}>{c.label}</button>
            );
          })}
        </div>

        {loading && items.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, fontSize: 12, color: "var(--text-secondary)" }}>불러오는 중...</div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: 30, fontSize: 12, color: "var(--text-secondary)" }}>⚠️ {error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "36px 10px", fontSize: 12, color: "var(--text-secondary)" }}>
            {filter === "all" ? "아직 기사 메시지가 없어요" : "해당하는 메시지가 없어요"}
          </div>
        ) : (
          <>
            {renderGroup("오늘", groups.오늘)}
            {renderGroup("어제", groups.어제)}
            {renderGroup("이전", groups.이전)}
          </>
        )}
      </div>
    </div>
  );
}
