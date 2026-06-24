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
export const SERVICE_LABEL = {
  refrigerant: "냉매충전",
  cleaning:    "분해세척",
  repair:      "수리·누설수리",
  install:     "에어컨 설치",
  unknown:     "미정",
};

export function serviceLabel(code) {
  return SERVICE_LABEL[code] || code || "미정";
}

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

export async function setInquiryStatus(actorId, inquiryId, status) {
  if (!actorId)   throw new Error("actorId required");
  if (!inquiryId) throw new Error("inquiryId required");
  const allowed = ["new", "contacted", "spam"];
  if (!allowed.includes(status)) throw new Error("status must be one of " + allowed.join("/"));
  const { error } = await supabase.rpc("set_inquiry_status", {
    p_actor:      actorId,
    p_inquiry_id: inquiryId,
    p_status:     status,
  });
  if (error) throw error;
}

// 인콰이리 → 빈 작업(미배정/금액0) 생성 + inquiry converted 처리. (Migration 118)
// 'new' / 'contacted' 만 전환 가능. 이미 converted/spam 이면 'inquiry_not_convertible' throw.
// 반환: 새 task_id (uuid)
export async function convertInquiryToTask(actorId, inquiryId) {
  if (!actorId)   throw new Error("actorId required");
  if (!inquiryId) throw new Error("inquiryId required");
  const { data, error } = await supabase.rpc("convert_inquiry_to_task", {
    p_actor:      actorId,
    p_inquiry_id: inquiryId,
  });
  if (error) throw error;
  return data; // uuid
}
