// 2026-06-06 — update_task_basic RPC wrapper (Mig 099).
//   원청/운영자가 작업 상세 측 5 컬럼만 편집 (phone/address/customer_name/scheduled_at/request_note).
//   정산·배정 컬럼 절대 X (RPC 측 강제).
//
// 권한 (서버 측 검증):
//   owner/admin/operator → 전체 task
//   partner              → 자기 principal_id task 만
//   그 외                → 거부 (role_not_allowed)
//
// 호출 spec:
//   const res = await updateTaskBasic({
//     taskId, phone, address, customerName, scheduledAt, requestNote, actor,
//   });
//   res.ok === true  → 성공
//   res.ok === false → res.error: phone_required | address_required | task_not_found |
//                                 actor_role_not_found | principal_mismatch | role_not_allowed
//
// scheduledAt 측 ISO 문자열 (KST→UTC 변환 후) 또는 null. 변환은 호출처 책임.

import { supabase } from "./supabase.js";

export async function updateTaskBasic({
  taskId,
  phone,
  address,
  customerName = "",
  scheduledAt  = null,    // ISO timestamptz (UTC) 또는 null
  requestNote  = "",
  actor,                  // 현재 로그인 user 의 UUID
} = {}) {
  if (!taskId)  return { ok: false, error: "taskId_required" };
  if (!actor)   return { ok: false, error: "actor_required" };

  const { data, error } = await supabase.rpc("update_task_basic", {
    p_task_id:       taskId,
    p_phone:         phone || "",
    p_address:       address || "",
    p_customer_name: customerName || "",
    p_scheduled_at:  scheduledAt,
    p_request_note:  requestNote || "",
    p_actor:         actor,
  });

  if (error) {
    console.error("[updateTaskBasic] rpc error:", error);
    return { ok: false, error: error.message || "rpc_error" };
  }
  // RPC 측 jsonb { ok, error } 반환
  return data || { ok: false, error: "empty_response" };
}

// 에러 코드 → 한국어 사용자 메시지
export function describeTaskBasicError(code) {
  switch (code) {
    case "task_not_found":     return "작업을 찾을 수 없어요.";
    case "actor_role_not_found": return "권한 정보를 찾을 수 없어요. 다시 로그인해주세요.";
    case "role_not_allowed":   return "이 작업을 수정할 권한이 없어요.";
    case "principal_mismatch": return "다른 원청의 작업은 수정할 수 없어요.";
    case "phone_required":     return "연락처를 입력해주세요.";
    case "address_required":   return "주소를 입력해주세요.";
    case "taskId_required":    return "작업 정보가 없어요.";
    case "actor_required":     return "로그인 정보가 없어요. 다시 로그인해주세요.";
    default:                    return code || "수정 실패";
  }
}

// ─── KST ↔ UTC 변환 (scheduled_at timestamptz) ─────────────────
//   사장님 입력은 KST 시각. RPC 측 timestamptz (UTC) 로 보내야.
//   date = 'YYYY-MM-DD' / time = 'HH:MM' (또는 빈 문자열 — 00:00 가정).

export function kstYmdHmToUtcIso(date, time) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const t = (time && /^\d{2}:\d{2}/.test(time)) ? time.slice(0, 5) : "00:00";
  // `${YYYY-MM-DD}T${HH:MM}:00+09:00` → Date 측 KST 인식 → toISOString = UTC.
  const d = new Date(`${date}T${t}:00+09:00`);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function utcIsoToKstDateTime(iso) {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: "", time: "" };
  // en-CA = YYYY-MM-DD, en-GB = 24-hour. Asia/Seoul 명시.
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
  return { date, time };
}
