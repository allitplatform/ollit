// Step 6-2 (2-A) — PWA 푸시 구독 등록 (Vercel Serverless Function)
// POST /api/push/subscribe
// payload: { userId, engineerId, role, subscription: { endpoint, keys: { p256dh, auth } } }
// 동작: GAS doPost_savePushSubscription 호출 → 시트 푸시구독 시트 박음

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key");
  res.setHeader("Access-Control-Max-Age", "86400");
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // Step 6-2 (2-D) — DELETE 메서드 (구독 해제 / endpoints 배열)
  if (req.method === "DELETE") {
    return handleDelete(req, res);
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
  const { userId, engineerId, role } = body || {};

  // Step 6-2 hotfix — subscription 객체 분해해서 별도 파라미터로 박음
  // GAS 측은 endpoint / p256dh / auth 개별 파라미터로 catch (subscription 묶음 X)
  // null safety 명시적 박음 (optional chaining catch 안 되는 환경 대비)
  const sub = (body && body.subscription) || {};
  const endpoint = sub.endpoint || "";
  const keys     = sub.keys || {};
  const p256dh   = keys.p256dh || "";
  const auth     = keys.auth   || "";

  if (!endpoint) {
    return res.status(400).json({ ok: false, error: "subscription.endpoint 필수" });
  }
  if (!userId && !engineerId) {
    return res.status(400).json({ ok: false, error: "userId 또는 engineerId 필수" });
  }

  const gasUrl = process.env.GAS_WEBAPP_URL;
  if (!gasUrl) {
    return res.status(500).json({ ok: false, error: "GAS_WEBAPP_URL 환경변수 누락" });
  }

  try {
    const params = new URLSearchParams();
    params.append("action",     "savePushSubscription");
    params.append("userId",     String(userId || ""));
    params.append("engineerId", String(engineerId || ""));
    params.append("role",       String(role || ""));
    params.append("endpoint",   endpoint);
    params.append("p256dh",     p256dh);
    params.append("auth",       auth);
    params.append("ua",         req.headers["user-agent"] || "");
    // ⚠️ subscription 파라미터 박지 X (분해해서 보냄 / GAS 측 parse 실패 catch)

    // 디버그 로그 (Vercel Functions logs / 운영자 진단용)
    console.log("[Step 6-2 푸시] /api/push/subscribe POST →",
      "userId:", userId || "-",
      "engineerId:", engineerId || "-",
      "role:", role || "-",
      "endpoint head:", endpoint.slice(0, 60) + "...",
      "p256dh len:", p256dh.length,
      "auth len:", auth.length,
    );

    const r = await fetch(`${gasUrl}?${params.toString()}`, {
      method: "GET",
      redirect: "follow",
    });
    const text = await r.text();
    const data = safeParse(text);
    if (!data) {
      return res.status(502).json({ ok: false, error: "GAS 응답이 JSON이 아닙니다", raw: text.slice(0, 200) });
    }
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "GAS 호출 실패" });
  }
}

function safeParse(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch (e) { return null; }
}

// Step 6-2 (2-D) — DELETE 구독 해제 (GAS deletePushSubscriptions forward)
async function handleDelete(req, res) {
  const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
  const { endpoints } = body;
  if (!Array.isArray(endpoints) || endpoints.length === 0) {
    return res.status(400).json({ ok: false, error: "endpoints 배열 필수" });
  }
  const gasUrl = process.env.GAS_WEBAPP_URL;
  if (!gasUrl) {
    return res.status(500).json({ ok: false, error: "GAS_WEBAPP_URL 환경변수 누락" });
  }
  try {
    const params = new URLSearchParams();
    params.append("action",    "deletePushSubscriptions");
    params.append("endpoints", JSON.stringify(endpoints));
    const r = await fetch(`${gasUrl}?${params.toString()}`, { method: "GET", redirect: "follow" });
    const text = await r.text();
    const data = safeParse(text);
    if (!data) {
      return res.status(502).json({ ok: false, error: "GAS 응답이 JSON이 아닙니다", raw: text.slice(0, 200) });
    }
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "GAS 호출 실패" });
  }
}
