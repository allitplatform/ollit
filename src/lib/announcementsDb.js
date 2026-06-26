// 2026-06-26 — 공지사항(announcements) 클라이언트 wrapper.
//   읽기: anon SELECT (RLS policy announcements_public_read 가 발행+미삭제만 통과).
//   쓰기: Mig 147 SECURITY DEFINER RPC 3종 (admin_publish/delete/pin_announcement).
//   푸시: admin_publish_announcement 성공 후 server-side trigger (Mig 148) 가 자동 발송.

import { supabase } from "./supabase.js";

// 목록 조회 — 활성 발행분, is_pinned DESC, published_at DESC.
//   페이지네이션 (1000행 캡 회피 — 공지는 적겠지만 습관).
//   호출처: 운영자 관리 화면 + 기사 PWA 공지 탭.
export async function listAnnouncements({ limit = 200, offset = 0 } = {}) {
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, body, created_by, created_at, published_at, is_pinned, is_popup")
    .order("is_pinned",    { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);
  if (error) {
    console.error("[announcementsDb.list]", error);
    return { ok: false, error: error.message, items: [] };
  }
  return { ok: true, items: data || [] };
}

// 발행 — admin_publish_announcement RPC (Mig 149 — 5 인자 v2).
//   응답: { ok, id, published_at, is_popup } | { ok:false, error }
//   ⚠️ p_actor 는 현재 로그인 운영자 UUID — 호출처에서 user.id 전달.
//   ⚠️ isPopup 추가 — 2단계 (앱 진입 자동 팝업). 클라/서버 시그니처 동기 필수.
export async function publishAnnouncement({ title, body, isPinned, isPopup, actorId }) {
  if (!actorId) return { ok: false, error: "actorId 누락 — 로그인 운영자 user_id 필요" };
  if (!title || !String(title).trim()) return { ok: false, error: "제목 필수" };
  const { data, error } = await supabase.rpc("admin_publish_announcement", {
    p_title:     String(title).trim(),
    p_body:      body || null,
    p_is_pinned: !!isPinned,
    p_is_popup:  !!isPopup,
    p_actor:     actorId,
  });
  if (error) {
    console.error("[announcementsDb.publish]", error);
    return { ok: false, error: error.message || "발행 실패" };
  }
  if (data && data.ok === false) {
    return { ok: false, error: data.error || "발행 실패" };
  }
  return { ok: true, id: data?.id, publishedAt: data?.published_at, isPopup: data?.is_popup };
}

// 2026-06-26 — 앱 진입 시 자동 팝업용 — 최신 is_popup 공지 1개 조회.
//   RLS 가 발행+미삭제만 통과. is_popup=true 필터 추가.
//   여러 개 있어도 1개 (is_pinned DESC → published_at DESC).
export async function getLatestPopupAnnouncement() {
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, body, created_at, published_at, is_pinned, is_popup")
    .eq("is_popup", true)
    .order("is_pinned",    { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[announcementsDb.getLatestPopup]", error);
    return { ok: false, error: error.message, item: null };
  }
  return { ok: true, item: data || null };
}

// 소프트 삭제 — admin_delete_announcement RPC.
export async function deleteAnnouncement({ id, actorId }) {
  if (!actorId) return { ok: false, error: "actorId 누락" };
  if (!id) return { ok: false, error: "id 누락" };
  const { data, error } = await supabase.rpc("admin_delete_announcement", {
    p_id:    id,
    p_actor: actorId,
  });
  if (error) {
    console.error("[announcementsDb.delete]", error);
    return { ok: false, error: error.message || "삭제 실패" };
  }
  if (data && data.ok === false) {
    return { ok: false, error: data.error || "삭제 실패" };
  }
  return { ok: true, rowsAffected: data?.rows_affected ?? 0 };
}

// 핀 토글 — admin_pin_announcement RPC.
export async function pinAnnouncement({ id, isPinned, actorId }) {
  if (!actorId) return { ok: false, error: "actorId 누락" };
  if (!id) return { ok: false, error: "id 누락" };
  const { data, error } = await supabase.rpc("admin_pin_announcement", {
    p_id:        id,
    p_is_pinned: !!isPinned,
    p_actor:     actorId,
  });
  if (error) {
    console.error("[announcementsDb.pin]", error);
    return { ok: false, error: error.message || "핀 변경 실패" };
  }
  if (data && data.ok === false) {
    return { ok: false, error: data.error || "핀 변경 실패" };
  }
  return { ok: true, rowsAffected: data?.rows_affected ?? 0 };
}
