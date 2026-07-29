// 2026-05-29 — 취소 표시용 한국어 라벨 (사장님 spec).
//   사용처:
//     · TaskRowOperator (UsolNAssignList.jsx) — 취소 리스트 row
//     · ChangeEntry (AdminTaskDetailScreen.jsx) — 변경 이력 카드 cancel 이벤트
//     · TaskChangesSection synthetic row — 옛 작업 fallback
//
//   RPC 저장 형식 (AdminApp.jsx:2589):
//     `${reasonId} · ${memo}` 또는 `${reasonId}` 단독 (memo 없을 때)
//     reasonId = CANCEL_REASONS (data/taskStatus.js) 측 id (customer/schedule/onsite/other)

import { CANCEL_REASONS, MISTAKE_REASON_ID } from "./taskStatus.js";

const _REASON_BY_ID = new Map(CANCEL_REASONS.map(r => [r.id, r.label]));

export { MISTAKE_REASON_ID };

// 원청 코드 → 한국 정식 라벨 (사장님 spec, 2026-05-29).
//   PRINCIPAL_CHIP_ORDER (allPrincipalTasksDb.js) 측 짧은 라벨과 다름 — 표시 정식 이름 별도 사전.
//
// 2026-06-19 정정: KA / KB 라벨이 서로 뒤바뀐 채로 들어가 있던 버그 수정.
//   data/principals.js 진실 소스: KA = 에어컨프로(aircon_pro), KB = 쿨가이(cool_son).
//   이전 매핑(KA="쿨가이" / KB="KB")은 변경이력 actor 표시에 오류 노출.
export const PRINCIPAL_LABELS_KR = {
  allday:  "올데이케어",
  KA:      "에어컨프로",
  KB:      "쿨가이",
  yongin:  "용인컴퍼니",
  usol_h:  "유솔홈케어",
  usol_n:  "유솔홈케어(N)",
  crikrin: "크리크린",
};

export function getPrincipalLabelKr(code) {
  if (!code) return null;
  return PRINCIPAL_LABELS_KR[code] || code;
}

// reason 텍스트 → 한국어 라벨.
//   `reasonId · memo` 분리 → reasonId 를 한국어로 매핑, memo 는 그대로.
//   reasonId 매핑 실패 시 원문 그대로 (자유 텍스트 안전).
export function getCancelReasonLabel(rawReason) {
  if (!rawReason) return null;
  const text = String(rawReason).trim();
  if (!text) return null;
  const parts = text.split(" · ");
  const id    = parts[0]?.trim() || "";
  const memo  = parts.slice(1).join(" · ").trim();
  const label = _REASON_BY_ID.get(id) || id;
  return memo ? `${label} · ${memo}` : label;
}

// ────────────────────────────────────────────────────────────────
// 2026-07-29 — 오접수(실수) 판정. 사장님 spec: 잘못 만든 접수는 통계에서 뺀다.
//
//   ⚠️ 저장 형식이 경로마다 다르다 (여기가 이 함수의 존재 이유):
//        · 운영자 취소 (AdminApp.jsx:8956 / AdminTaskDetailScreen.jsx CancelDialog)
//            → `${reasonId} · ${memo}`      ← 가운뎃점
//        · 기사 취소   (EngineerNewAssignDetailScreen.jsx:840)
//            → `${reasonId} — ${memo}`      ← em dash
//      getCancelReasonLabel() 은 " · " 만 쪼개므로 여기서 둘 다 처리한다.
//
//   되돌리기: 취소 정보 카드에서 사유를 바꾸면 즉시 통계에 다시 잡힌다.
//   ★ '진짜 삭제'가 아니다 — 행은 그대로 남는다.
// ────────────────────────────────────────────────────────────────
export function isMistakeCancelReason(rawReason) {
  if (!rawReason) return false;
  const text = String(rawReason).trim();
  if (!text) return false;
  // 앞머리(사유 id)만 떼어낸다. 구분자는 " · " 또는 " — " 둘 다 인정.
  const head = text.split(/\s+[·—]\s+/)[0].trim();
  if (head === MISTAKE_REASON_ID) return true;
  // 예전에 자유 텍스트로 "오접수 ..." 라고 적어둔 것도 같이 잡는다.
  return head.startsWith("오접수");
}

// task 객체 어디에 사유가 들어 있든 찾아서 판정 (필드명이 화면마다 다름).
export function isMistakeTask(task) {
  if (!task) return false;
  const raw = task.cancelReason
           || (task.categoryData  && task.categoryData.cancelReason)
           || (task.category_data && task.category_data.cancelReason)
           || "";
  return isMistakeCancelReason(raw);
}

// 짧은 버전 (리스트 row 12자 ellipsis 기본).
export function getCancelReasonShort(rawReason, maxLen = 12) {
  const full = getCancelReasonLabel(rawReason);
  if (!full) return null;
  return full.length > maxLen ? full.slice(0, maxLen) + "…" : full;
}

// 취소 actor → 이름 위주 라벨 (D2 spec: 역할 라벨 제거).
//   partner: 이름 / 없으면 원청 한국 라벨 / 둘 다 없으면 "—"
//   operator: 이름 / 없으면 "운영자"
//   engineer: 이름 / 없으면 "기사"
//   customer: "고객" (2026-06-07 — Mig 098 4번째 옵션)
//   그 외: 이름 / 없으면 "—"
export function getCancelActorLabel({ actor, name, principalCode }) {
  if (actor === "partner") {
    return name || getPrincipalLabelKr(principalCode) || "원청";
  }
  if (actor === "operator") {
    return name || "운영자";
  }
  if (actor === "engineer") {
    return name || "기사";
  }
  if (actor === "customer") {
    return "고객";
  }
  return name || "—";
}
