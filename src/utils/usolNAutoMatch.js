// V11-1 — 유솔 정산 CSV 자동 분류
// 작업DB의 productOrderId 매칭으로 우리 작업/다른 회사/미매칭 분리.
import { findTaskByProductOrderId, updateTask } from "../data/tasks.js";
import { csvSettlementRowToTaskUpdate } from "../data/usolNSettlementCsv.js";

// 입력: csvRows (정산 CSV 파싱 결과 — 한국어 헤더 객체 배열)
// 출력: { matched, otherCompany, unmatched }
//
// matched      : 우리 작업DB에 productOrderId가 있는 행 → 정산 정보 업데이트 대상
// otherCompany : 작업DB에 없음 → 다른 회사 거 (자동 제외)
// unmatched    : 우리 거로 의심되나 작업DB에 없는 경우 (현재는 휴리스틱 X → 빈 배열)
export function autoMatchSettlementCsv(csvRows, tasksArg) {
  const matched      = [];
  const otherCompany = [];
  const unmatched    = [];

  (csvRows || []).forEach(row => {
    const productOrderId = row["상품주문번호"];
    if (!productOrderId) {
      otherCompany.push(row);
      return;
    }

    const task = findTaskByProductOrderId(productOrderId, tasksArg);
    if (task) {
      matched.push({ row, taskId: task.id, task });
    } else {
      // 현재 단계에서는 미식별 행 = 다른 회사로 분류 (자동 제외)
      // 추가 휴리스틱(우리 사업자번호 등)은 V11-2에서 컬럼 확인 후 적용
      otherCompany.push(row);
    }
  });

  return { matched, otherCompany, unmatched };
}

// 매칭 확정 — 매칭된 행을 작업DB에 업데이트
export function confirmMatching(matchedItems) {
  const updated = [];
  (matchedItems || []).forEach(item => {
    const patch = csvSettlementRowToTaskUpdate(item.row);
    const next  = updateTask(item.taskId, patch);
    if (next) updated.push(next);
  });
  return updated;
}
