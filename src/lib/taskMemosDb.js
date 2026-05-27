// task_memos DB 어댑터 — 2026-05-27 Phase 2 (memos.js localStorage 대체).
// 운영자 / 기사 / 원청 양방향 공유.
//
// DB 의존 (사장님 DDL 실행 완료):
//   task_memos(id, task_id FK tasks, tenant_id, memo_type, body, author_id, author_name, author_role, created_at)
//   RLS: anon SELECT/INSERT 허용. UPDATE/DELETE 정책 없음 (= 차단). audit 무결성.
//
// 사용:
//   import { saveMemoAsync, useTaskMemos, MEMO_TYPES, getMemoTypeLabel } from "../lib/taskMemosDb.js";
//   const { memos, loading } = useTaskMemos(task.id);
//   await saveMemoAsync({ taskId, memoType, body, user });

import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase.js";
import { useRealtimeTable } from "../hooks/useRealtimeSubscription.js";

// Phase 1 MVP — 단일 tenant 고정 (CLAUDE.md spec).
const TENANT_ID = "11111111-1111-1111-1111-111111111111";

// ─── 상수 (옛 memos.js 에서 이주) ─────────────────────────────────────────────
export const MEMO_TYPES = [
  { id: "general", emoji: "📝", label: "일반 메모" },
  { id: "call",    emoji: "📞", label: "통화 내용" },
  { id: "issue",   emoji: "⚠️", label: "이슈/특이사항" },
];

export function getMemoTypeLabel(id) {
  const t = MEMO_TYPES.find(x => x.id === id);
  return t ? `${t.emoji} ${t.label}` : "📝 메모";
}

// 역할 이모지 (작성자 표시용)
export function getAuthorRoleEmoji(role) {
  if (role === "engineer")              return "🔧";
  if (role === "partner")               return "🏢";
  if (role === "owner" || role === "admin" || role === "operator") return "🛠";
  return "👤";
}

// ─── 작성자 정보 추출 — localStorage "allit.user" 형태 ─────────────────────────
//   user 객체 키: { user_id, role, name?, displayName?, username?, ... }
function extractAuthor(user) {
  if (!user || typeof user !== "object") return { id: null, name: "", role: "" };
  const id   = user.user_id || user.id || null;
  const name = user.name || user.displayName || user.username || "";
  const role = user.role || "";
  return { id, name, role };
}

// ─── INSERT — 메모 1건 저장 ────────────────────────────────────────────────────
// 응답: { ok: true, memo } | { ok: false, error }
export async function saveMemoAsync({ taskId, memoType = "general", body = "", user }) {
  if (!taskId) return { ok: false, error: "taskId 누락" };
  const text = String(body || "").trim();
  if (!text) return { ok: false, error: "메모 본문 비어있음" };
  if (!MEMO_TYPES.some(m => m.id === memoType)) {
    return { ok: false, error: `memoType 불가: ${memoType}` };
  }
  const { id: authorId, name: authorName, role: authorRole } = extractAuthor(user);

  const { data, error } = await supabase
    .from("task_memos")
    .insert({
      task_id:     taskId,
      tenant_id:   TENANT_ID,
      memo_type:   memoType,
      body:        text,
      author_id:   authorId,
      author_name: authorName,
      author_role: authorRole,
    })
    .select()
    .single();

  if (error) {
    console.error("[taskMemosDb.save]", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, memo: data };
}

// ─── React hook — useTaskMemos ────────────────────────────────────────────────
// 응답: { memos, loading, error, reload }
//   memos = 행 배열 (created_at DESC).
//   realtime=true(기본): task_memos INSERT (task_id 필터) 감지 시 자동 reload.
//     realtime publication 미적용 시 reload 수동 호출 fallback.
export function useTaskMemos(taskId, { realtime = true } = {}) {
  const [memos, setMemos]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const reload = useCallback(async () => {
    if (!taskId) {
      setMemos([]);
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase
      .from("task_memos")
      .select("id, task_id, memo_type, body, author_id, author_name, author_role, created_at")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });
    if (err) {
      console.error("[taskMemosDb.fetch]", err);
      setError(err.message);
      setMemos([]);
    } else {
      setMemos(data || []);
    }
    setLoading(false);
  }, [taskId]);

  useEffect(() => { reload(); }, [reload]);

  // realtime 구독 — useRealtimeTable 은 tableName null 이면 early return (안전).
  //   조건부 hook 호출 X — useRealtimeTable 은 무조건 호출, 내부에서 분기.
  useRealtimeTable(
    realtime && taskId ? "task_memos" : null,
    () => reload(),
    realtime && taskId ? `task_id=eq.${taskId}` : null,
  );

  return { memos, loading, error, reload };
}
