// 출장비 (visit_fee) 판별 + 표시 상수 — 운영자 PWA / 유솔 PWA 공용.
// 2026-06-09 작성.
//
// 사고 방지:
//   옛 분기 (PrincipalListTab / UsolNAssignList 측 각자 인라인) → 한쪽만 바뀌면 어긋남.
//   본 모듈 단일 진실 소스. 새 호출처는 본 import 만 사용.
//
// 판별 우선순위 (item):
//   1) service_types.code === 'visit_fee'         (강한 신호 — Mig 004 seed)
//   2) work_types.code   === 'visit'              (work_type 직접 코드)
//   3) work_types.name   === '출장비'              (텍스트 fallback)
//
// 데이터 shape 호환 (둘 다 지원):
//   nested (Supabase fetch): item.work_types.{ code, name, service_types.code }
//   flat   (rowToTask 결과): item.serviceCode / item.workType

// ── 상수 ──────────────────────────────────────────────
export const VISIT_FEE_SERVICE_CODE = "visit_fee";
export const VISIT_WORK_TYPE_CODE   = "visit";
export const VISIT_WORK_TYPE_NAME   = "출장비";
export const VISIT_TASK_STATUS      = "visit_only";

// 표시 상수 (taskStatus.js 의 visit_only 정의와 정합)
export const VISIT_ICON_EMOJI = "🚗";
export const VISIT_LABEL      = "출장비만";
export const VISIT_COLOR      = "#FF1B8D";   // taskStatus.js visit_only color

// ── 판별 ──────────────────────────────────────────────
// item 단위 — task_items[i] 또는 workItems[i] 가 출장비?
export function isVisitItem(item) {
  if (!item) return false;
  const svcCode = String(
    item.serviceCode
    || item.service_code
    || item.work_types?.service_types?.code
    || ""
  ).toLowerCase();
  if (svcCode === VISIT_FEE_SERVICE_CODE) return true;

  const wtCode = String(
    item.workTypeCode
    || item.work_type_code
    || item.work_types?.code
    || ""
  ).toLowerCase();
  if (wtCode === VISIT_WORK_TYPE_CODE) return true;

  const wtName = String(
    item.workType
    || item.work_type
    || item.work_types?.name
    || ""
  ).trim();
  if (wtName === VISIT_WORK_TYPE_NAME) return true;

  return false;
}

// task 단위 — task.status === 'visit_only' (전체 출장비만)
export function isPureVisitOnly(task) {
  return task?.status === VISIT_TASK_STATUS;
}

// task 단위 — 활성 items 중 visit 가 1건이라도 있는지 (혼합 task 포함)
export function hasAnyVisitItem(task) {
  if (!task) return false;
  if (isPureVisitOnly(task)) return true;
  const items = Array.isArray(task.workItems)  ? task.workItems
              : Array.isArray(task.task_items) ? task.task_items
              : [];
  return items.some(it => {
    if (it?.is_canceled === true) return false;
    return isVisitItem(it);
  });
}

// task 단위 — 활성 items 가 전부 visit (= pure) 인지
//   isPureVisitOnly 가 task.status 만 보지만 — status 가 다른 경우라도 모든 활성 item 이 visit 면 pure.
export function isAllItemsVisit(task) {
  if (!task) return false;
  if (isPureVisitOnly(task)) return true;
  const items = Array.isArray(task.workItems)  ? task.workItems
              : Array.isArray(task.task_items) ? task.task_items
              : [];
  const active = items.filter(it => it?.is_canceled !== true);
  if (active.length === 0) return false;
  return active.every(it => isVisitItem(it));
}
