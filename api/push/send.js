// Step 6-2 (2-A) — PWA 푸시 알림 전송 (Vercel Serverless Function)
// POST /api/push/send
// 보안: X-API-Key 헤더 (PUSH_API_KEY 환경변수와 일치)
// payload: { targetType, targetId, title, body, url, tag, icon, badge, requireInteraction }
//   - targetType: 'engineer' | 'user' | 'role'
//   - targetId  : 'E022' | 'A001' | 'engineer' / 'admin' / 'happycall' / ...
// 동작:
//   1) GAS getPushSubscriptions → 대상 구독 리스트
//   2) web-push 라이브러리로 각 구독에 발송
//   3) 만료(404/410) 구독은 GAS deletePushSubscriptions로 정리
//
// 환경변수 필수: VITE_VAPID_PUBLIC / VAPID_PRIVATE / VAPID_SUBJECT / GAS_WEBAPP_URL / PUSH_API_KEY

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

  // API key 검증 (GAS / 운영자 트리거에서만 호출 가능)
  const apiKey = req.headers["x-api-key"] || req.headers["X-API-Key"];
  if (!process.env.PUSH_API_KEY) {
    return res.status(500).json({ ok: false, error: "PUSH_API_KEY 환경변수 누락" });
  }
  if (apiKey !== process.env.PUSH_API_KEY) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  if (!configureVapid()) {
    return res.status(500).json({ ok: false, error: "VAPID 환경변수 누락 (VITE_VAPID_PUBLIC / VAPID_PRIVATE)" });
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
  // 2026-05-22 P1 — taskId destructure 추가 (SW saveToIndexedDB dedup 정상화).
  // trigger(015b) 측 payload에 'taskId' 들어있으나 이전엔 여기서 빠뜨려 SW data.taskId=null.
  // → 같은 title + 5초 이내 알림이 인앱 dedup 으로 묶임. 연쇄 알림 첫 1건만 보임.
  const { targetType, targetId, title, body: msgBody, url, tag, icon, badge, requireInteraction, taskId } = body;

  if (!targetType || !title) {
    return res.status(400).json({ ok: false, error: "targetType + title 필수" });
  }

  const gasUrl = process.env.GAS_WEBAPP_URL;
  if (!gasUrl) {
    return res.status(500).json({ ok: false, error: "GAS_WEBAPP_URL 환경변수 누락" });
  }

  // 1) GAS에서 대상 구독 리스트 가져오기
  let subs = [];
  try {
    const params = new URLSearchParams();
    params.append("action",     "getPushSubscriptions");
    params.append("targetType", String(targetType));
    params.append("targetId",   String(targetId || ""));

    const r = await fetch(`${gasUrl}?${params.toString()}`, { method: "GET", redirect: "follow" });
    const text = await r.text();
    const data = safeParse(text);
    if (!data || !data.ok) {
      return res.status(502).json({ ok: false, error: data?.error || "GAS 구독 리스트 조회 실패", raw: text.slice(0, 200) });
    }
    subs = Array.isArray(data.subscriptions) ? data.subscriptions : [];
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "GAS 호출 실패" });
  }

  // 2026-05-28 — endpoint 기준 dedup (GAS 시트의 같은 endpoint 다중 row 방어).
  //   getPushSubscriptions 가 시트 row 그대로 반환 → 같은 폰에서 알림 OFF/ON 반복 또는
  //   옛 잘못된 row(E022 버그 잔재) + 신규 정상 row 누적 시 한 endpoint 다중 sub 발생.
  //   send.js 단에서 1 endpoint = 1 발송 보장. 시트 정리 안 해도 즉시 중복 차단.
  //   endpoint 없는 row 는 발송 불가라 같이 제외.
  subs = Array.from(
    new Map(
      subs
        .filter(s => s && s.endpoint)
        .map(s => [s.endpoint, s])
    ).values()
  );

  if (subs.length === 0) {
    return res.status(200).json({ ok: true, sent: 0, failed: 0, expired: 0, note: "대상 구독 없음" });
  }

  // 2) web-push로 각 구독에 발송
  // 2026-05-22 P1 — taskId forward (SW data.taskId 로 들어가 dedup 식별자 역할).
  const payload = JSON.stringify({
    title,
    body: msgBody || "",
    url:  url || "/",
    tag:  tag || "ollit-noti",
    icon: icon  || "/icon-192.png",
    badge: badge || "/icon-192.png",
    requireInteraction: !!requireInteraction,
    taskId: taskId || null,
  });

 const results = await Promise.allSettled(subs.map(s => {
    // GAS 응답은 이미 { endpoint, keys: {p256dh, auth} } 표준 형식 박힘
    // 옛 평면 형식도 호환 박는 fallback
    const subscription = s.keys ? s : {
      endpoint: s.endpoint,
      keys: { p256dh: s.p256dh, auth: s.auth },
    };
    return webpush.sendNotification(subscription, payload).catch(err => {

      // 만료된 구독은 expired 마킹
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        return { __expired: true, endpoint: s.endpoint };
      }
      throw err;
    });
  }));

  let sent = 0, failed = 0;
  const expiredEndpoints = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      if (r.value && r.value.__expired) expiredEndpoints.push(r.value.endpoint);
      else sent++;
    } else {
      failed++;
      console.error("[push send error]", r.reason?.message, r.reason?.statusCode, r.reason?.body);
    }
  }

  // 3) 만료 구독 정리 (best-effort)
  if (expiredEndpoints.length > 0) {
    try {
      const params = new URLSearchParams();
      params.append("action", "deletePushSubscriptions");
      params.append("endpoints", JSON.stringify(expiredEndpoints));
      await fetch(`${gasUrl}?${params.toString()}`, { method: "GET", redirect: "follow" });
    } catch (e) { /* 정리 실패는 무시 */ }
  }

  return res.status(200).json({
    ok: true,
    sent,
    failed,
    expired: expiredEndpoints.length,
    total: subs.length,
  });
}
