// Step 6-2 (2-A) — PWA 푸시 알림 전송 (Vercel Serverless Function)
// POST /api/push/send
// 보안: X-API-Key 헤더 (PUSH_API_KEY 환경변수와 일치)
// payload: { targetType, targetId, title, body, url, tag, icon, badge, requireInteraction }
//   - targetType: 'engineer' | 'user' | 'role'
//   - targetId  : 'E022' | 'A001' | 'engineer' / 'admin' / 'happycall' / ...
// 동작:
//   1) Supabase push_subscriptions 조회 → 대상 구독 리스트
//   2) web-push 라이브러리로 각 구독에 발송 (VAPID / payload 무변경)
//   3) 만료(404/410) 구독은 push_subscriptions DELETE 로 정리
//
// 2026-05-29 — GAS getPushSubscriptions / deletePushSubscriptions → Supabase 전환.
//   조회: push_subscriptions ps JOIN users u ON u.id = ps.user_id
//         · engineer / user targetType + code (E0xx 등) → u.code 매칭
//         · engineer / user targetType + uuid          → ps.user_id 매칭
//         · role targetType                            → user_roles.role IN 매칭
//   발송: web-push 그대로 (VAPID / payload / dedup 동일)
//   정리: push_subscriptions DELETE WHERE endpoint IN (expired)
//
// 환경변수 필수:
//   VITE_VAPID_PUBLIC / VAPID_PRIVATE / VAPID_SUBJECT
//   VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
//   PUSH_API_KEY

import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const VAPID_PUBLIC   = process.env.VITE_VAPID_PUBLIC;
const VAPID_PRIVATE  = process.env.VAPID_PRIVATE;
const VAPID_SUBJECT  = process.env.VAPID_SUBJECT || "mailto:admin@allday-care.com";

