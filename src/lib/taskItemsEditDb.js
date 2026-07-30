// 2026-06-28 — 운영자 작업 견적 항목 수정/추가 RPC wrapper (Mig 153).
//   2 RPC + 보조 fetch:
//     · adminUpdateTaskItem (qty/unit_price 수정)
//     · adminInsertTaskItem (정책 매칭 검증 포함 — policy_not_found 거부)
//     · fetchPickerOptions  (work_types + appliance_types + service_types) — 추가 모달용
//
//   2026-07-30 — Mig 201 추가:
//     · adminChangeTaskItemType     (종목 변경 — 정책 검증 + 정산 재계산)
//     · adminRemoveTaskItem         (오입력 삭제 — 진짜 DELETE)
//     · previewTaskItemTypeChange   (저장 전 기사 몫 미리보기, 읽기 전용)
//
//   ⚠️ p_actor = user.user_id (하드코딩 X).
//   ⚠️ note 5자 이상 (서버 검증). 클라도 같이 가드.

import { supabase } from "./supabase.js";

// 수정 — qty/unit_price (둘 다 또는 한쪽). 트리거가 compute_payment 자동.
//   응답: { ok, taskId } | { ok:false, error }
export async function adminUpdateTaskItem({ actorId, itemId, qty, unitPrice, note }) {
  if (!actorId) return { ok: false, error: "actorId 누락" };
  if (!itemId)  return { ok: false, error: "itemId 누락" };
  if (!note || String(note).trim().length < 5) {
    return { ok: false, error: "변경 사유 5자 이상 필수" };
  }
  const { data, error } = await supabase.rpc("admin_update_task_item", {
    p_actor:      actorId,
    p_item_id:    itemId,
    p_qty:        qty,
    p_unit_price: unitPrice,
    p_note:       String(note).trim(),
  });
  if (error) {
    console.error("[taskItemsEditDb.update]", error);
    return { ok: false, error: error.message || "수정 실패" };
  }
  if (data && data.ok === false) {
    return { ok: false, error: data.error || "수정 실패" };
  }
  return { ok: true, taskId: data?.task_id };
}

// 추가 — 정책 검증 통과 시만 INSERT.
//   응답: { ok, itemId, taskId } | { ok:false, error, detail? }
export async function adminInsertTaskItem({
  actorId, taskId, workTypeId, applianceTypeId,
  qty, unitPrice, orderType, note,
}) {
  if (!actorId)    return { ok: false, error: "actorId 누락" };
  if (!taskId)     return { ok: false, error: "taskId 누락" };
  if (!workTypeId) return { ok: false, error: "work_type 선택 필수" };
  if (!note || String(note).trim().length < 5) {
    return { ok: false, error: "변경 사유 5자 이상 필수" };
  }
  if (qty == null || Number(qty) <= 0) {
    return { ok: false, error: "qty > 0 필수" };
  }
  if (unitPrice == null || Number(unitPrice) < 0) {
    return { ok: false, error: "unit_price >= 0 필수" };
  }
  const { data, error } = await supabase.rpc("admin_insert_task_item", {
    p_actor:             actorId,
    p_task_id:           taskId,
    p_work_type_id:      workTypeId,
    p_appliance_type_id: applianceTypeId || null,
    p_qty:               Number(qty),
    p_unit_price:        Number(unitPrice),
    p_order_type:        orderType || null,
    p_note:              String(note).trim(),
  });
  if (error) {
    console.error("[taskItemsEditDb.insert]", error);
    return { ok: false, error: error.message || "추가 실패" };
  }
  if (data && data.ok === false) {
    return {
      ok: false,
      error: data.error || "추가 실패",
      detail: data.detail || null,
    };
  }
  return { ok: true, itemId: data?.item_id, taskId: data?.task_id };
}

// ────────────────────────────────────────────────────────────────
// 2026-07-30 — Mig 201: 종목(work_type) 변경 + 오입력 항목 삭제.
//
//   ⚠️ 종목이 바뀌면 정산 분배율이 통째로 바뀐다 (세척/설치/수리/냉매/누수).
//      그래서 서버가 compute_payment 를 다시 돌린다.
//   ⚠️ 완료·취소된 작업은 서버에서 거부한다 (사장님 결정 2026-07-30).
// ────────────────────────────────────────────────────────────────

