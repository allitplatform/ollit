// 2026-06-19 Step 3-1 — doc_issues 발행 이력 DB 모듈 (Mig 143).
//
// 채번:
//   (issuer_business_no, 발행일 KST) 단위 001 부터 순번 증가.
//   E002 / E022 처럼 같은 사업자번호 공유 기사들은 통합 카운터.
//   doc_no = "YYMMDD-NNN" (YYMMDD = 실제 발행일, 거래일자 바꿔도 유지).
//
// 권한 (RPC 측 검증):
//   본인(actor = issuer_user_id) OR _caller_is_admin(actor).
//   PWA anon + 자체인증 → SECURITY DEFINER RPC 가 우회.
//
// 응답: { ok, id, doc_no, issuer_business_no, next_no, issue_date, issued_at_kst } | { ok:false, error }

import { supabase } from "./supabase.js";

async function callRpc(name, args, fallback = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    console.error(`[docIssuesDb.${name}]`, error);
    return { ok: false, error: error.message || "RPC 호출 실패", ...fallback };
  }
  return data || { ok: false, error: "빈 응답", ...fallback };
}

// payload 키 (Mig 143 issue_document):
//   doc_type, recipient_type, recipient_name, recipient_biz_name,
//   recipient_biz_no, recipient_address, supply, vat, amount, items, issue_date
//
// 사용:
//   const res = await issueDocument({ payload, issuerUserId, actor, taskId })
//   if (res.ok) ...res.doc_no... ;
export async function issueDocument({ payload, issuerUserId, actor, taskId = null }) {
  if (!actor)         return { ok: false, error: "actor 필수" };
  if (!issuerUserId)  return { ok: false, error: "issuerUserId 필수" };
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "payload 객체 필수" };
  }
  return callRpc("issue_document", {
    p_actor:          actor,
    p_issuer_user_id: issuerUserId,
    p_payload:        payload,
    p_task_id:        taskId,
  });
}
