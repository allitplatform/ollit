// 2026-06-22 — SMS 발송 endpoint (솔라피 LMS).
// 흐름: tasks UPDATE → sms_send_trigger → pg_net.http_post → 본 endpoint → 솔라피 API.
//
// 보안: body.secret = SMS_TRIGGER_SECRET 검증.
//   Supabase Vault + Vercel 환경변수에 동일 값 등록 (Coco 담당).
//   endpoint 가 공개라 검증 필수 — 외부 호출 차단.
//
// 발신번호: 01041163991 (Coco 승인 대기 중 — 승인 전 실발송 X). 안내번호: 1866-2003 (문구 표시용).
//
// 요청:
//   POST /api/sms/send
//   body: {
//     secret:        string  — SMS_TRIGGER_SECRET (필수)
//     type:          'assign' | 'complete' | 'visit_fee'  (visit_fee — 2026-07-21 출장비 안내 추가)
//     principal:     string  — principal_code ('allday' 등)
//     customerPhone: string  — 수신 고객 번호
//     vars: {
//       engineerName?:  string — assign 필수
//       engineerPhone?: string — assign 필수 (둘 중 하나 NULL 이면 발송 skip — 사장님 spec ①)
//       amount?:        number — complete 필수
//     }
//     dryRun?: boolean — true 시 솔라피 잔액 GET 으로 시그니처 정합성만 검증 (사장님 spec ②).
//   }
//
// 응답:
//   200 { ok: true, ... }
//   400 { ok: false, error }    — 본문 / 변수 형식 오류
//   401 { ok: false, error }    — secret 불일치
//   500 { ok: false, error }    — 환경변수 미설정
//   502 { ok: false, error }    — 솔라피 API 오류
//
// 환경변수 (Coco 등록):
//   SOLAPI_API_KEY / SOLAPI_API_SECRET / SMS_TRIGGER_SECRET
//
// ⚠️ notify_lifecycle_push (웹푸시) 와 완전 별도. 같은 tasks UPDATE 트리거 발화 가능 — 영향 0.

import crypto from "node:crypto";

const ALLOWED_ORIGIN     = process.env.ALLOWED_ORIGIN || "*";
const SMS_TRIGGER_SECRET = process.env.SMS_TRIGGER_SECRET;
const SOLAPI_API_KEY     = process.env.SOLAPI_API_KEY;
const SOLAPI_API_SECRET  = process.env.SOLAPI_API_SECRET;
const SOLAPI_FROM        = "01041163991";

const SOLAPI_SEND_URL    = "https://api.solapi.com/messages/v4/send-many";
const SOLAPI_BALANCE_URL = "https://api.solapi.com/cash/v1/balance";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin",  ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age",       "86400");
}

function safeParse(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) { return null; }
}

function normalizePhone(p) {
  return String(p || "").replace(/[^0-9]/g, "");
}

function formatPhoneDisplay(digits) {
  const s = String(digits || "");
  if (s.length === 11) return `${s.slice(0, 3)}-${s.slice(3, 7)}-${s.slice(7)}`;
  if (s.length === 10) return `${s.slice(0, 3)}-${s.slice(3, 6)}-${s.slice(6)}`;
  return s;
}

function formatAmount(n) {
  return Number(n || 0).toLocaleString("ko-KR");
}

