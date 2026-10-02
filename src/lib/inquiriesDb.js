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
  // 2026-07-28 — 종목 개편: 누설/누수 분리 (repair 는 옛 접수 행 표시용 유지)
  leak:        "냉매 누설",
  water_leak:  "물 누수",
  install:     "에어컨 설치",
  unknown:     "잘 모르겠어요(방문진단)",
};

export function serviceLabel(code) {
  return SERVICE_LABEL[code] || code || "미정";
}

// 2026-09-28 — 입주청소 랜딩(public/ipju.html) 접수 판별.
//   service_type 은 허용 목록 때문에 'unknown' 으로 들어오고, 입주청소 구분은 source 로만 한다.
//   source 형식: ipju_landing_top/32py/new/2026-11-05/am  (평수 0py · 주택상태 na · 날짜 nodate · 시간대 any 는 미입력)
//   2026-09-28 — 5번째 칸(시간대) 추가. 예전 4칸 형식 접수도 그대로 풀림.
export function isIpjuSource(source) {
  return String(source || "").startsWith("ipju_landing");
}
const IPJU_HOUSE = { new: "신축", old: "구축", etc: "상태 모름" };
const IPJU_TIME  = { am: "오전", pm: "오후" };
// → "32평 · 신축 · 희망일 11/5 오전" (입력 안 된 항목은 생략). 입주청소 접수가 아니면 "".
export function ipjuDetail(source) {
  if (!isIpjuSource(source)) return "";
  const [, py = "", house = "", date = "", time = ""] = String(source).split("/");
  const out = [];
  const pyNum = parseInt(py, 10);
  if (pyNum > 0) out.push(pyNum + "평");
  if (IPJU_HOUSE[house]) out.push(IPJU_HOUSE[house]);
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(date);
  const tm = IPJU_TIME[time] || "";
  if (m) out.push("희망일 " + Number(m[1]) + "/" + Number(m[2]) + (tm ? " " + tm : ""));
  else if (tm) out.push("희망 " + tm);
  return out.join(" · ");
}
// 2026-10-02 — 주방후드 랜딩(public/hood.html) 접수 판별. 입주청소와 같은 방식 (service_type 은 'unknown').
//   source 형식: hood_landing_top/home/1ea/2026-10-10/am  (대수 1ea · 날짜 nodate · 시간대 any 는 생략)
export function isHoodSource(source) {
  return String(source || "").startsWith("hood_landing");
}
// 2026-10-02 — 추가 서비스 3종 (restaurant · store · office). 배지는 그대로 "주방후드".
const HOOD_KIND = {
  home: "가정용 청소", biz: "업소용 청소", install: "후드 설치",
  restaurant: "식당 청소", store: "매장 정기관리", office: "사무실 · 바닥",
};
const HOOD_QTY  = { "2ea": "2대", "3ea": "3대 이상" };
// → "업소용 청소 · 2대 · 희망일 10/10 오후" (입력 안 된 항목은 생략). 주방후드 접수가 아니면 "".
export function hoodDetail(source) {
  if (!isHoodSource(source)) return "";
  const [, kind = "", qty = "", date = "", time = ""] = String(source).split("/");
  const out = [];
  if (HOOD_KIND[kind]) out.push(HOOD_KIND[kind]);
  if (HOOD_QTY[qty]) out.push(HOOD_QTY[qty]);
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(date);
  const tm = IPJU_TIME[time] || "";
  if (m) out.push("희망일 " + Number(m[1]) + "/" + Number(m[2]) + (tm ? " " + tm : ""));
  else if (tm) out.push("희망 " + tm);
  return out.join(" · ");
}
// 랜딩 접수 풀이 공통 — 입주청소·주방후드 중 해당하는 쪽. 둘 다 아니면 "".
export function landingDetail(source) {
  return ipjuDetail(source) || hoodDetail(source);
}
// 접수함·전환 메모에 쓰는 희망 서비스 라벨 — 입주청소·주방후드 랜딩은 service_type 과 관계없이 고정 라벨.
export function inquiryServiceLabel(row) {
  if (row && isIpjuSource(row.source)) return "입주청소";
  if (row && isHoodSource(row.source)) return "주방후드";
  return serviceLabel(row && row.service_type);
}

// service_type 코드 → ServiceTypeIcon 의 workType (startsWith 매칭용).
//   "분해세척" → "세척" / "수리·누설수리" → "수리" 등으로 짧게 통일.
//   ⚠️ getServiceKind 의 _kindFromServiceCode 는 cleaning/refrigerant/install/leak 만 매핑 —
//      repair/unknown 갭 차단용 매핑 (사장님 spec A안).
export const SERVICE_WORKTYPE = {
  refrigerant: "냉매충전",
  cleaning:    "세척",
  repair:      "수리",
  // 2026-07-28 — 접수함→작업 전환 시 종목 프리필
  leak:        "누설",
  water_leak:  "누수",
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
  const { data, error } = await supabase.rpc("set_inquiry_status", {
    p_actor:       actorId,
    p_inquiry_id:  inquiryId,
    p_status:      status,
    p_spam_reason: status === "spam" ? (spamReason || null) : null,
  });
  if (error) throw error;
  // 2026-07-15 — RPC 가 jsonb {ok, rows_affected} 로 실패를 알리는데 클라가 안 봤음
  //   → 스팸 처리 실패해도 조용히 성공처럼 보이고 목록에 그대로 남는 버그 (사장님 발견).
  if (data && data.ok === false) {
    throw new Error(data.error || "상태 변경 실패");
  }
  if (data && (data.rows_affected ?? 1) === 0) {
    throw new Error("상태 변경 없음 — 이미 전환(converted)됐거나 삭제된 문의일 수 있어요");
  }
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

// 인콰이리 → 작업 생성 후 마킹.
//   Migration 118(convert_inquiry_to_task) 은 폐기됨 — 호출 금지.
//   대신: 운영자가 "새 접수 폼"을 prefill 로 채워 등록 → apiCreateTask 성공 후 이 함수 호출.
//   Mig 152 RPC 는 rows_affected 반환. UPDATE 대상 status IN ('new','contacted') 아니면 0.
// 2026-07-11 — 조용한 실패 방지 (사장님 spec):
//   · RPC 에러 → throw.
//   · RPC ok=false → throw (권한/유효성).
//   · rows_affected=0 → throw ('inquiry 상태 변경 없음' — 이미 converted / spam / 없음 등).
//   호출자가 명확히 catch 하여 UI 경고 표시.
export async function markInquiryConverted(actorId, inquiryId, taskId) {
  if (!actorId)   throw new Error("actorId required");
  if (!inquiryId) throw new Error("inquiryId required");
  if (!taskId)    throw new Error("taskId required");
  const { data, error } = await supabase.rpc("mark_inquiry_converted", {
    p_actor:      actorId,
    p_inquiry_id: inquiryId,
    p_task_id:    taskId,
  });
  if (error) throw error;
  if (data && data.ok === false) {
    throw new Error(`[mark_inquiry_converted] ${data.error || "unknown error"}`);
  }
  const affected = Number(data?.rows_affected ?? 0);
  if (affected === 0) {
    throw new Error("[mark_inquiry_converted] rows_affected=0 — inquiry 상태 변경 없음 (이미 converted / spam / 삭제됨 or tenant 불일치)");
  }
  return data;
}