const SUPABASE_URL     = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 모듈 레벨 1회 생성 (Vercel cold start 비용 절감)
const supabase = (SUPABASE_URL && SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

// 2026-06-06 — push title → kind 매핑 (Mig 101 user_notification_preferences 게이트용).
//   트리거 SQL 미수정 — title 패턴 기반 추론. payload 측 'kind' 명시 측 우선.
// 2026-06-07 — 4 kind 추가 (작업 시작/기사 수락/취소 요청/냉매 수락 마감).
//   원래 매핑 안 됐던 title 들 — 토글로 끌 수 있게 함. 매핑 안 되면 null → 게이트 통과 (현행 유지).
function inferKindFromTitle(title) {
  if (!title) return null;
  const t = String(title);
  if (t.includes("새 접수") || t.includes("신규 냉매"))                      return "newOrder";
  if (t.includes("작업 배정") || t.includes("재배정") || t.includes("냉매 작업 배정")) return "assignment";
  if (t.includes("일정 확정") || t.includes("일정 변경"))                    return "scheduleChange";
  if (t.includes("작업 완료") || t.includes("완료되었습니다"))               return "taskComplete";
  if (t.includes("작업 취소"))                                              return "partialEtc";
  if (t.includes("입금"))                                                    return "settleComplete";
  // 2026-06-07 신규 4종 — 트리거 title 그대로 매칭
  if (t.includes("작업 시작"))                                              return "taskStart";
  if (t.includes("기사 수락"))                                              return "engineerAccept";
  if (t.includes("취소 요청"))                                              return "cancelRequest";
  if (t.includes("냉매 수락 마감"))                                         return "refrigClosed";
  return null;
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

  if (!supabase) {
    return res.status(500).json({
      ok: false,
      error: "VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수 누락",
    });
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
  // 2026-05-22 P1 — taskId destructure 추가 (SW saveToIndexedDB dedup 정상화).
  // trigger(015b) 측 payload에 'taskId' 들어있으나 이전엔 여기서 빠뜨려 SW data.taskId=null.
  // → 같은 title + 5초 이내 알림이 인앱 dedup 으로 묶임. 연쇄 알림 첫 1건만 보임.
  // 2026-06-06 — kind 추가 (Mig 101 user_notification_preferences 게이트). payload 측 명시 측 사용,
  //   미지정 측 inferKindFromTitle 측 fallback. 트리거 SQL 수정 없이 동작.
  const { targetType, targetId, title, body: msgBody, url, tag, icon, badge, requireInteraction, taskId, kind: kindParam } = body;

  if (!targetType || !title) {
    return res.status(400).json({ ok: false, error: "targetType + title 필수" });
  }
  const kind = kindParam || inferKindFromTitle(title);

  // 1) Supabase push_subscriptions 조회 — targetType 분기
  //    engineer / user + targetId 가 code (E0xx 등) → users.code 매칭
  //    engineer / user + targetId 가 uuid          → push_subscriptions.user_id 매칭
  //    role + targetId ('engineer'/'admin'/'operator' 등) → user_roles.role 매칭 → user_id IN
  let subs = [];
  try {
    let targetUserIds = null;

    if (targetType === "role" && targetId) {
      // 2026-07-24 — 복수 role 지원 ('admin,operator,owner') + user 중복 제거.
      //   기사 메시지 푸시가 role 별 3회 호출로 나가 같은 사람이 2~3번 받던 문제 fix
      //   (한 계정이 여러 역할 보유 시). 단일 role 호출은 기존과 동일 동작.
      const roles = String(targetId).split(",").map(s => s.trim()).filter(Boolean);
      const { data: roleRows, error: roleErr } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", roles);
      if (roleErr) {
        console.error("[push send:role lookup]", roleErr);
        return res.status(500).json({ ok: false, error: roleErr.message || "user_roles 조회 실패" });
      }
      targetUserIds = [...new Set((roleRows || []).map(r => r.user_id).filter(Boolean))];
      if (targetUserIds.length === 0) {
        return res.status(200).json({ ok: true, sent: 0, failed: 0, expired: 0, total: 0, note: "role 매칭 user 없음" });
      }
    } else if ((targetType === "engineer" || targetType === "user") && targetId) {
      // code (E0xx 등) → users.id (uuid) lookup
      if (UUID_RE.test(String(targetId))) {
        targetUserIds = [String(targetId)];
      } else {
        const { data: userRow, error: uErr } = await supabase
          .from("users")
          .select("id")
          .eq("code", String(targetId))
          .maybeSingle();
        if (uErr) {
          console.error("[push send:user code lookup]", uErr);
          return res.status(500).json({ ok: false, error: uErr.message || "users.code 조회 실패" });
        }
        if (!userRow || !userRow.id) {
          return res.status(200).json({ ok: true, sent: 0, failed: 0, expired: 0, total: 0, note: `users.code=${targetId} 매칭 없음` });
        }
        targetUserIds = [userRow.id];
      }
    } else {
      return res.status(400).json({ ok: false, error: "targetType + targetId 조합 불완전" });
    }

    // 2026-06-06 — Mig 101 kind 게이트. targetUserIds 측 enabled=false 인 user 제외.
    //   row 없음 = 켜짐 (default ON). false 행만 명시적으로 차단.
    //   kind 매핑 측 없으면 (inferKindFromTitle = null) 게이트 측 — 현행 유지.
    if (kind && targetUserIds.length > 0) {
      const { data: prefRows, error: prefErr } = await supabase
        .from("user_notification_preferences")
        .select("user_id, enabled")
        .in("user_id", targetUserIds)
        .eq("kind", kind);
      if (prefErr) {
        console.warn("[push send:pref lookup]", prefErr.message);
        // pref 조회 실패 측 차단 안 함 — 안전 측 발송 측 (default ON 약속).
      } else {
        const disabledIds = new Set(
          (prefRows || []).filter(r => r.enabled === false).map(r => r.user_id)
        );
        if (disabledIds.size > 0) {
          const before = targetUserIds.length;
          targetUserIds = targetUserIds.filter(uid => !disabledIds.has(uid));
          console.log(`[push send] kind=${kind} pref gate: ${before} → ${targetUserIds.length} (skipped ${disabledIds.size})`);
        }
      }
      if (targetUserIds.length === 0) {
        return res.status(200).json({ ok: true, sent: 0, failed: 0, expired: 0, total: 0, note: `kind=${kind} 전원 off` });
      }
    }

    // push_subscriptions 조회
    const { data: rows, error: psErr } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, user_id")
      .in("user_id", targetUserIds);
    if (psErr) {
      console.error("[push send:ps select]", psErr);
      return res.status(500).json({ ok: false, error: psErr.message || "push_subscriptions 조회 실패" });
    }
    subs = rows || [];
  } catch (e) {
    console.error("[push send:lookup exception]", e);
    return res.status(500).json({ ok: false, error: e?.message || "구독 조회 실패" });
  }

  // 2026-05-28 — endpoint 기준 dedup (push_subscriptions.endpoint 는 UNIQUE 라 보통 1행이지만
  //   안전 차원에서 dedup 코드 유지. 옛 GAS 잔재가 마이그된 케이스도 1 endpoint 1 발송 보장).
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

  // 2) web-push 발송 (Supabase 조회 결과 형식 = { endpoint, p256dh, auth, user_id })
  //    옛 GAS 호환 fallback (s.keys) 도 유지 — 별도 호출 경로 안전망.
  const results = await Promise.allSettled(subs.map(s => {
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

  // 3) 만료 구독 정리 (best-effort) — Supabase push_subscriptions DELETE
  if (expiredEndpoints.length > 0) {
    try {
      const { error: delErr, count } = await supabase
        .from("push_subscriptions")
        .delete({ count: "exact" })
        .in("endpoint", expiredEndpoints);
      if (delErr) {
        console.warn("[push send:expired cleanup]", delErr.message);
      } else {
        console.log("[push send] expired cleaned:", count, "of", expiredEndpoints.length);
      }
    } catch (e) {
      console.warn("[push send:expired cleanup exception]", e?.message);
    }
  }

  return res.status(200).json({
    ok: true,
    sent,
    failed,
    expired: expiredEndpoints.length,
    total: subs.length,
  });
}
