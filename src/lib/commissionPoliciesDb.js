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
  coolguy:    "KB",   // 시트 측 id alias (KB만 mismatch — principals.js SHEET_TO_OLD_ID_ALIAS 참고)
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

// Phase B-3 — 새 원청 기본 정책 12 row 생성 (크리크린 스타일)
// 세척 6 + 냉매 6 = 12 row, 모두 비율_견적금액 20%
// slug = policy_key 측 영문 슬러그 (기존 78 row 패턴 유지: wall/stand/2in1...)
export const DEFAULT_APPLIANCES = [
  { key: "벽걸이", slug: "wall",  base: 40000 },
  { key: "1way",   slug: "1way",  base: 50000 },
  { key: "스탠드", slug: "stand", base: 60000 },
  { key: "4way",   slug: "4way",  base: 70000 },
  { key: "원형",   slug: "round", base: 80000 },
  { key: "투인원", slug: "2in1",  base: 100000 },
];

const CATEGORY_ID_AIRCON = "33333333-3333-3333-3333-333333333001";

export function generateDefaultPolicies(principalCode) {
  if (!principalCode) return [];
  const policies = [];

  // 세척 6 row
  DEFAULT_APPLIANCES.forEach(app => {
    policies.push({
      tenant_id:      TENANT_ID,
      category_id:    CATEGORY_ID_AIRCON,
      principal_code: principalCode,
      service_code:   "cleaning",
      appliance_code: app.key,
      calc_method:    "비율_견적금액",
      policy_key:     `${principalCode}_cleaning_${app.slug}`,
      engineer_base:  app.base,
      fee_rate:       0.20,
      qty_condition:  null,
      principal_fee:  null,
      notes:          null,
    });
  });

  // 냉매 6 row (원형 포함)
  DEFAULT_APPLIANCES.forEach(app => {
    policies.push({
      tenant_id:      TENANT_ID,
      category_id:    CATEGORY_ID_AIRCON,
      principal_code: principalCode,
      service_code:   "refrigerant",
      appliance_code: app.key,
      calc_method:    "비율_견적금액",
      policy_key:     `${principalCode}_refri_${app.slug}`,
      engineer_base:  null,
      fee_rate:       0.20,
      qty_condition:  null,
      principal_fee:  null,
      notes:          null,
    });
  });

  return policies;
}

