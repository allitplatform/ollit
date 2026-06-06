// 2026-06-06 — 사용자별 알림 종류 on/off (Mig 101 user_notification_preferences)
//
// 6 kind:
//   newOrder        — 새 접수
//   assignment      — 배정
//   scheduleChange  — 일정 변경
//   taskComplete    — 작업 완료
//   partialEtc      — 부분완료/출장비/취소
//   settleComplete  — 정산 완료
//
// 약속: row 없음 = 켜짐 (default ON). false 명시 저장만 발송 측에서 의미 있음.

import { supabase } from "./supabase.js";

export const NOTI_KINDS = [
  "newOrder",
  "assignment",
  "scheduleChange",
  "taskComplete",
  "partialEtc",
  "settleComplete",
];

// 본인 prefs 전체 조회 → { newOrder: true, assignment: false, ... }
// row 없는 kind 는 true (default ON).
export async function fetchNotiPrefs(userId) {
  if (!userId) return { ok: false, error: "userId 필요", prefs: {} };
  const { data, error } = await supabase
    .from("user_notification_preferences")
    .select("kind, enabled")
    .eq("user_id", userId);
  if (error) {
    console.error("[notiPrefsDb.fetch]", error);
    return { ok: false, error: error.message, prefs: {} };
  }
  // 기본 ON, row 가 있는 kind 만 그 값으로 덮어쓰기
  const prefs = {};
  for (const k of NOTI_KINDS) prefs[k] = true;
  for (const r of (data || [])) {
    if (NOTI_KINDS.includes(r.kind)) prefs[r.kind] = !!r.enabled;
  }
  return { ok: true, prefs };
}

// 한 kind on/off UPSERT
export async function setNotiPref({ userId, kind, enabled, actorId }) {
  if (!userId || !kind || !actorId) {
    return { ok: false, error: "userId/kind/actorId 필요" };
  }
  if (!NOTI_KINDS.includes(kind)) {
    return { ok: false, error: `kind 미지원: ${kind}` };
  }
  const { data, error } = await supabase.rpc("set_notification_pref", {
    p_user_id: userId,
    p_kind:    kind,
    p_enabled: !!enabled,
    p_actor:   actorId,
  });
  if (error) {
    console.error("[notiPrefsDb.set]", error);
    return { ok: false, error: error.message };
  }
  if (data && data.ok === false) {
    return { ok: false, error: data.error || "RPC 실패" };
  }
  return { ok: true, kind, enabled: !!enabled };
}
