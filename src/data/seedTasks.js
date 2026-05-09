// V11-1 — 시드 (검증/시연용 유솔 N 작업 5건)
// AdminApp 시드와는 별도. V11-2에서 통합 예정.
// 케이스:
//   - 차지현 묶음 2건 (기본 + 실외기) — 같은 orderNumber, 다른 productOrderId
//   - 양상준 1건 (기본)
//   - 장승리 1건 (기본)
//   - 정민호 1건 (기본 / 13일+ 정산 대기)
import { makeEmptyTask } from "./tasks.js";
import { ENABLE_MOCK } from "../config/env.js";

// 오늘 기준 N일 전 ISO
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// Step 5-7-C — USOL_N_SEED_TASKS raw seed (운영 시 빈 배열로 export)
const _USOL_N_SEED_TASKS_RAW = [
  // 차지현 — 기본 (4way 1대)
  makeEmptyTask({
    id: "usol_n_seed_001",
    taskCode: "USN-260420-001",
    productOrderId: "20260420900100001",
    orderNumber:    "20260420900100",
    productName:    "에어컨청소 서울 인천 경기 (가정집/4way 천장형)",
    optionInfo:     "서비스 종류: 가정집 에어컨청소 / 구분: 4way",
    orderType:      "basic",
    workType:       "세척",
    appliance:      "4way",
    qty:            1,
    workItems:      [{ type: "4way", count: 1 }],
    customer:       "차지현",
    phone:          "010-1111-2222",
    address:        "서울 마포구 합정동 123-4",
    region:         "마포구",
    schedule:       "오늘 오후",
    time:           "14:00",
    grossAmount:    280000,
    npayFee:        -2543,
    salesLinkFee:   -1,
    netAmount:      277456,
    paidAt:         daysAgo(7),
    completedAt:    daysAgo(5),
    naverSettledAt: daysAgo(2),
    state:          "done",
    status:         "completed",
    principal:      "유솔홈케어 N",
    principalId:    "usol_n",
    importCsvType:  "usol_n_order",
    csvImportedAt:  daysAgo(8),
  }),

  // 차지현 — 실외기 추가
  makeEmptyTask({
    id: "usol_n_seed_002",
    taskCode: "USN-260420-002",
    productOrderId: "20260420900100002",
    orderNumber:    "20260420900100",
    productName:    "실외기",
    optionInfo:     "구분: 실외기 청소",
    orderType:      "extra",
    workType:       "세척",
    appliance:      "실외기",
    qty:            1,
    workItems:      [{ type: "실외기", count: 1 }],
    customer:       "차지현",
    phone:          "010-1111-2222",
    address:        "서울 마포구 합정동 123-4",
    region:         "마포구",
    schedule:       "오늘 오후",
    time:           "14:00",
    grossAmount:    50000,
    npayFee:        -454,
    salesLinkFee:   0,
    netAmount:      49546,
    paidAt:         daysAgo(7),
    completedAt:    daysAgo(5),
    naverSettledAt: daysAgo(2),
    state:          "done",
    status:         "completed",
    principal:      "유솔홈케어 N",
    principalId:    "usol_n",
    importCsvType:  "usol_n_order",
    csvImportedAt:  daysAgo(8),
  }),

  // 양상준 — 기본 (벽걸이 2대)
  makeEmptyTask({
    id: "usol_n_seed_003",
    taskCode: "USN-260422-003",
    productOrderId: "20260422900200001",
    orderNumber:    "20260422900200",
    productName:    "에어컨청소 서울 인천 경기 (가정집/벽걸이)",
    optionInfo:     "서비스 종류: 가정집 에어컨청소 / 구분: 벽걸이",
    orderType:      "basic",
    workType:       "세척",
    appliance:      "벽걸이",
    qty:            2,
    workItems:      [{ type: "벽걸이", count: 2 }],
    customer:       "양상준",
    phone:          "010-2222-3333",
    address:        "서울 강서구 화곡동 55-1",
    region:         "강서구",
    schedule:       "내일 오전",
    time:           "10:00",
    grossAmount:    160000,
    npayFee:        -1454,
    salesLinkFee:   0,
    netAmount:      158546,
    paidAt:         daysAgo(5),
    completedAt:    daysAgo(3),
    state:          "done",
    status:         "completed",
    principal:      "유솔홈케어 N",
    principalId:    "usol_n",
    importCsvType:  "usol_n_order",
    csvImportedAt:  daysAgo(6),
  }),

  // 장승리 — 기본 (스탠드 1대)
  makeEmptyTask({
    id: "usol_n_seed_004",
    taskCode: "USN-260424-004",
    productOrderId: "20260424900300001",
    orderNumber:    "20260424900300",
    productName:    "에어컨청소 서울 인천 경기 (가정집/스탠드)",
    optionInfo:     "서비스 종류: 가정집 에어컨청소 / 구분: 스탠드",
    orderType:      "basic",
    workType:       "세척",
    appliance:      "스탠드",
    qty:            1,
    workItems:      [{ type: "스탠드", count: 1 }],
    customer:       "장승리",
    phone:          "010-3333-4444",
    address:        "경기 성남시 분당구 정자동 88-2",
    region:         "성남시",
    schedule:       "이번 주",
    time:           "13:00",
    grossAmount:    60000,
    npayFee:        -545,
    salesLinkFee:   0,
    netAmount:      59455,
    paidAt:         daysAgo(3),
    completedAt:    daysAgo(1),
    state:          "done",
    status:         "completed",
    principal:      "유솔홈케어 N",
    principalId:    "usol_n",
    importCsvType:  "usol_n_order",
    csvImportedAt:  daysAgo(4),
  }),

  // 정민호 — 기본 (1way) / 13일+ 정산 대기 (경고 케이스)
  makeEmptyTask({
    id: "usol_n_seed_005",
    taskCode: "USN-260408-005",
    productOrderId: "20260408900400001",
    orderNumber:    "20260408900400",
    productName:    "에어컨청소 서울 인천 경기 (가정집/1way)",
    optionInfo:     "서비스 종류: 가정집 에어컨청소 / 구분: 1way",
    orderType:      "basic",
    workType:       "세척",
    appliance:      "1way",
    qty:            1,
    workItems:      [{ type: "1way", count: 1 }],
    customer:       "정민호",
    phone:          "010-4444-5555",
    address:        "인천 부평구 부평동 33-3",
    region:         "인천시",
    schedule:       "지난주",
    time:           "11:00",
    grossAmount:    50000,
    npayFee:        -454,
    salesLinkFee:   0,
    netAmount:      49546,
    paidAt:         daysAgo(20),
    completedAt:    daysAgo(15),   // 15일 전 완료 → 13일+ 대기
    naverSettledAt: null,           // 아직 정산 X (경고 대상)
    state:          "done",
    status:         "completed",
    principal:      "유솔홈케어 N",
    principalId:    "usol_n",
    importCsvType:  "usol_n_order",
    csvImportedAt:  daysAgo(21),
  }),
];

// Step 5-7-C — 운영 모드는 빈 배열 / 시뮬 모드는 raw seed
export const USOL_N_SEED_TASKS = ENABLE_MOCK ? _USOL_N_SEED_TASKS_RAW : [];

// 시드를 localStorage에 박는 헬퍼 (검증용 — UI 영향 X)
// 호출하면 src/data/tasks.js의 ollit_tasks_v1 키에 5건이 추가됩니다.
// 미호출 시 영향 X.
export function loadUsolNSeedToStorage() {
  if (typeof localStorage === "undefined") return false;
  try {
    const KEY = "ollit_tasks_v1";
    const existing = JSON.parse(localStorage.getItem(KEY) || "[]");
    // 중복 방지 (같은 id가 이미 있으면 추가 X)
    const existingIds = new Set(existing.map(t => t.id));
    const merged = [
      ...existing,
      ...USOL_N_SEED_TASKS.filter(t => !existingIds.has(t.id)),
    ];
    localStorage.setItem(KEY, JSON.stringify(merged));
    return true;
  } catch (e) {
    console.error("[seedTasks.loadUsolNSeedToStorage]", e);
    return false;
  }
}
