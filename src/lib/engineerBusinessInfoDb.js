// 2026-06-18 — 기사 사업자 정보 DB 모듈 (Mig 141 RPC 2개).
//
// 테이블:
//   · engineer_business_info — 1행/user_id
//     (business_name / representative_name / business_no / business_address / tax_type)
//   · users — bank_name / bank_account 재사용 (Mig 001 + Mig 102)
//
// PWA anon + sign_in_with_phone → auth.uid()=NULL → 테이블 RLS 차단.
// 모든 호출 SECURITY DEFINER RPC 경유. 본인(actor = user_id) 또는
// 운영자(_caller_is_admin) 둘 다 통과 — Mig 141 RPC 내부 분기.
//
// 응답 형식: { ok, row } | { ok, id } | { ok: false, error }.

import { supabase } from "./supabase.js";

// 과세유형 enum (Mig 141 CHECK 일치)
export const TAX_TYPES = ["간이", "일반"];

// 사업자번호 형식 검증 — '000-00-00000'.
export const BUSINESS_NO_REGEX = /^[0-9]{3}-[0-9]{2}-[0-9]{5}$/;
export function isValidBusinessNo(v) {
  if (v == null) return true; // null/empty 허용 (Mig 141 NULL OK)
  const s = String(v).trim();
  if (s === "") return true;
  return BUSINESS_NO_REGEX.test(s);
}

// '123456789' / '12345678901' 등 입력 → '123-45-67890' 마스크 (앞 10자리만).
export function formatBusinessNo(raw) {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

// 공통 RPC 호출 헬퍼 (bookkeepingDb 패턴)
async function callRpc(name, args, fallback = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    console.error(`[engineerBusinessInfoDb.${name}]`, error);
    return { ok: false, error: error.message || "RPC 호출 실패", ...fallback };
  }
  return data || { ok: false, error: "빈 응답", ...fallback };
}

// ============================================================
// 조회 — get_engineer_business_info(p_user_id, p_actor)
//   응답 row 형태:
//     { user_id, user_code, user_name,
//       business_name, representative_name, business_no,
//       business_address, tax_type,
//       bank_name, bank_account, updated_at }
//   ebi row 없는 기사는 user_* + bank_* 만 채워지고 사업자 5필드는 null.
// ============================================================
export async function getEngineerBusinessInfo(userId, actor) {
  if (!userId) return { ok: false, error: "userId 필수", row: null };
  if (!actor)  return { ok: false, error: "actor 필수",  row: null };
  return callRpc("get_engineer_business_info", {
    p_user_id: userId,
    p_actor:   actor,
  }, { row: null });
}

// ============================================================
// 저장 — upsert_engineer_business_info(p_user_id, p_patch, p_actor)
//   patch 화이트리스트 키 (Mig 141):
//     business_name / representative_name / business_no /
//     business_address / tax_type / bank_name / bank_account
//   누락 키는 RPC가 기존 값 보존(COALESCE). 빈 문자열은 NULL 처리.
//   사업자번호는 RPC가 regex 재검증 — 화면도 동일 검증 선반영 권장.
// ============================================================
export async function upsertEngineerBusinessInfo(userId, patch, actor) {
  if (!userId) return { ok: false, error: "userId 필수" };
  if (!actor)  return { ok: false, error: "actor 필수" };
  if (!patch || typeof patch !== "object") {
    return { ok: false, error: "patch 객체 필수" };
  }

  // 클라 사전검증 — 사업자번호 형식.
  const bizNo = patch.business_no;
  if (bizNo != null && String(bizNo).trim() !== "" && !isValidBusinessNo(bizNo)) {
    return { ok: false, error: "사업자번호 형식 오류 (000-00-00000)" };
  }
  // 과세유형 enum.
  const tax = patch.tax_type;
  if (tax != null && String(tax).trim() !== "" && !TAX_TYPES.includes(tax)) {
    return { ok: false, error: "과세유형 값 오류 (간이/일반)" };
  }

  return callRpc("upsert_engineer_business_info", {
    p_user_id: userId,
    p_patch:   patch,
    p_actor:   actor,
  });
}
