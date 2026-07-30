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
// 2026-07-26 — 길이 기반 단문/장문 자동 (한글 2바이트 환산, 90바이트 이하 = SMS 9원).
function pickSmsType(text) {
  let b = 0;
  for (const ch of String(text || "")) b += ch.charCodeAt(0) > 127 ? 2 : 1;
  return b <= 90 ? "SMS" : "LMS";
}

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
  // 2026-07-30 Mig 202 — 고객용 재배정 안내.
  //   그전까지는 재배정에도 위 'assign' 문구가 그대로 나갔다 → 고객 눈에는
  //   기사 두 명이 배정된 것처럼 보임(이중배정 오해). 앞 기사 연락처가
  //   무효라는 것도 명시해야 잘못된 번호로 전화하는 사고를 막는다.
  if (type === "reassign") {
    return (
`${prefix}담당 기사 변경 안내

신청하신 에어컨 서비스의
담당 기사님이 변경되었습니다.

▶ 변경된 기사: ${vars.engineerName} 기사님
▶ 기사 연락처: ${vars.engineerPhone}

앞서 안내드린 기사님 연락처는
더 이상 유효하지 않으니 참고 부탁드립니다.
변경된 기사님이 일정 조율을 위해
연락드릴 예정입니다.

문의: 1866-2003`
    );
  }
  // 2026-07-26 Mig 193 — 기사용 문자 (수신자 = 기사 폰. customerPhone 필드를
  //   수신자 슬롯으로 재사용 — 트리거가 기사 번호를 넣어 보냄).
  //   푸시 지연 대비 확실 채널 (사장님 결정: 배정마다 무조건 문자).
  if (type === "eng_assign") {
    // 2026-07-26 — 사장님 spec: 초간단 (상세는 앱에). 단문(SMS) 요금.
    // 2026-07-30 — 07-26 의 "reassigned 구분 폐기" 결정을 되돌림.
    //   운영해 보니 "재배정" 표기가 없으면 받는 쪽이 이중배정인지 구분 못 함.
    //   reassigned 플래그는 Mig 193 이 이미 보내고 있어 SQL 변경 불필요.
    if (vars.reassigned) {
      return (
`[올잇] 재배정 · ${vars.customer || "고객"} 고객
일정 재조율 해주세요. 앱 확인해 주세요.`
      );
    }
    return (
`[올잇] 새 배정 · ${vars.customer || "고객"} 고객
앱에서 확인해 주세요.`
    );
  }
  if (type === "eng_unassign") {
    // 2026-07-26 — 사장님 문구 확정: "제외" → "취소".
    return (
`[올잇] ${vars.customer || "고객"} 고객 건
배정 취소되었습니다. 앱 확인해 주세요.`
    );
  }
  if (type === "visit_fee") {
    // 2026-07-21 — 출장비 안내 (visit_only 건. Mig 184 트리거 발화, amount = tasks.travel_fee).
    return (
`${prefix}출장비 안내
금일 방문 건은
작업 진행이 어려웠던 점 양해 부탁드립니다.

▶ 출장비: ${formatAmount(vars.amount)}원
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

  const ENG_TYPES = ["eng_assign", "eng_unassign"];   // 2026-07-26 Mig 193
  // 2026-07-30 Mig 202 — 'reassign' 은 assign 과 같은 변수(기사명/연락처)를 쓴다.
  const ASSIGN_TYPES = ["assign", "reassign"];
  if (!ASSIGN_TYPES.includes(type) && type !== "complete" && type !== "visit_fee" && !ENG_TYPES.includes(type)) {
    res.status(400).json({ ok: false, error: "type must be assign|reassign|complete|visit_fee|eng_assign|eng_unassign" });
    return;
  }
  const to = normalizePhone(toRaw);
  if (!/^01[0-9]{8,9}$/.test(to)) {
    res.status(400).json({ ok: false, error: "customerPhone invalid" });
    return;
  }

  // 사장님 spec ① — engineerName / engineerPhone 둘 중 하나라도 NULL 이면 발송 skip (대표번호 fallback X).
  if (ASSIGN_TYPES.includes(type)) {
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
  } else if (!ENG_TYPES.includes(type)) {
    if (vars.amount == null || Number.isNaN(Number(vars.amount))) {
      res.status(400).json({ ok: false, error: "amount 누락 / 형식 오류" });
      return;
    }
  }
  // eng_* — customer/region 은 비어도 발송 (기사에게 안 가는 것보다 낫다)

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
          type: pickSmsType(text),   // 2026-07-26 — 기사 단문은 SMS 요금
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
