// Phase 4-2 — 작업번호 자동 생성 (클라이언트 함수)
//
// 패턴: {prefix}{YYMMDD}-{seq}
//   · prefix:  DB principals.prefix lookup (예: 'A-' / 'K-' / 'YS-' / 'YS-N-' / 'CK-')
//   · YYMMDD:  오늘 날짜 (KST 기준)
//   · seq:     같은 prefix + 같은 YYMMDD 박힌 작업 수 + 1 (3자리 zero-pad)
//
// 예: 'A-260514-001' / 'K-260514-007' / 'YS-N-260514-012'
//
// 사용처: NewReceptionFormScreen (handleSubmit) / createTaskAdapter (tasksDb.js)
//
// 안전:
//   · prefix lookup 실패 시 '?-' 폴백
//   · count 실패 시 1로 시작 (DB UNIQUE 제약은 task_no — 충돌 시 호출처가 재시도)
//   · 동시 박힘 race condition은 일단 catch 0 — 단일 운영자 사용 패턴

import { supabase } from "./supabase.js";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

// 오늘 YYMMDD (KST)
function todayYymmdd() {
  const now = new Date();
  // KST = UTC+9
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const yy = String(kst.getUTCFullYear()).slice(2);
  const mm = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(kst.getUTCDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

// principals.prefix lookup (code 기준)
async function _getPrefixByCode(principalCode) {
  if (!principalCode) return "?-";
  const { data, error } = await supabase
    .from("principals")
    .select("prefix")
    .eq("tenant_id", TENANT_ID)
    .eq("code", principalCode)
    .maybeSingle();
  if (error || !data) {
    console.warn(`[taskNoGenerator] prefix lookup 실패 (code=${principalCode})`, error);
    return "?-";
  }
  return data.prefix || "?-";
}

// principals.prefix lookup (name 기준 — 호출처가 이름만 박힌 케이스)
async function _getPrefixByName(principalName) {
  if (!principalName) return { prefix: "?-", code: null };
  const { data, error } = await supabase
    .from("principals")
    .select("code, prefix")
    .eq("tenant_id", TENANT_ID)
    .eq("name", principalName)
    .maybeSingle();
  if (error || !data) {
    console.warn(`[taskNoGenerator] prefix lookup 실패 (name=${principalName})`, error);
    return { prefix: "?-", code: null };
  }
  return { prefix: data.prefix || "?-", code: data.code };
}

// 같은 prefix + 같은 YYMMDD 작업 수 catch
async function _countTasksForToday(prefix, yymmdd) {
  // task_no LIKE 'A-260514-%' 등
  const pattern = `${prefix}${yymmdd}-%`;
  const { count, error } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", TENANT_ID)
    .like("task_no", pattern);
  if (error) {
    console.warn(`[taskNoGenerator] count 실패 (pattern=${pattern})`, error);
    return 0;
  }
  return count || 0;
}

// ============================================================
// 메인 함수 — principalCode 또는 principalName 박힌 케이스 둘 다 catch
// ============================================================
// 입력: { principalCode?: string, principalName?: string }
// 응답: { ok: true, taskNo, prefix, principalCode } | { ok: false, error }
export async function generateTaskNo({ principalCode, principalName } = {}) {
  let prefix;
  let resolvedCode = principalCode || null;

  if (principalCode) {
    prefix = await _getPrefixByCode(principalCode);
  } else if (principalName) {
    const r = await _getPrefixByName(principalName);
    prefix = r.prefix;
    resolvedCode = r.code;
  } else {
    return { ok: false, error: "principalCode / principalName 둘 다 없음" };
  }

  const yymmdd = todayYymmdd();
  const count = await _countTasksForToday(prefix, yymmdd);
  const seq = String(count + 1).padStart(3, "0");
  const taskNo = `${prefix}${yymmdd}-${seq}`;

  return { ok: true, taskNo, prefix, principalCode: resolvedCode };
}

// ============================================================
// 2026-05-23 — 일괄 측 측 (CSV 업로드 측 N개 task_no 측 시점 측 측)
// ============================================================
// generateTaskNo 측 측 호출 측 — 측 측 측 측 같은 count 측 catch (race condition).
// 측 시작 시 1회 count → 측 시점 측 += i 측 측 측 측 측 일관 측.
//
// 입력: principalCode (예: "usol_n") + count (생성할 task_no 개수)
// 응답: { ok: true, taskNos: ["YS-N-260523-001", ...], prefix, yymmdd } | { ok: false, error }
export async function generateTaskNosBulk(principalCode, count) {
  if (!principalCode) return { ok: false, error: "principalCode 측 X" };
  if (!Number.isInteger(count) || count <= 0) return { ok: false, error: "count 측 측 측 측" };

  const prefix = await _getPrefixByCode(principalCode);
  if (prefix === "?-") return { ok: false, error: `prefix lookup 실패 (code=${principalCode})` };

  const yymmdd = todayYymmdd();
  const existingCount = await _countTasksForToday(prefix, yymmdd);
  const taskNos = Array.from({ length: count }, (_, i) =>
    `${prefix}${yymmdd}-${String(existingCount + 1 + i).padStart(3, "0")}`
  );

  return { ok: true, taskNos, prefix, yymmdd };
}
