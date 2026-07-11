// src/lib/inquiriesDb.js
// 홈페이지 접수 폼(inquiries) 운영자 측 읽기/액션 RPC wrapper + 매핑 상수.
// AdminApp 의 "접수함" 탭 + 추후 HappycallApp 공용 재사용.
//
// 권한: list_inquiries / set_inquiry_status 둘 다 _caller_is_admin 통과자만.
//       호출자(actorId)는 user.user_id (uuid).
//
// DB 측 — db/migrations 외부에서 사장님이 별도 배포 (117_inquiries.sql).
//   list_inquiries(p_actor uuid, p_status text)        → SETOF inquiries
//   set_inquiry_status(p_actor uuid, p_inquiry_id uuid, p_status text)
//     · 허용 상태: 'new' / 'contacted' / 'spam'

import { supabase } from "./supabase";

// service_type 코드 → 손님 표시 한글 (중앙화 — 랜딩 SERVICE_CODE 의 역방향).
// 2026-07-11 — 사장님 spec: unknown 라벨을 "잘 모르겠어요(방문진단)" 로 명확화.
export const SERVICE_LABEL = {
  refrigerant: "냉매충전",
  cleaning:    "분해세척",
  repair:      "수리·누설수리",
  install:     "에어컨 설치",
  unknown:     "잘 모르겠어요(방문진단)",
};

export function serviceLabel(code) {
  return SERVICE_LABEL[code] || code || "미정";
}

// service_type 코드 → ServiceTypeIcon 의 workType (startsWith 매칭용).
//   "분해세척" → "세척" / "수리·누설수리" → "수리" 등으로 짧게 통일.
//   ⚠️ getServiceKind 의 _kindFromServiceCode 는 cleaning/refrigerant/install/leak 만 매핑 —
//      repair/unknown 갭 차단용 매핑 (사장님 spec A안).
export const SERVICE_WORKTYPE = {
  refrigerant: "냉매충전",
  cleaning:    "세척",
  repair:      "수리",
  install:     "설치",
  unknown:     "",
};

// 상태 → 한글 라벨 + 표시 색 (사장님 spec: 신규 빨강 / 통화함 파랑 / 스팸 회색 / 전환됨 초록).
export const INQUIRY_STATUS = {
  new:       { label: "신규",   color: "#DC2626", bg: "#FDECEC" },
  contacted: { label: "통화함", color: "#2563EB", bg: "#EAF2FB" },
  spam:      { label: "스팸",   color: "#6B7280", bg: "#EEF1F4" },
  converted: { label: "전환됨", color: "#16A34A", bg: "#E6F4EB" },
};

export function statusMeta(code) {
  return INQUIRY_STATUS[code] || { label: code || "?", color: "#4A5A70", bg: "#F2F5F9" };
}

// p_status NULL → 전체 / 'new'·'contacted'·'spam'·'converted' 별 필터.
export async function listInquiries(actorId, status = null) {
  if (!actorId) throw new Error("actorId required");
  const { data, error } = await supabase.rpc("list_inquiries", {
    p_actor:  actorId,
    p_status: status,
  });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// 2026-07-11 — spamReason 옵션 (Mig 170). status='spam' 시에만 저장, 그 외 무시.
export async function setInquiryStatus(actorId, inquiryId, status, spamReason = null) {
  if (!actorId)   throw new Error("actorId required");
  if (!inquiryId) throw new Error("inquiryId required");
  const allowed = ["new", "contacted", "spam"];
  if (!allowed.includes(status)) throw new Error("status must be one of " + allowed.join("/"));
  const { error } = await supabase.rpc("set_inquiry_status", {
    p_actor:       actorId,
    p_inquiry_id:  inquiryId,
    p_status:      status,
    p_spam_reason: status === "spam" ? (spamReason || null) : null,
  });
  if (error) throw error;
}

// 2026-07-11 — 빠른 선택 사유 (사장님 spec). 자유 텍스트도 허용.
export const SPAM_REASON_PRESETS = [
  "장난·허위",
  "광고·스팸문자",
  "중복접수",
  "타지역·서비스불가",
  "연락두절",
];

// 2026-07-10 — 스팸 문의 영구 삭제 (Mig 169).
//   조건: status='spam' + task_id IS NULL (converted 실데이터는 삭제 불가).
//   응답: { ok: true, deleted: true } or { ok: false, error }.
export async function deleteInquiry(actorId, inquiryId) {
  if (!actorId)   throw new Error("actorId required");
  if (!inquiryId) throw new Error("inquiryId required");
  const { data, error } = await supabase.rpc("delete_inquiry", {
    p_actor:      actorId,
    p_inquiry_id: inquiryId,
  });
  if (error) throw error;
  return data || { ok: false, error: "unknown" };
}

// 인콰이리 → 작업 생성 후 마킹 (best-effort).
//   Migration 118(convert_inquiry_to_task) 은 폐기됨 — 호출 금지.
//   대신: 운영자가 "새 접수 폼"을 prefill 로 채워 등록 → apiCreateTask 성공 후 이 함수 호출.
//   실패해도 작업은 살림 — 호출자 catch 로 콘솔 경고만 (사용자 흐름 막지 X).
export async function markInquiryConverted(actorId, inquiryId, taskId) {
  if (!actorId)   throw new Error("actorId required");
  if (!inquiryId) throw new Error("inquiryId required");
  if (!taskId)    throw new Error("taskId required");
  const { error } = await supabase.rpc("mark_inquiry_converted", {
    p_actor:      actorId,
    p_inquiry_id: inquiryId,
    p_task_id:    taskId,
  });
  if (error) throw error;
}
