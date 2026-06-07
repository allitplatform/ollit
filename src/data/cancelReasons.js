// 2026-05-29 — 취소 표시용 한국어 라벨 (사장님 spec).
//   사용처:
//     · TaskRowOperator (UsolNAssignList.jsx) — 취소 리스트 row
//     · ChangeEntry (AdminTaskDetailScreen.jsx) — 변경 이력 카드 cancel 이벤트
//     · TaskChangesSection synthetic row — 옛 작업 fallback
//
//   RPC 저장 형식 (AdminApp.jsx:2589):
//     `${reasonId} · ${memo}` 또는 `${reasonId}` 단독 (memo 없을 때)
//     reasonId = CANCEL_REASONS (data/taskStatus.js) 측 id (customer/schedule/onsite/other)

import { CANCEL_REASONS } from "./taskStatus.js";

const _REASON_BY_ID = new Map(CANCEL_REASONS.map(r => [r.id, r.label]));

// 원청 코드 → 한국 정식 라벨 (사장님 spec, 2026-05-29).
//   PRINCIPAL_CHIP_ORDER (allPrincipalTasksDb.js) 측 짧은 라벨과 다름 — 표시 정식 이름 별도 사전.
export const PRINCIPAL_LABELS_KR = {
  allday:  "올데이케어",
  KA:      "쿨가이",
  KB:      "KB",
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
