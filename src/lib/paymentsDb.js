// Phase 5 — 기사 → 회사 송금 (engineer remittance) DB 모듈
// Migration 025 — payments 3개 컬럼 추가:
//   · engineer_remitted_at         (기사 "입금 완료 보고" 일시)
//   · engineer_remit_confirmed_at  (운영자 "확인 완료" 일시)
//   · engineer_remit_confirmed_by  (확인한 운영자 user_id)
//
// 흐름:
//   1. 기사 PWA   — reportEngineerRemit(taskIds)  → engineer_remitted_at 기록
//   2. 운영자 PWA — listPendingRemits()           → 확인 대기 목록 조회
//   3. 운영자 PWA — confirmEngineerRemitWithCashflow(taskIds, actor)
//        → 확인 완료 + 통장 자동 IN (Mig 156, source='auto_engineer_remit')
//   (옵션)        — cancelEngineerRemit(taskIds) → 기사 보고 취소 (확인된 row 는 영향 X)
//
// 2026-06-29 — Mig 156 도입: confirm 시점에 cashflow 자동 IN.
//   · 신규: confirmEngineerRemitWithCashflow / cancelConfirmEngineerRemitWithCashflow (RPC).
//   · 옛: confirmEngineerRemit / cancelConfirmRemit — Deprecated.
//        호출처(AdminApp.jsx / AdminPcRemitInbox.jsx) 모두 새 함수로 전환 완료.
//        과거 호환·운영 사고 정정 용도로 남겨두나 신규 사용 금지.

import { supabase } from "./supabase.js";

// 2026-06-01 — task_id 배치 chunk (URL 길이 / 요청 크기 한계 회피).
const TASK_ID_CHUNK = 300;

// ============================================
// 1) 기사 "입금 완료 보고" (회사 송금 — taskIds 일괄)
// ============================================
export async function reportEngineerRemit(taskIds) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return { ok: false, error: "taskIds 없음" };
  }
  const ts = new Date().toISOString();
  let okCount = 0;
  for (let i = 0; i < taskIds.length; i += TASK_ID_CHUNK) {
    const chunk = taskIds.slice(i, i + TASK_ID_CHUNK);
    const { error } = await supabase
      .from("payments")
      .update({ engineer_remitted_at: ts })
      .in("task_id", chunk);
    if (error) {
      console.error("[reportEngineerRemit] 실패 chunk", i, error);
      return { ok: false, error: error.message, count: okCount };
    }
    okCount += chunk.length;
  }
  return { ok: true, count: okCount };
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
  const ts = new Date().toISOString();
  let okCount = 0;
  for (let i = 0; i < taskIds.length; i += TASK_ID_CHUNK) {
    const chunk = taskIds.slice(i, i + TASK_ID_CHUNK);
    const { error } = await supabase
      .from("payments")
      .update({ usol_remitted_at: ts })
      .in("task_id", chunk);
    if (error) {
      console.error("[reportUsolRemit] 실패 chunk", i, error);
      return { ok: false, error: error.message, count: okCount };
    }
    okCount += chunk.length;
  }
  return { ok: true, count: okCount };
}

// ============================================
// 2) 운영자 "확인 완료" 기록 (taskIds 일괄)
// ============================================
// @deprecated 2026-06-29 — Mig 156 도입 후 confirmEngineerRemitWithCashflow 사용.
//   이 함수는 cashflow 자동 IN 을 만들지 않음. 운영 사고 정정 용도로만 남김.
//   호출처(AdminApp.jsx 모바일 정산 / AdminPcRemitInbox.jsx) 전환 완료.
export async function confirmEngineerRemit(taskIds, adminUserId) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return { ok: false, error: "taskIds 없음" };
  }
  if (!adminUserId) {
    return { ok: false, error: "adminUserId 없음" };
  }
  const ts = new Date().toISOString();
  let okCount = 0;
  for (let i = 0; i < taskIds.length; i += TASK_ID_CHUNK) {
    const chunk = taskIds.slice(i, i + TASK_ID_CHUNK);
    const { error } = await supabase
      .from("payments")
      .update({
        engineer_remit_confirmed_at: ts,
        engineer_remit_confirmed_by: adminUserId,
      })
      .in("task_id", chunk);
    if (error) {
      console.error("[confirmEngineerRemit] 실패 chunk", i, error);
      return { ok: false, error: error.message, count: okCount };
    }
    okCount += chunk.length;
  }
  return { ok: true, count: okCount };
}

