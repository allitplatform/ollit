// Step 5-7-C — 운영 / 시뮬 모드 토글
// false: 운영 모드 (모든 mock SEED 빈 배열 / 시트 양방향 sync 데이터로만 동작)
// true:  시뮬 모드 (옛 SEED 데이터 / 시연 / 디자인 검증)
//
// 사용처 (단계별):
// - src/pages/AdminApp.jsx — ENGINEERS_DATA / TASKS_TODAY / ASSIGNED_TASKS / myMargin
// - src/shared/tasks.js — INITIAL_TASKS
// - src/data/seedTasks.js — USOL_N_SEED_TASKS
// - 다른 mock 영역 (운영 진입 시점에 추가 가능)
export const ENABLE_MOCK = false;
