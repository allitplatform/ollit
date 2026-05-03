// ============================================
// PWA ↔ GAS/시트 모델 어댑터
// 위치: src/shared/taskAdapter.js
// 8-A-1: pwaToSheet 만 (createTask 결선용)
// 8-B 이후: sheetToPwa 추가 예정 (getTasks 결선용)
// ============================================

// 원청 이름 → 시트 코드 매핑
// 시트는 한글 이름(principal)을 그대로 받지만, 작업번호 발급/필터 등에서 코드도 쓰임
export const PRINCIPAL_CODE = {
  "올데이케어": "O",
  "쿨가이": "K",
  "용인컴퍼니": "Y",
  "유솔현금": "H",
  "유솔네이버": "N",
  "세스코": "C",
};

// PWA 폼/태스크 모델 → GAS createTask payload (시트 컬럼 모양)
// - 빈 값은 "" 또는 0/1/기본값으로 정규화
// - taskId 는 보내지 않음 (시트 측이 발급, 응답에서 받음)
// - receivedAt 도 미포함 (시트 측이 자동 채움)
export function pwaToSheet(task) {
  return {
    principal: task.client || "",
    channel: task.channel || "카톡",
    customer: task.customer || "",
    phone: task.phone || "",
    address: task.address || "",
    summary: task.workType || "",
    totalQty: task.qty || 1,
    requestNote: task.requestNote || "",
    requestedDate: task.requestedDate || "",
    requestedTime: task.requestedTime || "",
    estimateTotal: task.productPrice || 0,
    status: task.status || "약속대기",
  };
}
