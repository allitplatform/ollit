// Step 6-2 (2-A) — PWA 푸시 테스트 (Vercel Serverless Function)
// POST /api/push/test
// 보안: X-API-Key 헤더 (PUSH_API_KEY 환경변수와 일치)
// payload: { subscription: { endpoint, keys: { p256dh, auth } }, title?, body? }
// 동작: 단일 구독에 직접 푸시 (시트 거치지 않음 / 사장님 cURL 또는 Postman 검증용)
//
// 사용 예시:
//   curl -X POST https://ollit.vercel.app/api/push/test \
//     -H "Content-Type: application/json" \
//     -H "X-API-Key: <PUSH_API_KEY>" \
//     -d '{ "subscription": { "endpoint": "...", "keys": { "p256dh": "...", "auth": "..." } } }'

import webpush from "web-push";

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const VAPID_PUBLIC   = process.env.VITE_VAPID_PUBLIC;
const VAPID_PRIVATE  = process.env.VAPID_PRIVATE;
const VAPID_SUBJECT  = process.env.VAPID_SUBJECT || "mailto:admin@allday-care.com";

let vapidConfigured = false;
function configureVapid() {
  if (vapidConfigured) return true;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false;
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    vapidConfigured = true;
    return true;
  } catch (e) {
    return false;
  }
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function safeParse(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch (e) { return null; }
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const apiKey = req.headers["x-api-key"] || req.headers["X-API-Key"];
  if (!process.env.PUSH_API_KEY) {
    return res.status(500).json({ ok: false, error: "PUSH_API_KEY 환경변수 누락" });
  }
  if (apiKey !== process.env.PUSH_API_KEY) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  if (!configureVapid()) {
    return res.status(500).json({ ok: false, error: "VAPID 환경변수 누락" });
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
  const { subscription, title, body: msgBody, url, tag } = body;

  if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return res.status(400).json({ ok: false, error: "subscription.endpoint + keys.p256dh + keys.auth 필수" });
  }

  const payload = JSON.stringify({
    title: title || "올잇 테스트 알림",
    body:  msgBody || "푸시 알림이 정상 작동합니다",
    url:   url || "/",
    tag:   tag || "ollit-test",
    icon:  "/icon-192.png",
    badge: "/icon-192.png",
  });

  try {
    await webpush.sendNotification(subscription, payload);
    return res.status(200).json({ ok: true, message: "푸시 발송 완료" });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "발송 실패",
      statusCode: e?.statusCode,
    });
  }
}