// 정책 일괄 INSERT (Phase B-3 새 원청 초기화)
export async function insertCommissionPolicies(policies) {
  if (!Array.isArray(policies) || policies.length === 0) {
    return { ok: false, error: "policies 비어있음" };
  }
  const { data, error } = await supabase
    .from("commission_policies")
    .insert(policies)
    .select();

  if (error) {
    console.error("[commissionPoliciesDb.insertCommissionPolicies]", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, data: data || [] };
}

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

// ============================================================
// Phase 3-1 — 옛 시트 호출 호환 매핑 + 어댑터
// 시트 호출 (getPolicy / calculateFee / getAllPolicies) 폐기.
// AdminApp 측 한글 폼 값을 그대로 받아서 DB 측 코드로 변환 후 RPC 호출.
// ============================================================

// 폼 측 한글 원청명 → DB principal_code
// 표시 형태가 두 가지: "에어컨프로 (KA)" (KA 1way 분기 로직) / "에어컨프로" (옛 seed)
export const PRINCIPAL_NAME_TO_CODE = {
  "올데이케어":     "allday",
  "에어컨프로 (KA)": "KA",
  "에어컨프로":     "KA",
  "쿨가이 (KB)":    "KB",
  "쿨가이":         "KB",
  "용인컴퍼니":     "yongin",
  "유솔홈케어 H":   "usol_h",
  "유솔홈케어 N":   "usol_n",
  "크리크린":       "crikrin",
};

// 폼 측 한글 작업유형 → DB service_code
// "냉매점검(YS-N)" 은 service_code='refrigerant' 이지만 calc_method='usol_n_냉매점검' — 정책 측 자동 결정
export const WORKTYPE_TO_SERVICE = {
  "세척":            "cleaning",
  "냉매충전":        "refrigerant",
  "출장비":          "visit_fee",
  "추가선택(YS-N)":   "addon",
  "냉매점검(YS-N)":   "refrigerant",
  "설치":            "install",
  "누설":            "leak",
  "점검":            "inspect",
  "수리":            "repair",
};

// 2026-05-16 fix — 폼 측 한글 기종 → DB appliance_code (영문)
// DB commission_policies.appliance_code = 영문 ('wall', 'stand' 등) 박혀있어 매핑 필요
export const APPLIANCE_NAME_TO_CODE = {
  "벽걸이":     "wall",
  "스탠드":     "stand",
  "1way":       "1way",
  "4way":       "4way",
  "원형":       "round",
  "투인원":     "2in1",
  "시스템멀티": "multi",
};

// "1way 첫 대" / "1way 추가" → { appliance, qtyCondition }
// 일반 기종은 qtyCondition=null
export function splitApplianceQty(applianceStr) {
  if (!applianceStr) return { appliance: null, qtyCondition: null };
  const s = String(applianceStr).trim();
  // "1way 첫 대" / "1way 첫대" / "1way 추가"
  const m = s.match(/^(.+?)\s+(첫\s*대|첫대|추가)$/);
  if (m) {
    const appliance = m[1].trim();
    const qtyRaw = m[2].replace(/\s+/g, "");
    const qtyCondition = qtyRaw === "첫대" || qtyRaw === "첫 대" ? "첫대" : "추가";
    // 2026-05-16 fix — 한글 → 영문 변환 (DB commission_policies.appliance_code 영문 매칭)
    const applianceCode = APPLIANCE_NAME_TO_CODE[appliance] || appliance;
    return { appliance: applianceCode, qtyCondition };
  }
  // 2026-05-16 fix — 한글 → 영문 변환
  const applianceCode = APPLIANCE_NAME_TO_CODE[s] || s;
  return { appliance: applianceCode, qtyCondition: null };
}

// 옛 calculateFee 호환 어댑터
// 옛 입력: (principalName 한글, workType 한글, applianceWithQty 한글, quote)
// 옛 출력: { ok, fee:{principalFee, engineerAmount, companyProfit}, policy:{policyText}, parsed:{type} }
// 내부적으로 calculate_commission RPC 호출 후 형태 변환.
export async function calculateFeeCompat(principalName, workType, applianceWithQty, quote) {
  const principalCode = PRINCIPAL_NAME_TO_CODE[principalName];
  const serviceCode   = WORKTYPE_TO_SERVICE[workType];
  if (!principalCode) {
    return { ok: false, error: `알 수 없는 원청: ${principalName}` };
  }
  if (!serviceCode) {
    return { ok: false, error: `알 수 없는 작업유형: ${workType}` };
  }
  const { appliance, qtyCondition } = splitApplianceQty(applianceWithQty);

  const res = await calculateCommissionRpc({
    principalCode,
    serviceCode,
    applianceCode: appliance,
    quotedAmount:  Number(quote) || 0,
    extraAmount:   0,
    naverFee:      0,
    qtyCondition,
  });

  if (!res || res.ok === false) {
    return { ok: false, error: (res && res.error) || "정책 조회 실패" };
  }

  const calcMethod = res.calc_method || res.calcMethod || "";
  const policyKey  = res.policy_key  || res.policyKey  || "";
  const label      = CALC_METHOD_LABEL[calcMethod] || calcMethod;

  return {
    ok: true,
    fee: {
      principalFee:   res.principal ?? 0,
      engineerAmount: res.engineer  ?? 0,
      companyProfit:  res.company   ?? 0,
    },
    policy: {
      policyText: label + (policyKey ? ` · ${policyKey}` : ""),
      calcMethod,
      policyKey,
    },
    parsed: {
      type: calcMethod,
    },
    total: res.total ?? 0,
  };
}

// 옛 getAllPolicies 호환 어댑터 (캐시용)
// engineers.js._findInPoliciesCache 측 sheet shape 호환 — { principalId, principal, workType, applianceType, rate }
// engineers.js Phase 3-3 측 정리 예정 — 그 전까지 호환 박힘 유지.
export async function listPoliciesSheetShape() {
  const res = await listCommissionPolicies();
  if (!res.ok) return { ok: false, error: res.error, policies: [] };
  const policies = (res.data || []).map(row => ({
    // engineers.js 호환 필드
    principalId:   row.principal_code,
    principal:     PRINCIPAL_LABEL[row.principal_code] || row.principal_code,
    workType:      SERVICE_LABEL[row.service_code]     || row.service_code,
    applianceType: row.appliance_code,
    rate:          row.engineer_base,
    // DB raw 도 같이 — 미래 코드에서 참조 가능
    ...row,
  }));
  return { ok: true, policies };
}
