// 2026-06-15 — 미정산(pending) task_items 의 회사 실수령(85%) 계산 헬퍼.
//
// 사장님 spec: 현황판 "안받음" 미정산분과 동일하게 통일.
//   task 단위로 그룹 → task_sub_sum 계산
//   유솔 몫 = FLOOR(task_sub_sum × 0.15)
//   item 단위 회사 실수령 = item.subtotal − round(유솔몫 × item.subtotal / task_sub_sum)
//   합산 = Σ task_sub_sum − FLOOR(task_sub_sum × 0.15)
//
// payments 정보 없이 동작 — task_items.subtotal 만 사용.
// (현황판 측은 RPC Mig 133 가 동일 산식으로 서버 측 계산.)

// task 단위 회사 실수령 (= subtotal − FLOOR(subtotal × 0.15))
export function calcTaskCompanyReceive(taskSubSum) {
  const v = Number(taskSubSum) || 0;
  if (v <= 0) return 0;
  return v - Math.floor(v * 0.15);
}

// items 배열 입력 → task 단위 그룹 → 회사 실수령 합 반환.
//   items 측 task_id / subtotal 필드 필요.
export function sumCompanyReceiveFromItems(items) {
  if (!Array.isArray(items) || items.length === 0) return 0;
  const taskSubByTask = new Map();
  for (const it of items) {
    const tid = it?.task_id;
    if (!tid) continue;
    const v = Number(it.subtotal) || 0;
    taskSubByTask.set(tid, (taskSubByTask.get(tid) || 0) + v);
  }
  let total = 0;
  for (const [, taskSub] of taskSubByTask) {
    total += calcTaskCompanyReceive(taskSub);
  }
  return total;
}

// 단일 item 의 회사 실수령 — task 분배 비율 적용.
//   itemsByTask: Map<task_id, items[]> (전체 task 의 active items)
//   taskSubByTask: Map<task_id, task_sub_sum>
export function calcItemCompanyReceiveDist(item, taskSubByTask) {
  if (!item) return 0;
  const sub = Number(item.subtotal) || 0;
  const taskSub = Number(taskSubByTask.get(item.task_id)) || 0;
  if (taskSub <= 0) return sub;
  const taskUsol = Math.floor(taskSub * 0.15);
  const distUsol = Math.round(taskUsol * (sub / taskSub));
  return sub - distUsol;
}

// item 단위 회사 실수령 합 (분배 적용).
//   sumCompanyReceiveFromItems 와 결과 동일 (반올림 누적 차이 미미).
export function sumCompanyReceiveByItemDist(items) {
  if (!Array.isArray(items) || items.length === 0) return 0;
  const taskSubByTask = new Map();
  for (const it of items) {
    if (!it?.task_id) continue;
    const v = Number(it.subtotal) || 0;
    taskSubByTask.set(it.task_id, (taskSubByTask.get(it.task_id) || 0) + v);
  }
  return items.reduce((s, it) => s + calcItemCompanyReceiveDist(it, taskSubByTask), 0);
}
