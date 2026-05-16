// Phase 3-7 — 회사 계좌 DB 접근 모듈
// Supabase `tenants.settings` jsonb 직접 사용. 시트 호출 폐기.
//
// 대표님 결정 (D1=C-1): 새 테이블 없이 tenants.settings.company_account JSON 키 활용.
// 마이그레이션 SQL 0개 / 추가 RLS 0개 (tenants 측 기존 정책 활용).
//
// 매핑:
//   tenants.settings.company_account = {
//     bankName:      "우리은행",
//     accountNumber: "1002-XXX-XXXXXX",
//     accountHolder: "올데이케어",
//     changedAt:     "2026-05-13"
//   }
//
// 시그니처 호환: 옛 api.js (getCompanyAccount / saveCompanyAccount) 대체.
// 외부 호출처 (data/companyAccount.js)는 import만 변경.

import { supabase } from "./supabase.js";
import { todayYmd } from "../utils/dateLabel.js";

const TENANT_ID    = "11111111-1111-1111-1111-111111111111";
const SETTINGS_KEY = "company_account";

// ============================================================
// 조회 — tenants.settings.company_account 읽기
// 응답: { ok: true, account: {...} | null } | { ok: false, error, account: null }
// ============================================================
export async function getCompanyAccountFromDb() {
  const { data, error } = await supabase
    .from("tenants")
    .select("settings")
    .eq("id", TENANT_ID)
    .maybeSingle();

  if (error) {
    console.error("[companyAccountDb.get]", error);
    return { ok: false, error: error.message, account: null };
  }

  const settings = (data && data.settings) || {};
  const ca = settings[SETTINGS_KEY] || null;
  if (!ca) return { ok: true, account: null };

  return {
    ok: true,
    account: {
      bankName:      ca.bankName      || "",
      accountNumber: ca.accountNumber || "",
      accountHolder: ca.accountHolder || "",
      changedAt:     ca.changedAt     || "",
    },
  };
}

// ============================================================
// 변경 — tenants.settings.company_account 갱신
// payload: { bankName, accountNumber, accountHolder, changedAt? }
// 응답: { ok: true, action: 'update', account } | { ok: false, error }
// ============================================================
export async function saveCompanyAccountToDb(payload) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "payload 누락" };
  }
  const bankName      = String(payload.bankName      || "").trim();
  const accountNumber = String(payload.accountNumber || "").trim();
  const accountHolder = String(payload.accountHolder || "").trim();
  if (!bankName || !accountNumber || !accountHolder) {
    return { ok: false, error: "필수 항목 누락 (은행 / 번호 / 예금주)" };
  }
  const today = todayYmd();
  const account = {
    bankName,
    accountNumber,
    accountHolder,
    changedAt: payload.changedAt || today,
  };

  // 1) 기존 settings 읽기 (다른 키 보존 — jsonb 부분 갱신)
  const { data: cur, error: selErr } = await supabase
    .from("tenants")
    .select("settings")
    .eq("id", TENANT_ID)
    .maybeSingle();

  if (selErr) {
    console.error("[companyAccountDb.save:select]", selErr);
    return { ok: false, error: selErr.message };
  }

  const nextSettings = {
    ...((cur && cur.settings) || {}),
    [SETTINGS_KEY]: account,
  };

  // 2) UPDATE
  const { error: updErr } = await supabase
    .from("tenants")
    .update({ settings: nextSettings })
    .eq("id", TENANT_ID);

  if (updErr) {
    console.error("[companyAccountDb.save:update]", updErr);
    return { ok: false, error: updErr.message };
  }

  return { ok: true, action: "update", account };
}
