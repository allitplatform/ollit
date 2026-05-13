// Phase 2 — commission_policies CRUD + calculate_commission RPC 박은 영역
// db/migrations/009_commission_policies_v6.sql 박은 영역 박은 영역 박은 영역 박음.
// RLS — admin / operator 박은 영역 박을 영역 (가짜단가 JSON 박은 영역 박은 영역 박은 영역 박은 영역 박은 영역 박은 영역 박을 영역).

import { supabase } from "./supabase.js";

export const TENANT_ID = "11111111-1111-1111-1111-111111111111";

// 옛 시스템 principal.id ↔ 새 시스템 principal_code 매핑
// principals.js 박은 영역 박은 영역 = aircon_pro / cool_son (옛 박은 영역)
// Supabase commission_policies 박은 영역 = KA / KB (새 박은 영역)
export const PRINCIPAL_ID_TO_CODE = {
  allday:     "allday",
  aircon_pro: "KA",
  cool_son:   "KB",
  yongin:     "yongin",
  usol_h:     "usol_h",
  usol_n:     "usol_n",
  crikrin:    "crikrin",
};

export const PRINCIPAL_CODE_TO_ID = {
  allday:  "allday",
  KA:      "aircon_pro",
  KB:      "cool_son",
  yongin:  "yongin",
  usol_h:  "usol_h",
  usol_n:  "usol_n",
  crikrin: "crikrin",
};

// 헬퍼 — principal.id (옛) → principal_code (새 / Supabase 박은 영역)
export function getPrincipalCode(principalId) {
  if (!principalId) return null;
  return PRINCIPAL_ID_TO_CODE[principalId] || principalId;
}

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
  addon:       "추가 옵션",
  visit_fee:   "출장비",
  install:     "설치",
  leak:        "누설",
  inspect:     "점검",
  repair:      "수리",
};

// 기종 코드 → 표시 (DB 측 한글 박혀있어도 일관성 박은 영역)
export const APPLIANCE_LABEL = {
  "벽걸이": "벽걸이",
  "1way":   "1way",
  "스탠드": "스탠드",
  "4way":   "4way",
  "원형":   "원형",
  "투인원": "투인원",
  "시스템멀티": "시스템멀티",
  "송풍팬분해": "송풍팬분해",
  "실외기":     "실외기",
  "피톤치드":   "피톤치드",
};

// 수량 조건 → 표시
export const QTY_LABEL = {
  "첫대": "첫 대",
  "추가": "추가 (2번째부터)",
};

// calc_method → 한국어 짧은 라벨 (카드 / 결과 카드 박은 영역)
export const CALC_METHOD_LABEL = {
  "직영_0":         "직영 (수수료 없음)",
  "직영_50_50":     "직영 (5:5 분배)",
  "차감후비율_50":  "가짜단가 차감 후 50%",
  "비율_견적금액":  "견적금액 비율",
  "비율_총금액":    "총금액 비율",
  "비율_판매가":    "판매가 비율",
  "정액":           "정액 (고정금액)",
  "usol_n_본작업":  "유솔N 본작업",
  "usol_n_추가선택": "유솔N 추가선택",
  "usol_n_냉매점검": "유솔N 냉매점검",
  "출장비_30K":     "출장비 (3만원)",
};

// calc_method → 긴 설명 (툴팁 / 부가 설명 박은 영역)
export const CALC_METHOD_DESC = {
  "직영_0":         "원청 수수료 0원 / 기사 = 단가표",
  "직영_50_50":     "원청 0원 / 기사 50% / 회사 50%",
  "차감후비율_50":  "(판매가 - 가짜단가) × 50% = 원청 수수료",
  "비율_견적금액":  "견적금액 × N% (현장추가 제외)",
  "비율_총금액":    "총금액 × N% (현장추가 포함)",
  "비율_판매가":    "판매가 × N% / 기사 = 단가표",
  "정액":           "원청 정액 (고정) / 기사 = 단가표",
  "usol_n_본작업":  "유솔N 세척 — 기사 단가 × 1.10 / 원청 15%",
  "usol_n_추가선택": "유솔N 추가 옵션 — 기사 85% / 원청 15%",
  "usol_n_냉매점검": "유솔N 냉매점검 — 특수 분배",
  "출장비_30K":     "작업 불가 시 — 기사 30,000원",
};
