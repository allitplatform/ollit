// Phase 5 — 기사 → 회사 송금 (engineer remittance) DB 모듈
// Migration 025 박은 spec — payments 측 3개 컬럼 박음:
//   · engineer_remitted_at         (기사 "입금 완료 보고" 일시)
//   · engineer_remit_confirmed_at  (운영자 "확인 완료" 일시)
//   · engineer_remit_confirmed_by  (확인한 운영자 user_id)
//
// 흐름:
//   1. 기사 PWA   — reportEngineerRemit(taskIds)  → engineer_remitted_at 박음
//   2. 운영자 PWA — listPendingRemits()           → 확인 대기 목록 박음
//   3. 운영자 PWA — confirmEngineerRemit(taskIds, adminUserId) → 확인 완료 박음
//   (옵션)        — cancelEngineerRemit(taskIds) → 기사 보고 취소 (확인 박힘 측 박지 X)

import { supabase } from "./supabase.js";

// ============================================
// 1) 기사 "입금 완료 보고" (회사 송금 — taskIds 일괄)
// ============================================
export async function reportEngineerRemit(taskIds) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return { ok: false, error: "taskIds 없음" };
  }

  const { error } = await supabase
    .from("payments")
    .update({ engineer_remitted_at: new Date().toISOString() })
    .in("task_id", taskIds);

  if (error) {
    console.error("[reportEngineerRemit] 실패:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, count: taskIds.length };
}

// ============================================
// 1-B) 2026-05-25 — 기사 "유솔 입금 완료 보고" (Migration 077 — usol_remitted_at)
// ============================================
//   회사 송금 reportEngineerRemit 와 동일 방식 — payments_anon_update 정책으로 통과.
//   확인(운영자/유솔) 단계 없음 — 기사 self-report. taskIds 일괄 UPDATE.
export async function reportUsolRemit(taskIds) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return { ok: false, error: "taskIds 없음" };
  }

  const { error } = await supabase
    .from("payments")
    .update({ usol_remitted_at: new Date().toISOString() })
    .in("task_id", taskIds);

  if (error) {
    console.error("[reportUsolRemit] 실패:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, count: taskIds.length };
}

// ============================================
// 2) 운영자 "확인 완료" 박음 (taskIds 일괄)
// ============================================
export async function confirmEngineerRemit(taskIds, adminUserId) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return { ok: false, error: "taskIds 없음" };
  }
  if (!adminUserId) {
    return { ok: false, error: "adminUserId 없음" };
  }

  const { error } = await supabase
    .from("payments")
    .update({
      engineer_remit_confirmed_at: new Date().toISOString(),
      engineer_remit_confirmed_by: adminUserId,
    })
    .in("task_id", taskIds);

  if (error) {
    console.error("[confirmEngineerRemit] 박지 X:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, count: taskIds.length };
}

// ============================================
// 3) 운영자 "확인 대기" 목록 박음 (engineer_remitted_at IS NOT NULL AND engineer_remit_confirmed_at IS NULL)
// ============================================
export async function listPendingRemits() {
  const { data, error } = await supabase
    .from("payments")
    .select(`
      task_id,
      engineer_amount,
      principal_amount,
      owner_amount,
      engineer_remitted_at,
      tasks!inner (
        id,
        task_no,
        customer_name,
        assigned_engineer_id,
        completed_at,
        status,
        principal_id
      )
    `)
    .not("engineer_remitted_at", "is", null)
    .is("engineer_remit_confirmed_at", null)
    .order("engineer_remitted_at", { ascending: true });

  if (error) {
    console.error("[listPendingRemits] 박지 X:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, items: data || [] };
}

// ============================================
// 4) 기사 보고 취소 (옵션) — 운영자 확인 완료 row는 건드리지 않음
// ============================================
export async function cancelEngineerRemit(taskIds) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return { ok: false, error: "taskIds 없음" };
  }

  const { error } = await supabase
    .from("payments")
    .update({ engineer_remitted_at: null })
    .in("task_id", taskIds)
    .is("engineer_remit_confirmed_at", null);

  if (error) {
    console.error("[cancelEngineerRemit] 실패:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// ============================================
// 5) 2026-05-22 — 운영자 "확인 완료" 취소 (confirmed → reported 복귀)
// engineer_remit_confirmed_at / engineer_remit_confirmed_by 만 NULL,
// engineer_remitted_at(기사 보고 시각)은 유지 → 상태가 reported 로 회귀.
// 사장님 실수 정정 용도 — 호출처에서 confirm dialog 권장.
// ============================================
export async function cancelConfirmRemit(taskIds) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return { ok: false, error: "taskIds 없음" };
  }

  const { error } = await supabase
    .from("payments")
    .update({
      engineer_remit_confirmed_at: null,
      engineer_remit_confirmed_by: null,
    })
    .in("task_id", taskIds);

  if (error) {
    console.error("[cancelConfirmRemit] 실패:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, count: taskIds.length };
}
