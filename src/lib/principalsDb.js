// Phase 3-3 — 원청 마스터 DB 접근 모듈
// Supabase `principals` 테이블 직접 사용 (시트 호출 폐기).
// 010_principals_extra_columns.sql 실행 후 사용 가능
// (prefix / color / bank_name / account_number / account_holder 컬럼 추가됨).
//
// 핵심 호환성:
//   · loadPrincipals / adaptSheetPrincipalToSeed 측 시트 shape 형태 유지
//   · DB principals.code (KA / KB ...) ↔ PWA SEED id (aircon_pro / cool_son ...) 매핑
//     → commissionPoliciesDb.js 측 PRINCIPAL_CODE_TO_ID / PRINCIPAL_ID_TO_CODE 재사용
//   · 결과: SHEET_TO_OLD_ID_ALIAS 변경 없이 SEED 매칭 정상 동작

import { supabase } from "./supabase.js";
import {
  PRINCIPAL_CODE_TO_ID,
  PRINCIPAL_ID_TO_CODE,
} from "./commissionPoliciesDb.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

// ============================================================
// 2026-06-04 — 원청 PWA 내정보 측 계좌 fetch + update 어댑터
// ============================================================

// 소유 원청 계좌 정보 fetch — user.principals[].id 배열 입력.
//   응답: { ok: true, accounts: [{ id, code, name, bank_name, account_number, account_holder }] }
//        | { ok: false, error }
export async function fetchPrincipalAccounts(principalIds) {
  if (!Array.isArray(principalIds) || principalIds.length === 0) {
    return { ok: true, accounts: [] };
  }
  const { data, error } = await supabase
    .from("principals")
    .select("id, code, name, bank_name, account_number, account_holder")
    .in("id", principalIds);
  if (error) {
    console.error("[principalsDb.fetchPrincipalAccounts]", error);
    return { ok: false, error: error.message, accounts: [] };
  }
  return { ok: true, accounts: data || [] };
}

// 본인 원청 계좌 변경 — Mig 096 update_principal_account RPC 호출.
//   인자: { principalId, bankName, accountNumber, accountHolder, actor }
//   응답: { ok: true, principal: { id, code, name, bank_name, account_number, account_holder } }
//        | { ok: false, error }
export async function updatePrincipalAccount({
  principalId,
  bankName,
  accountNumber,
  accountHolder,
  actor,
} = {}) {
  if (!principalId) return { ok: false, error: "principalId 필수" };
  if (!actor)       return { ok: false, error: "actor (user_id) 필수" };

  const { data, error } = await supabase.rpc("update_principal_account", {
    p_principal_id:   principalId,
    p_bank_name:      bankName      || "",
    p_account_number: accountNumber || "",
    p_account_holder: accountHolder || "",
    p_actor:          actor,
  });

  if (error) {
    console.error("[principalsDb.updatePrincipalAccount]", error);
    return { ok: false, error: error.message || "RPC 호출 실패" };
  }
  return data || { ok: false, error: "빈 응답" };
}

// DB type ('direct' / 'external') ↔ 시트 type ('직영' / '위탁')
function dbTypeToSheetType(dbType) {
  return dbType === "direct" ? "직영" : "위탁";
}
function sheetTypeToDbType(sheetType) {
  return sheetType === "직영" ? "direct" : "external";
}

// DB row → 시트 호환 shape (adaptSheetPrincipalToSeed 측 받아 처리)
// id는 옛 SEED id (aircon_pro / cool_son ...)로 변환 → SEED 매칭 정상 동작
function rowToSheetShape(row) {
  const oldId = PRINCIPAL_CODE_TO_ID[row.code] || row.code;
  return {
    principalId:    oldId,
    id:             oldId,
    name:           row.name           || "",
    prefix:         row.prefix         || "",
    color:          row.color          || "",
    type:           dbTypeToSheetType(row.type),
    note:           row.notes          || "",
    bankName:       row.bank_name      || "",
    accountNumber:  row.account_number || "",
    accountHolder:  row.account_holder || "",
  };
}

// 시트 sync payload → DB row
// 입력 payload (_toPrincipalSyncPayload 결과):
//   { principalId(시트측 id), name, prefix, color, type, note, bankName, accountNumber, accountHolder }
// 시트측 id (coolguy / aircon_pro / myc ...) → DB code (KB / KA / myc ...) 변환
function syncPayloadToRow(payload) {
  const dbCode = PRINCIPAL_ID_TO_CODE[payload.principalId] || payload.principalId;
  return {
    tenant_id:      TENANT_ID,
    code:           dbCode,
    name:           payload.name   || "",
    type:           sheetTypeToDbType(payload.type),
    active:         true,
    notes:          payload.note   || null,
    prefix:         payload.prefix || null,
    color:          payload.color  || null,
    bank_name:      payload.bankName      || null,
    account_number: payload.accountNumber || null,
    account_holder: payload.accountHolder || null,
  };
}

// ============================================================
// 조회 (READ) — 시트 호환 shape 반환
// ============================================================

// 모든 원청 조회
// 응답: { ok: true, principals: [...] } | { ok: false, error, principals: [] }
export async function listPrincipalsFromDb() {
  const { data, error } = await supabase
    .from("principals")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .order("code", { ascending: true });

  if (error) {
    console.error("[principalsDb.listPrincipalsFromDb]", error);
    return { ok: false, error: error.message, principals: [] };
  }
  return { ok: true, principals: (data || []).map(rowToSheetShape) };
}

// ============================================================
// 변경 (WRITE)
// ============================================================

// upsert — code 기준 존재 여부 catch 후 update 또는 insert
// 응답: { ok, action: 'create' | 'update', principalId(시트측 id) } | { ok: false, error }
export async function upsertPrincipalToDb(payload) {
  if (!payload || !payload.principalId) {
    return { ok: false, error: "principalId 필수" };
  }
  const row = syncPayloadToRow(payload);

  // code 기준 존재 여부
  const { data: existing, error: selErr } = await supabase
    .from("principals")
    .select("id, code")
    .eq("tenant_id", TENANT_ID)
    .eq("code", row.code)
    .maybeSingle();

  if (selErr) {
    console.error("[principalsDb.upsert:select]", selErr);
    return { ok: false, error: selErr.message };
  }

  if (existing) {
    // update — id / tenant_id / code 불변
    const updateRow = { ...row };
    delete updateRow.tenant_id;
    delete updateRow.code;
    const { error: updErr } = await supabase
      .from("principals")
      .update(updateRow)
      .eq("id", existing.id);
    if (updErr) {
      console.error("[principalsDb.upsert:update]", updErr);
      return { ok: false, error: updErr.message };
    }
    return { ok: true, action: "update", principalId: payload.principalId };
  }

  // insert
  const { error: insErr } = await supabase
    .from("principals")
    .insert(row);
  if (insErr) {
    console.error("[principalsDb.upsert:insert]", insErr);
    return { ok: false, error: insErr.message };
  }
  return { ok: true, action: "create", principalId: payload.principalId };
}

// 삭제 — 시트측 id를 받아 DB code로 변환 후 delete
export async function deletePrincipalFromDb(sheetId) {
  if (!sheetId) return { ok: false, error: "id 없음" };
  const dbCode = PRINCIPAL_ID_TO_CODE[sheetId] || sheetId;
  const { error } = await supabase
    .from("principals")
    .delete()
    .eq("tenant_id", TENANT_ID)
    .eq("code", dbCode);
  if (error) {
    console.error("[principalsDb.deletePrincipalFromDb]", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