// 솔라피 HMAC-SHA256 시그니처 — date + salt 를 apiSecret 으로 서명.
//   Authorization 헤더 형식 (공식 docs):
//     `HMAC-SHA256 apiKey={KEY}, date={ISO8601}, salt={RAND}, signature={HEX}`
function buildSolapiAuth(apiKey, apiSecret) {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString("hex");
  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(date + salt)
    .digest("hex");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

// 본문 조립 — spec §4 그대로. allday 만 첫 줄에 [올데이케어] prefix.
function buildText(type, principal, vars) {
  const prefix = principal === "allday" ? "[올데이케어] " : "";
  if (type === "assign") {
    return (
`${prefix}기사 배정 안내

안녕하세요, 신청하신 에어컨 서비스에
${vars.engineerName} 기사님이 배정되었습니다.

▶ 기사 연락처: ${vars.engineerPhone}

기사님이 일정 조율을 위해
오늘 중으로 연락드릴 예정입니다.
순차적으로 진행되어 다소 시간이 걸릴 수 있는 점
양해 부탁드립니다.

문의: 1866-2003`
    );
  }
  if (type === "visit_fee") {
    // 2026-07-21 — 출장비 안내 (visit_only 건. Mig 184 트리거 발화, amount = tasks.travel_fee).
    return (
`${prefix}출장비 안내

안녕하세요, 방문 결과
현장 여건상 작업 진행이 어려워
출장비만 발생했습니다.

▶ 출장비: ${formatAmount(vars.amount)}원

이용해 주셔서 감사합니다.

문의: 1866-2003`
    );
  }
  return (
`${prefix}서비스 완료 안내

신청하신 에어컨 서비스가
정상적으로 완료되었습니다.

▶ 결제금액: ${formatAmount(vars.amount)}원

※ 카드결제, 현금영수증, 세금계산서 발급
여부에 따라 실제 결제금액과 다를 수 있습니다.
이용해 주셔서 감사합니다.

문의: 1866-2003`
  );
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST")    {
    res.status(405).json({ ok: false, error: "Method Not Allowed" });
    return;
  }

  if (!SOLAPI_API_KEY || !SOLAPI_API_SECRET || !SMS_TRIGGER_SECRET) {
    res.status(500).json({
      ok: false,
      error: "환경변수 미설정 (SOLAPI_API_KEY / SOLAPI_API_SECRET / SMS_TRIGGER_SECRET)",
    });
    return;
  }

  // Vercel 환경에 따라 req.body 가 자동 parse 또는 raw string.
  let body = req.body;
  if (typeof body === "string") body = safeParse(body);
  if (!body || typeof body !== "object") {
    res.status(400).json({ ok: false, error: "invalid body" });
    return;
  }

  if (body.secret !== SMS_TRIGGER_SECRET) {
    res.status(401).json({ ok: false, error: "secret mismatch" });
    return;
  }

  // dryRun — 솔라피 잔액 GET 으로 시그니처 정합성만 검증 (사장님 spec ②).
  //   발신번호 미승인 상태에서도 호출 가능. 200 OK = 시그니처 정확.
  if (body.dryRun === true) {
    try {
      const r = await fetch(SOLAPI_BALANCE_URL, {
        method:  "GET",
        headers: { Authorization: buildSolapiAuth(SOLAPI_API_KEY, SOLAPI_API_SECRET) },
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        res.status(502).json({ ok: false, error: "solapi auth failed", status: r.status, detail: data });
        return;
      }
      res.status(200).json({ ok: true, dryRun: true, balance: data });
      return;
    } catch (e) {
      res.status(502).json({ ok: false, error: "solapi unreachable", detail: String(e?.message || e) });
      return;
    }
  }

  const type      = body.type;
  const principal = body.principal;
  const toRaw     = body.customerPhone;
  const vars      = body.vars || {};

  if (type !== "assign" && type !== "complete" && type !== "visit_fee") {
    res.status(400).json({ ok: false, error: "type must be assign|complete|visit_fee" });
    return;
  }
  const to = normalizePhone(toRaw);
  if (!/^01[0-9]{8,9}$/.test(to)) {
    res.status(400).json({ ok: false, error: "customerPhone invalid" });
    return;
  }

  // 사장님 spec ① — engineerName / engineerPhone 둘 중 하나라도 NULL 이면 발송 skip (대표번호 fallback X).
  if (type === "assign") {
    if (!vars.engineerName || !vars.engineerPhone) {
      res.status(400).json({ ok: false, error: "engineerName / engineerPhone 누락 — 발송 skip" });
      return;
    }
    const engDigits = normalizePhone(vars.engineerPhone);
    if (!engDigits) {
      res.status(400).json({ ok: false, error: "engineerPhone 형식 오류 — 발송 skip" });
      return;
    }
    vars.engineerPhone = formatPhoneDisplay(engDigits);  // 010-1234-5678 표시
  } else {
    if (vars.amount == null || Number.isNaN(Number(vars.amount))) {
      res.status(400).json({ ok: false, error: "amount 누락 / 형식 오류" });
      return;
    }
  }

  const text = buildText(type, principal, vars);

  try {
    const r = await fetch(SOLAPI_SEND_URL, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  buildSolapiAuth(SOLAPI_API_KEY, SOLAPI_API_SECRET),
      },
      body: JSON.stringify({
        messages: [{
          to,
          from: SOLAPI_FROM,
          text,
          type: "LMS",
        }],
      }),
    });
    const data = await r.json().catch(() => null);
    if (!r.ok) {
      res.status(502).json({ ok: false, error: "solapi error", status: r.status, detail: data });
      return;
    }
    res.status(200).json({ ok: true, detail: data });
  } catch (e) {
    res.status(502).json({ ok: false, error: "solapi unreachable", detail: String(e?.message || e) });
  }
}
