// 2026-06-28 — 접수함(inquiries) 통계 RPC wrapper (Mig 151).
//   2 RPC:
//     · get_inquiry_daily_counts(p_actor, p_start_ymd, p_end_ymd)
//         → [{ ymd, total, spam }, ...]  (zero-fill 포함)
//     · get_inquiry_funnel(p_actor, p_start_ymd, p_end_ymd)
//         → { totals: {...}, funnel: {...} }
//   ⚠️ p_actor = 로그인 운영자 UUID (하드코딩 X — 호출처에서 user.user_id 전달).
//   ⚠️ KST 변환은 RPC 안에서 (Asia/Seoul 명시) — 클라는 ymd 문자열만 전달.

import { supabase } from "./supabase.js";

// ymd 헬퍼 — N일 전 KST 날짜 문자열 ("YYYY-MM-DD").
//   클라 toLocaleDateString 은 timezone 옵션으로 KST 강제 (UTC 슬라이스 금지).
export function ymdKstNDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}
export function ymdKstToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

// 일별 카운트 — 카드 일별 막대 차트용.
//   응답: { ok, items: [{ ymd: "YYYY-MM-DD", total, spam }, ...] }
export async function getInquiryDailyCounts({ actorId, startYmd, endYmd }) {
  if (!actorId)  return { ok: false, error: "actorId 누락", items: [] };
  if (!startYmd) return { ok: false, error: "startYmd 누락", items: [] };
  if (!endYmd)   return { ok: false, error: "endYmd 누락",   items: [] };
  const { data, error } = await supabase.rpc("get_inquiry_daily_counts", {
    p_actor:     actorId,
    p_start_ymd: startYmd,
    p_end_ymd:   endYmd,
  });
  if (error) {
    console.error("[inquiryStatsDb.daily]", error);
    return { ok: false, error: error.message, items: [] };
  }
  // RPC RETURNS TABLE → 배열. ymd 가 date 타입이라 ISO 문자열 또는 Date 객체로 옴.
  const items = (Array.isArray(data) ? data : []).map(r => ({
    ymd:   typeof r.ymd === "string" ? r.ymd.slice(0, 10) : String(r.ymd || "").slice(0, 10),
    total: Number(r.total || 0),
    spam:  Number(r.spam  || 0),
  }));
  return { ok: true, items };
}

// 카드 + 퍼널 — 통계 헤더 메인.
//   응답: { ok, totals: {...}, funnel: {...} }
//     totals: { today, this_month, all_time_excl_spam, all_time_completed, conversion_rate_pct }
//     funnel: { new, contacted, converted, completed_in, spam, total_excl_spam }
export async function getInquiryFunnel({ actorId, startYmd, endYmd }) {
  if (!actorId)  return { ok: false, error: "actorId 누락" };
  if (!startYmd) return { ok: false, error: "startYmd 누락" };
  if (!endYmd)   return { ok: false, error: "endYmd 누락"   };
  const { data, error } = await supabase.rpc("get_inquiry_funnel", {
    p_actor:     actorId,
    p_start_ymd: startYmd,
    p_end_ymd:   endYmd,
  });
  if (error) {
    console.error("[inquiryStatsDb.funnel]", error);
    return { ok: false, error: error.message };
  }
  return {
    ok: true,
    totals: data?.totals || {},
    funnel: data?.funnel || {},
  };
}
