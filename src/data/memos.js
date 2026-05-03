// Step 8+9 V8 — 작업 메모 (localStorage)
// 카드 [⋯] 메뉴 → "메모 추가" → MemoAddScreen
// Phase 2 — Supabase task_memos 테이블로 옮길 때 동일 인터페이스 사용

const KEY = "ollit_task_memos_v1";

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(map) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // ignore quota
  }
}

// taskId → [{id, type, content, createdAt, author}]
export function loadMemos(taskId) {
  if (!taskId) return [];
  const all = readAll();
  return all[taskId] || [];
}

export function saveMemo({ taskId, type = "general", content = "", author = "" }) {
  if (!taskId || !content.trim()) return null;
  const all = readAll();
  const list = all[taskId] || [];
  const memo = {
    id: `memo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    content: content.trim(),
    author,
    createdAt: new Date().toISOString(),
  };
  all[taskId] = [memo, ...list];
  writeAll(all);
  return memo;
}

export function deleteMemo(taskId, memoId) {
  if (!taskId || !memoId) return;
  const all = readAll();
  const list = all[taskId] || [];
  all[taskId] = list.filter(m => m.id !== memoId);
  writeAll(all);
}

export const MEMO_TYPES = [
  { id: "general", emoji: "📝", label: "일반 메모" },
  { id: "call",    emoji: "📞", label: "통화 내용" },
  { id: "issue",   emoji: "⚠️", label: "이슈/특이사항" },
];

export function getMemoTypeLabel(id) {
  const t = MEMO_TYPES.find(x => x.id === id);
  return t ? `${t.emoji} ${t.label}` : "📝 메모";
}
