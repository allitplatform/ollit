// 2026-10-07 — 작업 항목의 화면 이름 (금액 표 · 품목별 취소 창 · 견적 수정 팝업이 같은 규칙을 쓴다).
//   기종 → 설명(설치 5종: 이전설치 · 철거 …) → 작업 이름(종류 이름과 다를 때) → 종류 이름
//   kindName: 그 항목의 종류 이름 (예: "설치"). 작업 이름이 이것과 같으면 중복이라 쓰지 않는다.
export function workItemName(it, kindName = "") {
  if (!it) return kindName || "";
  const appliance = it.appliance || it.appliance_type || "";
  if (appliance && appliance !== "(공통)") return appliance;
  if (it.description) return it.description;
  const wt = String(it.workType || it.work_type || "").replace(/_\(공통\)$/, "");
  if (wt && wt !== kindName) return wt;
  return kindName || wt || "";
}
