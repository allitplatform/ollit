// Phase 3-8 — 기사 단가 DB 접근 모듈
// Supabase `engineer_rates` 테이블 직접 사용. 시트 호출 폐기.
//
// 매핑:
//   · PWA engineerId ("E001"~) ↔ users.code → users.id (UUID FK)
//   · PWA workType      한글 그대로 ("세척" / "냉매충전" / "냉매점검" / "출장비" / "추가선택")
//   · PWA applianceType 한글/영문 그대로 ("벽걸이" / "스탠드" / "1way" / "4way" /
//                                     "원형" / "투인원" / "시스템멀티" / "천장형")
//   · rate (정수 원 / 0 이상)
//   · note (선택 텍스트)
//
// upsert 키 (3중): (tenant_id, user_id, work_type, appliance_code)
// 삭제: hard DELETE
//
// 시그니처 호환: 옛 api.js (getEngineerRates / saveEngineerRate / deleteEngineerRate) 대체.
// 외부 호출처 (data/engineers.js, AdminApp.jsx)는 import만 변경 / 응답 형태 유지.

import { supabase } from "./supabase.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

// users.code → users.id (UUID) 변환
async function _resolveUserId(engineerCode) {
  const code = String(engineerCode || "").trim();
  if (!code) return { ok: false, error: "engineerCode 누락" };
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("tenant_id", TENANT_ID)
    .eq("code", code)
    .maybeSingle();
  if (error) {
    return { ok: false, error: `users 조회 실패: ${error.message}` };
  }
  if (!data) {
    return { ok: false, error: `기사 매핑 실패 (${code} 사용자 없음)` };
  }
  return { ok: true, userId: data.id };
}

// DB row → 시트 호환 shape
// users 측 JOIN으로 code 가져옴 (engineerId 키 호환).
function rowToSheetShape(row) {
  return {
    engineerId:    row.users?.code   || "",
    workType:      row.work_type     || "",
    applianceType: row.appliance_code || "",
    rate:          row.rate ?? 0,
    note:          row.note          || "",
  };
}

// ============================================================
// 조회 (READ) — engineer_rates 전체 / 시트 호환 shape 반환
// 응답: { ok: true, rates: [...] } | { ok: false, error, rates: [] }
// ============================================================
export async function listEngineerRatesFromDb() {
  const { data, error } = await supabase
    .from("engineer_rates")
    .select("id, user_id, work_type, appliance_code, rate, note, users(code)")
    .eq("tenant_id", TENANT_ID);

  if (error) {
    console.error("[engineerRatesDb.list]", error);
    return { ok: false, error: error.message, rates: [] };
  }

  const rates = (data || []).map(rowToSheetShape);
  return { ok: true, rates };
}

// ============================================================
// 변경 (UPSERT) — 3중 키 기반 update or insert
// payload: { engineerId, workType, applianceType, rate, note? }
// 응답: { ok, action: 'create'|'update' } | { ok: false, error }
// ============================================================
export async function upsertEngineerRateToDb(payload) {
  if (!payload || !payload.engineerId || !payload.workType || !payload.applianceType) {
    return { ok: false, error: "필수 키 누락 (engineerId / workType / applianceType)" };
  }
  const rate = parseInt(payload.rate, 10);
  if (!Number.isFinite(rate) || rate < 0) {
    return { ok: false, error: "rate 값이 잘못됨 (정수 0 이상 필요)" };
  }

  // [1] engineerCode → user_id (UUID)
  const u = await _resolveUserId(payload.engineerId);
  if (!u.ok) return { ok: false, error: u.error };
  const userId = u.userId;

  const workType      = String(payload.workType).trim();
  const applianceCode = String(payload.applianceType).trim();
  const note          = payload.note ? String(payload.note).trim() : null;

  // [2] 존재 여부 확인 (3중 키)
  const { data: existing, error: selErr } = await supabase
    .from("engineer_rates")
    .select("id")
    .eq("tenant_id", TENANT_ID)
    .eq("user_id", userId)
    .eq("work_type", workType)
    .eq("appliance_code", applianceCode)
    .maybeSingle();

  if (selErr) {
    console.error("[engineerRatesDb.upsert:select]", selErr);
    return { ok: false, error: selErr.message };
  }

  if (existing) {
    // UPDATE — 2026-06-07 .select("id")로 0행 감지 (RLS silent fail 방지망)
    const { data: updated, error: updErr } = await supabase
      .from("engineer_rates")
      .update({
        rate,
        note,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id");
    if (updErr) {
      console.error("[engineerRatesDb.upsert:update]", updErr);
      return { ok: false, error: updErr.message };
    }
    if (!Array.isArray(updated) || updated.length === 0) {
      console.error("[engineerRatesDb.upsert:update] 0행 — RLS 또는 조건 매칭 실패");
      return { ok: false, error: "0행 매칭 — 저장 실패 (권한/조건 재확인)" };
    }
    return { ok: true, action: "update" };
  }

  // INSERT
  const { error: insErr } = await supabase
    .from("engineer_rates")
    .insert({
      tenant_id:      TENANT_ID,
      user_id:        userId,
      work_type:      workType,
      appliance_code: applianceCode,
      rate,
      note,
    });
  if (insErr) {
    console.error("[engineerRatesDb.upsert:insert]", insErr);
    return { ok: false, error: insErr.message };
  }
  return { ok: true, action: "create" };
}

// ============================================================
// 삭제 (DELETE) — 3중 키 기반 hard DELETE
// payload: { engineerId, workType, applianceType }
// 응답: { ok } | { ok: false, error }
// ============================================================
export async function deleteEngineerRateFromDb(payload) {
  if (!payload || !payload.engineerId || !payload.workType || !payload.applianceType) {
    return { ok: false, error: "필수 키 누락 (engineerId / workType / applianceType)" };
  }

  const u = await _resolveUserId(payload.engineerId);
  if (!u.ok) return { ok: false, error: u.error };
  const userId = u.userId;

  const workType      = String(payload.workType).trim();
  const applianceCode = String(payload.applianceType).trim();

  const { error } = await supabase
    .from("engineer_rates")
    .delete()
    .eq("tenant_id", TENANT_ID)
    .eq("user_id", userId)
    .eq("work_type", workType)
    .eq("appliance_code", applianceCode);

  if (error) {
    console.error("[engineerRatesDb.delete]", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
