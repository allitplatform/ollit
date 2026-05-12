// Phase 2 — commission_policies CRUD + calculate_commission RPC 박은 영역
// db/migrations/009_commission_policies_v6.sql 박은 영역 박은 영역 박은 영역 박음.
// RLS — admin / operator 박은 영역 박을 영역 (가짜단가 JSON 박은 영역 박은 영역 박은 영역 박은 영역 박은 영역 박은 영역 박을 영역).

import { supabase } from "./supabase.js";

export const TENANT_ID = "11111111-1111-1111-1111-111111111111";

// ============================================================
// 조회 (READ)
// ============================================================

// 전체 정책 조회 (필터 옵션 — principalCode / serviceCode)
export async function listCommissionPolicies({ principalCode, serviceCode } = {}) {
  let query = supabase
    .from("commission_policies")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .order("principal_code", { ascending: true })
    .order("service_code",   { ascending: true })
    .order("policy_key",     { ascending: true });

  if (principalCode) query = query.eq("principal_code", principalCode);
  if (serviceCode)   query = query.eq("service_code",   serviceCode);

  const { data, error } = await query;
  if (error) {
    console.error("[commissionPoliciesDb.listCommissionPolicies]", error);
    return { ok: false, error: error.message, data: [] };
  }
  return { ok: true, data: data || [] };
}

// 단일 정책 조회 (id)
export async function getCommissionPolicy(id) {
  if (!id) return { ok: false, error: "id 필수" };
  const { data, error } = await supabase
    .from("commission_policies")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[commissionPoliciesDb.getCommissionPolicy]", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, data };
}

// ============================================================
// 변경 (WRITE)
// ============================================================

// 정책 수정 (partial / undefined 박은 영역 무시)
// 박은 영역 박을 영역 박은 영역 — engineer_base / fee_rate / principal_fee / notes / qty_condition
export async function updateCommissionPolicy(id, updates) {
  if (!id || !updates) return { ok: false, error: "id / updates 필수" };

  // immutable 박은 영역 박은 영역 박음
  const patch = { ...updates };
  delete patch.id;
  delete patch.tenant_id;
  delete patch.category_id;
  delete patch.policy_key;

  const { data, error } = await supabase
    .from("commission_policies")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("[commissionPoliciesDb.updateCommissionPolicy]", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, data };
}

// ============================================================
// 계산 RPC (calculate_commission)
// ============================================================

// calculate_commission RPC 호출
// 응답: { ok, total, principal, engineer, company, calc_method, policy_key }
//       또는 { ok: false, error: 'policy_not_found' }
export async function calculateCommissionRpc({
  principalCode,
  serviceCode,
  applianceCode,
  quotedAmount,
  extraAmount = 0,
  naverFee = 0,
  qtyCondition = null,
}) {
  if (!principalCode || !serviceCode) {
    return { ok: false, error: "principalCode / serviceCode 필수" };
  }

  const { data, error } = await supabase.rpc("calculate_commission", {
    p_principal_code: principalCode,
    p_service_code:   serviceCode,
    p_appliance_code: applianceCode || null,
    p_quoted_amount:  Number(quotedAmount) || 0,
    p_extra_amount:   Number(extraAmount)  || 0,
    p_naver_fee:      Number(naverFee)     || 0,
    p_qty_condition:  qtyCondition,
  });

  if (error) {
    console.error("[commissionPoliciesDb.calculateCommissionRpc]", error);
    return { ok: false, error: error.message || "rpc_error" };
  }
  return data || { ok: false, error: "empty_response" };
}

// ============================================================
// 헬퍼
// ============================================================

// 원청 코드 → 표시 이름
export const PRINCIPAL_LABEL = {
  allday:  "올데이케어",
  KA:      "에어컨프로",
  KB:      "쿨가이",
  yongin:  "용인컴퍼니",
  usol_h:  "유솔홈케어 H",
  usol_n:  "유솔홈케어 N",
  crikrin: "크리크린",
  common:  "공통",
};

// 서비스 코드 → 표시 이름
export const SERVICE_LABEL = {
  cleaning:    "세척",
  refrigerant: "냉매충전",
  addon:       "추가선택",
  visit_fee:   "출장비",
  install:     "설치",
  leak:        "누설",
  inspect:     "점검",
  repair:      "수리",
};

// calc_method → 한글 설명
export const CALC_METHOD_DESC = {
  "직영_0":         "직영 / 원청 0 / 기사 단가",
  "직영_50_50":     "직영 / 기사 50% / 회사 50%",
  "차감후비율_50":  "(판매가 - 가짜단가) × 50%",
  "비율_견적금액":  "견적금액 × N% (현장추가 X)",
  "비율_총금액":    "총금액 × N% (현장추가 O)",
  "비율_판매가":    "판매가 × N% (기사 단가)",
  "정액":           "원청 정액 / 기사 단가",
  "usol_n_본작업":  "유솔N 세척 (기사 ×1.10 / 원청 15%)",
  "usol_n_추가선택": "유솔N 추가 (기사 85% / 원청 15%)",
  "usol_n_냉매점검": "유솔N 냉매점검 특수",
  "출장비_30K":     "출장비 30,000 (기사 100%)",
};