// 종목 변경 — work_type + 기종 (+ 선택적으로 qty/단가 동시 수정).
//   qty / unitPrice 를 안 넘기면(null) 기존 값 그대로.
//   응답: { ok, itemId, taskId, oldService, newService } | { ok:false, error, detail? }
export async function adminChangeTaskItemType({
  actorId, itemId, workTypeId, applianceTypeId, qty, unitPrice, note,
}) {
  if (!actorId)    return { ok: false, error: "actorId 누락" };
  if (!itemId)     return { ok: false, error: "itemId 누락" };
  if (!workTypeId) return { ok: false, error: "작업 종류 선택 필수" };
  if (!note || String(note).trim().length < 5) {
    return { ok: false, error: "변경 사유 5자 이상 필수" };
  }
  const { data, error } = await supabase.rpc("admin_change_task_item_type", {
    p_actor:             actorId,
    p_item_id:           itemId,
    p_work_type_id:      workTypeId,
    p_appliance_type_id: applianceTypeId || null,
    p_qty:               qty       == null ? null : Number(qty),
    p_unit_price:        unitPrice == null ? null : Number(unitPrice),
    p_note:              String(note).trim(),
  });
  if (error) {
    console.error("[taskItemsEditDb.changeType]", error);
    return { ok: false, error: error.message || "종목 변경 실패" };
  }
  if (data && data.ok === false) {
    return { ok: false, error: data.error || "종목 변경 실패", detail: data.detail || null };
  }
  return {
    ok: true,
    itemId:     data?.item_id,
    taskId:     data?.task_id,
    oldService: data?.old_service,
    newService: data?.new_service,
  };
}

// 오입력 항목 삭제 — 진짜 DELETE. 되돌리기 없음 (이력에만 남음).
//   ⚠️ ◐ 부분 취소와 다르다. 부분취소 = 실제로 안 한 작업 / 삭제 = 잘못 넣은 줄.
//   마지막 남은 1개는 서버가 거부한다 (그건 작업 취소로).
//   응답: { ok, taskId, remaining } | { ok:false, error }
export async function adminRemoveTaskItem({ actorId, itemId, note }) {
  if (!actorId) return { ok: false, error: "actorId 누락" };
  if (!itemId)  return { ok: false, error: "itemId 누락" };
  if (!note || String(note).trim().length < 5) {
    return { ok: false, error: "삭제 사유 5자 이상 필수" };
  }
  const { data, error } = await supabase.rpc("admin_remove_task_item", {
    p_actor:   actorId,
    p_item_id: itemId,
    p_note:    String(note).trim(),
  });
  if (error) {
    console.error("[taskItemsEditDb.remove]", error);
    return { ok: false, error: error.message || "삭제 실패" };
  }
  if (data && data.ok === false) {
    return { ok: false, error: data.error || "삭제 실패" };
  }
  return { ok: true, taskId: data?.task_id, remaining: data?.remaining };
}

// 저장 전 미리보기 — "기사 몫 얼마 → 얼마". 읽기 전용, 아무것도 안 바꾼다.
//   이 항목 하나 기준 개략치 (자재비 우선공제 · 출장비 제외).
//   응답: { ok, old:{service,amount,engineer,company,ok}, new:{...} } | { ok:false, error }
export async function previewTaskItemTypeChange({
  actorId, itemId, workTypeId, applianceTypeId, qty, unitPrice,
}) {
  if (!actorId || !itemId || !workTypeId) return { ok: false, error: "인자 부족" };
  const { data, error } = await supabase.rpc("preview_task_item_type_change", {
    p_actor:             actorId,
    p_item_id:           itemId,
    p_work_type_id:      workTypeId,
    p_appliance_type_id: applianceTypeId || null,
    p_qty:               qty       == null ? null : Number(qty),
    p_unit_price:        unitPrice == null ? null : Number(unitPrice),
  });
  if (error) {
    console.error("[taskItemsEditDb.preview]", error);
    return { ok: false, error: error.message || "미리보기 실패" };
  }
  if (data && data.ok === false) return { ok: false, error: data.error || "미리보기 실패" };
  return { ok: true, old: data?.old || null, new: data?.new || null };
}

// 추가 모달용 — service_types / work_types / appliance_types 일괄 fetch.
//   anon SELECT 허용 가정 (소형 마스터 데이터). 1회 fetch 후 재사용 권장.
//   응답: { ok, serviceTypes, workTypes, applianceTypes } | { ok:false, error }
export async function fetchPickerOptions() {
  try {
    const [stRes, wtRes, atRes] = await Promise.all([
      supabase.from("service_types").select("id, code, name").order("name"),
      supabase.from("work_types").select("id, code, name, service_type_id, appliance_type_id, default_unit_price").order("name"),
      supabase.from("appliance_types").select("id, code, name").order("name"),
    ]);
    if (stRes.error) throw stRes.error;
    if (wtRes.error) throw wtRes.error;
    if (atRes.error) throw atRes.error;
    return {
      ok: true,
      serviceTypes:   stRes.data || [],
      workTypes:      wtRes.data || [],
      applianceTypes: atRes.data || [],
    };
  } catch (e) {
    console.error("[taskItemsEditDb.fetchPickerOptions]", e);
    return { ok: false, error: e.message || "옵션 fetch 실패" };
  }
}