// ============================================
// 3) 운영자 "확인 대기" 목록 조회 (engineer_remitted_at IS NOT NULL AND engineer_remit_confirmed_at IS NULL)
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
    console.error("[listPendingRemits] 조회 실패:", error);
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
  for (let i = 0; i < taskIds.length; i += TASK_ID_CHUNK) {
    const chunk = taskIds.slice(i, i + TASK_ID_CHUNK);
    const { error } = await supabase
      .from("payments")
      .update({ engineer_remitted_at: null })
      .in("task_id", chunk)
      .is("engineer_remit_confirmed_at", null);
    if (error) {
      console.error("[cancelEngineerRemit] 실패 chunk", i, error);
      return { ok: false, error: error.message };
    }
  }
  return { ok: true };
}

// ============================================
// 5) 2026-05-22 — 운영자 "확인 완료" 취소 (confirmed → reported 복귀)
// engineer_remit_confirmed_at / engineer_remit_confirmed_by 만 NULL,
// engineer_remitted_at(기사 보고 시각)은 유지 → 상태가 reported 로 회귀.
// 사장님 실수 정정 용도 — 호출처에서 confirm dialog 권장.
// ============================================
// @deprecated 2026-06-29 — Mig 156 도입 후 cancelConfirmEngineerRemitWithCashflow 사용.
//   이 함수는 cashflow 자동 IN row 를 정리하지 않아 잔고 불일치 위험.
//   호출처(AdminApp.jsx 모바일 정산 / AdminPcRemitInbox.jsx) 전환 완료.
export async function cancelConfirmRemit(taskIds) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return { ok: false, error: "taskIds 없음" };
  }
  let okCount = 0;
  for (let i = 0; i < taskIds.length; i += TASK_ID_CHUNK) {
    const chunk = taskIds.slice(i, i + TASK_ID_CHUNK);
    const { error } = await supabase
      .from("payments")
      .update({
        engineer_remit_confirmed_at: null,
        engineer_remit_confirmed_by: null,
      })
      .in("task_id", chunk);
    if (error) {
      console.error("[cancelConfirmRemit] 실패 chunk", i, error);
      return { ok: false, error: error.message, count: okCount };
    }
    okCount += chunk.length;
  }
  return { ok: true, count: okCount };
}

// ============================================
// 6) 2026-06-29 — Mig 156: 운영자 "확인 완료" + 통장 자동 IN (RPC)
// ============================================
// 확인과 동시에 bookkeeping_cashflow 에 IN row 자동 INSERT.
// 송금액 = product_price + extra_fee + travel_fee − engineer_amount
//        = principal_amount + owner_amount (= remitFilter.calcRemitAmount 동일).
// 0원 송금건은 INSERT skip (직영기사 100% / 유솔H 냉매 등).
// 멱등성: (source='auto_engineer_remit', source_ref=task_id) UNIQUE — 재호출 안전.
//
// 반환: { ok, confirmed_count, cashflow_count, skipped_zero, errors[] }
//   · confirmed_count = payments UPDATE 된 task 수 (이미 confirmed 면 skip)
//   · cashflow_count  = 통장 IN 자동 INSERT 된 row 수
//   · skipped_zero    = 0원이라 cashflow INSERT 안 한 수
//   · errors[]        = 누락/에러 task 목록 (payment 없음 / 이미 confirmed 등)
export async function confirmEngineerRemitWithCashflow(taskIds, actor) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return { ok: false, error: "taskIds 없음" };
  }
  if (!actor) {
    return { ok: false, error: "actor 없음" };
  }
  const { data, error } = await supabase.rpc("confirm_engineer_remit_with_cashflow", {
    p_task_ids: taskIds,
    p_actor:    actor,
  });
  if (error) {
    console.error("[confirmEngineerRemitWithCashflow] RPC 실패", error);
    return { ok: false, error: error.message };
  }
  return data || { ok: false, error: "rpc_empty" };
}

// ============================================
// 7) 2026-06-29 — Mig 156: 확인 취소 + 통장 자동 IN row DELETE (RPC)
// ============================================
// confirm 시점에 INSERT 된 cashflow row 를 (source, source_ref) 키로 찾아 DELETE.
// 수동 입력(source NULL)은 영향 없음.
//
// 반환: { ok, cancelled_count, deleted_count }
//   · cancelled_count = payments UPDATE 된 수 (confirmed → null)
//   · deleted_count   = 통장에서 DELETE 된 자동 IN row 수
export async function cancelConfirmEngineerRemitWithCashflow(taskIds, actor) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return { ok: false, error: "taskIds 없음" };
  }
  if (!actor) {
    return { ok: false, error: "actor 없음" };
  }
  const { data, error } = await supabase.rpc("cancel_confirm_engineer_remit_with_cashflow", {
    p_task_ids: taskIds,
    p_actor:    actor,
  });
  if (error) {
    console.error("[cancelConfirmEngineerRemitWithCashflow] RPC 실패", error);
    return { ok: false, error: error.message };
  }
  return data || { ok: false, error: "rpc_empty" };
}
