// Step 6-2 (2-A) — PWA 푸시 구독 등록 (Vercel Serverless Function)
// POST   /api/push/subscribe       — UPSERT (endpoint UNIQUE)
// DELETE /api/push/subscribe       — endpoints 배열 DELETE
//
// 2026-05-29 — GAS 시트 → Supabase push_subscriptions 전환.
//   옛: doPost_savePushSubscription / deletePushSubscriptions GAS 시트 호출
//   새: Supabase push_subscriptions 테이블 (service_role 키 사용, RLS 우회)
//
// 환경변수:
//   VITE_SUPABASE_URL           — Supabase 프로젝트 URL
//   SUPABASE_SERVICE_ROLE_KEY   — service_role 키 (서버 전용, 클라이언트 노출 금지)
//
// payload (POST):
//   { userId?, engineerId?, role, subscription: { endpoint, keys: { p256dh, auth } } }
//   user_id 해석 우선순위:
//     1) userId (uuid 형식 검증 후 그대로)
//     2) engineerId (users.code lookup → uuid)
//
// payload (DELETE):
//   { endpoints: [endpoint1, endpoint2, ...] }

import { createClient } from "@supabase/supabase-js";

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 모듈 레벨 1회 생성 (Vercel cold start 비용 절감)
const supabase = (SUPABASE_URL && SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function safeParse(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch (e) { return null; }
}

// engineerId (code) → users.id (uuid) 변환
async function resolveUserUuid({ userId, engineerId }) {
  // 1) userId 가 uuid 형식이면 그대로 사용
  if (userId && UUID_RE.test(String(userId))) {
    return { uuid: String(userId), source: "userId" };
  }
  // 2) engineerId (code) → users.code lookup
  if (engineerId) {
    const { data, error } = await supabase
      .from("users")
      .select("id")
      .eq("code", String(engineerId))
      .maybeSingle();
    if (error) {
      console.error("[push/subscribe:userLookup]", error);
      return { uuid: null, error: error.message };
    }
    if (data && data.id) {
      return { uuid: data.id, source: "engineerId_lookup" };
    }
    return { uuid: null, error: `users.code 매칭 실패 (engineerId=${engineerId})` };
  }
  return { uuid: null, error: "userId / engineerId 둘 다 없음" };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!supabase) {
    return res.status(500).json({
      ok: false,
      error: "VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수 누락",
    });
  }

  if (req.method === "DELETE") {
    return handleDelete(req, res);
  }
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
  const { userId, engineerId, role } = body || {};
  const sub = (body && body.subscription) || {};
  const endpoint = sub.endpoint || "";
  const keys = sub.keys || {};
  const p256dh = keys.p256dh || "";
  const auth = keys.auth || "";

  if (!endpoint) {
    return res.status(400).json({ ok: false, error: "subscription.endpoint 필수" });
  }
  if (!userId && !engineerId) {
    return res.status(400).json({ ok: false, error: "userId 또는 engineerId 필수" });
  }

  // user_id 해석
  const { uuid: userUuid, source, error: resolveErr } = await resolveUserUuid({ userId, engineerId });
  if (!userUuid) {
    console.warn("[push/subscribe] user_id 해석 실패", { userId, engineerId, resolveErr });
    return res.status(400).json({
      ok: false,
      error: resolveErr || "user_id 매핑 실패",
    });
  }

  // 디버그 로그 — Vercel Functions logs
  console.log("[push/subscribe] UPSERT →",
    "user_uuid:", userUuid.slice(0, 8) + "...",
    "via:", source,
    "engineerId:", engineerId || "-",
    "role:", role || "-",
    "endpoint head:", endpoint.slice(0, 60) + "...",
    "p256dh len:", p256dh.length,
    "auth len:", auth.length,
  );

  // push_subscriptions UPSERT (endpoint UNIQUE)
  //   기존 endpoint row 있으면 user_id / p256dh / auth / role / ua / last_used_at 갱신.
  //   created_at 은 INSERT 시 DB default, UPDATE 시 무변경.
  const row = {
    user_id:      userUuid,
    endpoint,
    p256dh,
    auth,
    role:         role || "",
    ua:           req.headers["user-agent"] || "",
    last_used_at: new Date().toISOString(),
  };

  const { data: upserted, error: upErr } = await supabase
    .from("push_subscriptions")
    .upsert(row, { onConflict: "endpoint" })
    .select("id")
    .maybeSingle();

  if (upErr) {
    console.error("[push/subscribe:upsert]", upErr);
    return res.status(500).json({
      ok: false,
      error: upErr.message || "push_subscriptions UPSERT 실패",
    });
  }

  return res.status(200).json({
    ok: true,
    action: "upsert",
    id: upserted?.id || null,
  });
}

async function handleDelete(req, res) {
  const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
  const { endpoints } = body || {};
  if (!Array.isArray(endpoints) || endpoints.length === 0) {
    return res.status(400).json({ ok: false, error: "endpoints 배열 필수" });
  }

  const cleaned = endpoints.map(e => String(e)).filter(Boolean);
  if (cleaned.length === 0) {
    return res.status(400).json({ ok: false, error: "유효한 endpoint 없음" });
  }

  const { error: delErr, count } = await supabase
    .from("push_subscriptions")
    .delete({ count: "exact" })
    .in("endpoint", cleaned);

  if (delErr) {
    console.error("[push/subscribe:delete]", delErr);
    return res.status(500).json({
      ok: false,
      error: delErr.message || "push_subscriptions DELETE 실패",
    });
  }

  console.log("[push/subscribe] DELETE →", "deleted:", count, "endpoints:", cleaned.length);
  return res.status(200).json({ ok: true, deleted: count || 0 });
}
